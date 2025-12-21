import { useState, useEffect } from 'react';
import './SettingsPage.css';
import { UserSettings, StorageLocation } from '../../../models/settings';
import { Encryption } from '../../../models/encryption';
import { BrowserStorage } from '../../../models/storage';

interface SettingsPageProps {
  onBack: () => void;
  encryption: Encryption | null;
  onLock: () => void;
}

export default function SettingsPage({ onBack, encryption, onLock }: SettingsPageProps) {
  const [autoLock, setAutoLock] = useState(30);
  const [enableAutoFill, setEnableAutoFill] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [themeColor, setThemeColor] = useState('blue');
  const [storageLocation, setStorageLocation] = useState<StorageLocation>(StorageLocation.Sync);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    await UserSettings.updateItems();
    setAutoLock(UserSettings.items.autolock || 30);
    setEnableAutoFill(UserSettings.items.autofill || false);
    setTheme((UserSettings.items.theme as 'light' | 'dark') || 'light');
    setThemeColor(UserSettings.items.themeColor || 'blue');
    setStorageLocation(UserSettings.items.storageLocation || StorageLocation.Sync);
    
    // Apply theme on load
    applyTheme((UserSettings.items.theme as 'light' | 'dark') || 'light', UserSettings.items.themeColor || 'blue');
  };

  const handleAutoLockChange = async (value: number) => {
    setAutoLock(value);
    UserSettings.items.autolock = value;
    await UserSettings.commitItems();
  };

  const handleAutoFillToggle = async () => {
    const newValue = !enableAutoFill;
    setEnableAutoFill(newValue);
    UserSettings.items.autofill = newValue;
    await UserSettings.commitItems();
  };

  const applyTheme = (newTheme: 'light' | 'dark', color: string) => {
    document.documentElement.setAttribute('data-theme', newTheme);
    if (color !== 'blue') {
      document.documentElement.setAttribute('data-color', color);
    } else {
      document.documentElement.removeAttribute('data-color');
    }
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    UserSettings.items.theme = newTheme;
    await UserSettings.commitItems();
    applyTheme(newTheme, themeColor);
  };

  const handleThemeColorChange = async (color: string) => {
    setThemeColor(color);
    UserSettings.items.themeColor = color;
    await UserSettings.commitItems();
    applyTheme(theme, color);
  };

  const handleStorageLocationChange = async (location: StorageLocation) => {
    if (confirm(`确定要将数据存储位置更改为 ${location === StorageLocation.Sync ? '同步存储' : '本地存储'} 吗？\n\n这可能需要迁移数据。`)) {
      setStorageLocation(location);
      UserSettings.items.storageLocation = location;
      await UserSettings.commitItems();
      alert('存储位置已更改。请重新加载扩展以应用更改。');
    }
  };

  const handleClearAllData = async () => {
    if (!confirm('确定要清除所有数据吗？\n\n这将删除所有账户和设置，且无法恢复！')) {
      return;
    }

    if (!confirm('最后确认：真的要删除所有数据吗？')) {
      return;
    }

    try {
      await BrowserStorage.clearLogs();
      alert('所有数据已清除。请重新加载扩展。');
      window.location.reload();
    } catch (error) {
      console.error('Clear data failed:', error);
      alert('清除数据失败：' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleChangePassword = () => {
    alert('更改密码功能\n\n此功能需要重新加密所有账户数据。\n\n目前这是占位符功能。');
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-btn" onClick={onBack}>
          ← 返回
        </button>
        <h1>设置</h1>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <h2>🔒 安全</h2>

          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-label">自动锁定</div>
              <div className="setting-desc">在指定时间后自动锁定扩展</div>
            </div>
            <select
              value={autoLock}
              onChange={(e) => handleAutoLockChange(Number(e.target.value))}
              className="setting-select"
            >
              <option value={0}>禁用</option>
              <option value={5}>5 分钟</option>
              <option value={15}>15 分钟</option>
              <option value={30}>30 分钟</option>
              <option value={60}>1 小时</option>
            </select>
          </div>

          {encryption && encryption.getEncryptionStatus() && (
            <>
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">更改密码</div>
                  <div className="setting-desc">更改主密码</div>
                </div>
                <button className="btn-action-small" onClick={handleChangePassword}>
                  更改
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">立即锁定</div>
                  <div className="setting-desc">锁定扩展</div>
                </div>
                <button className="btn-action-small" onClick={onLock}>
                  锁定
                </button>
              </div>
            </>
          )}
        </section>

        <section className="settings-section">
          <h2>⚡ 功能</h2>

          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-label">自动填充</div>
              <div className="setting-desc">在网页上自动填充验证码</div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={enableAutoFill}
                onChange={handleAutoFillToggle}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h2>🎨 外观</h2>

          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-label">主题</div>
              <div className="setting-desc">选择外观主题</div>
            </div>
            <select
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value as 'light' | 'dark')}
              className="setting-select"
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-label">主题颜色</div>
              <div className="setting-desc">选择应用的主题颜色</div>
            </div>
            <div className="color-picker">
              <button
                className={`color-option blue ${themeColor === 'blue' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('blue')}
                title="蓝色"
              >
                <span className="color-dot" style={{ background: '#2563eb' }}></span>
              </button>
              <button
                className={`color-option green ${themeColor === 'green' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('green')}
                title="绿色"
              >
                <span className="color-dot" style={{ background: '#059669' }}></span>
              </button>
              <button
                className={`color-option purple ${themeColor === 'purple' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('purple')}
                title="紫色"
              >
                <span className="color-dot" style={{ background: '#7c3aed' }}></span>
              </button>
              <button
                className={`color-option orange ${themeColor === 'orange' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('orange')}
                title="橙色"
              >
                <span className="color-dot" style={{ background: '#ea580c' }}></span>
              </button>
              <button
                className={`color-option pink ${themeColor === 'pink' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('pink')}
                title="粉色"
              >
                <span className="color-dot" style={{ background: '#db2777' }}></span>
              </button>
              <button
                className={`color-option teal ${themeColor === 'teal' ? 'active' : ''}`}
                onClick={() => handleThemeColorChange('teal')}
                title="青色"
              >
                <span className="color-dot" style={{ background: '#0d9488' }}></span>
              </button>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2>💾 存储</h2>

          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-label">存储位置</div>
              <div className="setting-desc">选择数据存储位置</div>
            </div>
            <select
              value={storageLocation}
              onChange={(e) => handleStorageLocationChange(e.target.value as StorageLocation)}
              className="setting-select"
            >
              <option value={StorageLocation.Sync}>同步存储 (跨设备)</option>
              <option value={StorageLocation.Local}>本地存储 (仅本设备)</option>
            </select>
          </div>
        </section>

        <section className="settings-section danger">
          <h2>⚠️ 危险区域</h2>

          <div className="setting-item">
            <div className="setting-info">
              <div className="setting-label">清除所有数据</div>
              <div className="setting-desc">删除所有账户和设置</div>
            </div>
            <button className="btn-danger" onClick={handleClearAllData}>
              清除数据
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
