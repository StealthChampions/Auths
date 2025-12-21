import React, { useState, useRef } from 'react';
import jsQR from 'jsqr';
import { useAccounts, useStyle, useNotification } from '../../store';
import { useI18n } from '../../i18n';
import EntryComponent from './EntryComponent';
import AddAccountForm from './AddAccountForm';
import AddMethodSelector, { AddMethod } from './AddMethodSelector';
import QRScanner from './QRScanner';
import EditAccountModal from './EditAccountModal';

// SVG Icons
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M16 16L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const KeyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="15" r="4" stroke="currentColor" strokeWidth="2" />
    <path d="M11 12L21 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M18 5L21 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 7L18 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Use OTPEntryInterface from global declarations
declare global {
  interface OTPEntryInterface {
    hash: string;
    issuer: string;
    account: string;
    code: string;
    period: number;
    pinned: boolean;
    type: number;
    counter: number;
    digits: number;
    secret: string | null;
    algorithm: number;
    icon?: string;
    folder?: string;
  }
}

export default function MainBody() {
  const { entries, filter, showSearch, dispatch } = useAccounts();
  const { style, dispatch: styleDispatch } = useStyle();
  const { dispatch: notificationDispatch } = useNotification();
  const { t } = useI18n();
  const [searchText, setSearchText] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannerMode, setScannerMode] = useState<'scan' | 'upload'>('scan');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<OTPEntryInterface | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const filteredEntries = entries?.filter((entry: OTPEntryInterface) => {
    // First apply search filter
    const matchesSearch = () => {
      if (searchText === '') return true;
      const search = searchText.toLowerCase();
      const issuer = (entry.issuer || '').toLowerCase();
      const account = (entry.account || '').toLowerCase();
      return issuer.includes(search) || account.includes(search);
    };

    // Then apply folder filter
    const matchesFolder = () => {
      if (selectedFolder === 'all') return true;
      if (selectedFolder === 'uncategorized') return !entry.folder;
      return entry.folder === selectedFolder;
    };

    return matchesSearch() && matchesFolder();
  }) || [];

  const folders = Array.from(new Set(entries?.map((e: OTPEntryInterface) => e.folder).filter(Boolean))) as string[];

  console.log('[MainBody] entries:', entries?.length, 'filteredEntries:', filteredEntries.length, 'searchText:', searchText);

  const handleClearFilter = () => {
    dispatch({ type: 'stopFilter' });
    if (entries?.length >= 10) {
      dispatch({ type: 'showSearch' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = Array.from(
      container.querySelectorAll('.entry:not(.filtered):not(.not-searched)')
    );
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        const nextIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
        (focusableElements[nextIndex] as HTMLElement)?.focus();
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
        (focusableElements[prevIndex] as HTMLElement)?.focus();
        break;
      case '/':
        e.preventDefault();
        const searchInput = document.getElementById('searchInput') as HTMLInputElement;
        searchInput?.focus();
        break;
    }
  };

  const getTabindex = (entry: OTPEntryInterface) => {
    const firstVisibleEntry = filteredEntries[0];
    return entry === firstVisibleEntry ? 0 : -1;
  };

  const handleAddAccountSuccess = () => {
    setShowMethodSelector(false);
    setShowAddForm(false);
    setShowQRScanner(false);
  };

  const handleEditEntry = (entry: OTPEntryInterface) => {
    console.log('[MainBody] handleEditEntry called, entry:', entry.issuer);
    setEditingEntry(entry);
    setShowEditModal(true);
  };

  const handleEditClose = () => {
    setShowEditModal(false);
    setEditingEntry(null);
  };

  const handleEditSave = () => {
    setShowEditModal(false);
    setEditingEntry(null);
  };

  const handleMethodSelect = (method: AddMethod) => {
    if (method === 'scan') {
      setShowMethodSelector(false);
      setScannerMode('scan');
      setShowQRScanner(true);
    } else if (method === 'upload') {
      // 直接打开文件选择器，保持当前页面不关闭
      fileInputRef.current?.click();
    } else {
      setShowMethodSelector(false);
      setShowAddForm(true);
    }
  };

  // 解析 otpauth URL
  const parseOtpAuthUrl = (url: string) => {
    if (!url.startsWith('otpauth://')) {
      throw new Error(t('qr_error_not_otp_url'));
    }

    const urlObj = new URL(url);
    if (urlObj.protocol !== 'otpauth:') {
      throw new Error(t('qr_error_not_otp_url'));
    }

    const type = urlObj.host;
    if (type !== 'totp' && type !== 'hotp') {
      throw new Error(t('qr_error_unsupported_type'));
    }

    const label = decodeURIComponent(urlObj.pathname.substring(1));
    const params = new URLSearchParams(urlObj.search);

    let issuer = params.get('issuer') || '';
    let account = '';

    if (label.includes(':')) {
      const parts = label.split(':');
      if (!issuer) issuer = parts[0];
      account = parts[1] || '';
    } else {
      account = label;
    }

    const secret = params.get('secret');
    if (!secret) {
      throw new Error(t('qr_error_no_secret'));
    }

    const base32Regex = /^[A-Z2-7]+=*$/i;
    if (!base32Regex.test(secret)) {
      throw new Error(t('qr_error_invalid_secret'));
    }

    const period = parseInt(params.get('period') || '30');
    const digits = parseInt(params.get('digits') || '6');
    const algorithm = params.get('algorithm')?.toUpperCase() || 'SHA1';

    return {
      type: type === 'hotp' ? 2 : 1,
      issuer: issuer || t('qr_unknown_issuer'),
      account,
      secret: secret.toUpperCase(),
      period,
      digits,
      algorithm: algorithm === 'SHA256' ? 2 : algorithm === 'SHA512' ? 3 : 1,
      counter: parseInt(params.get('counter') || '0'),
    };
  };

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[MainBody] File selected:', file.name, file.type, file.size);

    if (!file.type.startsWith('image/')) {
      notificationDispatch({ type: 'alert', payload: t('qr_error_not_image') });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      notificationDispatch({ type: 'alert', payload: t('qr_error_file_too_large') });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      console.log('[MainBody] Processing image...');

      const img = new Image();
      img.onload = () => {
        console.log('[MainBody] Image loaded:', img.width, 'x', img.height);

        if (!canvasRef.current) {
          notificationDispatch({ type: 'alert', payload: t('qr_error_canvas_unavailable') });
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) {
          notificationDispatch({ type: 'alert', payload: t('qr_error_canvas_unavailable') });
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        console.log('[MainBody] Calling jsQR...');

        let code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        console.log('[MainBody] jsQR result:', code ? code.data : 'No QR found');

        if (code) {
          try {
            const accountData = parseOtpAuthUrl(code.data);

            // 检查是否已存在相同的账户（通过 secret 判断）
            const isDuplicate = entries?.some((entry: OTPEntryInterface) =>
              entry.secret === accountData.secret
            );

            if (isDuplicate) {
              console.log('[MainBody] Duplicate account detected');
              notificationDispatch({ type: 'alert', payload: t('account_already_exists') });
              return;
            }

            dispatch({ type: 'addCode', payload: accountData });
            notificationDispatch({ type: 'alert', payload: t('added') });
            // 成功后关闭选择页面
            setShowMethodSelector(false);
          } catch (err) {
            console.error('[MainBody] Parse error:', err);
            notificationDispatch({ type: 'alert', payload: err instanceof Error ? err.message : t('qr_error_parse_failed') });
          }
        } else {
          notificationDispatch({ type: 'alert', payload: t('qr_error_not_found') });
        }
      };

      img.onerror = () => {
        notificationDispatch({ type: 'alert', payload: t('qr_error_image_load_failed') });
      };

      img.src = dataUrl;
    };

    reader.onerror = () => {
      notificationDispatch({ type: 'alert', payload: t('qr_error_file_read_failed') });
    };

    reader.readAsDataURL(file);

    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };



  return (
    <>
      {/* Search Bar */}
      <div className="search-bar">
        <div className="search-container">
          <span className="search-icon">
            <SearchIcon />
          </span>
          <input
            id="searchInput"
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('search_accounts')}
            className="search-input"
          />
          {searchText && (
            <button
              className="clear-search"
              onClick={() => setSearchText('')}
              title={t('clear')}
              aria-label={t('clear')}
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      {/* Folder Tabs */}
      {entries && entries.length > 0 && (
        <div className="folder-tabs-container">
          <div className="folder-tabs">
            <button
              className={`folder-tab ${selectedFolder === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedFolder('all')}
            >
              {t('all_accounts')}
            </button>
            {folders.map(folder => (
              <button
                key={folder}
                className={`folder-tab ${selectedFolder === folder ? 'active' : ''}`}
                onClick={() => setSelectedFolder(folder)}
              >
                {folder}
              </button>
            ))}
            {entries.some((e: OTPEntryInterface) => !e.folder) && folders.length > 0 && (
              <button
                className={`folder-tab ${selectedFolder === 'uncategorized' ? 'active' : ''}`}
                onClick={() => setSelectedFolder('uncategorized')}
              >
                {t('uncategorized')}
              </button>
            )}
          </div>
        </div>
      )}



      {/* Entries List */}
      <div
        className="entries-container"
        ref={containerRef}
        onKeyDown={handleKeyDown}
      >
        {filteredEntries.length === 0 && !entries?.length ? (
          <div className="no-entry">
            <div className="no-entry-icon">
              <KeyIcon />
            </div>
            <p className="no-entry-text">{t('no_accounts_yet')}</p>
            <p className="no-entry-hint">{t('tap_to_add')}</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="no-entry">
            <div className="no-entry-icon">
              <SearchIcon />
            </div>
            <p className="no-entry-text">{t('no_matching_accounts')}</p>
            <p className="no-entry-hint">{t('try_different_search')}</p>
          </div>
        ) : (
          filteredEntries.map((entry: OTPEntryInterface) => (
            <EntryComponent
              key={entry.hash}
              entry={entry}
              filtered={false}
              notSearched={searchText !== '' &&
                !entry.issuer.toLowerCase().includes(searchText.toLowerCase()) &&
                (!entry.account || !entry.account.toLowerCase().includes(searchText.toLowerCase()))
              }
              tabindex={getTabindex(entry)}
              onEdit={handleEditEntry}
            />
          ))
        )}
      </div>

      {/* Add Account FAB */}
      {!style.isEditing && (
        <button
          className="add-account-fab"
          onClick={() => setShowMethodSelector(true)}
          title={t('add_account')}
          aria-label={t('add_account')}
        >
          <PlusIcon />
        </button>
      )}

      {/* Add Method Selector Modal */}
      {showMethodSelector && (
        <div className="modal-overlay" onClick={() => setShowMethodSelector(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <AddMethodSelector
              onClose={() => setShowMethodSelector(false)}
              onSelect={handleMethodSelect}
            />
          </div>
        </div>
      )}

      {/* Add Account Form Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <AddAccountForm
              onClose={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="modal-overlay" onClick={() => setShowQRScanner(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <QRScanner
              onClose={() => setShowQRScanner(false)}
              onSuccess={handleAddAccountSuccess}
              initialMode={scannerMode}
            />
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {showEditModal && editingEntry && (
        <div className="modal-overlay" onClick={handleEditClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <EditAccountModal
              entry={editingEntry}
              onClose={handleEditClose}
              onSave={handleEditSave}
            />
          </div>
        </div>
      )}

      {/* Hidden file input for direct upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Hidden canvas for QR processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  );
}
