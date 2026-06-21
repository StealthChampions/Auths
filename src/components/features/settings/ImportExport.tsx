/**
 * Import/Export Component | 导入导出组件
 *
 * Handles encrypted backup export and import functionality.
 * 处理加密备份的导出和导入功能。
 */

import React, { useState, useEffect } from 'react';
import { useNotification, useAccounts } from '@/store';
import { useI18n } from '@/i18n';
import { SecureHash } from '@/models/encryption';
import { buildBackupMergePreview, type BackupMergePreview } from '@/utils/backup-preview';
import { formatLocalDate } from '@/utils/date';

interface ImportExportProps {
  onClose: () => void;
}

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v11M8 10l4 4 4-4" />
    <path d="M5 17v3h14v-3" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21V10M8 14l4-4 4 4" />
    <path d="M5 7V4h14v3" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
  </svg>
);

export default function ImportExport({ onClose }: ImportExportProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportPassword, setExportPassword] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [importPreview, setImportPreview] = useState<BackupMergePreview | null>(null);
  const [previewAccounts, setPreviewAccounts] = useState<OTPEntryInterface[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [accountCount, setAccountCount] = useState(0);
  const { dispatch: notificationDispatch } = useNotification();
  const { dispatch: accountsDispatch } = useAccounts();
  const { t } = useI18n();

  // Helper function to show toast | 显示 Toast 的辅助函数
  const showToast = (type: 'success' | 'error', text: string) => {
    notificationDispatch({ type, payload: text });
  };

  const clearImportPreview = () => {
    setImportPreview(null);
    setPreviewAccounts([]);
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
      link.download = `auths-backup-${formatLocalDate()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      showToast('success', t('export_success'));
      setExportPassword('');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('error', t('export_failed') + (err instanceof Error ? err.message : t('unknown_error')));
    }
  };

  const readImportAccounts = async (): Promise<OTPEntryInterface[] | null> => {
    if (!importFile) {
      showToast('error', t('select_backup_file'));
      return null;
    }

    const text = await importFile.text();
    const backupData = JSON.parse(text);

    let accounts;
    if (backupData.encrypted && backupData.data) {
      if (!importPassword) {
        showToast('error', t('enter_decrypt_password'));
        return null;
      }

      const decryptedJson = SecureHash.decryptData(backupData.data, importPassword);
      if (!decryptedJson) {
        showToast('error', t('decrypt_failed'));
        return null;
      }

      try {
        accounts = JSON.parse(decryptedJson);
      } catch {
        showToast('error', t('decrypt_format_error'));
        return null;
      }
    } else if (backupData.accounts) {
      accounts = backupData.accounts;
    } else {
      showToast('error', t('format_error'));
      return null;
    }

    if (!Array.isArray(accounts)) {
      showToast('error', t('format_error'));
      return null;
    }

    return accounts as OTPEntryInterface[];
  };

  const prepareImportPreview = async () => {
    const accounts = await readImportAccounts();
    if (!accounts) return null;

    const result = await chrome.storage.local.get(['entries']);
    const existingAccounts: OTPEntryInterface[] = result.entries || [];
    const preview = buildBackupMergePreview(existingAccounts, accounts);
    setPreviewAccounts(accounts);
    setImportPreview(preview);
    return { accounts, preview };
  };

  const handlePreviewImport = async () => {
    try {
      setPreviewLoading(true);
      await prepareImportPreview();
    } catch (err) {
      console.error('Import preview failed:', err);
      showToast('error', t('import_failed') + (err instanceof Error ? err.message : t('unknown_error')));
      clearImportPreview();
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      if (!importFile) {
        showToast('error', t('select_backup_file'));
        return;
      }

      const prepared = importPreview
        ? { accounts: previewAccounts, preview: importPreview }
        : await prepareImportPreview();
      if (!prepared) return;

      await chrome.storage.local.set({ entries: prepared.preview.mergedAccounts, entriesLastModified: Date.now() });

      // Update global state immediately | 立即更新全局状态
      accountsDispatch({ type: 'setEntries', payload: prepared.preview.mergedAccounts });

      showToast('success', t('import_success_with_updates', [
        prepared.preview.newCount.toString(),
        prepared.preview.updatedCount.toString(),
      ]));
      setImportFile(null);
      setImportPassword('');
      clearImportPreview();
    } catch (err) {
      console.error('Import failed:', err);
      showToast('error', t('import_failed') + (err instanceof Error ? err.message : t('unknown_error')));
    }
  };

  return (
    <div className="import-export-modal">
      <div className="modal-header">
        <h2>{t('backup_restore_title')}</h2>
        <button type="button" className="close-btn" onClick={onClose} title={t('close')} aria-label={t('close')}>
          ✕
        </button>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          {t('tab_export')}
        </button>
        <button
          type="button"
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
              type="button"
              className="btn-primary btn-full"
              onClick={handleExport}
            >
              <span className="btn-icon"><DownloadIcon /></span>
              {t('btn_export_file')}
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
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] || null);
                    clearImportPreview();
                  }}
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
                onChange={(e) => {
                  setImportPassword(e.target.value);
                  clearImportPreview();
                }}
                placeholder={t('enter_encrypt_password')}
              />
            </div>

            {importPreview ? (
              <div className="backup-preview-panel">
                <div className="backup-preview-title">{t('import_preview_title')}</div>
                <div className="backup-preview-grid">
                  <div>
                    <span>{t('preview_total')}</span>
                    <strong>{importPreview.incomingCount}</strong>
                  </div>
                  <div>
                    <span>{t('preview_new')}</span>
                    <strong>{importPreview.newCount}</strong>
                  </div>
                  <div>
                    <span>{t('preview_updates')}</span>
                    <strong>{importPreview.updatedCount}</strong>
                  </div>
                  <div>
                    <span>{t('preview_duplicates')}</span>
                    <strong>{importPreview.duplicateCount}</strong>
                  </div>
                </div>
                <p>{t('import_preview_result', [importPreview.mergedCount.toString()])}</p>
              </div>
            ) : (
              <div className="import-warning">
                <span className="import-warning-icon"><AlertIcon /></span>
                {t('import_warning')}
              </div>
            )}

            <div className="import-action-grid">
              <button
                type="button"
                className="btn-secondary"
                onClick={handlePreviewImport}
                disabled={!importFile || previewLoading}
              >
                {previewLoading ? t('restore_process') : t('btn_preview_import')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleImport}
                disabled={!importFile || !importPreview}
              >
                <span className="btn-icon"><UploadIcon /></span>
                {t('btn_confirm_import')}
              </button>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
