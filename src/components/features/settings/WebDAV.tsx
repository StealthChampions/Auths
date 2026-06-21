/**
 * WebDAV Sync Component | WebDAV 同步组件
 *
 * Provides WebDAV cloud sync functionality for backup and restore.
 * 提供 WebDAV 云同步功能，用于备份和恢复。
 */

import React, { useState } from 'react';
import { useI18n } from '@/i18n';
import { useNotification, useAccounts } from '@/store';
import { addLocalizedSyncLog, getLocalizedSyncLogText, getSyncLogs, clearSyncLogs, formatLogTime, type SyncLogEntry } from '@/utils/sync-logger';
import { dedupeAccountsBySecret } from '@/utils/accounts';
import { decryptWebDAVPassword, migratePlainWebDAVConfig, withEncryptedWebDAVPassword } from '@/utils/webdav-credentials';
import { cleanupExpiredWebDAVBackups, downloadWebDAVBackup, getLatestWebDAVBackup, listWebDAVBackups, uploadWebDAVBackup } from '@/utils/webdav-sync';
import '@/assets/styles/components.css';

interface WebDAVProps {
    onClose: () => void;
}

/**
 * Ensure WebDAV server permission is granted | 确保已获得 WebDAV 服务器访问权限
 * Requests permission dynamically if not already granted | 如果尚未授权则动态请求权限
 * @param url - WebDAV server URL | WebDAV 服务器地址
 * @returns true if permission granted, false otherwise | 授权成功返回 true，否则返回 false
 */
async function ensureWebDAVPermission(url: string): Promise<boolean> {
    try {
        const urlObj = new URL(url);
        const origin = urlObj.origin + '/*';

        // Check if permission already granted | 检查是否已有权限
        const hasPermission = await chrome.permissions.contains({ origins: [origin] });
        if (hasPermission) {
            return true;
        }

        // Request permission from user | 向用户请求权限
        const granted = await chrome.permissions.request({ origins: [origin] });
        return granted;
    } catch {
        return false;
    }
}

export default function WebDAV({ onClose }: WebDAVProps) {
    const { t } = useI18n();
    const { dispatch: notificationDispatch } = useNotification();
    const { dispatch: accountsDispatch } = useAccounts();

    // Form state | 表单状态
    const [serverUrl, setServerUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [autoBackup, setAutoBackup] = useState(false);
    const [backupInterval, setBackupInterval] = useState('1440'); // Default 24 hours | 默认 24 小时
    const [retentionDays, setRetentionDays] = useState(30); // Default 30 days | 默认 30 天
    const [showRestoreList, setShowRestoreList] = useState(false);
    const [backupFiles, setBackupFiles] = useState<Array<{ name: string, date: string }>>([]);
    const [restoreLoading, setRestoreLoading] = useState(false);
    // Log related state | 日志相关状态
    const [showLogs, setShowLogs] = useState(false);
    const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
    // Sync state | 同步状态
    const [syncing, setSyncing] = useState(false);
    // Sync on startup toggle | 启动时同步开关
    const [syncOnStartup, setSyncOnStartup] = useState(false);

    // Helper function to show toast messages | 显示 Toast 消息的辅助函数
    const showToast = (type: 'success' | 'error', text: string) => {
        notificationDispatch({ type, payload: text });
    };

    // Helper function to refresh logs | 刷新日志的辅助函数
    const refreshLogs = async () => {
        if (showLogs) {
            const logs = await getSyncLogs();
            setSyncLogs(logs);
        }
    };

    const applyRetentionPolicy = async () => {
        let cleanup;
        try {
            cleanup = await cleanupExpiredWebDAVBackups(serverUrl, username, password, retentionDays);
        } catch (error) {
            await addLocalizedSyncLog('WARN', 'BACKUP_SUCCESS', {
                messageKey: 'retention_cleanup_failed',
                detailsFallback: error instanceof Error ? error.message : t('unknown_error')
            });
            return;
        }

        if (cleanup.skipped) return;
        if (cleanup.deleted.length > 0 || cleanup.failed.length > 0) {
            await addLocalizedSyncLog(cleanup.failed.length > 0 ? 'WARN' : 'INFO', 'BACKUP_SUCCESS', {
                messageKey: 'retention_cleanup_done',
                detailsKey: 'log_details_retention_cleanup',
                detailsArgs: [String(cleanup.deleted.length), String(cleanup.failed.length)]
            });
        }
    };

    // List backups from WebDAV server using PROPFIND | 使用 PROPFIND 列出 WebDAV 服务器上的备份
    const listBackups = async () => {
        if (!serverUrl || !username || !password) {
            showToast('error', t('configure_webdav_first'));
            return;
        }

        // Ensure permission before fetching | 获取前先确保有权限
        if (!await ensureWebDAVPermission(serverUrl)) {
            showToast('error', t('permission_denied'));
            return;
        }

        setRestoreLoading(true);

        try {
            await applyRetentionPolicy();
            const files = (await listWebDAVBackups(serverUrl, username, password)).sort((a, b) => b.timestamp - a.timestamp).map((file) => ({
                name: file.name,
                date: file.timestamp ? new Date(file.timestamp).toLocaleString() : 'Unknown',
            }));

            setBackupFiles(files);
            setShowRestoreList(true);

            if (files.length === 0) {
                showToast('error', t('no_backups_found'));
            }
        } catch (err) {
            showToast('error', t('fetch_backups_failed') + (err instanceof Error ? err.message : t('unknown_error')));
        } finally {
            setRestoreLoading(false);
        }
    };

    // Restore from selected backup | 从选定的备份恢复
    const handleRestore = async (filename: string) => {
        if (!serverUrl || !username || !password) {
            showToast('error', t('configure_webdav_first'));
            return;
        }

        // Ensure permission before restoring | 恢复前先确保有权限
        if (!await ensureWebDAVPermission(serverUrl)) {
            showToast('error', t('permission_denied'));
            return;
        }

        setRestoreLoading(true);
        await addLocalizedSyncLog('INFO', 'RESTORE_START', {
            messageKey: 'log_restore_start',
            detailsFallback: filename
        });

        try {
            const backupData = await downloadWebDAVBackup(serverUrl, username, password, filename);

            // Merge with existing accounts | 与现有账户合并
            const result = await chrome.storage.local.get(['entries']);
            const existingAccounts = result.entries || [];

            // First merge all accounts | 先合并所有账户
            const allAccounts = [...existingAccounts, ...backupData.accounts];

            // Then deduplicate by secret (consistent with performDownload and background.ts)
            // 基于 secret 去重（与 performDownload 和 background.ts 保持一致）
            const {
                accounts: deduplicatedAccounts,
                removedDuplicates,
            } = dedupeAccountsBySecret(allAccounts, { duplicatePreference: 'last' });

            const importCount = deduplicatedAccounts.length - existingAccounts.length;

            await chrome.storage.local.set({ entries: deduplicatedAccounts, entriesLastModified: Date.now() });

            // Update global state immediately | 立即更新全局状态
            accountsDispatch({ type: 'setEntries', payload: deduplicatedAccounts });

            await addLocalizedSyncLog('INFO', 'RESTORE_SUCCESS', {
                messageKey: 'log_restore_success',
                detailsKey: 'log_details_imported_deduped',
                detailsArgs: [String(importCount), String(removedDuplicates)]
            });
            showToast('success', t('restore_success', [importCount.toString()]));
            setShowRestoreList(false);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : t('unknown_error');
            await addLocalizedSyncLog('ERROR', 'RESTORE_FAILED', {
                messageKey: 'log_restore_failed',
                detailsFallback: errorMsg
            });
            showToast('error', t('restore_failed') + errorMsg);
        } finally {
            setRestoreLoading(false);
            await refreshLogs();
        }
    };

    // Save WebDAV configuration | 保存 WebDAV 配置
    const handleSaveConfig = async () => {
        if (!serverUrl || !username || !password) {
            showToast('error', t('fill_all_fields'));
            return;
        }

        // Validate URL format | 验证 URL 格式
        try {
            new URL(serverUrl);
        } catch {
            showToast('error', t('invalid_server_url'));
            return;
        }

        // Save form data BEFORE requesting permission to prevent data loss
        // 在请求权限之前保存表单数据，防止数据丢失
        const tempConfig = await withEncryptedWebDAVPassword({
            serverUrl,
            username,
            autoBackup,
            backupInterval: parseInt(backupInterval),
            retentionDays
        }, password);
        await chrome.storage.local.set({ webdavConfig: tempConfig });

        // Request permission for WebDAV server | 请求 WebDAV 服务器访问权限
        if (!await ensureWebDAVPermission(serverUrl)) {
            showToast('error', t('permission_denied'));
            return;
        }

        const config = await withEncryptedWebDAVPassword({
            serverUrl,
            username,
            autoBackup,
            backupInterval: parseInt(backupInterval),
            retentionDays,
            syncOnStartup
        }, password);

        // Save config to storage | 保存配置到存储
        await chrome.storage.local.set({ webdavConfig: config });

        // Configure auto-backup alarm | 配置自动备份定时器
        if (autoBackup) {
            // Request alarms permission dynamically | 动态请求 alarms 权限
            const hasAlarmsPermission = await chrome.permissions.request({ permissions: ['alarms'] });
            if (!hasAlarmsPermission || !chrome.alarms?.create) {
                showToast('error', t('permission_denied'));
                return;
            }
            chrome.alarms.create('autoBackup', {
                periodInMinutes: parseInt(backupInterval)
            });
        } else {
            // Only clear alarm if we have permission | 仅在有权限时清除定时器
            const hasAlarms = await chrome.permissions.contains({ permissions: ['alarms'] });
            if (hasAlarms && chrome.alarms?.clear) {
                chrome.alarms.clear('autoBackup');
            }
        }

        await addLocalizedSyncLog('INFO', 'CONFIG_SAVED', {
            messageKey: 'log_config_saved',
            detailsKey: autoBackup ? 'log_details_auto_backup_enabled' : 'log_details_auto_backup_disabled'
        });
        await applyRetentionPolicy();
        showToast('success', t('config_saved'));
        await refreshLogs();
    };

    // Handle manual backup to WebDAV | 手动备份到 WebDAV
    const handleBackup = async () => {
        if (!serverUrl || !username || !password) {
            showToast('error', t('configure_webdav_first'));
            return;
        }

        // Ensure permission before backup | 备份前先确保有权限
        if (!await ensureWebDAVPermission(serverUrl)) {
            showToast('error', t('permission_denied'));
            return;
        }

        setLoading(true);
        await addLocalizedSyncLog('INFO', 'BACKUP_START', {
            messageKey: 'log_backup_start',
            detailsFallback: serverUrl
        });

        try {
            // Get entries from storage | 从存储中获取账户数据
            const result = await chrome.storage.local.get(['entries']);
            let entries = result.entries || [];

            if (entries.length === 0) {
                showToast('error', t('no_accounts_backup'));
                setLoading(false);
                return;
            }

            // Deduplicate before upload | 上传前去重
            const {
                accounts: deduplicatedEntries,
                removedDuplicates,
            } = dedupeAccountsBySecret(entries);

            // Update local if duplicates were removed | 如果有重复被移除则更新本地
            if (removedDuplicates > 0) {
                await chrome.storage.local.set({ entries: deduplicatedEntries, entriesLastModified: Date.now() });
                accountsDispatch({ type: 'setEntries', payload: deduplicatedEntries });
                await addLocalizedSyncLog('INFO', 'BACKUP_START', {
                    messageKey: 'log_pre_upload_dedupe',
                    detailsKey: 'log_details_removed_duplicates',
                    detailsArgs: [String(removedDuplicates)]
                });
                entries = deduplicatedEntries;
            }

            const filename = await uploadWebDAVBackup(serverUrl, username, password, entries);
            await applyRetentionPolicy();

            await addLocalizedSyncLog('INFO', 'BACKUP_SUCCESS', {
                messageKey: 'log_backup_success',
                detailsKey: 'log_details_file',
                detailsArgs: [filename]
            });
            showToast('success', t('backup_success'));
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : t('unknown_error');
            await addLocalizedSyncLog('ERROR', 'BACKUP_FAILED', {
                messageKey: 'log_backup_failed',
                detailsFallback: errorMsg
            });
            showToast('error', t('backup_failed') + errorMsg);
        } finally {
            setLoading(false);
            await refreshLogs();
        }
    };

    // Handle smart sync - compare local and remote, sync the newest | 智能同步 - 对比本地和远程，取最新
    const handleSync = async () => {
        if (!serverUrl || !username || !password) {
            showToast('error', t('configure_webdav_first'));
            return;
        }

        if (!await ensureWebDAVPermission(serverUrl)) {
            showToast('error', t('permission_denied'));
            return;
        }

        setSyncing(true);
        await addLocalizedSyncLog('INFO', 'BACKUP_START', {
            messageKey: 'sync_checking'
        });

        try {
            // 1. Get local data and its timestamp | 获取本地数据及其时间戳
            const localResult = await chrome.storage.local.get(['entries', 'entriesLastModified']);
            const localEntries = localResult.entries || [];
            const localTimestamp = localResult.entriesLastModified || 0;

            // 2. Get remote latest backup file info | 获取远程最新备份文件信息
            const latestRemoteFile = await getLatestWebDAVBackup(serverUrl, username, password);

            // 3. Compare and sync | 对比并同步
            if (!latestRemoteFile) {
                // No remote backup, upload local | 没有远程备份，上传本地
                if (localEntries.length > 0) {
                    showToast('success', t('sync_uploading'));
                    await performUpload(localEntries);
                } else {
                    showToast('success', t('sync_up_to_date'));
                }
            } else if (localTimestamp === 0 && localEntries.length === 0) {
                // No local data, download remote | 没有本地数据，下载远程
                showToast('success', t('sync_downloading'));
                await performDownload(latestRemoteFile.name);
            } else if (latestRemoteFile.timestamp > localTimestamp) {
                // Remote is newer, download | 远程更新，下载
                showToast('success', t('sync_downloading'));
                await performDownload(latestRemoteFile.name);
            } else if (localTimestamp > latestRemoteFile.timestamp) {
                // Local is newer, upload | 本地更新，上传
                showToast('success', t('sync_uploading'));
                await performUpload(localEntries);
            } else {
                // Same timestamp, up to date | 时间相同，已是最新
                showToast('success', t('sync_up_to_date'));
            }

            await applyRetentionPolicy();
            await addLocalizedSyncLog('INFO', 'BACKUP_SUCCESS', {
                messageKey: 'sync_complete'
            });
            // Record last sync timestamp | 记录上次同步时间
            await chrome.storage.local.set({ lastSyncedTimestamp: Date.now() });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : t('unknown_error');
            await addLocalizedSyncLog('ERROR', 'BACKUP_FAILED', {
                messageKey: 'log_sync_failed',
                detailsFallback: errorMsg
            });
            showToast('error', t('sync_failed') + errorMsg);
        } finally {
            setSyncing(false);
        }
    };

    // Helper: perform upload | 辅助函数：执行上传
    const performUpload = async (entries: any[]) => {
        await uploadWebDAVBackup(serverUrl, username, password, entries);
        await applyRetentionPolicy();
        // Update local timestamp | 更新本地时间戳
        await chrome.storage.local.set({ entriesLastModified: Date.now() });
    };

    // Helper: perform download and merge | 辅助函数：执行下载并合并
    const performDownload = async (filename: string) => {
        const backupData = await downloadWebDAVBackup(serverUrl, username, password, filename);

        // Merge accounts | 合并账户
        const localResult = await chrome.storage.local.get(['entries']);
        const existingAccounts = localResult.entries || [];

        // First merge all accounts | 先合并所有账户
        const allAccounts = [...existingAccounts, ...backupData.accounts];

        // Then deduplicate | 然后去重
        const {
            accounts: deduplicatedAccounts,
            removedDuplicates,
        } = dedupeAccountsBySecret(allAccounts, { duplicatePreference: 'last' });

        const importCount = deduplicatedAccounts.length - existingAccounts.length;

        await chrome.storage.local.set({
            entries: deduplicatedAccounts,
            entriesLastModified: Date.now()
        });

        // Update global state | 更新全局状态
        accountsDispatch({ type: 'setEntries', payload: deduplicatedAccounts });
    };

    // Load saved config on mount | 组件挂载时加载已保存的配置
    React.useEffect(() => {
        const loadConfig = async () => {
            const result = await chrome.storage.local.get(['webdavConfig']);
            if (result.webdavConfig) {
                const config = await migratePlainWebDAVConfig(result.webdavConfig);
                const decryptedPassword = await decryptWebDAVPassword(config);
                setServerUrl(config?.serverUrl || '');
                setUsername(config?.username || '');
                setPassword(decryptedPassword);
                setAutoBackup(Boolean(config?.autoBackup));
                setBackupInterval(config?.backupInterval?.toString() || '1440');
                setRetentionDays(Number(config?.retentionDays || 30));
                setSyncOnStartup(Boolean(config?.syncOnStartup));
            }
        };
        loadConfig();
    }, []);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content webdav-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>🌐 {t('webdav_title')}</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <p className="section-description">
                        {t('webdav_desc')}
                    </p>

                    <div className="form-group">
                        <label htmlFor="serverUrl">{t('server_url')}</label>
                        <input
                            type="url"
                            id="serverUrl"
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            placeholder="https://example.com/webdav/"
                        />
                        <span className="input-hint">{t('server_url_hint')}</span>
                    </div>

                    <div className="form-group">
                        <label htmlFor="username">{t('username')}</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={t('username')}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">{t('password')}</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t('password')}
                        />
                    </div>

                    <div className="toggle-setting" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--color-border)', marginTop: '16px' }}>
                        <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{t('auto_backup')}</span>
                        <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                            <input
                                type="checkbox"
                                checked={autoBackup}
                                onChange={(e) => setAutoBackup(e.target.checked)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                                position: 'absolute',
                                cursor: 'pointer',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: autoBackup ? 'var(--color-primary)' : 'var(--color-border)',
                                transition: '0.3s',
                                borderRadius: '24px'
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    content: '""',
                                    height: '18px',
                                    width: '18px',
                                    left: autoBackup ? '23px' : '3px',
                                    bottom: '3px',
                                    backgroundColor: 'var(--color-bg-primary)',
                                    transition: '0.3s',
                                    borderRadius: '50%',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}></span>
                            </span>
                        </label>
                    </div>

                    {autoBackup && (
                        <>
                            <div className="form-group">
                                <label htmlFor="backupInterval">{t('backup_frequency')}</label>
                                <select
                                    id="backupInterval"
                                    value={backupInterval}
                                    onChange={(e) => setBackupInterval(e.target.value)}
                                    className="form-select"
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                >
                                    <option value="30">{t('freq_30m')}</option>
                                    <option value="60">{t('freq_1h')}</option>
                                    <option value="360">{t('freq_6h')}</option>
                                    <option value="720">{t('freq_12h')}</option>
                                    <option value="1440">{t('freq_24h')}</option>
                                    <option value="10080">{t('freq_week')}</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="retentionDays">{t('retention_policy')}</label>
                                <select
                                    id="retentionDays"
                                    value={retentionDays}
                                    onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                                    className="form-select"
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                >
                                    <option value={7}>{t('retain_7d')}</option>
                                    <option value={30}>{t('retain_30d')}</option>
                                    <option value={90}>{t('retain_90d')}</option>
                                    <option value={365}>{t('retain_1y')}</option>
                                    <option value={-1}>{t('retain_forever')}</option>
                                </select>
                            </div>
                        </>
                    )}

                    {/* Sync on startup toggle | 启动时同步开关 */}
                    <div className="toggle-setting" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--color-border)', marginTop: '16px' }}>
                        <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{t('sync_on_startup')}</span>
                        <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                            <input
                                type="checkbox"
                                checked={syncOnStartup}
                                onChange={(e) => setSyncOnStartup(e.target.checked)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                                position: 'absolute',
                                cursor: 'pointer',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: syncOnStartup ? 'var(--color-primary)' : 'var(--color-border)',
                                transition: '0.3s',
                                borderRadius: '24px'
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    content: '""',
                                    height: '18px',
                                    width: '18px',
                                    left: syncOnStartup ? '23px' : '3px',
                                    bottom: '3px',
                                    backgroundColor: 'var(--color-bg-primary)',
                                    transition: '0.3s',
                                    borderRadius: '50%',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}></span>
                            </span>
                        </label>
                    </div>

                    <div className="button-group">
                        <button
                            className="btn-secondary"
                            onClick={handleSaveConfig}
                        >
                            💾 {t('btn_save_config')}
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleBackup}
                            disabled={loading}
                        >
                            {loading ? `⏳ ${t('backup_process')}` : `☁️ ${t('btn_backup_now')}`}
                        </button>
                    </div>

                    <div className="button-group" style={{ marginTop: '8px' }}>
                        <button
                            className="btn-secondary"
                            onClick={listBackups}
                            disabled={restoreLoading}
                            style={{ width: '100%' }}
                        >
                            {restoreLoading ? `⏳ ${t('restore_process')}` : `📥 ${t('btn_restore_cloud')}`}
                        </button>
                    </div>

                    {showRestoreList && backupFiles.length > 0 && (
                        <div className="backup-list" style={{ marginTop: '16px', padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>{t('select_restore_backup')}</h4>
                            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                {backupFiles.map((file) => (
                                    <div
                                        key={file.name}
                                        onClick={() => handleRestore(file.name)}
                                        style={{
                                            padding: '8px 12px',
                                            marginBottom: '4px',
                                            background: 'var(--color-bg-primary)',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <span>{file.name}</span>
                                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{file.date}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}


                    {/* 查看同步日志按钮 */}
                    <div className="button-group" style={{ marginTop: '8px' }}>
                        <button
                            className="btn-secondary"
                            onClick={async () => {
                                const logs = await getSyncLogs();
                                setSyncLogs(logs);
                                setShowLogs(!showLogs);
                            }}
                            style={{ width: '100%' }}
                        >
                            📋 {t('view_sync_logs')}
                        </button>
                    </div>

                    {/* 日志列表 */}
                    {showLogs && (
                        <div className="backup-list" style={{ marginTop: '16px', padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h4 style={{ margin: 0, fontSize: '14px' }}>📋 {t('sync_logs_title')}</h4>
                                <button
                                    onClick={async () => {
                                        await clearSyncLogs();
                                        setSyncLogs([]);
                                        showToast('success', t('logs_cleared'));
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid var(--color-border)',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        color: 'var(--color-text-secondary)'
                                    }}
                                >
                                    🗑️ {t('clear_logs')}
                                </button>
                            </div>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {syncLogs.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px', padding: '16px' }}>
                                        {t('no_sync_logs')}
                                    </div>
                                ) : (
                                    syncLogs.map((log, index) => {
                                        const localizedLog = getLocalizedSyncLogText(log, t);
                                        return (
                                            <div
                                                key={index}
                                                style={{
                                                    padding: '8px 12px',
                                                    marginBottom: '4px',
                                                    background: 'var(--color-bg-primary)',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    borderLeft: `3px solid ${log.level === 'ERROR' ? '#ef4444' : log.level === 'WARN' ? '#f59e0b' : '#22c55e'}`
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontWeight: 500, color: log.level === 'ERROR' ? '#ef4444' : 'var(--color-text-primary)' }}>
                                                        {log.level === 'ERROR' ? '❌' : log.level === 'WARN' ? '⚠️' : '✅'} {localizedLog.message}
                                                    </span>
                                                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                                                        {formatLogTime(log.timestamp)}
                                                    </span>
                                                </div>
                                                {localizedLog.details && (
                                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                                                        {localizedLog.details}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    <div className="backup-tips">
                        <h4>💡 {t('backup_tips_title')}</h4>
                        <ul>
                            <li><strong>Nextcloud:</strong> https://your-domain/remote.php/dav/files/username/</li>
                            <li><strong>Synology:</strong> https://your-nas/webdav/</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
