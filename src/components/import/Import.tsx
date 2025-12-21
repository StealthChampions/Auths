import React, { useState, useEffect } from 'react';
import { useCurrentView, useStyle } from '../../store';
import ButtonInput from '../common/ButtonInput';
import { getCachedSecrets } from '../../utils/import';
import { Encryption } from '../../models/encryption';
import { EntryStorage } from '../../models/storage';

// Placeholder components
const FileImport = ({ onClose }: { onClose: () => void }) => (
  <div>
    <h3>文件导入</h3>
    <p>从文件导入账户</p>
    <ButtonInput onClick={onClose}>关闭</ButtonInput>
  </div>
);

const QrImport = ({ onClose }: { onClose: () => void }) => (
  <div>
    <h3>二维码导入</h3>
    <p>扫描二维码导入账户</p>
    <ButtonInput onClick={onClose}>关闭</ButtonInput>
  </div>
);

const TextImport = ({ onClose }: { onClose: () => void }) => (
  <div>
    <h3>文本导入</h3>
    <p>从文本导入账户</p>
    <ButtonInput onClick={onClose}>关闭</ButtonInput>
  </div>
);

export default function Import() {
  const { dispatch: viewDispatch } = useCurrentView();
  const { dispatch: styleDispatch } = useStyle();
  const [activeTab, setActiveTab] = useState<'file' | 'qr' | 'text'>('file');

  const handleBack = () => {
    viewDispatch({ type: 'changeView', payload: '' });
  };

  const handleTabChange = (tab: 'file' | 'qr' | 'text') => {
    setActiveTab(tab);
  };

  const handleClose = () => {
    styleDispatch({ type: 'hideInfo' });
  };

  return (
    <div className="import-page">
      <div className="import-header">
        <h1>导入账户</h1>
        <ButtonInput
          onClick={handleBack}
          className="back-button"
          title="返回"
        >
          ← 返回
        </ButtonInput>
      </div>
      
      <div className="import-tabs">
        <button
          className={`tab-button ${activeTab === 'file' ? 'active' : ''}`}
          onClick={() => handleTabChange('file')}
        >
          文件导入
        </button>
        <button
          className={`tab-button ${activeTab === 'qr' ? 'active' : ''}`}
          onClick={() => handleTabChange('qr')}
        >
          二维码导入
        </button>
        <button
          className={`tab-button ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => handleTabChange('text')}
        >
          文本导入
        </button>
      </div>
      
      <div className="import-content">
        {activeTab === 'file' && <FileImport onClose={handleClose} />}
        {activeTab === 'qr' && <QrImport onClose={handleClose} />}
        {activeTab === 'text' && <TextImport onClose={handleClose} />}
      </div>
    </div>
  );
}