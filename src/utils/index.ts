/**
 * Utility Functions | 工具函数
 *
 * Common utility functions for site matching and tab operations.
 * 用于网站匹配和标签页操作的通用工具函数。
 */

import { parseSiteName, isMatchedEntry, type SiteName } from './site-match';

/**
 * Get current site name from tab | 从标签页获取当前网站名称
 * @returns [title, nameFromDomain, hostname]
 */
export async function getSiteName(): Promise<SiteName> {
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
      return [null, null, null];
    }
    title = tab.title ?? null;
    url = tab.url ?? null;
  }

  return parseSiteName(url, title);
}

/**
 * Get matched entries by site name | 根据网站名称获取匹配的条目
 */
export function getMatchedEntries(
  siteName: SiteName,
  entries: OTPEntryInterface[]
) {
  if (!siteName[1] && !siteName[2]) {
    return false;
  }

  const matched: OTPEntryInterface[] = [];

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
  siteName: SiteName,
  entries: OTPEntryInterface[]
) {
  const matchedEnteries = getMatchedEntries(siteName, entries);
  if (matchedEnteries) {
    return matchedEnteries.map((entry) => entry.hash);
  }

  return false;
}

/**
 * Get current active tab | 获取当前活动标签页
 */
export async function getCurrentTab() {
  const currentWindow = await chrome.windows.getCurrent();
  const queryOptions = { active: true, windowId: currentWindow.id };
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}
