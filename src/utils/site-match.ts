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
 */
export function isMatchedEntry(
  siteName: SiteName,
  entry: { issuer?: string; account?: string }
): boolean {
  const siteTitle = (siteName[0] || "").toLowerCase();
  const siteNameFromHost = (siteName[1] || "").toLowerCase();
  const siteHost = (siteName[2] || "").toLowerCase();

  const issuer = (entry.issuer || "").toLowerCase();
  const account = (entry.account || "").toLowerCase();

  if (issuer.includes("::")) {
    const parts = issuer.split("::");
    if (parts.length > 1) {
      const domainPart = parts[1].trim();
      if (domainPart && siteHost.indexOf(domainPart) !== -1) {
        return true;
      }
    }
  }

  if (siteNameFromHost) {
    if (
      issuer.indexOf(siteNameFromHost) !== -1 ||
      siteNameFromHost.indexOf(issuer) !== -1
    ) {
      return true;
    }
    if (account.indexOf(siteNameFromHost) !== -1) {
      return true;
    }
  }

  if (siteTitle && issuer && siteTitle.indexOf(issuer) !== -1) {
    return true;
  }

  const issuerClean = issuer.replace(/[^0-9a-z]/gi, "");
  if (siteHost && issuerClean && siteHost.indexOf(issuerClean) !== -1) {
    return true;
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
