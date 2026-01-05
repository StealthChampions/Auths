/**
 * Import/Export Component | 导入导出组件
 *
 * Handles encrypted backup export and import functionality.
 * 处理加密备份的导出和导入功能。
 */

import React, { useState, useEffect } from 'react';
import { useBackup, useNotification, useAccounts } from '@/store';
import { useI18n } from '@/i18n';
import { SecureHash } from '@/models/encryption';

interface ImportExportProps {
  onClose: () => void;
}

export default function ImportExport({ onClose }: ImportExportProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportPassword, setExportPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [accountCount, setAccountCount] = useState(0);
  const { dispatch } = useBackup();
  const { dispatch: notificationDispatch } = useNotification();
  const { dispatch: accountsDispatch } = useAccounts();
  const { t } = useI18n();

  // Helper function to show toast | 显示 Toast 的辅助函数
  const showToast = (type: 'success' | 'error', text: string) => {
    notificationDispatch({ type, payload: text });
  };

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
      // Get all accounts from storage
      const result = await chrome.storage.local.get(['entries']);
      const accounts = result.entries || [];

      if (accounts.length === 0) {
        showToast('error', t('no_accounts_backup'));
        return;
      }

      let backupData;

      if (exportPassword) {
        // Encrypt the accounts data if password provided
        // 如果提供了密码则加密数据
        const accountsJson = JSON.stringify(accounts);
        const encryptedData = SecureHash.encryptData(accountsJson, exportPassword);

        backupData = {
          version: '1.0',
          timestamp: Date.now(),
          encrypted: true,
          data: encryptedData
        };
      } else {
        // Export unencrypted if no password | 如果没有密码则导出未加密的
        backupData = {
          version: '1.0',
          timestamp: Date.now(),
          encrypted: false,
          accounts: accounts
        };
      }

      // Create download
      const dataStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auths-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);

      showToast('success', t('export_success'));
      setExportPassword('');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('error', t('export_failed') + (err instanceof Error ? err.message : t('unknown_error')));
    }
  };

  const handleImport = async () => {
    try {
      if (!importFile) {
        showToast('error', t('select_backup_file'));
        return;
      }

      // Read file
      const text = await importFile.text();
      const backupData = JSON.parse(text);

      // Check if file is encrypted (new format) or plain (legacy)
      let accounts;
      if (backupData.encrypted && backupData.data) {
        // Encrypted file requires password | 加密文件需要密码
        if (!importPassword) {
          showToast('error', t('enter_decrypt_password'));
          return;
        }
        // Decrypt the data
        const decryptedJson = SecureHash.decryptData(backupData.data, importPassword);
        if (!decryptedJson) {
          showToast('error', t('decrypt_failed'));
          return;
        }
        try {
          accounts = JSON.parse(decryptedJson);
        } catch {
          showToast('error', t('decrypt_format_error'));
          return;
        }
      } else if (backupData.accounts) {
        // Unencrypted format (no password needed) | 未加密格式（不需要密码）
        accounts = backupData.accounts;
      } else {
        showToast('error', t('format_error'));
        return;
      }

      if (!Array.isArray(accounts)) {
        showToast('error', t('format_error'));
        return;
      }

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

      // Update global state immediately | 立即更新全局状态
      accountsDispatch({ type: 'setEntries', payload: mergedAccounts });

      showToast('success', t('import_success', [importCount.toString()]));
      setImportFile(null);
      setImportPassword('');
    } catch (err) {
      console.error('Import failed:', err);
      showToast('error', t('import_failed') + (err instanceof Error ? err.message : t('unknown_error')));
    }
  };

  return (
    <div className="import-export-modal">
      <div className="modal-header">
        <h2>{t('backup_restore_title')}</h2>
        <button className="close-btn" onClick={onClose} title={t('close')}>
          ✕
        </button>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          {t('tab_export')}
        </button>
        <button
          className={`tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          {t('tab_import')}
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'export' ? (
          <div className="export-section">
            <p className="section-description">
              {t('export_desc')}
            </p>

            <div className="form-group">
              <label htmlFor="exportPassword">{t('encrypt_password')}</label>
              <input
                type="password"
                id="exportPassword"
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                placeholder={t('enter_encrypt_password')}
              />
              <span className="input-hint">
                {t('enter_encrypt_password_hint')}
              </span>
            </div>

            <div className="export-info">
              <div className="info-item">
                <span className="info-label">{t('account_count')}:</span>
                <span className="info-value">{accountCount}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('export_format')}:</span>
                <span className="info-value">JSON ({t('encrypt_password')})</span>
              </div>
            </div>

            <button
              className="btn-primary btn-full"
              onClick={handleExport}
            >
              📥 {t('btn_export_file')}
            </button>
          </div>
        ) : (
          <div className="import-section">
            <p className="section-description">
              {t('import_desc')}
            </p>

            <div className="form-group">
              <label htmlFor="importFile">{t('select_file')}</label>
              <div className="file-input-wrapper">
                <input
                  type="file"
                  id="importFile"
                  accept=".json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                <div className="file-input-display">
                  {importFile ? importFile.name : t('select_file_placeholder')}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="importPassword">{t('decrypt_password')}</label>
              <input
                type="password"
                id="importPassword"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                placeholder={t('enter_encrypt_password')}
              />
            </div>

            <div className="import-warning">
              ⚠️ {t('import_warning')}
            </div>

            <button
              className="btn-primary btn-full"
              onClick={handleImport}
              disabled={!importFile}
            >
              📤 {t('btn_import_file')}
            </button>
          </div>
        )}


      </div>
    </div>
  );
}
