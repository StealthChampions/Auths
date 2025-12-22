import React, { useState } from 'react';
import { SecureHash } from '../../models/encryption';
import './NewComponents.css';

interface WebDAVProps {
    onClose: () => void;
}

/**
 * 获取当前会话中的主密码（用于加密 WebDAV 凭据）
 */
async function getCachedPassphrase(): Promise<string | null> {
    try {
        const result = await chrome.storage.session.get(['cachedPassphrase']);
        return result.cachedPassphrase || null;
    } catch {
        return null;
    }
}

export default function WebDAV({ onClose }: WebDAVProps) {
    const [serverUrl, setServerUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [autoBackup, setAutoBackup] = useState(false);
    const [backupInterval, setBackupInterval] = useState('1440'); // Default 24 hours
    const [retentionDays, setRetentionDays] = useState(30); // Default 30 days

    const handleSaveConfig = async () => {
        if (!serverUrl || !username || !password) {
            setMessage({ type: 'error', text: '请填写所有字段' });
            return;
        }

        // Validate URL
        try {
            new URL(serverUrl);
        } catch {
            setMessage({ type: 'error', text: '请输入有效的服务器地址' });
            return;
        }

        // 获取主密码用于加密 WebDAV 凭据
        const masterPassword = await getCachedPassphrase();
        if (!masterPassword) {
            setMessage({ type: 'error', text: '请先解锁应用后再配置 WebDAV' });
            return;
        }

        // 加密 WebDAV 密码
        const encryptedPassword = SecureHash.encryptData(password, masterPassword);

        const config = {
            serverUrl,
            username,
            encryptedPassword, // 存储加密后的密码
            autoBackup,
            backupInterval: parseInt(backupInterval),
            retentionDays
        };

        // Save config to storage (不再存储明文密码)
        await chrome.storage.local.set({ webdavConfig: config });

        // Configure alarm
        if (autoBackup) {
            chrome.alarms.create('autoBackup', {
                periodInMinutes: parseInt(backupInterval)
            });
        } else {
            chrome.alarms.clear('autoBackup');
        }

        setMessage({ type: 'success', text: '配置已保存！' });
    };

    const handleBackup = async () => {
        if (!serverUrl || !username || !password) {
            setMessage({ type: 'error', text: '请先配置 WebDAV 服务器' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            // Get entries from storage
            const result = await chrome.storage.local.get(['entries']);
            const entries = result.entries || [];

            if (entries.length === 0) {
                setMessage({ type: 'error', text: '没有可备份的账户' });
                setLoading(false);
                return;
            }

            // Create backup data
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

            // Upload to WebDAV (使用当前状态中的明文密码，因为用户刚输入)
            const response = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Basic ' + btoa(`${username}:${password}`),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(backupData, null, 2)
            });

            if (response.ok || response.status === 201 || response.status === 204) {
                setMessage({ type: 'success', text: '备份成功！' });
            } else {
                if (response.status === 401) {
                    throw new Error('认证失败：请检查用户名和密码');
                } else if (response.status === 404) {
                    throw new Error('路径错误：服务器地址不正确或文件夹不存在');
                } else if (response.status === 409) {
                    throw new Error('冲突：目标文件夹不存在');
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            }
        } catch (err) {
            setMessage({ type: 'error', text: '备份失败: ' + (err instanceof Error ? err.message : '网络错误') });
        } finally {
            setLoading(false);
        }
    };

    // Load saved config on mount
    React.useEffect(() => {
        const loadConfig = async () => {
            const result = await chrome.storage.local.get(['webdavConfig']);
            if (result.webdavConfig) {
                setServerUrl(result.webdavConfig.serverUrl || '');
                setUsername(result.webdavConfig.username || '');
                // 密码需要解密才能显示，如果有主密码的话
                // 为安全起见，不自动填充密码，让用户重新输入
                // 或显示占位符
                if (result.webdavConfig.encryptedPassword) {
                    // 有加密密码，尝试解密
                    const masterPassword = await getCachedPassphrase();
                    if (masterPassword) {
                        const decrypted = SecureHash.decryptData(
                            result.webdavConfig.encryptedPassword,
                            masterPassword
                        );
                        if (decrypted) {
                            setPassword(decrypted);
                        }
                    }
                } else if (result.webdavConfig.password) {
                    // 兼容旧版本的明文密码
                    setPassword(result.webdavConfig.password);
                }
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
                    <h2>🌐 WebDAV 备份</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <p className="section-description">
                        连接到自建服务器进行备份（支持 Nextcloud、坚果云等）
                    </p>

                    <div className="form-group">
                        <label htmlFor="serverUrl">服务器地址</label>
                        <input
                            type="url"
                            id="serverUrl"
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            placeholder="https://example.com/webdav/"
                        />
                        <span className="input-hint">完整的 WebDAV 目录地址</span>
                    </div>

                    <div className="form-group">
                        <label htmlFor="username">用户名</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="您的用户名"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">密码</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="您的密码或应用密码"
                        />
                    </div>

                    <div className="toggle-setting" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--color-border)', marginTop: '16px' }}>
                        <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>开启自动备份</span>
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
                                <label htmlFor="backupInterval">备份频率</label>
                                <select
                                    id="backupInterval"
                                    value={backupInterval}
                                    onChange={(e) => setBackupInterval(e.target.value)}
                                    className="form-select"
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                >
                                    <option value="60">每小时</option>
                                    <option value="360">每6小时</option>
                                    <option value="720">每12小时</option>
                                    <option value="1440">每天</option>
                                    <option value="10080">每周</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="retentionDays">保留策略</label>
                                <select
                                    id="retentionDays"
                                    value={retentionDays}
                                    onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                                    className="form-select"
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                >
                                    <option value={7}>保留最近 7 天</option>
                                    <option value={30}>保留最近 30 天</option>
                                    <option value={90}>保留最近 90 天</option>
                                    <option value={365}>保留最近 1 年</option>
                                    <option value={-1}>永久保留</option>
                                </select>
                            </div>
                        </>
                    )}

                    <div className="button-group">
                        <button
                            className="btn-secondary"
                            onClick={handleSaveConfig}
                        >
                            💾 保存配置
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleBackup}
                            disabled={loading}
                        >
                            {loading ? '⏳ 备份中...' : '☁️ 立即备份'}
                        </button>
                    </div>

                    {message && (
                        <div className={`message ${message.type}`}>
                            {message.text}
                        </div>
                    )}

                    <div className="backup-tips">
                        <h4>💡 常用服务配置</h4>
                        <ul>
                            <li><strong>坚果云:</strong> https://dav.jianguoyun.com/dav/</li>
                            <li><strong>Nextcloud:</strong> https://你的域名/remote.php/dav/files/用户名/</li>
                            <li><strong>Synology:</strong> https://你的NAS/webdav/</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
