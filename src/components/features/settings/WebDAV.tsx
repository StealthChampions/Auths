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
import { buildBackupMergePreview, normalizeBackupAccounts, type BackupMergePreview } from '@/utils/backup-preview';
import { decryptWebDAVPassword, loadWebDAVConfig, saveLocalWebDAVConfigDraft, saveWebDAVConfig } from '@/utils/webdav-credentials';
import { cleanupExpiredWebDAVBackups, downloadWebDAVBackup, getLatestWebDAVBackup, getWebDAVDeviceId, getWebDAVDeviceName, listWebDAVBackups, setWebDAVDeviceName, uploadWebDAVBackup, type WebDAVBackupFile } from '@/utils/webdav-sync';

interface WebDAVProps {
    onClose: () => void;
}

interface BackupHistoryItem extends WebDAVBackupFile {
    date: string;
    displayDeviceName: string;
    accountCount?: number;
    backupTimestamp?: number;
}

interface DeviceHistoryItem {
    id: string;
    name: string;
    backupCount: number;
    lastBackup: string;
    isCurrent: boolean;
}

interface RestorePreviewState {
    file: BackupHistoryItem;
    accounts: OTPEntryInterface[];
    summary: BackupMergePreview;
}

interface SyncConflictState {
    remoteFileName: string;
    remoteDate: string;
    remoteAccounts: OTPEntryInterface[];
    localAccounts: OTPEntryInterface[];
    summary: BackupMergePreview;
}

type SyncConflictResolution = 'merge' | 'local' | 'remote';

const GlobeIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9M12 3c-2.4 2.5-3.6 5.5-3.6 9s1.2 6.5 3.6 9" />
    </svg>
);

const SaveIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3h12l2 2v16H5z" />
        <path d="M8 3v6h8V3M8 21v-7h8v7" />
    </svg>
);

const CloudUploadIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.5 18H18a4 4 0 0 0 .4-8 6 6 0 0 0-11.3-2A5 5 0 0 0 6 18h.5" />
        <path d="M12 11v9M8.5 14.5 12 11l3.5 3.5" />
    </svg>
);

const DownloadIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v11M8 10l4 4 4-4" />
        <path d="M5 17v3h14v-3" />
    </svg>
);

const LogsIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 6h11M8 12h11M8 18h11" />
        <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </svg>
);

const TrashIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" />
        <path d="M10 11v6M14 11v6" />
    </svg>
);

const SpinnerIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon-spin">
        <path d="M12 3a9 9 0 1 1-8 5" />
    </svg>
);

const FieldHint = ({ text }: { text: string }) => (
    <button type="button" className="webdav-hint" aria-label={text}>
        ?
        <span className="webdav-hint-tooltip" role="tooltip">{text}</span>
    </button>
);

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
    const [deviceName, setDeviceName] = useState('');
    const [currentDeviceId, setCurrentDeviceId] = useState('');
    const [loading, setLoading] = useState(false);
    const [autoBackup, setAutoBackup] = useState(false);
    const [backupInterval, setBackupInterval] = useState('1440'); // Default 24 hours | 默认 24 小时
    const [retentionDays, setRetentionDays] = useState(30); // Default 30 days | 默认 30 天
    const [showRestoreList, setShowRestoreList] = useState(false);
    const [backupFiles, setBackupFiles] = useState<BackupHistoryItem[]>([]);
    const [deviceHistory, setDeviceHistory] = useState<DeviceHistoryItem[]>([]);
    const [restorePreview, setRestorePreview] = useState<RestorePreviewState | null>(null);
    const [restoreLoading, setRestoreLoading] = useState(false);
    // Log related state | 日志相关状态
    const [showLogs, setShowLogs] = useState(false);
    const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
    // Sync state | 同步状态
    const [syncing, setSyncing] = useState(false);
    const [syncConflict, setSyncConflict] = useState<SyncConflictState | null>(null);
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

    const formatBackupDate = (timestamp?: number) => {
        return timestamp ? new Date(timestamp).toLocaleString() : t('unknown_time');
    };

    const getDisplayDeviceName = (file: WebDAVBackupFile, backupDeviceName?: string) => {
        if (file.legacy) return t('legacy_backup');
        if (backupDeviceName) return backupDeviceName;
        if (file.deviceName) return file.deviceName.replace(/-/g, ' ');
        return t('device_id_label', [file.deviceId || t('unknown_device')]);
    };

    const buildDeviceHistory = (files: BackupHistoryItem[], activeDeviceId = currentDeviceId) => {
        const devices = new Map<string, DeviceHistoryItem & { lastTimestamp: number }>();

        for (const file of files) {
            const id = file.legacy ? 'legacy' : (file.deviceId || file.displayDeviceName);
            const timestamp = file.backupTimestamp || file.timestamp || 0;
            const existing = devices.get(id);

            if (!existing) {
                devices.set(id, {
                    id,
                    name: file.displayDeviceName,
                    backupCount: 1,
                    lastBackup: formatBackupDate(timestamp),
                    isCurrent: Boolean(activeDeviceId && file.deviceId === activeDeviceId),
                    lastTimestamp: timestamp,
                });
            } else {
                existing.backupCount += 1;
                if (timestamp > existing.lastTimestamp) {
                    existing.lastTimestamp = timestamp;
                    existing.lastBackup = formatBackupDate(timestamp);
                    existing.name = file.displayDeviceName;
                }
            }
        }

        setDeviceHistory(
            Array.from(devices.values())
                .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.lastTimestamp - a.lastTimestamp)
                .map(({ lastTimestamp, ...device }) => device)
        );
    };

    const copyDeviceId = async () => {
        if (!currentDeviceId) return;
        try {
            await navigator.clipboard.writeText(currentDeviceId);
            showToast('success', t('device_id_copied'));
        } catch {
            showToast('error', t('copy_failed'));
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

    const persistDeviceName = async () => {
        const savedDeviceName = await setWebDAVDeviceName(deviceName);
        setDeviceName(savedDeviceName);
        return savedDeviceName;
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
            const activeDeviceId = currentDeviceId || await getWebDAVDeviceId();
            setCurrentDeviceId(activeDeviceId);
            await applyRetentionPolicy();
            const files = (await listWebDAVBackups(serverUrl, username, password)).sort((a, b) => b.timestamp - a.timestamp);
            const history = await Promise.all(files.map(async (file): Promise<BackupHistoryItem> => {
                try {
                    const backupData = await downloadWebDAVBackup<OTPEntryInterface>(serverUrl, username, password, file.name);
                    const backupTimestamp = backupData.timestamp || file.timestamp;
                    return {
                        ...file,
                        backupTimestamp,
                        accountCount: backupData.accounts.length,
                        displayDeviceName: getDisplayDeviceName(file, backupData.deviceName),
                        date: formatBackupDate(backupTimestamp),
                    };
                } catch {
                    return {
                        ...file,
                        backupTimestamp: file.timestamp,
                        displayDeviceName: getDisplayDeviceName(file),
                        date: formatBackupDate(file.timestamp),
                    };
                }
            }));

            setBackupFiles(history);
            buildDeviceHistory(history, activeDeviceId);
            setShowRestoreList(true);
            setRestorePreview(null);

            if (history.length === 0) {
                showToast('error', t('no_backups_found'));
            }
        } catch (err) {
            showToast('error', t('fetch_backups_failed') + (err instanceof Error ? err.message : t('unknown_error')));
        } finally {
            setRestoreLoading(false);
        }
    };

    const prepareRestorePreview = async (file: BackupHistoryItem) => {
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

        try {
            const backupData = await downloadWebDAVBackup<OTPEntryInterface>(serverUrl, username, password, file.name);
            const result = await chrome.storage.local.get(['entries']);
            const existingAccounts: OTPEntryInterface[] = result.entries || [];
            const summary = buildBackupMergePreview(existingAccounts, backupData.accounts);
            setRestorePreview({
                file: {
                    ...file,
                    accountCount: backupData.accounts.length,
                    backupTimestamp: backupData.timestamp || file.backupTimestamp || file.timestamp,
                    displayDeviceName: getDisplayDeviceName(file, backupData.deviceName),
                    date: formatBackupDate(backupData.timestamp || file.backupTimestamp || file.timestamp),
                },
                accounts: backupData.accounts,
                summary,
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : t('unknown_error');
            showToast('error', t('restore_failed') + errorMsg);
        } finally {
            setRestoreLoading(false);
        }
    };

    // Restore from selected backup | 从选定的备份恢复
    const handleRestore = async () => {
        if (!restorePreview) return;

        setRestoreLoading(true);
        await addLocalizedSyncLog('INFO', 'RESTORE_START', {
            messageKey: 'log_restore_start',
            detailsFallback: restorePreview.file.name
        });

        try {
            const { summary } = restorePreview;

            await chrome.storage.local.set({ entries: summary.mergedAccounts, entriesLastModified: Date.now() });

            // Update global state immediately | 立即更新全局状态
            accountsDispatch({ type: 'setEntries', payload: summary.mergedAccounts });

            await addLocalizedSyncLog('INFO', 'RESTORE_SUCCESS', {
                messageKey: 'log_restore_success',
                detailsKey: 'log_details_imported_deduped',
                detailsArgs: [String(summary.newCount), String(summary.removedDuplicates)]
            });
            showToast('success', t('restore_success_with_updates', [
                summary.newCount.toString(),
                summary.updatedCount.toString(),
            ]));
            setShowRestoreList(false);
            setRestorePreview(null);
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
            await persistDeviceName();
            new URL(serverUrl);
        } catch {
            showToast('error', t('invalid_server_url'));
            return;
        }

        // Save form data BEFORE requesting permission to prevent data loss
        // 在请求权限之前保存表单数据，防止数据丢失
        await saveLocalWebDAVConfigDraft({
            serverUrl,
            username,
            autoBackup,
            backupInterval: parseInt(backupInterval),
            retentionDays,
            syncOnStartup
        }, password);

        // Request permission for WebDAV server | 请求 WebDAV 服务器访问权限
        if (!await ensureWebDAVPermission(serverUrl)) {
            showToast('error', t('permission_denied'));
            return;
        }

        await saveWebDAVConfig({
            serverUrl,
            username,
            autoBackup,
            backupInterval: parseInt(backupInterval),
            retentionDays,
            syncOnStartup
        }, password);

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
            await persistDeviceName();
            // Get entries from storage | 从存储中获取账户数据
            const result = await chrome.storage.local.get(['entries']);
            let entries: OTPEntryInterface[] = result.entries || [];

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
            await persistDeviceName();
            // 1. Get local data and its timestamp | 获取本地数据及其时间戳
            const localResult = await chrome.storage.local.get(['entries', 'entriesLastModified', 'lastSyncedTimestamp']);
            const localEntries: OTPEntryInterface[] = localResult.entries || [];
            const localTimestamp = localResult.entriesLastModified || 0;
            const lastSyncedTimestamp = localResult.lastSyncedTimestamp || 0;

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
            } else if (
                latestRemoteFile.timestamp > lastSyncedTimestamp &&
                localTimestamp > lastSyncedTimestamp &&
                localEntries.length > 0
            ) {
                const backupData = await downloadWebDAVBackup<OTPEntryInterface>(serverUrl, username, password, latestRemoteFile.name);
                const summary = buildBackupMergePreview(localEntries, backupData.accounts);
                setSyncConflict({
                    remoteFileName: latestRemoteFile.name,
                    remoteDate: formatBackupDate(backupData.timestamp || latestRemoteFile.timestamp),
                    remoteAccounts: backupData.accounts,
                    localAccounts: localEntries,
                    summary,
                });
                showToast('error', t('sync_conflict_detected'));
                await addLocalizedSyncLog('WARN', 'BACKUP_FAILED', {
                    messageKey: 'sync_conflict_detected',
                    detailsKey: 'log_details_file',
                    detailsArgs: [latestRemoteFile.name]
                });
                return;
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
    const performUpload = async (entries: OTPEntryInterface[]) => {
        await persistDeviceName();
        await uploadWebDAVBackup(serverUrl, username, password, entries);
        await applyRetentionPolicy();
        // Update local timestamp | 更新本地时间戳
        await chrome.storage.local.set({ entriesLastModified: Date.now() });
    };

    // Helper: perform download and merge | 辅助函数：执行下载并合并
    const performDownload = async (filename: string) => {
        const backupData = await downloadWebDAVBackup<OTPEntryInterface>(serverUrl, username, password, filename);

        // Merge accounts | 合并账户
        const localResult = await chrome.storage.local.get(['entries']);
        const existingAccounts: OTPEntryInterface[] = localResult.entries || [];

        // First merge all accounts | 先合并所有账户
        const allAccounts = [...existingAccounts, ...backupData.accounts];

        // Then deduplicate | 然后去重
        const { accounts: deduplicatedAccounts } = dedupeAccountsBySecret(allAccounts, { duplicatePreference: 'last' });

        await chrome.storage.local.set({
            entries: deduplicatedAccounts,
            entriesLastModified: Date.now()
        });

        // Update global state | 更新全局状态
        accountsDispatch({ type: 'setEntries', payload: deduplicatedAccounts });
    };

    const resolveSyncConflict = async (resolution: SyncConflictResolution) => {
        if (!syncConflict) return;

        setSyncing(true);
        try {
            let nextEntries: OTPEntryInterface[];

            if (resolution === 'merge') {
                nextEntries = syncConflict.summary.mergedAccounts;
                await chrome.storage.local.set({ entries: nextEntries, entriesLastModified: Date.now() });
                accountsDispatch({ type: 'setEntries', payload: nextEntries });
                await uploadWebDAVBackup(serverUrl, username, password, nextEntries);
            } else if (resolution === 'local') {
                nextEntries = normalizeBackupAccounts(syncConflict.localAccounts);
                await chrome.storage.local.set({ entries: nextEntries, entriesLastModified: Date.now() });
                accountsDispatch({ type: 'setEntries', payload: nextEntries });
                await uploadWebDAVBackup(serverUrl, username, password, nextEntries);
            } else {
                nextEntries = normalizeBackupAccounts(syncConflict.remoteAccounts);
                await chrome.storage.local.set({ entries: nextEntries, entriesLastModified: Date.now() });
                accountsDispatch({ type: 'setEntries', payload: nextEntries });
            }

            await chrome.storage.local.set({ lastSyncedTimestamp: Date.now() });
            await applyRetentionPolicy();
            await addLocalizedSyncLog('INFO', 'BACKUP_SUCCESS', {
                messageKey: 'sync_conflict_resolved',
                detailsKey: resolution === 'merge'
                    ? 'sync_conflict_resolve_merge'
                    : resolution === 'local'
                        ? 'sync_conflict_resolve_local'
                        : 'sync_conflict_resolve_remote'
            });
            setSyncConflict(null);
            showToast('success', t('sync_complete'));
            await refreshLogs();
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

    // Load saved config on mount | 组件挂载时加载已保存的配置
    React.useEffect(() => {
        const loadConfig = async () => {
            const [config, savedDeviceName, savedDeviceId] = await Promise.all([
                loadWebDAVConfig(),
                getWebDAVDeviceName(),
                getWebDAVDeviceId(),
            ]);
            setDeviceName(savedDeviceName);
            setCurrentDeviceId(savedDeviceId);
            if (config) {
                let decryptedPassword = '';
                try {
                    decryptedPassword = await decryptWebDAVPassword(config);
                } catch {
                    decryptedPassword = '';
                }
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
                    <h2>
                        <span className="modal-title-icon"><GlobeIcon /></span>
                        {t('webdav_title')}
                    </h2>
                    <button type="button" className="close-btn" onClick={onClose} title={t('close')} aria-label={t('close')}>×</button>
                </div>

                <div className="modal-body webdav-body">
                    <p className="section-description compact-description">
                        {t('webdav_desc')}
                    </p>

                    <section className="webdav-section">
                        <h3>{t('webdav_connection')}</h3>

                        <div className="webdav-connection-grid">
                            <div className="form-group webdav-field-full">
                                <span className="webdav-label-row">
                                    <label htmlFor="deviceName">{t('device_name')}</label>
                                    <FieldHint text={t('device_name_hint')} />
                                </span>
                                <input
                                    type="text"
                                    id="deviceName"
                                    value={deviceName}
                                    onChange={(e) => setDeviceName(e.target.value)}
                                    placeholder={t('device_name_placeholder')}
                                    maxLength={60}
                                />
                            </div>

                            <div className="form-group webdav-field-full">
                                <span className="webdav-label-row">
                                    <label htmlFor="serverUrl">{t('server_url')}</label>
                                    <FieldHint text={t('server_url_hint')} />
                                </span>
                                <input
                                    type="url"
                                    id="serverUrl"
                                    value={serverUrl}
                                    onChange={(e) => setServerUrl(e.target.value)}
                                    placeholder="https://example.com/webdav/"
                                />
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
                        </div>

                        <div className="button-group webdav-primary-actions">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={handleSaveConfig}
                            >
                                <span className="btn-icon"><SaveIcon /></span>
                                {t('btn_save_config')}
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={handleBackup}
                                disabled={loading}
                            >
                                <span className="btn-icon">{loading ? <SpinnerIcon /> : <CloudUploadIcon />}</span>
                                {loading ? t('backup_process') : t('btn_backup_now')}
                            </button>
                        </div>

                        <div className="device-management-card">
                            <div className="device-management-main">
                                <span className="device-management-label">{t('current_device')}</span>
                                <code>{currentDeviceId || t('unknown_device')}</code>
                            </div>
                            <button
                                type="button"
                                className="btn-subtle"
                                onClick={copyDeviceId}
                                disabled={!currentDeviceId}
                            >
                                {t('copy_device_id')}
                            </button>
                        </div>

                        {deviceHistory.length > 0 && (
                            <div className="backup-list device-history-panel">
                                <h4>{t('known_devices')}</h4>
                                <div className="device-history-list">
                                    {deviceHistory.map((device) => (
                                        <div className="device-history-row" key={device.id}>
                                            <div>
                                                <span className="device-history-name">
                                                    {device.name}
                                                    {device.isCurrent && <strong>{t('current_device_badge')}</strong>}
                                                </span>
                                                <span className="device-history-id">{device.id}</span>
                                            </div>
                                            <span>{t('device_backup_summary', [String(device.backupCount), device.lastBackup])}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="webdav-section">
                        <h3>{t('webdav_automation')}</h3>

                        <div className="webdav-toggle-grid">
                            <div className="toggle-setting webdav-toggle-compact">
                                <span>{t('sync_on_startup')}</span>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        aria-label={t('sync_on_startup')}
                                        checked={syncOnStartup}
                                        onChange={(e) => setSyncOnStartup(e.target.checked)}
                                    />
                                    <span className="toggle-slider" />
                                </label>
                            </div>

                            <div className="toggle-setting webdav-toggle-compact">
                                <span>{t('auto_backup')}</span>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        aria-label={t('auto_backup')}
                                        checked={autoBackup}
                                        onChange={(e) => setAutoBackup(e.target.checked)}
                                    />
                                    <span className="toggle-slider" />
                                </label>
                            </div>
                        </div>

                        {autoBackup && (
                            <div className="webdav-auto-options">
                                <div className="webdav-policy-grid">
                                    <div className="form-group">
                                        <label htmlFor="backupInterval">{t('backup_frequency')}</label>
                                        <span className="select-control">
                                            <select
                                                id="backupInterval"
                                                value={backupInterval}
                                                onChange={(e) => setBackupInterval(e.target.value)}
                                                className="form-select"
                                            >
                                                <option value="30">{t('freq_30m')}</option>
                                                <option value="60">{t('freq_1h')}</option>
                                                <option value="360">{t('freq_6h')}</option>
                                                <option value="720">{t('freq_12h')}</option>
                                                <option value="1440">{t('freq_24h')}</option>
                                                <option value="10080">{t('freq_week')}</option>
                                            </select>
                                        </span>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="retentionDays">{t('retention_policy')}</label>
                                        <span className="select-control">
                                            <select
                                                id="retentionDays"
                                                value={retentionDays}
                                                onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                                                className="form-select"
                                            >
                                                <option value={7}>{t('retain_7d')}</option>
                                                <option value={30}>{t('retain_30d')}</option>
                                                <option value={90}>{t('retain_90d')}</option>
                                                <option value={365}>{t('retain_1y')}</option>
                                                <option value={-1}>{t('retain_forever')}</option>
                                            </select>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                    </section>

                    <section className="webdav-section">
                        <h3>{t('webdav_manual_actions')}</h3>

                        <div className="button-group button-group-compact webdav-action-grid">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={handleSync}
                                disabled={syncing}
                            >
                                <span className="btn-icon">{syncing ? <SpinnerIcon /> : <CloudUploadIcon />}</span>
                                {syncing ? t('sync_checking') : t('sync_button')}
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={listBackups}
                                disabled={restoreLoading}
                            >
                                <span className="btn-icon">{restoreLoading ? <SpinnerIcon /> : <DownloadIcon />}</span>
                                {restoreLoading ? t('restore_process') : t('btn_load_backup_history')}
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={async () => {
                                    const logs = await getSyncLogs();
                                    setSyncLogs(logs);
                                    setShowLogs(!showLogs);
                                }}
                            >
                                <span className="btn-icon"><LogsIcon /></span>
                                {t('view_sync_logs')}
                            </button>
                        </div>

                        {syncConflict && (
                            <div className="backup-preview-panel sync-conflict-panel">
                                <div className="backup-preview-title">{t('sync_conflict_title')}</div>
                                <p>{t('sync_conflict_description', [syncConflict.remoteDate])}</p>
                                <div className="backup-preview-grid">
                                    <div>
                                        <span>{t('preview_new')}</span>
                                        <strong>{syncConflict.summary.newCount}</strong>
                                    </div>
                                    <div>
                                        <span>{t('preview_updates')}</span>
                                        <strong>{syncConflict.summary.updatedCount}</strong>
                                    </div>
                                    <div>
                                        <span>{t('preview_duplicates')}</span>
                                        <strong>{syncConflict.summary.duplicateCount}</strong>
                                    </div>
                                    <div>
                                        <span>{t('preview_after_merge')}</span>
                                        <strong>{syncConflict.summary.mergedCount}</strong>
                                    </div>
                                </div>
                                <div className="conflict-action-grid">
                                    <button type="button" className="btn-primary" onClick={() => resolveSyncConflict('merge')} disabled={syncing}>
                                        {t('sync_conflict_merge')}
                                    </button>
                                    <button type="button" className="btn-secondary" onClick={() => resolveSyncConflict('local')} disabled={syncing}>
                                        {t('sync_conflict_use_local')}
                                    </button>
                                    <button type="button" className="btn-secondary" onClick={() => resolveSyncConflict('remote')} disabled={syncing}>
                                        {t('sync_conflict_use_remote')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {showRestoreList && backupFiles.length > 0 && (
                            <div className="backup-list">
                                <h4>{t('backup_history_title')}</h4>
                                <div className="backup-list-scroll">
                                    {backupFiles.map((file) => (
                                        <button
                                            type="button"
                                            key={file.name}
                                            onClick={() => prepareRestorePreview(file)}
                                            className={`backup-file-row ${restorePreview?.file.name === file.name ? 'selected' : ''}`}
                                        >
                                            <span className="backup-file-main">
                                                <span className="backup-file-name">{file.name}</span>
                                                <span className="backup-file-device">
                                                    {file.displayDeviceName}
                                                    {file.accountCount !== undefined && (
                                                        <span> · {t('backup_account_count', [String(file.accountCount)])}</span>
                                                    )}
                                                </span>
                                            </span>
                                            <span className="backup-file-date">{file.date}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {restorePreview && (
                            <div className="backup-preview-panel">
                                <div className="backup-preview-title">{t('restore_preview_title')}</div>
                                <p>{restorePreview.file.name}</p>
                                <div className="backup-preview-grid">
                                    <div>
                                        <span>{t('preview_total')}</span>
                                        <strong>{restorePreview.summary.incomingCount}</strong>
                                    </div>
                                    <div>
                                        <span>{t('preview_new')}</span>
                                        <strong>{restorePreview.summary.newCount}</strong>
                                    </div>
                                    <div>
                                        <span>{t('preview_updates')}</span>
                                        <strong>{restorePreview.summary.updatedCount}</strong>
                                    </div>
                                    <div>
                                        <span>{t('preview_duplicates')}</span>
                                        <strong>{restorePreview.summary.duplicateCount}</strong>
                                    </div>
                                </div>
                                <p>{t('restore_preview_result', [restorePreview.summary.mergedCount.toString()])}</p>
                                <div className="restore-preview-actions">
                                    <button type="button" className="btn-secondary" onClick={() => setRestorePreview(null)}>
                                        {t('cancel')}
                                    </button>
                                    <button type="button" className="btn-primary" onClick={handleRestore} disabled={restoreLoading}>
                                        {restoreLoading ? t('restore_process') : t('btn_confirm_restore')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {showLogs && (
                            <div className="backup-list sync-log-panel">
                                <div className="backup-list-header">
                                    <h4>{t('sync_logs_title')}</h4>
                                    <button
                                        type="button"
                                        className="btn-subtle"
                                        onClick={async () => {
                                            await clearSyncLogs();
                                            setSyncLogs([]);
                                            showToast('success', t('logs_cleared'));
                                        }}
                                    >
                                        <span className="btn-icon"><TrashIcon /></span>
                                        {t('clear_logs')}
                                    </button>
                                </div>
                                <div className="sync-log-list">
                                    {syncLogs.length === 0 ? (
                                        <div className="empty-state">
                                            {t('no_sync_logs')}
                                        </div>
                                    ) : (
                                        syncLogs.map((log, index) => {
                                            const localizedLog = getLocalizedSyncLogText(log, t);
                                            const levelClass = `sync-log-${log.level.toLowerCase()}`;
                                            return (
                                                <div
                                                    key={index}
                                                    className={`sync-log-entry ${levelClass}`}
                                                >
                                                    <div className="sync-log-main">
                                                        <span className="sync-log-message">
                                                            <span className="status-dot" aria-hidden="true" />
                                                            {localizedLog.message}
                                                        </span>
                                                        <span className="sync-log-time">
                                                            {formatLogTime(log.timestamp)}
                                                        </span>
                                                    </div>
                                                    {localizedLog.details && (
                                                        <div className="sync-log-details">
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

                        <details className="backup-tips backup-tips-details">
                            <summary>{t('backup_tips_title')}</summary>
                            <ul>
                                <li><strong>Nextcloud:</strong> https://your-domain/remote.php/dav/files/username/</li>
                                <li><strong>Synology:</strong> https://your-nas/webdav/</li>
                            </ul>
                        </details>
                    </section>
                </div>
            </div>
        </div>
    );
}
