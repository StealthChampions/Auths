/**
 * WebDAV Sync Component | WebDAV 同步组件
 *
 * Provides WebDAV cloud sync functionality for backup and restore.
 * 提供 WebDAV 云同步功能，用于备份和恢复。
 */

import React, { useState } from 'react';
import { useI18n } from '@/i18n';
import { useNotification, useAccounts } from '@/store';
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

    // Helper function to show toast messages | 显示 Toast 消息的辅助函数
    const showToast = (type: 'success' | 'error', text: string) => {
        notificationDispatch({ type, payload: text });
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
            const response = await fetch(serverUrl, {
                method: 'PROPFIND',
                headers: {
                    'Authorization': 'Basic ' + btoa(`${username}:${password}`),
                    'Depth': '1',
                    'Content-Type': 'application/xml'
                },
                body: `<?xml version="1.0" encoding="utf-8" ?>
                    <D:propfind xmlns:D="DAV:">
                        <D:prop>
                            <D:displayname/>
                            <D:getlastmodified/>
                        </D:prop>
                    </D:propfind>`
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const text = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            const responses = xml.getElementsByTagNameNS('DAV:', 'response');

            const files: Array<{ name: string, date: string }> = [];
            for (let i = 0; i < responses.length; i++) {
                const href = responses[i].getElementsByTagNameNS('DAV:', 'href')[0]?.textContent || '';
                const lastModified = responses[i].getElementsByTagNameNS('DAV:', 'getlastmodified')[0]?.textContent || '';

                // Filter for auths backup files | 筛选 auths 备份文件
                if (href.includes('auths-backup') && href.endsWith('.json')) {
                    const name = decodeURIComponent(href.split('/').pop() || '');
                    files.push({
                        name,
                        date: lastModified ? new Date(lastModified).toLocaleString() : 'Unknown'
                    });
                }
            }

            // Sort by name (date in filename) descending | 按文件名（包含日期）降序排序
            files.sort((a, b) => b.name.localeCompare(a.name));

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

        try {
            const downloadUrl = serverUrl.endsWith('/')
                ? `${serverUrl}${filename}`
                : `${serverUrl}/${filename}`;

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: {
                    'Authorization': 'Basic ' + btoa(`${username}:${password}`)
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const backupData = await response.json();

            if (!backupData.accounts || !Array.isArray(backupData.accounts)) {
                throw new Error(t('format_error'));
            }

            // Merge with existing accounts | 与现有账户合并
            const result = await chrome.storage.local.get(['entries']);
            const existingAccounts = result.entries || [];
            const mergedAccounts = [...existingAccounts];

            let importCount = 0;
            for (const account of backupData.accounts) {
                const exists = mergedAccounts.find((a: any) => a.hash === account.hash);
                if (!exists) {
                    mergedAccounts.push(account);
                    importCount++;
                }
            }

            await chrome.storage.local.set({ entries: mergedAccounts });

            // Update global state immediately | 立即更新全局状态
            accountsDispatch({ type: 'setEntries', payload: mergedAccounts });

            showToast('success', t('restore_success', [importCount.toString()]));
            setShowRestoreList(false);
        } catch (err) {
            showToast('error', t('restore_failed') + (err instanceof Error ? err.message : t('unknown_error')));
        } finally {
            setRestoreLoading(false);
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

        // Request permission for WebDAV server | 请求 WebDAV 服务器访问权限
        if (!await ensureWebDAVPermission(serverUrl)) {
            showToast('error', t('permission_denied'));
            return;
        }

        const config = {
            serverUrl,
            username,
            password, // Store password directly (no encryption without master password) | 直接存储密码（无主密码时不加密）
            autoBackup,
            backupInterval: parseInt(backupInterval),
            retentionDays
        };

        // Save config to storage | 保存配置到存储
        await chrome.storage.local.set({ webdavConfig: config });

        // Configure auto-backup alarm | 配置自动备份定时器
        if (autoBackup) {
            // Request alarms permission dynamically | 动态请求 alarms 权限
            const hasAlarmsPermission = await chrome.permissions.request({ permissions: ['alarms'] });
            if (!hasAlarmsPermission) {
                showToast('error', t('permission_denied'));
                return;
            }
            chrome.alarms.create('autoBackup', {
                periodInMinutes: parseInt(backupInterval)
            });
        } else {
            // Only clear alarm if we have permission | 仅在有权限时清除定时器
            const hasAlarms = await chrome.permissions.contains({ permissions: ['alarms'] });
            if (hasAlarms) {
                chrome.alarms.clear('autoBackup');
            }
        }

        showToast('success', t('config_saved'));
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

        try {
            // Get entries from storage | 从存储中获取账户数据
            const result = await chrome.storage.local.get(['entries']);
            const entries = result.entries || [];

            if (entries.length === 0) {
                showToast('error', t('no_accounts_backup'));
                setLoading(false);
                return;
            }

            // Create backup data | 创建备份数据
            const backupData = {
                version: '1.0',
                timestamp: Date.now(),
                accounts: entries
            };

            const now = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const filename = `auths-backup-${now}.json`;
            const uploadUrl = serverUrl.endsWith('/')
                ? `${serverUrl}${filename}`
                : `${serverUrl}/${filename}`;

            // Upload to WebDAV | 上传到 WebDAV（使用当前状态中的明文密码）
            const response = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Basic ' + btoa(`${username}:${password}`),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(backupData, null, 2)
            });

            if (response.ok || response.status === 201 || response.status === 204) {
                showToast('success', t('backup_success'));
            } else {
                if (response.status === 401) {
                    throw new Error(t('auth_failed'));
                } else if (response.status === 404) {
                    throw new Error(t('path_error'));
                } else if (response.status === 409) {
                    throw new Error(t('conflict_error'));
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            }
        } catch (err) {
            showToast('error', t('backup_failed') + (err instanceof Error ? err.message : t('unknown_error')));
        } finally {
            setLoading(false);
        }
    };

    // Load saved config on mount | 组件挂载时加载已保存的配置
    React.useEffect(() => {
        const loadConfig = async () => {
            const result = await chrome.storage.local.get(['webdavConfig']);
            if (result.webdavConfig) {
                setServerUrl(result.webdavConfig.serverUrl || '');
                setUsername(result.webdavConfig.username || '');
                // Load password directly | 直接加载密码
                setPassword(result.webdavConfig.password || '');
                setAutoBackup(result.webdavConfig.autoBackup || false);
                setBackupInterval(result.webdavConfig.backupInterval?.toString() || '1440');
                setRetentionDays(result.webdavConfig.retentionDays || 30);
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
