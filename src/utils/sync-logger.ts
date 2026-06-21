/**
 * WebDAV Sync Logger | WebDAV 同步日志工具
 *
 * Log WebDAV backup and restore operations for debugging and monitoring.
 * 记录 WebDAV 备份和恢复操作的详细日志，便于调试和监控同步状态。
 */

// Log levels | 日志级别
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

// Operation types | 操作类型
export type SyncOperation =
    | 'BACKUP_START'
    | 'BACKUP_SUCCESS'
    | 'BACKUP_FAILED'
    | 'RESTORE_START'
    | 'RESTORE_SUCCESS'
    | 'RESTORE_FAILED'
    | 'CONFIG_SAVED'
    | 'AUTO_BACKUP_TRIGGER'
    | 'LIST_BACKUPS'
    | 'PERMISSION_REQUEST';

// Log entry interface | 日志条目接口
export interface SyncLogEntry {
    timestamp: number;
    level: LogLevel;
    operation: SyncOperation;
    message: string;
    details?: string;
    messageKey?: string;
    messageArgs?: string[];
    detailsKey?: string;
    detailsArgs?: string[];
}

// Storage key | 存储键名
const STORAGE_KEY = 'webdavSyncLogs';

// Max log entries | 最大日志条目数
const MAX_LOG_ENTRIES = 100;

type TranslationFunction = (key: string, substitutions?: string | string[]) => string;

interface SyncLogLocalization {
    messageKey?: string;
    messageArgs?: string[];
    detailsKey?: string;
    detailsArgs?: string[];
}

interface LocalizedSyncLogOptions {
    messageKey: string;
    messageArgs?: string[];
    detailsKey?: string;
    detailsArgs?: string[];
    messageFallback?: string;
    detailsFallback?: string;
}

const LEGACY_MESSAGE_KEYS: Record<string, string> = {
    '检测到远程更新，正在下载': 'sync_downloading',
    '本地更新，正在上传': 'sync_uploading',
    '上传前去重': 'log_pre_upload_dedupe',
    '自动同步成功（下载）': 'log_auto_sync_download_success',
    '自动备份成功（上传）': 'log_auto_backup_upload_success',
    '自动备份跳过（已是最新）': 'log_auto_backup_skipped',
    '自动备份失败': 'log_auto_backup_failed',
    '启动同步成功（下载）': 'log_startup_sync_download_success',
    '启动同步成功（上传）': 'log_startup_sync_upload_success',
    '启动同步跳过': 'log_startup_sync_skipped',
    '备份保留策略已执行': 'retention_cleanup_done',
    '备份成功，但保留策略执行失败': 'retention_cleanup_failed',
};

function getChromeMessage(key: string, substitutions?: string[]): string {
    try {
        return chrome.i18n.getMessage(key, substitutions);
    } catch {
        return '';
    }
}

function translateLogField(
    t: TranslationFunction,
    key: string | undefined,
    args: string[] | undefined,
    fallback?: string
): string | undefined {
    if (!key) return fallback;
    const translated = t(key, args);
    if (translated && translated !== key) return translated;
    return fallback || key;
}

function parseLegacyDetails(details: string, t: TranslationFunction): string | undefined {
    let match = details.match(/^新增 (-?\d+) 个账户, 去重 (-?\d+) 个$/);
    if (match) return translateLogField(t, 'log_details_added_deduped', [match[1], match[2]], details);

    match = details.match(/^导入 (-?\d+) 个账户, 去重 (-?\d+) 个$/);
    if (match) return translateLogField(t, 'log_details_imported_deduped', [match[1], match[2]], details);

    match = details.match(/^去重 (-?\d+) 个账户$/);
    if (match) return translateLogField(t, 'log_details_deduped', [match[1]], details);

    match = details.match(/^移除 (-?\d+) 个重复账户$/);
    if (match) return translateLogField(t, 'log_details_removed_duplicates', [match[1]], details);

    match = details.match(/^文件: (.+)$/);
    if (match) return translateLogField(t, 'log_details_file', [match[1]], details);

    match = details.match(/^删除 (-?\d+) 个过期备份, 失败 (-?\d+) 个$/);
    if (match) return translateLogField(t, 'log_details_retention_cleanup', [match[1], match[2]], details);

    if (details === '本地和远程数据一致') {
        return translateLogField(t, 'log_details_local_remote_up_to_date', undefined, details);
    }

    if (details === '自动备份: 开启') {
        return translateLogField(t, 'log_details_auto_backup_enabled', undefined, details);
    }

    if (details === '自动备份: 关闭') {
        return translateLogField(t, 'log_details_auto_backup_disabled', undefined, details);
    }

    return undefined;
}

/**
 * Add sync log | 添加同步日志
 * @param level - Log level | 日志级别
 * @param operation - Operation type | 操作类型
 * @param message - Log message | 日志消息
 * @param details - Optional details | 详细信息（可选）
 */
export async function addSyncLog(
    level: LogLevel,
    operation: SyncOperation,
    message: string,
    details?: string,
    localization?: SyncLogLocalization
): Promise<void> {
    try {
        const entry: SyncLogEntry = {
            timestamp: Date.now(),
            level,
            operation,
            message,
            details,
            ...localization
        };

        // Output to console as well |同时输出到控制台
        const logPrefix = `[Auths WebDAV] [${level}] [${operation}]`;
        if (level === 'ERROR') {
            console.error(logPrefix, message, details || '');
        } else if (level === 'WARN') {
            console.warn(logPrefix, message, details || '');
        } else {
            console.log(logPrefix, message, details || '');
        }

        // Get existing logs | 获取现有日志
        const result = await chrome.storage.local.get([STORAGE_KEY]);
        const logs: SyncLogEntry[] = result[STORAGE_KEY] || [];

        // Add new log | 添加新日志
        logs.push(entry);

        // Keep log count within limit | 保持日志数量在限制内
        while (logs.length > MAX_LOG_ENTRIES) {
            logs.shift();
        }

        // Save logs | 保存日志
        await chrome.storage.local.set({ [STORAGE_KEY]: logs });
    } catch (error) {
        console.error('[Auths WebDAV] Failed to save log:', error);
    }
}

export async function addLocalizedSyncLog(
    level: LogLevel,
    operation: SyncOperation,
    options: LocalizedSyncLogOptions
): Promise<void> {
    const message = getChromeMessage(options.messageKey, options.messageArgs) || options.messageFallback || options.messageKey;
    const details = options.detailsKey
        ? getChromeMessage(options.detailsKey, options.detailsArgs) || options.detailsFallback || options.detailsKey
        : options.detailsFallback;

    await addSyncLog(level, operation, message, details, {
        messageKey: options.messageKey,
        messageArgs: options.messageArgs,
        detailsKey: options.detailsKey,
        detailsArgs: options.detailsArgs,
    });
}

export function getLocalizedSyncLogText(
    log: SyncLogEntry,
    t: TranslationFunction
): { message: string; details?: string } {
    const legacyMessageKey = log.messageKey || LEGACY_MESSAGE_KEYS[log.message];
    const message = translateLogField(t, legacyMessageKey, log.messageArgs, log.message) || log.message;

    const details = log.detailsKey
        ? translateLogField(t, log.detailsKey, log.detailsArgs, log.details)
        : log.details
            ? parseLegacyDetails(log.details, t) || log.details
            : undefined;

    return { message, details };
}

/**
 * Get all sync logs | 获取所有同步日志
 * @returns Log list (reverse chronological) | 日志列表（按时间倒序）
 */
export async function getSyncLogs(): Promise<SyncLogEntry[]> {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEY]);
        const logs: SyncLogEntry[] = result[STORAGE_KEY] || [];
        // Return reverse (newest first) | 返回倒序（最新在前）
        return logs.reverse();
    } catch (error) {
        console.error('[Auths WebDAV] Failed to get logs:', error);
        return [];
    }
}

/**
 * Clear all sync logs | 清空所有同步日志
 */
export async function clearSyncLogs(): Promise<void> {
    try {
        await chrome.storage.local.remove(STORAGE_KEY);
        console.log('[Auths WebDAV] Logs cleared');
    } catch (error) {
        console.error('[Auths WebDAV] Failed to clear logs:', error);
    }
}

/**
 * Format log timestamp | 格式化日志时间戳
 * @param timestamp - Timestamp | 时间戳
 * @returns Formatted date string | 格式化的时间字符串
 */
export function formatLogTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
}
