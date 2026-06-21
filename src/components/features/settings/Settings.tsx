/**
 * Settings Component | 设置组件
 *
 * Main settings page with options for theme, language,
 * time sync, and access to import/export and WebDAV features.
 *
 * 主设置页面，包含主题、语言、时间同步选项，
 * 以及导入导出和 WebDAV 功能入口。
 */

import React, { useState, useEffect } from 'react';
import { useMenu, useNotification, useAccounts } from '@/store';
import { syncTimeWithGoogle } from '@/models/syncTime';
import { useI18n } from '@/i18n';
import { UserSettings } from '@/models/settings';
import { applyThemePreference, normalizeThemePreference, type ThemePreference } from '@/utils/theme';
import ImportExport from './ImportExport';
import WebDAV from './WebDAV';

// SVG Icons | SVG 图标
const ArrowLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const BackupIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 3V15M12 15L8 11M12 15L16 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const SettingHint = ({ text }: { text: string }) => (
  <button type="button" className="setting-hint" aria-label={text}>
    <span aria-hidden="true">?</span>
    <span className="setting-hint-tooltip" role="tooltip">{text}</span>
  </button>
);

const SettingLabel = ({
  htmlFor,
  label,
  description,
}: {
  htmlFor?: string;
  label: React.ReactNode;
  description: string;
}) => (
  <div className="setting-label-row">
    {htmlFor ? (
      <label htmlFor={htmlFor}>{label}</label>
    ) : (
      <span className="setting-label-text">{label}</span>
    )}
    <SettingHint text={description} />
  </div>
);

interface SettingsPageProps {
  onClose: () => void;
}

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const { menu, dispatch } = useMenu();
  const { t } = useI18n();
  const [showImportExport, setShowImportExport] = useState(false);
  const [showWebDAV, setShowWebDAV] = useState(false);
  const [activeSection, setActiveSection] = useState<'general' | 'backup' | 'about'>('general');
  const [isSyncing, setIsSyncing] = useState(false);
  const { dispatch: notificationDispatch } = useNotification();
  const { dispatch: accountsDispatch } = useAccounts();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [siteBadgeEnabled, setSiteBadgeEnabled] = useState(false);

  useEffect(() => {
    chrome.permissions
      .contains({ permissions: ['tabs'] })
      .then(setSiteBadgeEnabled)
      .catch(() => setSiteBadgeEnabled(false));
  }, []);

  const handleSiteBadgeToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        const granted = await chrome.permissions.request({ permissions: ['tabs'] });
        if (!granted) {
          notificationDispatch({ type: 'error', payload: t('permission_denied') });
          return;
        }
        setSiteBadgeEnabled(true);
      } else {
        await chrome.permissions.remove({ permissions: ['tabs'] });
        setSiteBadgeEnabled(false);
      }
    } catch {
      notificationDispatch({ type: 'error', payload: t('permission_denied') });
    }
  };

  // Handle clear all data | 处理清除所有数据
  const handleClearAllData = async () => {
    try {
      // Clear all entries from storage | 清除存储中的所有条目
      await chrome.storage.local.remove(['entries', 'webdavConfig']);
      // Update global state | 更新全局状态
      accountsDispatch({ type: 'setEntries', payload: [] });
      // Close confirm dialog | 关闭确认对话框
      setShowClearConfirm(false);
      // Show success notification | 显示成功通知
      notificationDispatch({ type: 'success', payload: t('all_data_cleared') });
    } catch {
      notificationDispatch({ type: 'error', payload: t('clear_failed') });
    }
  };



  const handleThemeChange = (theme: ThemePreference) => {
    dispatch({ type: 'setTheme', payload: theme });
    applyThemePreference(theme);
    UserSettings.items.theme = theme;
    UserSettings.commitItems();
  };

  const handleLanguageChange = (language: string) => {
    dispatch({ type: 'setLanguage', payload: language });
    UserSettings.items.language = language;
    UserSettings.commitItems();
  };

  const handleSmartFilterChange = (enabled: boolean) => {
    dispatch({ type: 'setSmartFilter', payload: enabled });
    UserSettings.items.smartFilter = enabled;
    UserSettings.commitItems();
  };

  const handleSyncTime = async () => {
    setIsSyncing(true);
    try {
      const result = await syncTimeWithGoogle();
      if (result === 'updateSuccess') {
        const offset = UserSettings.items.offset || 0;
        notificationDispatch({
          type: 'success',
          payload: t('sync_success').replace('{offset}', String(offset))
        });
      } else if (result === 'clock_too_far_off') {
        notificationDispatch({ type: 'error', payload: t('clock_too_far_off') });
      } else {
        notificationDispatch({ type: 'error', payload: t('sync_error') });
      }
    } catch (e) {
      notificationDispatch({ type: 'error', payload: t('sync_error') });
    } finally {
      setIsSyncing(false);
    }
  };

  const navItems = [
    { id: 'general', label: t('general'), icon: <SettingsIcon /> },
    { id: 'backup', label: t('backup'), icon: <BackupIcon /> },
    { id: 'about', label: t('about'), icon: <InfoIcon /> },
  ];

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button type="button" className="back-btn" onClick={onClose} title={t('back')} aria-label={t('back')}>
          <ArrowLeftIcon />
          <span>{t('back')}</span>
        </button>
        <h2>{t('settings')}</h2>
      </div>

      <div className="settings-nav">
        {navItems.map(item => (
          <button
            type="button"
            key={item.id}
            className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
            onClick={() => setActiveSection(item.id as typeof activeSection)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-content">
        {activeSection === 'general' && (
          <>
            <div className="settings-section">
              <h3>{t('appearance')}</h3>

              <div className="setting-item setting-row">
                <div className="setting-copy">
                  <SettingLabel
                    htmlFor="themePreference"
                    label={t('theme')}
                    description={t('theme_description')}
                  />
                </div>
                <select
                  id="themePreference"
                  value={normalizeThemePreference(menu.theme)}
                  onChange={(e) => handleThemeChange(normalizeThemePreference(e.target.value))}
                >
                  <option value="system">{t('follow_system')}</option>
                  <option value="light">{t('theme_light')}</option>
                  <option value="dark">{t('theme_dark')}</option>
                </select>
              </div>

              <div className="setting-item setting-row">
                <div className="setting-copy">
                  <SettingLabel
                    htmlFor="languagePreference"
                    label={t('language')}
                    description={t('language_description')}
                  />
                </div>
                <select
                  id="languagePreference"
                  value={menu.language || 'system'}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                >
                  <option value="system">{t('follow_system')}</option>
                  <option value="en">{t('lang_english')}</option>
                  <option value="zh_CN">{t('lang_chinese')}</option>
                </select>
              </div>

              <div className="setting-item setting-row">
                <div className="setting-copy">
                  <SettingLabel
                    label={t('sync_time')}
                    description={t('sync_time_desc')}
                  />
                </div>
                <div className="settings-inline-action">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleSyncTime}
                    disabled={isSyncing}
                  >
                    {isSyncing ? t('syncing') : t('sync_now')}
                  </button>
                </div>
              </div>

            </div>

            <div className="settings-section">
              <h3>{t('features')}</h3>

              <div className="setting-item setting-row setting-toggle-row">
                <div className="setting-copy">
                  <SettingLabel
                    htmlFor="smartFilter"
                    label={t('smart_filter')}
                    description={t('smart_filter_description')}
                  />
                </div>
                <input
                  id="smartFilter"
                  type="checkbox"
                  checked={menu.smartFilter || false}
                  onChange={(e) => handleSmartFilterChange(e.target.checked)}
                />
              </div>

              <div className="setting-item setting-row setting-toggle-row">
                <div className="setting-copy">
                  <SettingLabel
                    htmlFor="siteBadge"
                    label={t('site_badge')}
                    description={t('site_badge_description')}
                  />
                </div>
                <input
                  id="siteBadge"
                  type="checkbox"
                  checked={siteBadgeEnabled}
                  onChange={(e) => handleSiteBadgeToggle(e.target.checked)}
                />
              </div>
            </div>
          </>
        )}


        {activeSection === 'backup' && (
          <div className="settings-section settings-section-compact">
            <h3>{t('backup_restore')}</h3>

            <div className="setting-item setting-row backup-setting-row">
              <div className="setting-copy">
                <SettingLabel
                  label={t('manage_backups')}
                  description={t('manage_backups_description')}
                />
              </div>
              <div className="settings-inline-action">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowImportExport(true)}
                >
                  {t('open')}
                </button>
              </div>
            </div>

            <div className="setting-item setting-row backup-setting-row">
              <div className="setting-copy">
                <SettingLabel
                  label="WebDAV"
                  description={t('webdav_description')}
                />
              </div>
              <div className="settings-inline-action">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowWebDAV(true)}
                >
                  {t('configure')}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'backup' && (
          <div className="settings-section settings-section-compact danger-zone">
            <h3>{t('danger_zone')}</h3>

            <div className="setting-item setting-row backup-setting-row danger-setting-row">
              <div className="setting-copy">
                <SettingLabel
                  label={t('clear_all_data')}
                  description={t('clear_all_data_warning')}
                />
              </div>
              <div className="settings-inline-action">
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => setShowClearConfirm(true)}
                >
                  {t('clear')}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'about' && (
          <div className="settings-section">
            <h3>{t('about')}</h3>

            <div className="about-info">
              <div className="info-row">
                <span>{t('version')}</span>
                <span>{chrome.runtime.getManifest().version}</span>
              </div>
              <div className="info-row">
                <span>{t('developer')}</span>
                <span>Auths Team</span>
              </div>
              <div className="info-row">
                <span>{t('license')}</span>
                <span>Apache 2.0</span>
              </div>
            </div>

            <div className="links">
              <a href="https://github.com/StealthChampions/Auths" target="_blank" rel="noopener noreferrer">
                {t('github')}
              </a>
              <a href="https://github.com/StealthChampions/Auths/issues" target="_blank" rel="noopener noreferrer">
                {t('report_issue')}
              </a>
              <a href="https://github.com/StealthChampions/Auths/blob/main/README.md" target="_blank" rel="noopener noreferrer">
                {t('help')}
              </a>
            </div>
          </div>
        )}
      </div>

      {showImportExport && (
        <div className="modal-overlay" onClick={() => setShowImportExport(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <ImportExport onClose={() => setShowImportExport(false)} />
          </div>
        </div>
      )}


      {showWebDAV && (
        <WebDAV onClose={() => setShowWebDAV(false)} />
      )}

      {/* Clear All Data Confirmation Dialog | 清除数据确认对话框 */}
      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div
            className="modal-content clear-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning Icon | 警告图标 */}
            <div className="clear-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
                <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Title | 标题 */}
            <h3>{t('clear_all_data')}</h3>

            {/* Warning Message | 警告信息 */}
            <p>{t('clear_all_data_confirm')}</p>

            {/* Buttons | 按钮 */}
            <div className="clear-confirm-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setShowClearConfirm(false)}
              >
                {t('no')}
              </button>
              <button
                className="btn-danger"
                type="button"
                onClick={handleClearAllData}
              >
                {t('yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
