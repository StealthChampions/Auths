/**
 * Add Method Selector Component | 添加方式选择组件
 *
 * Provides options for adding accounts: scan QR, upload image, or manual input.
 * 提供添加账户的方式：扫描二维码、上传图片或手动输入。
 */

import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { useAccounts, useNotification } from '@/store';
import { useI18n } from '@/i18n';

// SVG Icons | SVG 图标
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ScanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7V5C3 3.89543 3.89543 3 5 3H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M17 3H19C20.1046 3 21 3.89543 21 5V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M21 17V19C21 20.1046 20.1046 21 19 21H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M7 21H5C3.89543 21 3 20.1046 3 19V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <rect x="7" y="7" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="9" y="9" width="2" height="2" fill="currentColor" />
    <rect x="13" y="9" width="2" height="2" fill="currentColor" />
    <rect x="9" y="13" width="2" height="2" fill="currentColor" />
    <rect x="13" y="13" width="2" height="2" fill="currentColor" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 16L4 17C4 18.6569 5.34315 20 7 20L17 20C18.6569 20 20 18.6569 20 17L20 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 4V14M12 4L8 8M12 4L16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const KeyboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M6 10H6.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M10 10H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M14 10H14.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M18 10H18.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 14H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const LoadingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="spinning">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="40" strokeDashoffset="10" />
  </svg>
);

const ErrorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

interface AddMethodSelectorProps {
  onClose: () => void;
  onSuccess: () => void;
  onManualEntry: () => void;
}

export default function AddMethodSelector({ onClose, onSuccess, onManualEntry }: AddMethodSelectorProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { entries, dispatch } = useAccounts();
  const { dispatch: notificationDispatch } = useNotification();

  // Helper for error toast
  const showError = (msg: string) => {
    notificationDispatch({ type: 'error', payload: msg });
  };

  const parseOtpAuthUrl = (url: string) => {
    // Check if it's an otpauth URL
    if (!url.startsWith('otpauth://')) {
      throw new Error(t('qr_error_not_otp_url'));
    }

    try {
      const urlObj = new URL(url);

      if (urlObj.protocol !== 'otpauth:') {
        throw new Error(t('qr_error_not_otp_url'));
      }

      const type = urlObj.host; // totp or hotp
      if (type !== 'totp' && type !== 'hotp') {
        throw new Error(t('qr_error_unsupported_type'));
      }

      const label = decodeURIComponent(urlObj.pathname.substring(1));
      const params = new URLSearchParams(urlObj.search);

      let issuer = params.get('issuer') || '';
      let account = '';

      // Parse label (format: issuer:account or just account)
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

      // Validate Base32 secret
      const base32Regex = /^[A-Z2-7]+=*$/i;
      if (!base32Regex.test(secret)) {
        throw new Error(t('qr_error_invalid_secret'));
      }

      const period = parseInt(params.get('period') || '30');
      const digits = parseInt(params.get('digits') || '6');
      const algorithm = params.get('algorithm')?.toUpperCase() || 'SHA1';

      // Validate period
      if (period < 1 || period > 300) {
        throw new Error(t('qr_error_invalid_period'));
      }

      // Validate digits
      if (digits < 4 || digits > 10) {
        throw new Error(t('qr_error_invalid_digits'));
      }

      return {
        type: type === 'hotp' ? 2 : 1, // 1=TOTP, 2=HOTP
        issuer: issuer || t('qr_unknown_issuer'),
        account,
        secret: secret.toUpperCase(),
        period,
        digits,
        algorithm: algorithm === 'SHA256' ? 2 : algorithm === 'SHA512' ? 3 : 1,
        counter: parseInt(params.get('counter') || '0'),
      };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('qr_error')) {
        throw err;
      }
      throw new Error(t('qr_error_parse_failed'));
    }
  };

  const handleQRCodeDetected = (qrData: string) => {
    console.log('[Auths] QR Code detected:', qrData);
    try {
      const accountData = parseOtpAuthUrl(qrData);
      console.log('[Auths] Parsed account data:', accountData);

      // Check for duplicate account
      const normalizedSecret = accountData.secret.trim().toUpperCase().replace(/\s/g, '');
      const isDuplicate = entries?.some((entry: any) => {
        const entrySecret = (entry.secret || '').toUpperCase().replace(/\s/g, '');
        return entry.issuer === accountData.issuer && entrySecret === normalizedSecret;
      });

      if (isDuplicate) {
        showError(t('account_already_exists'));
        return;
      }

      dispatch({
        type: 'addCode',
        payload: accountData
      });

      // Show success notification
      notificationDispatch({ type: 'success', payload: t('account_added_successfully') || 'Account added successfully!' });
      console.log('[Auths] Account added successfully');

      onSuccess();
    } catch (err) {
      console.error('[Auths] QR parse error:', err);
      showError(err instanceof Error ? err.message : t('qr_error_unknown'));
    }
  };

  const processImage = async (dataUrl: string): Promise<void> => {
    console.log('[Auths] Processing image for QR code...');
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) {
          reject(new Error(t('qr_error_canvas_unavailable')));
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error(t('qr_error_canvas_unavailable')));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        // Fill white background to handle transparent images
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.drawImage(img, 0, 0);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code) {
          console.log('[Auths] QR code found (normal):', code.data);
          handleQRCodeDetected(code.data);
          resolve();
        } else {
          // Try with inverted colors
          console.log('[Auths] No QR code found with normal mode, trying inverted...');
          const invertedCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          if (invertedCode) {
            console.log('[Auths] QR code found (inverted):', invertedCode.data);
            handleQRCodeDetected(invertedCode.data);
            resolve();
          } else {
            console.log('[Auths] No QR code found in image');
            showError(t('qr_error_not_found'));
            resolve();
          }
        }
      };

      img.onerror = () => {
        reject(new Error(t('qr_error_image_load_failed')));
      };

      img.src = dataUrl;
    });
  };

  const handleRegionSelect = async () => {
    setLoading(true);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        throw new Error(t('qr_error_no_active_tab'));
      }

      if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('edge://')) {
        throw new Error(t('qr_error_restricted_page'));
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/content-scripts/region-selector.js']
        });
      } catch {
        // Ignore if already injected
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'startRegionSelection'
      });

      console.log('[Auths Popup] Region selection response:', response);

      if (response.error) {
        if (response.error === 'Selection cancelled') {
          setLoading(false);
          return;
        }
        if (response.error === 'QR code not found') {
          showError(t('qr_error_not_found'));
          setLoading(false);
          return;
        }
        throw new Error(response.error);
      }

      // New flow: content script handles QR detection and saving via background
      if (response.success) {
        // Account was saved by background script, just close and refresh
        onSuccess();
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === t('qr_error_restricted_page') || err.message.includes('Cannot access') || err.message.includes('chrome://')) {
          showError(t('qr_error_restricted_page'));
          setLoading(false);
        } else if (err.message.includes('Selection cancelled')) {
          // User cancelled
        } else if (err.message.includes('Selection too small')) {
          showError(t('qr_error_selection_too_small'));
        } else if (err.message.includes('Could not establish connection')) {
          showError(t('qr_error_connection_failed'));
          setLoading(false);
        } else {
          showError(err.message);
        }
      } else {
        showError(t('qr_error_capture_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setLoading(true);

    if (!file.type.startsWith('image/')) {
      showError(t('qr_error_not_image'));
      setLoading(false);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError(t('qr_error_file_too_large'));
      setLoading(false);
      return;
    }

    try {
      const reader = new FileReader();

      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          try {
            await processImage(dataUrl);
          } catch (err) {
            showError(err instanceof Error ? err.message : t('qr_error_unknown'));
          }
        }
        setLoading(false);
      };

      reader.onerror = () => {
        showError(t('qr_error_file_read_failed'));
        setLoading(false);
      };

      reader.readAsDataURL(file);
    } catch {
      showError(t('qr_error_file_read_failed'));
      setLoading(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="add-method-selector" style={{ position: 'relative' }}>
      <div className="form-header">
        <h2>{t('add_account')}</h2>
        <button className="icon-btn" onClick={onClose} title={t('close')} aria-label={t('close')}>
          <CloseIcon />
        </button>
      </div>

      <div className="method-list">
        {/* Scan Button */}
        <button
          className="method-item"
          onClick={handleRegionSelect}
          disabled={loading}
        >
          <div className="method-icon">
            {loading ? <LoadingIcon /> : <ScanIcon />}
          </div>
          <div className="method-info">
            <div className="method-title">{t('qr_select_region')}</div>
            <div className="method-description">{t('qr_select_region_desc')}</div>
          </div>
          <div className="method-arrow">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {/* Upload Button */}
        <button
          className="method-item"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          <div className="method-icon">
            <UploadIcon />
          </div>
          <div className="method-info">
            <div className="method-title">{t('qr_upload_image')}</div>
            <div className="method-description">{t('qr_upload_image_desc')}</div>
          </div>
          <div className="method-arrow">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {/* Manual Button */}
        <button
          className="method-item"
          onClick={onManualEntry}
        >
          <div className="method-icon">
            <KeyboardIcon />
          </div>
          <div className="method-info">
            <div className="method-title">{t('add_secret')}</div>
            <div className="method-description">{t('secret_key_placeholder')}</div>
          </div>
          <div className="method-arrow">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
