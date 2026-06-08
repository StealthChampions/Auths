/**
 * Site Matching | 网站匹配
 *
 * Pure functions for parsing a site identity from a URL and matching it
 * against OTP entries. Safe to use in service workers (no DOM access).
 *
 * 用于从 URL 解析网站标识并与 OTP 条目匹配的纯函数。
 * 可在 Service Worker 中使用（无 DOM 依赖）。
 */

export type SiteName = [string | null, string | null, string | null];

/**
 * Parse site name tuple from URL and (optional) tab title.
 * Returns [normalizedTitle, nameFromDomain, hostname].
 */
export function parseSiteName(url?: string | null, title?: string | null): SiteName {
  const normalizedTitle = title
    ? title.replace(/[^a-z0-9]/gi, "").toLowerCase()
    : null;

  if (!url) {
    return [normalizedTitle, null, null];
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return [normalizedTitle, null, null];
  }

  let nameFromDomain = "";

  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    nameFromDomain = hostname;
  }

  if (hostname.indexOf(".") === -1) {
    nameFromDomain = hostname;
  }

  const hostLevelUnits = hostname.split(".");

  if (hostLevelUnits.length === 2) {
    nameFromDomain = hostLevelUnits[0];
  }

  if (hostLevelUnits.length > 2) {
    if (
      ["com", "net", "org", "edu", "gov", "co"].indexOf(
        hostLevelUnits[hostLevelUnits.length - 2]
      ) !== -1
    ) {
      nameFromDomain = hostLevelUnits[hostLevelUnits.length - 3];
    } else {
      nameFromDomain = hostLevelUnits[hostLevelUnits.length - 2];
    }
  }

  nameFromDomain = nameFromDomain.replace(/-/g, "").toLowerCase();

  return [normalizedTitle, nameFromDomain, hostname];
}

/**
 * Check whether a single entry matches the parsed site name.
 *
 * Goals: avoid false positives such as
 *   - empty `issuer` matching every site (because `"google".indexOf("") === 0`)
 *   - reverse substring matches on short issuers (e.g. issuer "Co" matching "google.com")
 *   - matching an account email merely because it shares letters with the host
 */
export function isMatchedEntry(
  siteName: SiteName,
  entry: { issuer?: string; account?: string }
): boolean {
  const siteTitle = (siteName[0] || "").toLowerCase();
  const siteNameFromHost = (siteName[1] || "").toLowerCase();
  const siteHost = (siteName[2] || "").toLowerCase();

  const issuer = (entry.issuer || "").toLowerCase().trim();
  const account = (entry.account || "").toLowerCase().trim();

  // Empty issuer never matches — undermatching is better than overmatching.
  // 空 issuer 永远不匹配，宁缺勿滥。
  if (!issuer) return false;

  // 1. Strict "issuer::host" directive — explicit user override.
  if (issuer.includes("::")) {
    const parts = issuer.split("::");
    if (parts.length > 1) {
      const domainPart = parts[1].trim();
      if (domainPart && siteHost.indexOf(domainPart) !== -1) {
        return true;
      }
    }
  }

  const issuerClean = issuer.replace(/[^0-9a-z]/gi, "");
  if (!issuerClean) return false;

  // 2. Issuer matches the registered domain name segment.
  //    e.g. issuer "Google" on google.com / accounts.google.com → match
  //    Allow "Google Workspace" → contains "google" only when issuer is the
  //    longer side (avoid short-issuer false positives like "Co" → ".com").
  if (siteNameFromHost) {
    if (issuerClean === siteNameFromHost) return true;
    if (
      siteNameFromHost.length >= 3 &&
      issuerClean.length > siteNameFromHost.length &&
      issuerClean.indexOf(siteNameFromHost) !== -1
    ) {
      return true;
    }
  }

  // 3. Account is an email whose domain matches the current site.
  //    user@google.com on accounts.google.com → match
  //    user@gmail.com on github.com           → no match
  if (account && siteHost) {
    const at = account.lastIndexOf("@");
    if (at !== -1) {
      const emailHost = account.slice(at + 1).trim();
      if (
        emailHost &&
        (siteHost === emailHost ||
          siteHost.endsWith("." + emailHost) ||
          emailHost.endsWith("." + siteHost))
      ) {
        return true;
      }
    }
  }

  // 4. Site title contains issuer — require issuer ≥ 3 chars to avoid noise.
  if (siteTitle && issuerClean.length >= 3 && siteTitle.indexOf(issuerClean) !== -1) {
    return true;
  }

  // 5. Issuer matches a host label exactly (handles subdomains).
  //    issuer "Gemini" on gemini.google.com → match
  //    issuer "Google" on accounts.google.com → match
  //    issuer "Oracle" on gemini.google.com → no match
  if (siteHost && issuerClean.length >= 3) {
    for (const label of siteHost.split(".")) {
      if (label === issuerClean) return true;
    }
  }

  return false;
}

/**
 * Count entries matching the parsed site name. Entries whose secret is null
 * (locked / encrypted) are still counted — caller decides what to do.
 */
export function countMatchedEntries(
  siteName: SiteName,
  entries: Array<{ issuer?: string; account?: string }>
): number {
  if (!siteName[1] && !siteName[2]) return 0;
  let count = 0;
  for (const entry of entries) {
    if (isMatchedEntry(siteName, entry)) count++;
  }
  return count;
}
