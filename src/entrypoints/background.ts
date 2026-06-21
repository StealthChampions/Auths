/**
 * Background Service Worker | 后台服务脚本
 *
 * Handles extension lifecycle events, keyboard commands, and message communication.
 * Provides screen capture, QR code parsing, and account storage functionality.
 *
 * 处理扩展生命周期事件、键盘命令和消息通信。
 * 提供屏幕截图、二维码解析和账户存储功能。
 */

import { parseSiteName, countMatchedEntries } from '@/utils/site-match';
import { dedupeAccountsBySecret, generateEntryHash, hasDuplicateSecret } from '@/utils/accounts';
import { decryptWebDAVPassword, loadWebDAVConfig } from '@/utils/webdav-credentials';
import { cleanupExpiredWebDAVBackups, downloadWebDAVBackup, getLatestWebDAVBackup, uploadWebDAVBackup } from '@/utils/webdav-sync';
import { addLocalizedSyncLog } from '@/utils/sync-logger';
import { debugError, debugLog } from '@/utils/logger';

type LocaleMessages = Record<string, { message: string; description?: string }>;

export default defineBackground(() => {
  const localeCache: Record<string, LocaleMessages> = {};

  async function loadLocaleMessages(locale: string): Promise<LocaleMessages> {
    if (localeCache[locale]) return localeCache[locale];

    try {
      const response = await fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`));
      const messages = await response.json();
      localeCache[locale] = messages;
      return messages;
    } catch {
      return {};
    }
  }

  // Get user's language preference from storage
  // 从存储中获取用户的语言偏好
  async function getUserLanguage(): Promise<string> {
    try {
      const [localResult, syncResult] = await Promise.all([
        chrome.storage.local.get('UserSettings'),
        chrome.storage.sync.get('UserSettings').catch(() => ({ UserSettings: {} })),
      ]);
      const settings = {
        ...(syncResult.UserSettings || {}),
        ...(localResult.UserSettings || {}),
      };
      const lang = settings.language || 'system';
      if (lang === 'system') {
        // Use browser language | 使用浏览器语言
        const browserLang = chrome.i18n.getUILanguage();
        return browserLang.startsWith('zh') ? 'zh_CN' : 'en';
      }
      return lang;
    } catch {
      return 'zh_CN'; // Default to Chinese | 默认中文
    }
  }

  // Get localized message
  // 获取本地化消息
  async function getMessage(key: string, substitutions?: string | string[]): Promise<string> {
    const lang = await getUserLanguage();
    const messages = await loadLocaleMessages(lang);
    const fallbackMessages = lang === 'en' ? {} : await loadLocaleMessages('en');
    const entry = messages[key] || fallbackMessages[key];
    if (!entry?.message) return key;

    let message = entry.message;
    if (substitutions) {
      const values = Array.isArray(substitutions) ? substitutions : [substitutions];
      values.forEach((value, index) => {
        message = message.replace(`$${index + 1}`, value);
      });
    }

    return message;
  }

  // Handle extension installation
  // 处理扩展安装事件
  chrome.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
    if (details.reason === 'install') {
      // Extension installed | 扩展已安装
    } else if (details.reason === 'update') {
      // Extension updated | 扩展已更新
    }
  });

  // Handle auto backup alarm | 处理自动备份定时器
  const handleAutoBackupAlarm = async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name === 'autoBackup') {
      debugLog('[Auths Background] Auto backup alarm triggered');

      try {
        // Get WebDAV config | 获取 WebDAV 配置
        const config = await loadWebDAVConfig();
        const password = await decryptWebDAVPassword(config);

        if (!config || !config.serverUrl || !config.username || !password) {
          debugLog('[Auths Background] WebDAV not configured, skipping auto backup');
          return;
        }
        // Get entries and timestamps | 获取账户数据和时间戳
        const entriesResult = await chrome.storage.local.get(['entries', 'entriesLastModified']);
        const entries = entriesResult.entries || [];
        const localTimestamp = entriesResult.entriesLastModified || 0;

        if (entries.length === 0) {
          debugLog('[Auths Background] No entries to backup');
          return;
        }

        // Get remote latest backup timestamp | 获取远程最新备份时间戳
        const latestRemote = await getLatestWebDAVBackup(config.serverUrl, config.username, password);
        const remoteTimestamp = latestRemote?.timestamp || 0;
        const remoteFilename = latestRemote?.name || '';

        // Sync decision based on timestamps | 基于时间戳的同步决策
        if (remoteTimestamp > localTimestamp && remoteFilename) {
          // Remote is newer, download | 远程更新，下载
          debugLog('[Auths Background] Remote is newer, downloading...');
          await addLocalizedSyncLog('INFO', 'AUTO_BACKUP_TRIGGER', {
            messageKey: 'sync_downloading',
            detailsKey: 'log_details_file',
            detailsArgs: [remoteFilename]
          });

          const backupData = await downloadWebDAVBackup<OTPEntryInterface>(config.serverUrl, config.username, password, remoteFilename);
          const allAccounts = [...entries, ...backupData.accounts];
          const {
            accounts: deduplicatedAccounts,
            removedDuplicates,
          } = dedupeAccountsBySecret(allAccounts, { duplicatePreference: 'last' });

          const importCount = deduplicatedAccounts.length - entries.length;

          await chrome.storage.local.set({ entries: deduplicatedAccounts, entriesLastModified: Date.now(), lastSyncedTimestamp: Date.now() });
          await addLocalizedSyncLog('INFO', 'BACKUP_SUCCESS', {
            messageKey: 'log_auto_sync_download_success',
            detailsKey: 'log_details_added_deduped',
            detailsArgs: [String(importCount), String(removedDuplicates)]
          });
        } else if (localTimestamp > remoteTimestamp) {
          // Local is newer, upload | 本地更新，上传
          debugLog('[Auths Background] Local is newer, uploading...');
          await addLocalizedSyncLog('INFO', 'AUTO_BACKUP_TRIGGER', {
            messageKey: 'sync_uploading',
            detailsFallback: config.serverUrl
          });

          // Deduplicate before upload | 上传前去重
          const { accounts: deduplicatedEntries } = dedupeAccountsBySecret(entries);

          // Update local if duplicates were removed | 如果有重复被移除则更新本地
          if (deduplicatedEntries.length < entries.length) {
            await chrome.storage.local.set({ entries: deduplicatedEntries, entriesLastModified: Date.now() });
            await addLocalizedSyncLog('INFO', 'AUTO_BACKUP_TRIGGER', {
              messageKey: 'log_pre_upload_dedupe',
              detailsKey: 'log_details_removed_duplicates',
              detailsArgs: [String(entries.length - deduplicatedEntries.length)]
            });
          }

          const filename = await uploadWebDAVBackup(config.serverUrl, config.username, password, deduplicatedEntries);
          await chrome.storage.local.set({ lastSyncedTimestamp: Date.now() });
          await addLocalizedSyncLog('INFO', 'BACKUP_SUCCESS', {
            messageKey: 'log_auto_backup_upload_success',
            detailsKey: 'log_details_file',
            detailsArgs: [filename]
          });

        } else {
          // Already up to date | 已是最新
          debugLog('[Auths Background] Already up to date');
          await addLocalizedSyncLog('INFO', 'AUTO_BACKUP_TRIGGER', {
            messageKey: 'log_auto_backup_skipped',
            detailsKey: 'log_details_local_remote_up_to_date'
          });
          await chrome.storage.local.set({ lastSyncedTimestamp: Date.now() });
        }

        try {
          const cleanup = await cleanupExpiredWebDAVBackups(config.serverUrl, config.username, password, Number(config.retentionDays ?? 30));
          if (!cleanup.skipped && (cleanup.deleted.length > 0 || cleanup.failed.length > 0)) {
            await addLocalizedSyncLog(cleanup.failed.length > 0 ? 'WARN' : 'INFO', 'BACKUP_SUCCESS', {
              messageKey: 'retention_cleanup_done',
              detailsKey: 'log_details_retention_cleanup',
              detailsArgs: [String(cleanup.deleted.length), String(cleanup.failed.length)]
            });
          }
        } catch (cleanupError) {
          await addLocalizedSyncLog('WARN', 'BACKUP_SUCCESS', {
            messageKey: 'retention_cleanup_failed',
            detailsFallback: cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
          });
        }

        debugLog('[Auths Background] Auto sync completed');
      } catch (error) {
        debugError('[Auths Background] Auto backup error:', error);

        await addLocalizedSyncLog('ERROR', 'BACKUP_FAILED', {
          messageKey: 'log_auto_backup_failed',
          detailsFallback: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  };

  let autoBackupAlarmListenerRegistered = false;

  function registerAutoBackupAlarmListener() {
    if (autoBackupAlarmListenerRegistered || !chrome.alarms?.onAlarm) return;
    chrome.alarms.onAlarm.addListener(handleAutoBackupAlarm);
    autoBackupAlarmListenerRegistered = true;
  }

  registerAutoBackupAlarmListener();

  if (chrome.permissions.onAdded) {
    chrome.permissions.onAdded.addListener((perms) => {
      if (perms.permissions?.includes('alarms')) {
        registerAutoBackupAlarmListener();
      }
    });
  }

  // Handle commands
  // 处理快捷键命令
  chrome.commands.onCommand.addListener((command: string) => {
    if (command === 'scan-qr') {
      // Handle QR scan command | 处理扫描二维码命令
    } else if (command === 'autofill') {
      // Handle autofill command | 处理自动填充命令
    }
  });

  // ==== Site-match badge ====
  // 当切换/加载标签页时，统计已存储账户中能匹配当前网址的数量并显示为角标
  // Count entries that match the active tab's URL and display as a toolbar badge.
  // 依赖可选 "tabs" 权限以读取 tab.url / tab.title。
  // Requires the optional "tabs" permission to read tab.url / tab.title.

  const BADGE_BG = '#2563eb';
  const BADGE_FG = '#ffffff';

  async function hasTabsPermission(): Promise<boolean> {
    try {
      return await chrome.permissions.contains({ permissions: ['tabs'] });
    } catch {
      return false;
    }
  }

  async function setBadgeForTab(tabId: number, count: number) {
    try {
      const text = count > 0 ? String(count) : '';
      await chrome.action.setBadgeText({ tabId, text });
      if (count > 0) {
        await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_BG });
        if (chrome.action.setBadgeTextColor) {
          await chrome.action.setBadgeTextColor({ tabId, color: BADGE_FG });
        }
      }
    } catch {
      // tab may have been closed | 标签页可能已被关闭
    }
  }

  async function updateBadgeForTab(tab: chrome.tabs.Tab) {
    if (!tab.id) return;

    // Skip non-http(s) pages | 跳过非 http(s) 页面
    const url = tab.url || tab.pendingUrl || '';
    if (!/^https?:\/\//i.test(url)) {
      await setBadgeForTab(tab.id, 0);
      return;
    }

    const { entries } = await chrome.storage.local.get(['entries']);
    if (!Array.isArray(entries) || entries.length === 0) {
      await setBadgeForTab(tab.id, 0);
      return;
    }

    // Treat entries with no secret (locked / encrypted) as not visible — when
    // every matched entry is locked, show no badge so we don't leak counts.
    // 已加密的条目（secret 为 null）视为已锁定，全部锁定时不显示角标。
    const visibleEntries = (entries as OTPEntryInterface[]).filter((entry) => entry.secret);
    if (visibleEntries.length === 0) {
      await setBadgeForTab(tab.id, 0);
      return;
    }

    const siteName = parseSiteName(url, tab.title);
    const count = countMatchedEntries(siteName, visibleEntries);
    await setBadgeForTab(tab.id, count);
  }

  async function updateBadgeForActiveTab() {
    if (!(await hasTabsPermission())) return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab) await updateBadgeForTab(tab);
    } catch {
      // ignore
    }
  }

  async function clearAllBadges() {
    try {
      await chrome.action.setBadgeText({ text: '' });
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id !== undefined) {
          await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
        }
      }
    } catch {
      // chrome.tabs.query may itself require permission; the global clear above
      // is enough as a fallback.
    }
  }

  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    if (!(await hasTabsPermission())) return;
    try {
      const tab = await chrome.tabs.get(tabId);
      await updateBadgeForTab(tab);
    } catch {
      // ignore
    }
  });

  chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
    if (!tab.active) return;
    if (!(await hasTabsPermission())) return;
    if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') {
      updateBadgeForTab(tab);
    }
  });

  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    updateBadgeForActiveTab();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.entries) {
      updateBadgeForActiveTab();
    }
  });

  // React to optional-permission toggle | 响应可选权限的开关
  if (chrome.permissions.onAdded) {
    chrome.permissions.onAdded.addListener((perms) => {
      if (perms.permissions?.includes('tabs')) {
        updateBadgeForActiveTab();
      }
    });
  }
  if (chrome.permissions.onRemoved) {
    chrome.permissions.onRemoved.addListener((perms) => {
      if (perms.permissions?.includes('tabs')) {
        clearAllBadges();
      }
    });
  }

  // Initial paint after the worker starts | 服务脚本启动后首次刷新
  updateBadgeForActiveTab();

  // ==== End site-match badge ====


  // Parse otpauth URL
  // 解析 otpauth URL
  function parseOtpAuthUrl(url: string) {
    if (!url.startsWith('otpauth://')) {
      throw new Error('Not a valid otpauth URL');
    }

    const urlObj = new URL(url);
    if (urlObj.protocol !== 'otpauth:') {
      throw new Error('Not a valid otpauth URL');
    }

    const type = urlObj.host;
    if (type !== 'totp' && type !== 'hotp') {
      throw new Error('Unsupported OTP type');
    }

    const label = decodeURIComponent(urlObj.pathname.substring(1));
    const params = new URLSearchParams(urlObj.search);

    let issuer = params.get('issuer') || '';
    let account = '';

    if (label.includes(':')) {
      const parts = label.split(':');
      if (!issuer) issuer = parts[0];
      account = parts[1] || '';
    } else {
      account = label;
    }

    const secret = params.get('secret');
    if (!secret) {
      throw new Error('No secret found in URL');
    }

    const base32Regex = /^[A-Z2-7]+=*$/i;
    if (!base32Regex.test(secret)) {
      throw new Error('Invalid secret key');
    }

    const period = parseInt(params.get('period') || '30');
    const digits = parseInt(params.get('digits') || '6');
    const algorithm = params.get('algorithm')?.toUpperCase() || 'SHA1';

    return {
      type: type === 'hotp' ? 2 : 1,
      issuer: issuer || 'Unknown',
      account,
      secret: secret.toUpperCase(),
      period,
      digits,
      algorithm: algorithm === 'SHA256' ? 2 : algorithm === 'SHA512' ? 3 : 1,
      counter: parseInt(params.get('counter') || '0'),
    };
  }

  // Handle messages from content scripts and popup
  // 处理来自 content script 和 popup 的消息
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'captureVisibleTab') {
      chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, { format: 'png' })
        .then((dataUrl) => {
          sendResponse({ dataUrl });
        })
        .catch((error) => {
          sendResponse({ error: error.message });
        });
      return true;
    }

    // Handle getMessage request from content script
    // 处理来自 content script 的获取消息请求
    if (message.action === 'getMessage') {
      (async () => {
        const msg = await getMessage(message.key);
        sendResponse({ message: msg });
      })();
      return true;
    }

    // Handle QR code data from content script - save account directly
    // 处理来自 content script 的二维码数据 - 直接保存账户
    if (message.action === 'saveQRAccount') {
      debugLog('[Auths Background] Received QR data');
      (async () => {
        try {
          const accountData = parseOtpAuthUrl(message.qrData);
          debugLog('[Auths Background] Parsed QR account');

          // Add hash and other fields
          // 添加哈希值和其他字段
          const newEntry = {
            ...accountData,
            hash: generateEntryHash(),
            pinned: false,
            code: '',
          };

          // Load existing entries and check for duplicates
          // 加载现有条目并检查重复
          const result = await chrome.storage.local.get(['entries']);
          const entries = result.entries || [];

          // Check for duplicate account (by secret only, consistent with all other dedup paths)
          // 仅基于 secret 检查重复（与所有其他去重逻辑保持一致）
          const isDuplicate = hasDuplicateSecret(entries, accountData.secret);

          if (isDuplicate) {
            debugLog('[Auths Background] Duplicate account detected');
            const duplicateMsg = await getMessage('account_already_exists');
            sendResponse({
              success: false,
              error: 'account_already_exists',
              message: duplicateMsg,
              isDuplicate: true
            });
            return;
          }

          entries.push(newEntry);
          await chrome.storage.local.set({ entries, entriesLastModified: Date.now() });

          debugLog('[Auths Background] Account saved successfully');
          const successMsg = await getMessage('account_added_successfully');

          // Send notification if permission granted | 如果有权限则发送通知
          const hasNotificationPermission = await chrome.permissions.contains({ permissions: ['notifications'] });
          if (hasNotificationPermission) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: '/images/icon128.png',
              title: 'Auths',
              message: successMsg
            });
          }

          sendResponse({ success: true, account: accountData, message: successMsg });
        } catch (error) {
          debugError('[Auths Background] Error parsing QR:', error);
          const failedMsg = await getMessage('qr_add_failed');
          sendResponse({ success: false, error: (error as Error).message, message: failedMsg });
        }
      })();
      return true;
    }

    return false;
  });
});
