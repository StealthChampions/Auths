import React, { useState, useEffect } from 'react';
import { useStyle, useMenu, useNotification, useAccounts } from '../../store';
import { useI18n } from '../../i18n';
import { UserSettings } from '../../models/settings';
import MainHeader from './MainHeader';
import MainBody from './MainBody';
import Settings from './Settings';
import PasswordUnlock from './PasswordUnlock';
import './Notification.css';

export default function Popup() {
  const { menu } = useMenu();
  const { notification, dispatch: notificationDispatch } = useNotification();
  const { dispatch: accountsDispatch } = useAccounts();
  const { style, dispatch: styleDispatch } = useStyle();
  const { t } = useI18n();
  const [hideoutline, setHideoutline] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [unlockAttempts, setUnlockAttempts] = useState(0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Auto-clear notification after 3 seconds
  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => {
        notificationDispatch({ type: 'clear' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification.message]);

  // Load entries from storage on mount
  useEffect(() => {
    const loadEntries = async () => {
      try {
        const result = await chrome.storage.local.get(['entries']);
        if (result.entries && Array.isArray(result.entries)) {
          console.log('[Popup] Loaded entries from storage:', result.entries.length);
          accountsDispatch({ type: 'setEntries', payload: result.entries });
        }
      } catch (err) {
        console.error('[Popup] Failed to load entries:', err);
      }
    };
    loadEntries();
  }, []);

  // Load and apply theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      await UserSettings.updateItems();
      const theme = (UserSettings.items.theme as string) || 'light';
      document.documentElement.setAttribute('data-theme', theme);
    };
    loadTheme();
  }, []);

  // Check if locked on mount
  useEffect(() => {
    const checkLockStatus = async () => {
      const result = await chrome.storage.local.get(['hasPassword', 'isLocked']);
      if (result.hasPassword && result.isLocked) {
        setIsLocked(true);
      }
    };
    checkLockStatus();
  }, []);

  // Auto-lock timer
  useEffect(() => {
    if (!menu.autolock || menu.autolock === 0 || isLocked) return;

    const checkAutoLock = () => {
      const now = Date.now();
      const idleTime = (now - lastActivity) / 1000 / 60; // minutes

      if (idleTime >= menu.autolock) {
        handleLock();
      }
    };

    const interval = setInterval(checkAutoLock, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [menu.autolock, lastActivity, isLocked]);

  // Track user activity
  useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now());

    window.addEventListener('mousedown', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    return () => {
      window.removeEventListener('mousedown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
    };
  }, []);

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

  const handlePasswordUnlock = async (password: string) => {
    try {
      const result = await chrome.storage.local.get(['passwordHash']);
      const passwordHash = btoa(password);

      if (passwordHash === result.passwordHash) {
        await chrome.storage.local.set({ isLocked: false });
        setIsLocked(false);
        setUnlockAttempts(0);
        setLastActivity(Date.now());
      } else {
        setUnlockAttempts(prev => prev + 1);
        if (unlockAttempts >= 4) {
          alert(t('too_many_attempts'));
        }
      }
    } catch (err) {
      console.error('Unlock failed:', err);
      setUnlockAttempts(prev => prev + 1);
    }
  };

  const handleLock = async () => {
    const result = await chrome.storage.local.get(['hasPassword']);
    if (result.hasPassword) {
      await chrome.storage.local.set({ isLocked: true });
      setIsLocked(true);
    }
  };

  const handleForgotPassword = () => {
    if (confirm(t('forgot_password_confirm'))) {
      chrome.storage.local.clear(() => {
        window.location.reload();
      });
    }
  };

  const handleToggleEdit = () => {
    styleDispatch({ type: style.isEditing ? 'stopEdit' : 'startEdit' });
  };

  // Show unlock screen (only when password is set and locked)
  if (isLocked) {
    return (
      <div className={`${getThemeClass()} ${hideoutline ? 'hideoutline' : ''}`}>
        <div className="full-screen-modal">
          <PasswordUnlock
            onUnlock={handlePasswordUnlock}
            onForgotPassword={handleForgotPassword}
            attempts={unlockAttempts}
          />
        </div>
      </div>
    );
  }

  // Show settings page
  if (showSettings) {
    return (
      <div className={`${getThemeClass()} ${hideoutline ? 'hideoutline' : ''}`}>
        <Settings onClose={() => setShowSettings(false)} />
      </div>
    );
  }

  // Main UI
  return (
    <div
      className={`${getThemeClass()} ${hideoutline ? 'hideoutline' : ''}`}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
    >
      <MainHeader
        onSettingsClick={() => setShowSettings(true)}
        onLockClick={handleLock}
        onEditToggle={handleToggleEdit}
        isEditing={style.isEditing}
      />
      <MainBody />

      {/* Notification Toast */}
      {notification.message && (
        <div className="notification-toast">
          {notification.message}
        </div>
      )}
    </div>
  );
}
