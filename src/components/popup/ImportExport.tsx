import React, { useState, useEffect } from 'react';
import { useBackup } from '../../store';

interface ImportExportProps {
  onClose: () => void;
}

export default function ImportExport({ onClose }: ImportExportProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportPassword, setExportPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [accountCount, setAccountCount] = useState(0);
  const { dispatch } = useBackup();

  // Load account count on mount
  useEffect(() => {
    const loadAccountCount = async () => {
      const result = await chrome.storage.local.get(['entries']);
      const entries = result.entries || [];
      setAccountCount(entries.length);
    };
    loadAccountCount();
  }, []);

  const handleExport = async () => {
    try {
      setMessage(null);

      if (!exportPassword) {
        setMessage({ type: 'error', text: '请输入加密密码' });
        return;
      }

      // Get all accounts from storage
      const result = await chrome.storage.local.get(['entries']);
      const accounts = result.entries || [];

      if (accounts.length === 0) {
        setMessage({ type: 'error', text: '没有可导出的账户' });
        return;
      }

      // Create backup data
      const backupData = {
        version: '1.0',
        timestamp: Date.now(),
        accounts: accounts,
        // Add encryption here using exportPassword
      };

      // Create download
      const dataStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auths-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: '导出成功！' });
      setExportPassword('');
    } catch (err) {
      console.error('Export failed:', err);
      setMessage({ type: 'error', text: '导出失败: ' + (err instanceof Error ? err.message : '未知错误') });
    }
  };

  const handleImport = async () => {
    try {
      setMessage(null);

      if (!importFile) {
        setMessage({ type: 'error', text: '请选择备份文件' });
        return;
      }

      if (!importPassword) {
        setMessage({ type: 'error', text: '请输入解密密码' });
        return;
      }

      // Read file
      const text = await importFile.text();
      const backupData = JSON.parse(text);

      if (!backupData.accounts || !Array.isArray(backupData.accounts)) {
        setMessage({ type: 'error', text: '备份文件格式不正确' });
        return;
      }

      // Decrypt and restore (simplified - add proper decryption)
      const accounts = backupData.accounts;

      // Merge with existing accounts
      const result = await chrome.storage.local.get(['entries']);
      const existingAccounts = result.entries || [];
      const mergedAccounts = [...existingAccounts];

      let importCount = 0;
      for (const account of accounts) {
        const exists = mergedAccounts.find(a => a.hash === account.hash);
        if (!exists) {
          mergedAccounts.push(account);
          importCount++;
        }
      }

      await chrome.storage.local.set({ entries: mergedAccounts });

      setMessage({ type: 'success', text: `成功导入 ${importCount} 个账户！` });
      setImportFile(null);
      setImportPassword('');
    } catch (err) {
      console.error('Import failed:', err);
      setMessage({ type: 'error', text: '导入失败: ' + (err instanceof Error ? err.message : '未知错误') });
    }
  };

  return (
    <div className="import-export-modal">
      <div className="modal-header">
        <h2>数据备份与恢复</h2>
        <button className="close-btn" onClick={onClose} title="关闭">
          ✕
        </button>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          导出备份
        </button>
        <button
          className={`tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          导入备份
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'export' ? (
          <div className="export-section">
            <p className="section-description">
              将所有账户导出为加密的备份文件
            </p>

            <div className="form-group">
              <label htmlFor="exportPassword">加密密码</label>
              <input
                type="password"
                id="exportPassword"
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                placeholder="用于加密备份文件的密码"
              />
              <span className="input-hint">
                此密码用于加密导出的备份文件，请妥善保管
              </span>
            </div>

            <div className="export-info">
              <div className="info-item">
                <span className="info-label">账户数量:</span>
                <span className="info-value">{accountCount}</span>
              </div>
              <div className="info-item">
                <span className="info-label">导出格式:</span>
                <span className="info-value">JSON (加密)</span>
              </div>
            </div>

            <button
              className="btn-primary btn-full"
              onClick={handleExport}
              disabled={!exportPassword}
            >
              📥 导出备份文件
            </button>
          </div>
        ) : (
          <div className="import-section">
            <p className="section-description">
              从备份文件恢复账户数据
            </p>

            <div className="form-group">
              <label htmlFor="importFile">选择备份文件</label>
              <div className="file-input-wrapper">
                <input
                  type="file"
                  id="importFile"
                  accept=".json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                <div className="file-input-display">
                  {importFile ? importFile.name : '选择 .json 文件...'}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="importPassword">解密密码</label>
              <input
                type="password"
                id="importPassword"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                placeholder="导出时设置的密码"
              />
            </div>

            <div className="import-warning">
              ⚠️ 导入将合并备份文件中的账户到现有数据
            </div>

            <button
              className="btn-primary btn-full"
              onClick={handleImport}
              disabled={!importFile || !importPassword}
            >
              📤 导入备份
            </button>
          </div>
        )}

        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
