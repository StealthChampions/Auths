import React from 'react';
import { useI18n } from '../../i18n';

// SVG Icons
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7V5C3 3.89543 3.89543 3 5 3H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M17 3H19C20.1046 3 21 3.89543 21 5V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M21 17V19C21 20.1046 20.1046 21 19 21H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M7 21H5C3.89543 21 3 20.1046 3 19V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <rect x="7" y="7" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="2"/>
    <rect x="9" y="9" width="2" height="2" fill="currentColor"/>
    <rect x="13" y="9" width="2" height="2" fill="currentColor"/>
    <rect x="9" y="13" width="2" height="2" fill="currentColor"/>
    <rect x="13" y="13" width="2" height="2" fill="currentColor"/>
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 16L4 17C4 18.6569 5.34315 20 7 20L17 20C18.6569 20 20 18.6569 20 17L20 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 4V14M12 4L8 8M12 4L16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const KeyboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M6 10H6.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M10 10H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M14 10H14.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M18 10H18.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M8 14H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export type AddMethod = 'scan' | 'upload' | 'manual';

interface AddMethodSelectorProps {
  onClose: () => void;
  onSelect: (method: AddMethod) => void;
}

export default function AddMethodSelector({ onClose, onSelect }: AddMethodSelectorProps) {
  const { t } = useI18n();

  const methods = [
    {
      id: 'scan' as AddMethod,
      icon: <ScanIcon />,
      title: t('qr_select_region'),
      description: t('qr_select_region_desc'),
    },
    {
      id: 'upload' as AddMethod,
      icon: <UploadIcon />,
      title: t('qr_upload_image'),
      description: t('qr_upload_image_desc'),
    },
    {
      id: 'manual' as AddMethod,
      icon: <KeyboardIcon />,
      title: t('add_secret'),
      description: t('secret_key_placeholder'),
    },
  ];

  return (
    <div className="add-method-selector">
      <div className="form-header">
        <h2>{t('add_account')}</h2>
        <button className="icon-btn" onClick={onClose} title={t('close')} aria-label={t('close')}>
          <CloseIcon />
        </button>
      </div>

      <div className="method-list">
        {methods.map((method) => (
          <button
            key={method.id}
            className="method-item"
            onClick={() => onSelect(method.id)}
          >
            <div className="method-icon">{method.icon}</div>
            <div className="method-info">
              <div className="method-title">{method.title}</div>
              <div className="method-description">{method.description}</div>
            </div>
            <div className="method-arrow">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
