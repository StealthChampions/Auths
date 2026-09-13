/**
 * Time Sync Module | 时间同步模块
 *
 * Synchronizes local time with remote servers to ensure accurate OTP generation.
 * Tries multiple endpoints in order so the sync still works in regions where
 * one provider is unreachable (e.g. mainland China, where Google is blocked).
 *
 * 与远程服务器同步本地时间，确保 OTP 生成准确。
 * 按优先级依次尝试多个端点，以便在某一提供方不可达的地区
 * （例如中国大陆屏蔽 Google）依然能完成同步。
 */

import { UserSettings } from "./settings";

/**
 * Endpoints tried in order. Each one returns a `Date` HTTP response header
 * on a successful response, which we parse as the server time. They were
 * chosen to cover different network reachability profiles:
 *
 *   - generate_204: Google captive-portal probe, globally reachable except
 *     in regions that block Google entirely.
 *   - ncsi.txt: Microsoft Network Connectivity Status Indicator, widely
 *     reachable behind corporate firewalls; returns plain text body.
 *   - library/test/success.html: Apple captive-portal probe.
 *   - cdn-cgi/trace: Cloudflare edge probe, returns `ts=<unix-seconds>` in
 *     the body; we also read the `Date` header as a fallback.
 *
 * 按顺序尝试的端点。每个端点在响应成功时都携带 `Date` 响应头，
 * 我们用它解析服务器时间。选择这些端点是为了覆盖不同的网络可达性：
 *
 *   - generate_204：Google 强制门户探测，除完全屏蔽 Google 的地区外
 *     全球可达。
 *   - ncsi.txt：微软网络连接状态指示，企业防火墙环境通常可达；
 *     返回纯文本响应体。
 *   - library/test/success.html：Apple 强制门户探测。
 *   - cdn-cgi/trace：Cloudflare 边缘探测，响应体内含 `ts=<unix 秒数>`；
 *     我们也读取 `Date` 头作为兜底。
 */
const TIME_SYNC_ENDPOINTS = [
  "https://www.google.com/generate_204",
  "https://www.msftncsi.com/ncsi.txt",
  "https://www.apple.com/library/test/success.html",
  "https://www.cloudflare.com/cdn-cgi/trace",
];

/**
 * Maximum clock drift accepted, in seconds. Larger values indicate the
 * device's clock is too far off to be safely corrected silently — the user
 * should fix it manually.
 *
 * 允许的最大时钟偏移（秒）。超过此值视为设备时钟偏差过大，
 * 不自动修正——提示用户手动校准。
 */
const MAX_DRIFT_SECONDS = 300;

/**
 * Total budget across all endpoint attempts (HEAD probe per endpoint +
 * network round trip). Each individual probe is capped below.
 *
 * 整个同步流程的总超时预算（每个端点 HEAD 探测 + 网络往返）。
 * 单次探测单独有更短的超时限制。
 */
const PER_REQUEST_TIMEOUT_MS = 5000;

/**
 * Issue a HEAD request to `url` and return the server's `Date` header as a
 * Unix timestamp in milliseconds, or `null` on any failure (network error,
 * timeout, missing header, malformed value).
 *
 * 对 `url` 发起 HEAD 请求，把服务端 `Date` 响应头解析为 Unix 毫秒时间戳。
 * 任意失败（网络错误、超时、响应头缺失、格式非法）均返回 `null`。
 */
function probeDateHeader(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      try {
        xhr.abort();
      } catch {
        // already aborted | 已经中止
      }
      clearTimeout(timer);
      resolve(value);
    };

    let xhr: XMLHttpRequest;
    try {
      xhr = new XMLHttpRequest();
    } catch {
      return resolve(null);
    }

    const timer = setTimeout(() => finish(null), PER_REQUEST_TIMEOUT_MS);

    try {
      xhr.open("HEAD", url);
    } catch {
      return finish(null);
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      const date = xhr.getResponseHeader("date");
      if (!date) {
        return finish(null);
      }
      const ms = new Date(date).getTime();
      if (!Number.isFinite(ms)) {
        return finish(null);
      }
      finish(ms);
    };

    // Network-level failures (DNS, TCP, TLS, CORS preflight reject, …)
    // surface through `error` rather than `readystatechange`.
    // 网络层失败（DNS / TCP / TLS / CORS 预检拒绝等）通过 `error` 事件触发，
    // 不会进入 `readystatechange`。
    xhr.onerror = () => finish(null);

    try {
      xhr.send();
    } catch {
      finish(null);
    }
  });
}

/**
 * Sync local clock offset with a remote server.
 *
 * Tries each endpoint in `TIME_SYNC_ENDPOINTS` until one returns a usable
 * `Date` header. The first successful probe is used to compute the offset
 * between local time and server time, which is then stored via
 * `UserSettings.offset` so subsequent OTP generations can correct for it.
 *
 * Returns:
 *   - `'updateSuccess'`     — offset stored (drift within MAX_DRIFT_SECONDS).
 *   - `'clock_too_far_off'` — drift exceeded the accepted threshold; the
 *                             user must fix their system clock manually.
 *   - `'updateFailure'`     — every endpoint failed; user can retry later.
 *
 * 与远程服务器同步本地时钟偏移。
 *
 * 按顺序尝试 `TIME_SYNC_ENDPOINTS` 中的每个端点，直至返回可用的 `Date`
 * 响应头。第一个成功的探测用于计算本地与服务器时间之差，并写入
 * `UserSettings.offset`，供后续 OTP 生成时进行补偿。
 *
 * 返回值：
 *   - `'updateSuccess'`     — 偏移已保存（漂移在 MAX_DRIFT_SECONDS 内）。
 *   - `'clock_too_far_off'` — 漂移超过允许阈值，需用户手动校准系统时钟。
 *   - `'updateFailure'`     — 所有端点都失败，用户可稍后重试。
 */
export async function syncTimeWithGoogle(): Promise<
  "updateSuccess" | "updateFailure" | "clock_too_far_off"
> {
  await UserSettings.updateItems();

  for (const url of TIME_SYNC_ENDPOINTS) {
    const serverTimeMs = await probeDateHeader(url);
    if (serverTimeMs === null) {
      // Try the next endpoint.
      // 继续尝试下一个端点。
      continue;
    }

    const clientTimeMs = Date.now();
    const offsetSeconds = Math.round((serverTimeMs - clientTimeMs) / 1000);

    if (Math.abs(offsetSeconds) > MAX_DRIFT_SECONDS) {
      return "clock_too_far_off";
    }

    UserSettings.items.offset = offsetSeconds;
    UserSettings.commitItems();
    return "updateSuccess";
  }

  return "updateFailure";
}