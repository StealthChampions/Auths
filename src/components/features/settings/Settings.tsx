/**
 * Settings Component | 设置组件
 *
 * Main settings page with options for theme, language, zoom,
 * time sync, and access to import/export and WebDAV features.
 *
 * 主设置页面，包含主题、语言、缩放、时间同步选项，
 * 以及导入导出和 WebDAV 功能入口。
 */

import React, { useState } from 'react';
import { useMenu, useNotification } from '@/store';
import { syncTimeWithGoogle } from '@/models/syncTime';
import { useI18n } from '@/i18n';
import { UserSettings } from '@/models/settings';
import ImportExport from './ImportExport';
import WebDAV from './WebDAV';
import '@/assets/styles/components.css';

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


  const handleThemeChange = (theme: string) => {
    dispatch({ type: 'setTheme', payload: theme });
    document.documentElement.setAttribute('data-theme', theme);
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

  const handleZoomChange = (zoom: number) => {
    dispatch({ type: 'setZoom', payload: zoom });
    UserSettings.items.zoom = zoom;
    UserSettings.commitItems();

    if (zoom !== 100) {
      document.body.style.marginBottom = 480 * (zoom / 100 - 1) + "px";
      document.body.style.marginRight = 320 * (zoom / 100 - 1) + "px";
      document.body.style.transform = "scale(" + zoom / 100 + ")";
    } else {
      document.body.style.marginBottom = "";
      document.body.style.marginRight = "";
      document.body.style.transform = "";
    }
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
        <button className="back-btn" onClick={onClose} title={t('back')} aria-label={t('back')}>
          <ArrowLeftIcon />
          <span>{t('back')}</span>
        </button>
        <h2>{t('settings')}</h2>
      </div>

      <div className="settings-nav">
        {navItems.map(item => (
          <button
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

              <div className="setting-item">
                <label>{t('theme')}</label>
                <select
                  value={menu.theme || 'light'}
                  onChange={(e) => handleThemeChange(e.target.value)}
                >
                  <option value="light">{t('theme_light')}</option>
                  <option value="dark">{t('theme_dark')}</option>
                  <option value="violet">{t('theme_violet')}</option>
                  <option value="emerald">{t('theme_emerald')}</option>
                  <option value="sunset">{t('theme_sunset')}</option>
                  <option value="ocean">{t('theme_ocean')}</option>
                </select>
                <p className="setting-description">
                  {t('theme_description')}
                </p>
              </div>

              <div className="setting-item">
                <label>{t('language')}</label>
                <select
                  value={menu.language || 'system'}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                >
                  <option value="system">{t('follow_system')}</option>
                  <option value="en">{t('lang_english')}</option>
                  <option value="zh_CN">{t('lang_chinese')}</option>
                </select>
                <p className="setting-description">
                  {t('language_description')}
                </p>
              </div>

              <div className="setting-item">
                <label>{t('zoom')}</label>
                <select
                  value={menu.zoom || 100}
                  onChange={(e) => handleZoomChange(Number(e.target.value))}
                >
                  <option value={80}>80%</option>
                  <option value={90}>90%</option>
                  <option value={100}>100%</option>
                  <option value={110}>110%</option>
                  <option value={120}>120%</option>
                  <option value={150}>150%</option>
                </select>
                <p className="setting-description">
                  {t('zoom_description')}
                </p>
              </div>

              <div className="setting-item">
                <label>{t('sync_time')}</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <button
                    className="btn-secondary"
                    onClick={handleSyncTime}
                    disabled={isSyncing}
                    style={{ width: 'auto', padding: '8px 16px' }}
                  >
                    {isSyncing ? t('syncing') : t('sync_time')}
                  </button>
                </div>
                <p className="setting-description">
                  {t('sync_time_desc')}
                </p>
              </div>

            </div>

            <div className="settings-section">
              <h3>{t('features')}</h3>

              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={menu.smartFilter || false}
                    onChange={(e) => handleSmartFilterChange(e.target.checked)}
                  />
                  <span>{t('smart_filter')}</span>
                </label>
                <p className="setting-description">
                  {t('smart_filter_description')}
                </p>
              </div>
            </div>
          </>
        )}


        {activeSection === 'backup' && (
          <div className="settings-section">
            <h3>{t('backup_restore')}</h3>

            {/* Entry 1: Manage Backups */}
            <div className="setting-item">
              <div
                className="backup-card"
                onClick={() => setShowImportExport(true)}
                role="button"
                tabIndex={0}
              >
                <div className="backup-icon-wrapper">
                  <BackupIcon />
                </div>
                <div className="backup-content">
                  <div className="backup-title">{t('manage_backups')}</div>
                  <p className="setting-description">
                    {t('manage_backups_description')}
                  </p>
                </div>
              </div>
            </div>

            {/* Entry 2: WebDAV */}
            <div className="setting-item">
              <div
                className="backup-card"
                onClick={() => setShowWebDAV(true)}
                role="button"
                tabIndex={0}
              >
                <div className="backup-icon-wrapper">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                    <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M7 15h10M12 11v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="9" r="1.5" fill="currentColor" />
                  </svg>
                </div>
                <div className="backup-content">
                  <div className="backup-title">WebDAV</div>
                  <p className="setting-description">
                    {t('webdav_description')}
                  </p>
                </div>
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
                <span>1.0.0</span>
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
    </div>
  );
}
