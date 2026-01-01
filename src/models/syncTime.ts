/**
 * Time Sync Module | 时间同步模块
 *
 * Synchronizes local time with Google servers to ensure accurate OTP generation.
 * Calculates and stores time offset for devices with incorrect system time.
 *
 * 与 Google 服务器同步本地时间，确保 OTP 生成准确。
 * 为系统时间不准确的设备计算并存储时间偏移量。
 */

import { UserSettings } from "./settings";

/**
 * Sync time with Google servers | 与 Google 服务器同步时间
 * @returns Promise with result: 'updateSuccess', 'updateFailure', or 'clock_too_far_off'
 */
export async function syncTimeWithGoogle() {
  await UserSettings.updateItems();

  return new Promise(
    (resolve: (value: string) => void, reject: (reason: Error) => void) => {
      try {
        // @ts-expect-error - these typings are wrong
        const xhr = new XMLHttpRequest({ mozAnon: true });
        xhr.open("HEAD", "https://www.google.com/generate_204");
        const xhrAbort = setTimeout(() => {
          xhr.abort();
          return resolve("updateFailure");
        }, 5000);
        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            clearTimeout(xhrAbort);
            const date = xhr.getResponseHeader("date");
            if (!date) {
              return resolve("updateFailure");
            }
            const serverTime = new Date(date).getTime();
            const clientTime = new Date().getTime();
            const offset = Math.round((serverTime - clientTime) / 1000);

            // Check if within 5 minutes | 检查是否在5分钟内
            if (Math.abs(offset) <= 300) {
              UserSettings.items.offset = Math.round(
                (serverTime - clientTime) / 1000
              );
              UserSettings.commitItems();
              return resolve("updateSuccess");
            } else {
              return resolve("clock_too_far_off");
            }
          }
        };
        xhr.send();
      } catch (error) {
        return reject(error as Error);
      }
    }
  );
}
