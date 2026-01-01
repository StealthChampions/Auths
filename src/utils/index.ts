/**
 * Utility Functions | 工具函数
 *
 * Common utility functions for site matching and tab operations.
 * 用于网站匹配和标签页操作的通用工具函数。
 */

/**
 * Get current site name from tab | 从标签页获取当前网站名称
 * @returns [title, nameFromDomain, hostname]
 */
export async function getSiteName() {
  const tab = await getCurrentTab();
  const query = new URLSearchParams(document.location.search.substring(1));

  let title: string | null;
  let url: string | null;
  const titleFromQuery = query.get("title");
  const urlFromQuery = query.get("url");

  if (titleFromQuery && urlFromQuery) {
    title = decodeURIComponent(titleFromQuery);
    url = decodeURIComponent(urlFromQuery);
  } else {
    if (!tab) {
      return [null, null];
    }

    title = tab.title?.replace(/[^a-z0-9]/gi, "").toLowerCase() ?? null;
    url = tab.url ?? null;
  }

  if (!url) {
    return [title, null];
  }

  const urlParser = new URL(url);
  const hostname = urlParser.hostname; // it's always lower case

  // try to parse name from hostname
  // i.e. hostname is www.example.com
  // name should be example
  let nameFromDomain = "";

  // ip address
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    nameFromDomain = hostname;
  }

  // local network
  if (hostname.indexOf(".") === -1) {
    nameFromDomain = hostname;
  }

  const hostLevelUnits = hostname.split(".");

  if (hostLevelUnits.length === 2) {
    nameFromDomain = hostLevelUnits[0];
  }

  // www.example.com
  // example.com.cn
  if (hostLevelUnits.length > 2) {
    // example.com.cn
    if (
      ["com", "net", "org", "edu", "gov", "co"].indexOf(
        hostLevelUnits[hostLevelUnits.length - 2]
      ) !== -1
    ) {
      nameFromDomain = hostLevelUnits[hostLevelUnits.length - 3];
    } else {
      // www.example.com
      nameFromDomain = hostLevelUnits[hostLevelUnits.length - 2];
    }
  }

  nameFromDomain = nameFromDomain.replace(/-/g, "").toLowerCase();

  return [title, nameFromDomain, hostname];
}

/**
 * Get matched entries by site name | 根据网站名称获取匹配的条目
 */
export function getMatchedEntries(
  siteName: Array<string | null>,
  entries: OTPEntryInterface[]
) {
  if (siteName.length < 2) {
    return false;
  }

  const matched = [];

  for (const entry of entries) {
    if (isMatchedEntry(siteName, entry)) {
      matched.push(entry);
    }
  }

  return matched;
}

/**
 * Get matched entries hash array | 获取匹配条目的哈希数组
 */
export function getMatchedEntriesHash(
  siteName: Array<string | null>,
  entries: OTPEntryInterface[]
) {
  const matchedEnteries = getMatchedEntries(siteName, entries);
  if (matchedEnteries) {
    return matchedEnteries.map((entry) => entry.hash);
  }

  return false;
}

/**
 * Check if entry matches site | 检查条目是否匹配网站
 */
function isMatchedEntry(
  siteName: Array<string | null>,
  entry: OTPEntryInterface
) {
  const siteTitle = (siteName[0] || "").toLowerCase();
  const siteNameFromHost = (siteName[1] || "").toLowerCase();
  const siteHost = (siteName[2] || "").toLowerCase();

  const issuerRaw = entry.issuer || "";
  const accountRaw = entry.account || "";

  const issuer = issuerRaw.toLowerCase();
  const account = accountRaw.toLowerCase();

  // 1. Check strict issuer::host format if present
  if (issuer.includes("::")) {
    const parts = issuer.split("::");
    if (parts.length > 1) {
      const domainPart = parts[1].trim();
      if (domainPart && siteHost.indexOf(domainPart) !== -1) {
        return true;
      }
    }
  }

  // 2. Check if domain name matches Issuer (bidirectional) or Account
  if (siteNameFromHost) {
    // Domain matches Issuer?
    // e.g. Domain: "google", Issuer: "Google Services" -> match
    // e.g. Domain: "github", Issuer: "GitHub" -> match
    if (issuer.indexOf(siteNameFromHost) !== -1 || siteNameFromHost.indexOf(issuer) !== -1) {
      return true;
    }

    // Domain matches Account? (e.g. user@google.com matches google)
    if (account.indexOf(siteNameFromHost) !== -1) {
      return true;
    }
  }

  // 3. Keep existing logic: Check if Page Title contains Issuer
  // e.g. Title: "GitHub - Where the world builds software", Issuer: "GitHub"
  if (siteTitle && issuer && siteTitle.indexOf(issuer) !== -1) {
    return true;
  }

  // 4. Fallback: Check if Host contains Issuer (cleaned)
  // e.g. Host: "accounts.google.com", Issuer: "Google"
  const issuerClean = issuer.replace(/[^0-9a-z]/gi, "");
  if (siteHost && issuerClean && siteHost.indexOf(issuerClean) !== -1) {
    return true;
  }

  return false;
}

/**
 * Get current active tab | 获取当前活动标签页
 */
export async function getCurrentTab() {
  const currentWindow = await chrome.windows.getCurrent();
  const queryOptions = { active: true, windowId: currentWindow.id };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}


