/**
 * Popup Component | Popup 主组件
 *
 * Main popup component for the extension.
 * Manages app state, theme, zoom, and renders main UI.
 *
 * 扩展的主 Popup 组件。
 * 管理应用状态、主题、缩放，并渲染主界面。
 */

import React, { useState, useEffect } from 'react';
import { useStyle, useMenu, useNotification, useAccounts } from '@/store';
import { UserSettings } from '@/models/settings';
import MainHeader from '@/components/layout/MainHeader';
import MainBody from '@/components/layout/MainBody';
import Settings from '@/components/features/settings/Settings';
import '@/assets/styles/notification.css';

export default function Popup() {
  const { menu, dispatch: menuDispatch } = useMenu();
  const { notification, dispatch: notificationDispatch } = useNotification();
  const { dispatch: accountsDispatch } = useAccounts();
  const { style, dispatch: styleDispatch } = useStyle();
  const [hideoutline, setHideoutline] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Auto-clear notification after 3 seconds
  // 3秒后自动清除通知
  useEffect(() => {
    // Only auto-clear toasts, not dialogs
    // 只自动清除 Toast，不清除对话框
    if (notification.message && notification.mode !== 'dialog') {
      const timer = setTimeout(() => {
        notificationDispatch({ type: 'clear' });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [notification.message, notification.mode]);

  // Load entries from storage on mount
  // 组件挂载时从存储加载条目
  useEffect(() => {
    const loadEntries = async () => {
      try {
        const result = await chrome.storage.local.get(['entries']);
        if (result.entries && Array.isArray(result.entries)) {
          accountsDispatch({ type: 'setEntries', payload: result.entries });
        }
      } catch {
        // Silently handle loading errors
        // 静默处理加载错误
      }
    };
    loadEntries();
  }, []);

  // Load and apply settings on mount
  // 组件挂载时加载并应用设置
  useEffect(() => {
    const loadSettings = async () => {
      await UserSettings.updateItems();

      // Theme | 主题
      const theme = (UserSettings.items.theme as string) || 'light';
      document.documentElement.setAttribute('data-theme', theme);
      menuDispatch({ type: 'setTheme', payload: theme });

      // Zoom | 缩放
      if (UserSettings.items.zoom) {
        menuDispatch({ type: 'setZoom', payload: UserSettings.items.zoom });
        const zoom = UserSettings.items.zoom;
        if (zoom !== 100) {
          document.body.style.marginBottom = 480 * (zoom / 100 - 1) + "px";
          document.body.style.marginRight = 320 * (zoom / 100 - 1) + "px";
          document.body.style.transform = "scale(" + zoom / 100 + ")";
        }
      }

      // Language | 语言
      if (UserSettings.items.language) {
        menuDispatch({ type: 'setLanguage', payload: UserSettings.items.language as string });
      }

      // Smart Filter | 智能过滤
      if (UserSettings.items.smartFilter !== undefined) {
        menuDispatch({ type: 'setSmartFilter', payload: UserSettings.items.smartFilter });
      }
    };
    loadSettings();
  }, []);

  // Get theme class name | 获取主题类名
  const getThemeClass = () => {
    switch (menu.theme) {
      case 'accessibility':
        return 'theme-accessibility';
      case 'dark':
        return 'theme-dark';
      case 'simple':
        return 'theme-simple';
      case 'compact':
        return 'theme-compact';
      case 'flat':
        return 'theme-flat';
      default:
        return 'theme-normal';
    }
  };

  const handleMouseDown = () => {
    setHideoutline(true);
  };

  const handleKeyDown = () => {
    setHideoutline(false);
  };

  const handleToggleEdit = () => {
    styleDispatch({ type: style.isEditing ? 'stopEdit' : 'startEdit' });
  };

  // Render notification component | 渲染通知组件
  const renderNotification = () => {
    if (!notification.message) return null;

    if (notification.mode === 'dialog') {
      return (
        <div className="notification-overlay" onClick={() => notificationDispatch({ type: 'clear' })}>
          <div className="notification-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="notification-dialog-message">{notification.message}</div>
            <button
              className="notification-dialog-btn"
              onClick={() => notificationDispatch({ type: 'clear' })}
            >
              OK
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`el-message el-message--${notification.severity}`}
        onClick={() => notificationDispatch({ type: 'clear' })}
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          minWidth: '300px',
          maxWidth: '80%',
          background:
            notification.severity === 'success' ? '#f0f9eb' :
              notification.severity === 'error' ? '#fef0f0' :
                notification.severity === 'warning' ? '#fdf6ec' : '#f4f4f5',
          borderColor:
            notification.severity === 'success' ? '#e1f3d8' :
              notification.severity === 'error' ? '#fde2e2' :
                notification.severity === 'warning' ? '#faecd8' : '#e9e9eb',
          color:
            notification.severity === 'success' ? '#67c23a' :
              notification.severity === 'error' ? '#f56c6c' :
                notification.severity === 'warning' ? '#e6a23c' : '#909399',
          borderRadius: '4px',
          borderWidth: '1px',
          borderStyle: 'solid',
          display: 'flex',
          alignItems: 'center',
          zIndex: 2147483647,
          padding: '10px 15px',
          fontSize: '14px',
          lineHeight: '1',
          boxShadow: '0 2px 12px 0 rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          transition: 'opacity 0.3s, transform 0.3s, top 0.4s'
        }}
      >
        <div style={{ marginRight: '10px', display: 'flex', alignItems: 'center' }}>
          {notification.severity === 'success' && (
            <svg viewBox="0 0 1024 1024" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm-55.808 536.384-99.52-99.584a38.4 38.4 0 1 0-54.336 54.336l126.72 126.72a38.272 38.272 0 0 0 54.336 0l262.4-262.464a38.4 38.4 0 1 0-54.272-54.336L456.192 600.384z" />
            </svg>
          )}
          {notification.severity === 'error' && (
            <svg viewBox="0 0 1024 1024" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 832a384 384 0 1 0 0-768 384 384 0 0 0 0 768zm48-176a48 48 0 1 1-96 0 48 48 0 0 1 96 0zm-48-432a32 32 0 0 1 32 32v288a32 32 0 0 1-64 0V288a32 32 0 0 1 32-32z" />
            </svg>
          )}
          {notification.severity === 'warning' && (
            <svg viewBox="0 0 1024 1024" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 832a384 384 0 1 0 0-768 384 384 0 0 0 0 768zm48-176a48 48 0 1 1-96 0 48 48 0 0 1 96 0zm-48-432a32 32 0 0 1 32 32v288a32 32 0 0 1-64 0V288a32 32 0 0 1 32-32z" />
            </svg>
          )}
          {notification.severity === 'info' && (
            <svg viewBox="0 0 1024 1024" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 832a384 384 0 1 0 0-768 384 384 0 0 0 0 768zm48-176a48 48 0 1 1-96 0 48 48 0 0 1 96 0zm-48-432a32 32 0 0 1 32 32v288a32 32 0 0 1-64 0V288a32 32 0 0 1 32-32z" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1 }}>{notification.message}</div>
      </div>
    );
  };

  // Main UI | 主界面
  return (
    <>
      <div
        className={`app-container ${getThemeClass()} ${hideoutline ? 'hideoutline' : ''}`}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
      >
        {showSettings ? (
          <Settings onClose={() => setShowSettings(false)} />
        ) : (
          <>
            <MainHeader
              onSettingsClick={() => setShowSettings(true)}
              onEditToggle={handleToggleEdit}
              isEditing={style.isEditing}
            />
            <MainBody />
          </>
        )}
      </div>
      {renderNotification()}
    </>
  );
}
