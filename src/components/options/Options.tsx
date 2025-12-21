import React, { useState } from 'react';
import { useMenu, useBackup } from '../../store';
import ButtonInput from '../common/ButtonInput';
import ToggleInput from '../common/ToggleInput';

export default function Options() {
  const {
    menu,
    dispatch: menuDispatch
  } = useMenu();
  
  const {
    backup,
    dispatch: backupDispatch
  } = useBackup();

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteComplete, setDeleteComplete] = useState(false);

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

  const handleSetDropboxEncrypted = (value: boolean) => {
    backupDispatch({ type: 'setEnc', payload: { service: 'dropbox', value } });
  };

  const handleSetDriveEncrypted = (value: boolean) => {
    backupDispatch({ type: 'setEnc', payload: { service: 'drive', value } });
  };

  const handleSetOneDriveEncrypted = (value: boolean) => {
    backupDispatch({ type: 'setEnc', payload: { service: 'onedrive', value } });
  };

  const handleDeleteEverything = async () => {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
      localStorage.clear();
      chrome.runtime.sendMessage({ action: "lock" });
      setDeleteConfirm(false);
      setDeleteComplete(true);
    } catch (error) {
      console.error('Failed to delete everything:', error);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Auths 选项</h1>
      
      <section style={{ marginTop: '30px' }}>
        <h2>常规设置</h2>
        <div style={{ marginBottom: '15px' }}>
          <label>
            缩放: {menu.zoom}%
            <input
              type="range"
              min="50"
              max="150"
              step="10"
              value={menu.zoom}
              onChange={(e) => handleSetZoom(Number(e.target.value))}
              style={{ marginLeft: '10px' }}
            />
          </label>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <ToggleInput
            id="autofill"
            label="启用自动填充"
            checked={menu.useAutofill}
            onChange={handleSetAutofill}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <ToggleInput
            id="smartFilter"
            label="智能过滤"
            checked={menu.smartFilter}
            onChange={handleSetSmartFilter}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <ToggleInput
            id="contextMenu"
            label="启用上下文菜单"
            checked={menu.enableContextMenu}
            onChange={handleSetEnableContextMenu}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>
            主题:
            <select
              value={menu.theme}
              onChange={(e) => handleSetTheme(e.target.value)}
              style={{ marginLeft: '10px' }}
            >
              <option value="normal">普通</option>
              <option value="dark">深色</option>
              <option value="simple">简单</option>
              <option value="compact">紧凑</option>
              <option value="flat">扁平</option>
              <option value="accessibility">无障碍</option>
            </select>
          </label>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>
            自动锁定 (秒):
            <input
              type="number"
              min="0"
              max="300"
              value={menu.autolock}
              onChange={(e) => handleSetAutolock(Number(e.target.value))}
              style={{ marginLeft: '10px' }}
            />
          </label>
        </div>
      </section>
      
      <section style={{ marginTop: '30px' }}>
        <h2>备份设置</h2>
        <div style={{ marginBottom: '15px' }}>
          <ToggleInput
            id="dropboxEncrypted"
            label="Dropbox 加密"
            checked={backup.dropboxEncrypted}
            onChange={handleSetDropboxEncrypted}
            disabled={!backup.dropboxToken}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <ToggleInput
            id="driveEncrypted"
            label="Google Drive 加密"
            checked={backup.driveEncrypted}
            onChange={handleSetDriveEncrypted}
            disabled={!backup.driveToken}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <ToggleInput
            id="oneDriveEncrypted"
            label="OneDrive 加密"
            checked={backup.oneDriveEncrypted}
            onChange={handleSetOneDriveEncrypted}
            disabled={!backup.oneDriveToken}
          />
        </div>
      </section>
      
      <section style={{ marginTop: '30px' }}>
        <h2>危险操作</h2>
        <p>删除所有数据将永久删除您的所有账户、设置和备份。此操作无法撤销。</p>
        <div style={{ marginBottom: '15px' }}>
          <ToggleInput
            id="deleteConfirm"
            label="我确认要删除所有数据"
            checked={deleteConfirm}
            onChange={setDeleteConfirm}
          />
        </div>
        <div style={{ marginTop: '15px' }}>
          <ButtonInput
            onClick={handleDeleteEverything}
            disabled={!deleteConfirm}
            className="danger"
          >
            删除所有数据
          </ButtonInput>
        </div>
        {deleteComplete && (
          <p style={{ color: 'green', marginTop: '10px' }}>
            所有数据已成功删除！
          </p>
        )}
      </section>
    </div>
  );
}
