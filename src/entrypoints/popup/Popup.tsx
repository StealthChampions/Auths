/**
 * Popup Component | Popup 主组件
 *
 * Main popup component for the extension.
 * Manages app state, theme, and renders main UI.
 *
 * 扩展的主 Popup 组件。
 * 管理应用状态、主题，并渲染主界面。
 */

import React, { Suspense, useState, useEffect } from 'react';
import { useStyle, useMenu, useNotification, useAccounts } from '@/store';
import { UserSettings } from '@/models/settings';
import { addLocalizedSyncLog } from '@/utils/sync-logger';
import { dedupeAccountsBySecret } from '@/utils/accounts';
import { normalizeAccountList } from '@/utils/account-normalization';
import { decryptWebDAVPassword, loadWebDAVConfig } from '@/utils/webdav-credentials';
import { runWebDAVSync } from '@/utils/webdav-sync-manager';
import { cleanupExpiredWebDAVBackups } from '@/utils/webdav-sync';
import { applyThemePreference, normalizeThemePreference, resolveThemePreference } from '@/utils/theme';
import { debugError, debugLog } from '@/utils/logger';
import MainHeader from '@/components/layout/MainHeader';
import MainBody from '@/components/layout/MainBody';
import '@/assets/styles/components.css';
import '@/assets/styles/notification.css';

const Settings = React.lazy(() => import('@/components/features/settings/Settings'));

export default function Popup() {
  const { menu, dispatch: menuDispatch } = useMenu();
  const { notification, dispatch: notificationDispatch } = useNotification();
  const { dispatch: accountsDispatch } = useAccounts();
  const { style, dispatch: styleDispatch } = useStyle();
  const [hideoutline, setHideoutline] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Auto-clear notification after 3 seconds
  // 3秒后自动清除通知
  useEffect(() => {
    // Only auto-clear toasts, not dialogs
    // 只自动清除 Toast，不清除对话框
    if (notification.message && notification.mode !== 'dialog') {
      const timer = setTimeout(() => {
        notificationDispatch({ type: 'clear' });
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [notification.message, notification.mode]);

  // Load entries from storage on mount
  // 组件挂载时从存储加载条目
  useEffect(() => {
    const loadEntries = async () => {
      try {
        const result = await chrome.storage.local.get(['entries']);
        if (result.entries && Array.isArray(result.entries)) {
          const { accounts: entries, invalidCount } = normalizeAccountList(result.entries);

          // Auto deduplicate on load | 加载时自动去重
          const {
            accounts: deduplicatedEntries,
            removedDuplicates,
          } = dedupeAccountsBySecret(entries);

          // Update storage if duplicates were removed (don't update timestamp to avoid triggering sync)
          // 如果有重复被移除则更新存储（不更新时间戳以避免触发同步）
          if (removedDuplicates > 0 || invalidCount > 0) {
            debugLog(`[Auths] Auto cleanup: removed ${removedDuplicates} duplicate entries and ${invalidCount} invalid entries`);
            await chrome.storage.local.set({ entries: deduplicatedEntries });
          }

          accountsDispatch({ type: 'setEntries', payload: deduplicatedEntries });
        }
      } catch {
        // Silently handle loading errors
        // 静默处理加载错误
      }
    };
    loadEntries();
  }, []);

  // Load and apply settings on mount
  // 组件挂载时加载并应用设置
  useEffect(() => {
    const loadSettings = async () => {
      await UserSettings.updateItems();

      // Theme | 主题
      const theme = normalizeThemePreference(UserSettings.items.theme as string);
      if (UserSettings.items.theme !== theme) {
        UserSettings.items.theme = theme;
        UserSettings.commitItems();
      }
      applyThemePreference(theme);
      menuDispatch({ type: 'setTheme', payload: theme });

      // Language | 语言
      if (UserSettings.items.language) {
        menuDispatch({ type: 'setLanguage', payload: UserSettings.items.language as string });
      }

      // Smart Filter | 智能过滤
      if (UserSettings.items.smartFilter !== undefined) {
        menuDispatch({ type: 'setSmartFilter', payload: UserSettings.items.smartFilter });
      }

      // Clipboard auto-clear | 剪贴板自动清理
      if (UserSettings.items.clipboardClearSeconds === undefined) {
        UserSettings.items.clipboardClearSeconds = 0;
        UserSettings.commitItems();
      }
      menuDispatch({
        type: 'setClipboardClearSeconds',
        payload: Number(UserSettings.items.clipboardClearSeconds ?? 0),
      });

      // Sync on startup | 启动时自动同步
      try {
        const config = await loadWebDAVConfig();
        const password = await decryptWebDAVPassword(config);
        if (config?.syncOnStartup && config?.serverUrl && config?.username && password) {
          debugLog('[Auths] Startup sync enabled, performing auto sync...');

          const syncResult = await runWebDAVSync({
            serverUrl: config.serverUrl,
            username: config.username,
            password,
            onEntriesChanged: (entries) => accountsDispatch({ type: 'setEntries', payload: entries }),
          });

          if (syncResult.status === 'downloaded') {
            await addLocalizedSyncLog('INFO', 'BACKUP_SUCCESS', {
              messageKey: 'log_startup_sync_download_success',
              detailsKey: 'log_details_deduped',
              detailsArgs: [String(syncResult.summary?.removedDuplicates ?? 0)]
            });
            debugLog(`[Auths] Startup sync: downloaded and merged, removed ${syncResult.summary?.removedDuplicates ?? 0} duplicates`);
          } else if (syncResult.status === 'uploaded') {
            await addLocalizedSyncLog('INFO', 'BACKUP_SUCCESS', {
              messageKey: 'log_startup_sync_upload_success',
              detailsKey: 'log_details_file',
              detailsArgs: [syncResult.filename || '']
            });
            debugLog('[Auths] Startup sync: uploaded successfully');
          } else if (syncResult.status === 'conflict' && syncResult.conflict) {
            await addLocalizedSyncLog('WARN', 'BACKUP_FAILED', {
              messageKey: 'sync_conflict_detected',
              detailsKey: 'log_details_file',
              detailsArgs: [syncResult.conflict.remoteFileName]
            });
            debugLog('[Auths] Startup sync: conflict detected, skipped automatic overwrite');
          } else {
            debugLog('[Auths] Startup sync: already up to date');
            await addLocalizedSyncLog('INFO', 'BACKUP_SUCCESS', {
              messageKey: 'log_startup_sync_skipped',
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
        }
      } catch (err) {
        debugError('[Auths] Startup sync failed:', err);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => {
      if (menu.theme === 'system') {
        applyThemePreference('system');
      }
    };

    updateSystemTheme();
    mediaQuery.addEventListener('change', updateSystemTheme);
    return () => mediaQuery.removeEventListener('change', updateSystemTheme);
  }, [menu.theme]);

  const getThemeClass = () => {
    return resolveThemePreference(menu.theme) === 'dark' ? 'theme-dark' : 'theme-light';
  };

  const handleMouseDown = () => {
    setHideoutline(true);
  };

  const handleKeyDown = () => {
    setHideoutline(false);
  };

  const handleToggleEdit = () => {
    styleDispatch({ type: style.isEditing ? 'stopEdit' : 'startEdit' });
  };

  // Render notification component | 渲染通知组件
  const renderNotification = () => {
    if (!notification.message) return null;

    if (notification.mode === 'dialog') {
      return (
        <div className="notification-overlay" onClick={() => notificationDispatch({ type: 'clear' })}>
          <div className="notification-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="notification-dialog-message">{notification.message}</div>
            <button
              className="notification-dialog-btn"
              onClick={() => notificationDispatch({ type: 'clear' })}
            >
              OK
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`el-message el-message--${notification.severity}`}
        onClick={() => notificationDispatch({ type: 'clear' })}
      >
        <div className="el-message-icon">
          {notification.severity === 'success' && (
            <svg viewBox="0 0 1024 1024" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm-55.808 536.384-99.52-99.584a38.4 38.4 0 1 0-54.336 54.336l126.72 126.72a38.272 38.272 0 0 0 54.336 0l262.4-262.464a38.4 38.4 0 1 0-54.272-54.336L456.192 600.384z" />
            </svg>
          )}
          {notification.severity === 'error' && (
            <svg viewBox="0 0 1024 1024" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 832a384 384 0 1 0 0-768 384 384 0 0 0 0 768zm48-176a48 48 0 1 1-96 0 48 48 0 0 1 96 0zm-48-432a32 32 0 0 1 32 32v288a32 32 0 0 1-64 0V288a32 32 0 0 1 32-32z" />
            </svg>
          )}
          {notification.severity === 'warning' && (
            <svg viewBox="0 0 1024 1024" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 832a384 384 0 1 0 0-768 384 384 0 0 0 0 768zm48-176a48 48 0 1 1-96 0 48 48 0 0 1 96 0zm-48-432a32 32 0 0 1 32 32v288a32 32 0 0 1-64 0V288a32 32 0 0 1 32-32z" />
            </svg>
          )}
          {notification.severity === 'info' && (
            <svg viewBox="0 0 1024 1024" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 832a384 384 0 1 0 0-768 384 384 0 0 0 0 768zm48-176a48 48 0 1 1-96 0 48 48 0 0 1 96 0zm-48-432a32 32 0 0 1 32 32v288a32 32 0 0 1-64 0V288a32 32 0 0 1 32-32z" />
            </svg>
          )}
        </div>
        <div className="el-message-text">{notification.message}</div>
      </div>
    );
  };

  // Main UI | 主界面
  return (
    <>
      <div
        className={`app-container ${getThemeClass()} ${hideoutline ? 'hideoutline' : ''}`}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
      >
        {showSettings ? (
          <Suspense fallback={null}>
            <Settings onClose={() => setShowSettings(false)} />
          </Suspense>
        ) : (
          <>
            <MainHeader
              onSettingsClick={() => setShowSettings(true)}
              onEditToggle={handleToggleEdit}
              isEditing={style.isEditing}
            />
            <MainBody />
          </>
        )}
      </div>
      {renderNotification()}
    </>
  );
}
