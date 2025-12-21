import React from 'react';
import { useI18n } from '../../i18n';

// SVG Icons
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" fill="currentColor"/>
    <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="11" width="18" height="11" rx="2" fill="currentColor"/>
    <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="3" fill="currentColor"/>
    <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

interface MainHeaderProps {
  onSettingsClick?: () => void;
  onLockClick?: () => void;
  onEditToggle?: () => void;
  isEditing?: boolean;
}

export default function MainHeader({ onSettingsClick, onLockClick, onEditToggle, isEditing }: MainHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="main-header">
      <div className="header-title">
        <div className="logo">
          <ShieldIcon />
        </div>
        <span className="app-name">{t('appName')}</span>
      </div>
      <div className="header-actions">
        {onEditToggle && (
          <button
            className={`icon-btn ${isEditing ? 'active' : ''}`}
            onClick={onEditToggle}
            title={isEditing ? t('done') : t('edit')}
            aria-label={isEditing ? t('done') : t('edit')}
            style={isEditing ? { color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '13px', width: 'auto', padding: '0 8px' } : {}}
          >
           {isEditing ? t('done') : t('edit')}
          </button>
        )}
        {onLockClick && (
          <button
            className="icon-btn"
            onClick={onLockClick}
            title={t('lock')}
            aria-label={t('lock')}
          >
            <LockIcon />
          </button>
        )}
        <button
          className="icon-btn"
          onClick={onSettingsClick}
          title={t('settings')}
          aria-label={t('settings')}
        >
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}
