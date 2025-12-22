import React, { useState, useEffect } from 'react';
import { useMenu } from '../../store';
import { useI18n } from '../../i18n';
import { SecureHash } from '../../models/encryption';
import ImportExport from './ImportExport';
import PasswordSetup from './PasswordSetup';
import WebDAV from './WebDAV';
import './NewComponents.css';

// SVG Icons
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
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [showWebDAV, setShowWebDAV] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [activeSection, setActiveSection] = useState<'general' | 'security' | 'backup' | 'about'>('general');

  // Check if password is already set
  useEffect(() => {
    const checkPassword = async () => {
      const result = await chrome.storage.local.get(['hasPassword']);
      setHasPassword(!!result.hasPassword);
    };
    checkPassword();
  }, []);

  const handleThemeChange = (theme: string) => {
    dispatch({ type: 'setTheme', payload: theme });
    document.documentElement.setAttribute('data-theme', theme);
  };

  const handleAutoLockChange = (minutes: number) => {
    dispatch({ type: 'setAutolock', payload: minutes });
  };

  const handleZoomChange = (zoom: number) => {
    dispatch({ type: 'setZoom', payload: zoom });

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

  const handleResetPassword = () => {
    if (confirm(t('reset_password_confirm'))) {
      chrome.storage.local.clear(() => {
        alert(t('password_reset'));
        window.location.reload();
      });
    }
  };

  /**
   * 安全地设置主密码
   * 使用 PBKDF2 进行密码哈希，不存储明文密码
   */
  const handleSetPassword = async (password: string) => {
    try {
      // 使用 SecureHash 进行密码哈希 (PBKDF2 with 100000 iterations)
      const passwordHash = SecureHash.hashPassword(password);

      await chrome.storage.local.set({
        passwordHash,      // 格式: salt:hash
        hasPassword: true,
        isLocked: false,
        // 存储密码设置时间，用于安全审计
        passwordSetAt: Date.now()
      });

      setHasPassword(true);
      setShowPasswordSetup(false);
    } catch {
      alert(t('password_setup_failed'));
    }
  };

  const navItems = [
    { id: 'general', label: t('general'), icon: <SettingsIcon /> },
    { id: 'security', label: t('security'), icon: <LockIcon /> },
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
                {t('zoom_description') || '调整界面缩放比例'}
              </p>
            </div>

            <h3>{t('features')}</h3>

            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={menu.smartFilter || false}
                  onChange={(e) => dispatch({ type: 'setSmartFilter', payload: e.target.checked })}
                />
                <span>{t('smart_filter')}</span>
              </label>
              <p className="setting-description">
                {t('smart_filter_description')}
              </p>
            </div>
          </div>
        )}

        {activeSection === 'security' && (
          <div className="settings-section">
            <h3>{t('password_protection')}</h3>

            <div className="setting-item">
              {hasPassword ? (
                <>
                  <div className="password-status">
                    <LockIcon />
                    <span>{t('encrypted')}</span>
                  </div>
                  <button className="btn-secondary" onClick={() => setShowPasswordSetup(true)}>
                    {t('update')} {t('phrase')}
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-primary" onClick={() => setShowPasswordSetup(true)}>
                    {t('set_password')}
                  </button>
                  <p className="setting-description">
                    {t('security_warning')}
                  </p>
                </>
              )}
            </div>

            <div className="setting-item">
              <label>{t('auto_lock')}</label>
              <select
                value={menu.autolock || 0}
                onChange={(e) => handleAutoLockChange(Number(e.target.value))}
                disabled={!hasPassword}
              >
                <option value={0}>{t('disabled')}</option>
                <option value={1}>1 {t('minute')}</option>
                <option value={5}>5 {t('minutes')}</option>
                <option value={10}>10 {t('minutes')}</option>
                <option value={30}>30 {t('minutes')}</option>
                <option value={60}>1 {t('hour')}</option>
              </select>
              <p className="setting-description">
                {t('auto_lock_description')}
              </p>
            </div>

            <h3>{t('privacy')}</h3>

            <div className="setting-item">
              <button className="btn-secondary" onClick={handleResetPassword}>
                {t('reset_password')}
              </button>
              <p className="setting-description warning">
                {t('reset_password_warning')}
              </p>
            </div>

            <div className="setting-item">
              <button
                className="btn-danger"
                onClick={() => {
                  if (confirm(t('clear_all_data_confirm'))) {
                    chrome.storage.local.clear(() => {
                      alert(t('all_data_cleared'));
                      window.location.reload();
                    });
                  }
                }}
              >
                {t('clear_all_data')}
              </button>
              <p className="setting-description warning">
                {t('clear_all_data_warning')}
              </p>
            </div>
          </div>
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
                    导入导出备份文件
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
                <div className="backup-icon-wrapper" style={{ background: '#fff3e0' }}>
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                    <rect x="3" y="4" width="18" height="14" rx="2" stroke="#ff9800" strokeWidth="2" />
                    <path d="M7 15h10M12 11v4" stroke="#ff9800" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="9" r="1.5" fill="#ff9800" />
                  </svg>
                </div>
                <div className="backup-content">
                  <div className="backup-title">WebDAV</div>
                  <p className="setting-description">
                    自定义服务器备份
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

      {showPasswordSetup && (
        <div className="modal-overlay" onClick={() => setShowPasswordSetup(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <PasswordSetup
              onSetPassword={handleSetPassword}
              onCancel={() => setShowPasswordSetup(false)}
            />
          </div>
        </div>
      )}

      {showWebDAV && (
        <WebDAV onClose={() => setShowWebDAV(false)} />
      )}
    </div>
  );
}
