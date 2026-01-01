/**
 * Main Header Component | 主标题栏组件
 *
 * Displays app logo, title and action buttons (edit, settings).
 * 显示应用 Logo、标题和操作按钮（编辑、设置）。
 */

import React from 'react';
import { useI18n } from '../../i18n';

// Logo Component - using the actual app icon
// Logo 组件 - 使用实际的应用图标
const AuthsLogo = () => (
  <img
    src="/images/icon128.png"
    alt="Auths"
    style={{ width: '24px', height: '24px', objectFit: 'contain' }}
  />
);



const GoogleSettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
  </svg>
);

const GoogleEditIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </svg>
);

const GoogleCheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
);

interface MainHeaderProps {
  onSettingsClick?: () => void;
  onEditToggle?: () => void;
  isEditing?: boolean;
}

export default function MainHeader({ onSettingsClick, onEditToggle, isEditing }: MainHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="main-header">
      <div className="header-title">
        <div className="logo">
          <AuthsLogo />
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
          >
            {isEditing ? <GoogleCheckIcon /> : <GoogleEditIcon />}
          </button>
        )}

        <button
          className="icon-btn"
          onClick={onSettingsClick}
          title={t('settings')}
          aria-label={t('settings')}
        >
          <GoogleSettingsIcon />
        </button>
      </div>
    </header>
  );
}
