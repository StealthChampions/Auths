import React from 'react';
import { useMenu, useCurrentView, useStyle } from '../../store';
import ButtonInput from '../common/ButtonInput';

export default function MenuPage() {
  const {
    menu,
    dispatch: menuDispatch
  } = useMenu();
  
  const { dispatch: viewDispatch } = useCurrentView();
  const { dispatch: styleDispatch } = useStyle();

  const handleSetZoom = (newZoom: number) => {
    menuDispatch({ type: 'setZoom', payload: newZoom });
    // Apply zoom styles
    if (newZoom !== 100) {
      document.body.style.marginBottom = 480 * (newZoom / 100 - 1) + "px";
      document.body.style.marginRight = 320 * (newZoom / 100 - 1) + "px";
      document.body.style.transform = "scale(" + newZoom / 100 + ")";
    } else {
      document.body.style.marginBottom = "";
      document.body.style.marginRight = "";
      document.body.style.transform = "";
    }
  };

  const handleSetAutofill = (value: boolean) => {
    menuDispatch({ type: 'setAutofill', payload: value });
  };

  const handleSetSmartFilter = (value: boolean) => {
    menuDispatch({ type: 'setSmartFilter', payload: value });
  };

  const handleSetEnableContextMenu = (value: boolean) => {
    menuDispatch({ type: 'setEnableContextMenu', payload: value });
  };

  const handleSetTheme = (newTheme: string) => {
    menuDispatch({ type: 'setTheme', payload: newTheme });
  };

  const handleSetAutolock = (value: number) => {
    menuDispatch({ type: 'setAutolock', payload: value });
  };

  const handleCloseMenu = () => {
    styleDispatch({ type: 'hideMenu' });
  };

  const navigateToPage = (page: string) => {
    viewDispatch({ type: 'changeView', payload: page });
    styleDispatch({ type: 'hideMenu' });
  };

  return (
    <div className="menu-page">
      <div className="menu-header">
        <h2>设置</h2>
        <ButtonInput
          onClick={handleCloseMenu}
          className="close-button"
          title="关闭"
        >
          ×
        </ButtonInput>
      </div>
      
      <div className="menu-content">
        <div className="menu-section">
          <h3>常规设置</h3>
          <div className="menu-item">
            <label>缩放: {menu.zoom}%</label>
            <input
              type="range"
              min="50"
              max="150"
              step="10"
              value={menu.zoom}
              onChange={(e) => handleSetZoom(Number(e.target.value))}
            />
          </div>
          
          <div className="menu-item">
            <label>
              <input
                type="checkbox"
                checked={menu.useAutofill}
                onChange={(e) => handleSetAutofill(e.target.checked)}
              />
              启用自动填充
            </label>
          </div>
          
          <div className="menu-item">
            <label>
              <input
                type="checkbox"
                checked={menu.smartFilter}
                onChange={(e) => handleSetSmartFilter(e.target.checked)}
              />
              智能过滤
            </label>
          </div>
          
          <div className="menu-item">
            <label>
              <input
                type="checkbox"
                checked={menu.enableContextMenu}
                onChange={(e) => handleSetEnableContextMenu(e.target.checked)}
              />
              启用上下文菜单
            </label>
          </div>
        </div>
        
        <div className="menu-section">
          <h3>外观</h3>
          <div className="menu-item">
            <label>主题:</label>
            <select
              value={menu.theme}
              onChange={(e) => handleSetTheme(e.target.value)}
            >
              <option value="normal">普通</option>
              <option value="dark">深色</option>
              <option value="simple">简单</option>
              <option value="compact">紧凑</option>
              <option value="flat">扁平</option>
              <option value="accessibility">无障碍</option>
            </select>
          </div>
        </div>
        
        <div className="menu-section">
          <h3>安全</h3>
          <div className="menu-item">
            <label>自动锁定 (秒):</label>
            <input
              type="number"
              min="0"
              max="300"
              value={menu.autolock}
              onChange={(e) => handleSetAutolock(Number(e.target.value))}
            />
          </div>
        </div>
        
        <div className="menu-section">
          <h3>其他</h3>
          <div className="menu-item">
            <ButtonInput
              onClick={() => navigateToPage('BackupPage')}
              className="menu-button"
            >
              备份设置
            </ButtonInput>
          </div>
          
          <div className="menu-item">
            <ButtonInput
              onClick={() => navigateToPage('AboutPage')}
              className="menu-button"
            >
              关于
            </ButtonInput>
          </div>
        </div>
        
        <div className="menu-footer">
          <p>版本: {menu.version}</p>
        </div>
      </div>
    </div>
  );
}