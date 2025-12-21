import React, { useState } from 'react';
import './NewComponents.css';

interface CloudBackupProps {
    onClose: () => void;
}

export default function CloudBackup({ onClose }: CloudBackupProps) {
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleConnect = (service: string) => {
        setMessage({ type: 'success', text: `正在连接 ${service}...` });
        chrome.runtime.sendMessage({ action: service.toLowerCase().replace(' ', '') });

        // Listen for response
        setTimeout(() => {
            setMessage({ type: 'success', text: `${service} 授权窗口已打开` });
        }, 1000);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content cloud-backup-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>☁️ 云备份</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <p className="section-description">
                        选择云服务商进行账户数据备份
                    </p>

                    <div className="cloud-services">
                        {/* Google Drive */}
                        <button
                            className="cloud-btn"
                            onClick={() => handleConnect('drive')}
                        >
                            <div className="cloud-icon">
                                <svg viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M6.6 66.85l14.7-26.45h65.4l-14.7 26.45z" fill="#0066da" />
                                    <path d="M58.8 0L29.4 51.6l-14.7 26.45L0 51.6z" fill="#00ac47" />
                                    <path d="M29.4 51.6L58.8 0h28.5L57.9 51.6z" fill="#ea4335" />
                                    <path d="M29.4 51.6l14.7 26.45h42.6L72.3 51.6z" fill="#00832d" />
                                    <path d="M57.9 51.6L87.3 0H58.8L29.4 51.6z" fill="#2684fc" />
                                    <path d="M0 51.6l14.7 26.45 14.7-26.45H6.6z" fill="#ffba00" />
                                </svg>
                            </div>
                            <div className="cloud-info">
                                <div className="cloud-name">Google Drive</div>
                                <div className="cloud-status">点击连接授权</div>
                            </div>
                        </button>

                        {/* Dropbox */}
                        <button
                            className="cloud-btn"
                            onClick={() => handleConnect('dropbox')}
                        >
                            <div className="cloud-icon">
                                <svg viewBox="0 0 24 24" fill="#0061FF">
                                    <path d="M6 2L0 6.5L6 11L12 6.5L6 2ZM18 2L12 6.5L18 11L24 6.5L18 2ZM0 15.5L6 20L12 15.5L6 11L0 15.5ZM18 11L12 15.5L18 20L24 15.5L18 11ZM6 21.5L12 17L18 21.5L12 26L6 21.5Z" />
                                </svg>
                            </div>
                            <div className="cloud-info">
                                <div className="cloud-name">Dropbox</div>
                                <div className="cloud-status">点击连接授权</div>
                            </div>
                        </button>

                        {/* OneDrive */}
                        <button
                            className="cloud-btn"
                            onClick={() => handleConnect('onedrive')}
                        >
                            <div className="cloud-icon">
                                <svg viewBox="0 0 24 24" fill="none">
                                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#0078D4" />
                                </svg>
                            </div>
                            <div className="cloud-info">
                                <div className="cloud-name">OneDrive</div>
                                <div className="cloud-status">点击连接授权</div>
                            </div>
                        </button>
                    </div>

                    {message && (
                        <div className={`message ${message.type}`}>
                            {message.text}
                        </div>
                    )}

                    <div className="backup-tips">
                        <h4>💡 使用提示</h4>
                        <ul>
                            <li>点击服务后会弹出授权窗口</li>
                            <li>授权成功后自动上传备份</li>
                            <li>备份文件以日期命名保存</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
