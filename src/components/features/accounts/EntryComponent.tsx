/**
 * Entry Component | 账户条目组件
 *
 * Displays a single OTP account entry with code generation,
 * copy functionality, pin/delete actions, and QR code display.
 *
 * 显示单个 OTP 账户条目，包含验证码生成、
 * 复制功能、置顶/删除操作和二维码显示。
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAccounts, useStyle, useNotification } from '@/store';
import { useI18n } from '@/i18n';
import { UserSettings } from '@/models/settings';
import { KeyUtilities } from '@/models/key-utilities';
import { OTPType, OTPAlgorithm } from '@/models/otp';
import { getIconUrl } from '@/utils/icon-map';
import qrcode from 'qrcode-generator';

// SVG Icons | SVG 图标
const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 9V4l1 0c0.55 0 1-0.45 1-1s-0.45-1-1-1H7C6.45 2 6 2.45 6 3s0.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);



const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </svg>
);

const QRCodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 2h3v3h-3v-3zm-3-2h3v3h-3v-3zm3-3h-3v-3h3v3zm0 3h-3v3h-3v-3h3v-3h3v3z" />
  </svg>
);

const ServiceIcon = ({ issuer, account, icon }: { issuer: string; account: string; icon?: string }) => {
  const [error, setError] = useState(false);

  if (icon) {
    return <img src={icon} alt={issuer} className="service-icon" onError={() => setError(true)} />;
  }

  const domain = getIconUrl(issuer, account);
  if (domain && !error) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
        alt={issuer}
        className="service-icon"
        onError={() => setError(true)}
      />
    );
  }

  const initial = (issuer || account || '?').charAt(0).toUpperCase();
  return <div className="service-icon-placeholder">{initial}</div>;
};

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

interface EntryComponentProps {
  entry: OTPEntryInterface;
  filtered?: boolean;
  notSearched?: boolean;
  tabindex?: number;
  onEdit?: (entry: OTPEntryInterface) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
}

// Format code with space in the middle (e.g., "123 456")
function formatCode(code: string): string {
  if (!code || code.length < 4) return code;
  const mid = Math.floor(code.length / 2);
  return `${code.slice(0, mid)} ${code.slice(mid)}`;
}

export default function EntryComponent({
  entry,
  filtered = false,
  notSearched = false,
  tabindex = -1,
  onEdit,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver = false
}: EntryComponentProps) {
  const { dispatch } = useAccounts();
  const { style } = useStyle();
  const { dispatch: notificationDispatch } = useNotification();
  const { t } = useI18n();
  const [code, setCode] = useState(entry.code);
  const [timeLeft, setTimeLeft] = useState(0);
  const [progress, setProgress] = useState(100);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Generate TOTP code
  useEffect(() => {
    const generateCode = () => {
      if (!entry.secret || typeof entry.secret !== 'string') {
        setCode(entry.code || '------');
        return;
      }

      // HOTP (type 2) doesn't auto-generate
      if (entry.type === 2) {
        setCode(entry.code || '------');
        return;
      }

      try {
        // Map entry.type to OTPType enum
        const otpType = entry.type === 1 ? OTPType.totp :
          entry.type === 2 ? OTPType.hotp : OTPType.totp;

        // Map algorithm number to OTPAlgorithm enum
        const algorithm = entry.algorithm === 2 ? OTPAlgorithm.SHA256 :
          entry.algorithm === 3 ? OTPAlgorithm.SHA512 : OTPAlgorithm.SHA1;

        const newCode = KeyUtilities.generate(
          otpType,
          entry.secret,
          entry.counter || 0,
          entry.period || 30,
          entry.digits || 6,
          algorithm,
          UserSettings.items.offset || 0 // clock offset
        );
        setCode(newCode);
      } catch (err) {
        console.error('Failed to generate TOTP:', err);
        setCode('ERROR');
      }
    };

    generateCode();

    // Update code every second for TOTP
    let interval: NodeJS.Timeout | null = null;
    if (entry.type === 1) {
      interval = setInterval(generateCode, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [entry.secret, entry.period, entry.digits, entry.type, entry.algorithm, entry.counter]);

  // Update progress and time left
  useEffect(() => {
    if (entry.type !== 1) return; // Only for TOTP

    const updateProgress = () => {
      const now = Math.floor(Date.now() / 1000);
      const secondsLeft = entry.period - (now % entry.period);
      const progressPercent = (secondsLeft / entry.period) * 100;

      setTimeLeft(secondsLeft);
      setProgress(progressPercent);
    };

    updateProgress();
    const interval = setInterval(updateProgress, 100);
    return () => clearInterval(interval);
  }, [entry.period, entry.type]);

  const handleCopy = async () => {
    if (!code || code === 'ERROR' || code.includes('•')) return;

    try {
      await navigator.clipboard.writeText(code);
      const message = t('copied') || 'Copied';
      notificationDispatch({ type: 'success', payload: message });
    } catch (err) {
      console.error('Failed to copy:', err);
      notificationDispatch({ type: 'error', payload: 'Failed to copy' });
    }
  };

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'pinEntry', payload: entry.hash });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t('delete_confirm').replace('{name}', entry.issuer))) {
      dispatch({ type: 'deleteCode', payload: entry.hash });
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(entry);
    }
  };

  // Generate OTP URI for QR code
  const generateOTPUri = () => {
    const type = entry.type === 2 ? 'hotp' : 'totp';
    const algorithm = entry.algorithm === 2 ? 'SHA256' : entry.algorithm === 3 ? 'SHA512' : 'SHA1';
    const label = encodeURIComponent(`${entry.issuer}:${entry.account}`);
    const params = new URLSearchParams();
    params.set('secret', entry.secret || '');
    params.set('issuer', entry.issuer);
    params.set('algorithm', algorithm);
    params.set('digits', String(entry.digits || 6));
    if (type === 'totp') {
      params.set('period', String(entry.period || 30));
    } else {
      params.set('counter', String(entry.counter || 0));
    }
    return `otpauth://${type}/${label}?${params.toString()}`;
  };

  const handleShowQR = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!entry.secret) return;

    const uri = generateOTPUri();
    const qr = qrcode(0, 'M');
    qr.addData(uri);
    qr.make();
    setQrDataUrl(qr.createDataURL(4, 0));
    setShowQR(true);
  };

  const isHOTP = entry.type === 2;
  const isEncrypted = entry.secret === null;
  const isLowTime = timeLeft <= 5 && entry.type === 1;

  const classNames = [
    'entry',
    entry.pinned ? 'pinned' : '',
    filtered ? 'filtered' : '',
    notSearched ? 'not-searched' : '',
    isLowTime ? 'timeout' : '',
    isDragOver ? 'drag-over' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      tabIndex={tabindex}
      onClick={handleCopy}
      role="button"
      aria-label={`Copy code for ${entry.issuer}`}
      data-hash={entry.hash}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="entry-header">
        <div className="entry-brand">
          <ServiceIcon issuer={entry.issuer} account={entry.account} icon={entry.icon} />
        </div>
        <div className="entry-info-top">
          <span className="issuer">
            {entry.pinned && <span className="pin-badge">★</span>}
            {entry.issuer || 'Unknown'}
          </span>
          {entry.account && (
            <span className="account">{entry.account}</span>
          )}
        </div>

        {/* Normal mode: QR code and Pin buttons */}
        {!style.isEditing && (
          <div className="entry-actions-top">
            <button
              className="action-btn qr-btn"
              onClick={handleShowQR}
              title={t('scan_qr_code')}
              aria-label={t('scan_qr_code')}
            >
              <QRCodeIcon />
            </button>
            <button
              className="action-btn pin-btn"
              onClick={handlePin}
              title={entry.pinned ? t('unpin') : t('pin')}
              aria-label={entry.pinned ? t('unpin') : t('pin')}
            >
              <PinIcon />
            </button>
          </div>
        )}

        {/* Edit mode: Edit and Delete buttons */}
        {style.isEditing && (
          <div className="entry-actions-top">
            <button
              className="action-btn move-btn move-up"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'moveEntryUp', payload: entry.hash });
              }}
              title={t('move_up')}
              aria-label={t('move_up')}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14l5-5 5 5H7z" />
              </svg>
            </button>
            <button
              className="action-btn move-btn move-down"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'moveEntryDown', payload: entry.hash });
              }}
              title={t('move_down')}
              aria-label={t('move_down')}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5H7z" />
              </svg>
            </button>
            <button
              className="action-btn edit-btn"
              onClick={handleEdit}
              title={t('edit')}
              aria-label={t('edit')}
            >
              <EditIcon />
            </button>
            <button
              className="action-btn delete-btn"
              onClick={handleDelete}
              title={t('delete')}
              aria-label={t('delete')}
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      <div className="entry-body">
        <span className={`code ${isEncrypted ? 'encrypted' : ''}`}>
          {isEncrypted ? '••• •••' : formatCode(code)}
        </span>
        {entry.type === 1 && !isEncrypted && (
          <div className="timer-section">
            <div className="timer-progress">
              <div className="timer-progress-track">
                <div
                  className="timer-progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>


      {/* HOTP Counter */}
      {isHOTP && (
        <div className="hotp-counter">
          {t('counter')}: {entry.counter}
        </div>
      )}

      {/* QR Code Modal - rendered via Portal to avoid event bubbling */}
      {showQR && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setShowQR(false); }}>
          <div className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="form-header">
              <h2>{t('qr_code')}</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowQR(false)}
                title={t('close')}
                aria-label={t('close')}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <div className="qr-content">
              <img src={qrDataUrl} alt="QR Code" className="qr-image" />
              <p className="qr-label">{entry.issuer}</p>
              <p className="qr-account">{entry.account}</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
