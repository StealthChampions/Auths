/**
 * WebDAV Sync Logger | WebDAV 同步日志工具
 *
 * 记录 WebDAV 备份和恢复操作的详细日志，便于调试和监控同步状态。
 */

// 日志级别
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

// 操作类型
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

// 日志条目接口
export interface SyncLogEntry {
    timestamp: number;
    level: LogLevel;
    operation: SyncOperation;
    message: string;
    details?: string;
}

// 存储键名
const STORAGE_KEY = 'webdavSyncLogs';

// 最大日志条目数
const MAX_LOG_ENTRIES = 100;

/**
 * 添加同步日志
 * @param level - 日志级别
 * @param operation - 操作类型
 * @param message - 日志消息
 * @param details - 详细信息（可选）
 */
export async function addSyncLog(
    level: LogLevel,
    operation: SyncOperation,
    message: string,
    details?: string
): Promise<void> {
    try {
        const entry: SyncLogEntry = {
            timestamp: Date.now(),
            level,
            operation,
            message,
            details
        };

        // 同时输出到控制台
        const logPrefix = `[Auths WebDAV] [${level}] [${operation}]`;
        if (level === 'ERROR') {
            console.error(logPrefix, message, details || '');
        } else if (level === 'WARN') {
            console.warn(logPrefix, message, details || '');
        } else {
            console.log(logPrefix, message, details || '');
        }

        // 获取现有日志
        const result = await chrome.storage.local.get([STORAGE_KEY]);
        const logs: SyncLogEntry[] = result[STORAGE_KEY] || [];

        // 添加新日志
        logs.push(entry);

        // 保持日志数量在限制内
        while (logs.length > MAX_LOG_ENTRIES) {
            logs.shift();
        }

        // 保存日志
        await chrome.storage.local.set({ [STORAGE_KEY]: logs });
    } catch (error) {
        console.error('[Auths WebDAV] Failed to save log:', error);
    }
}

/**
 * 获取所有同步日志
 * @returns 日志列表（按时间倒序）
 */
export async function getSyncLogs(): Promise<SyncLogEntry[]> {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEY]);
        const logs: SyncLogEntry[] = result[STORAGE_KEY] || [];
        // 返回倒序（最新在前）
        return logs.reverse();
    } catch (error) {
        console.error('[Auths WebDAV] Failed to get logs:', error);
        return [];
    }
}

/**
 * 清空所有同步日志
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
 * 格式化日志时间戳
 * @param timestamp - 时间戳
 * @returns 格式化的时间字符串
 */
export function formatLogTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
}
