import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { useAccounts } from '../../store';
import { useI18n } from '../../i18n';

// SVG Icons
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const RegionSelectIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 8V4H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 16V20H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 4H20V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 20H20V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="8" y="8" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 3V15M12 3L8 7M12 3L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ErrorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const LoadingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="spinning">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="40" strokeDashoffset="10"/>
  </svg>
);

interface QRScannerProps {
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'scan' | 'upload';
}

export default function QRScanner({ onClose, onSuccess, initialMode }: QRScannerProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { dispatch } = useAccounts();
  const { t } = useI18n();
  const hasTriggeredInitialMode = useRef(false);

  // Auto-trigger based on initial mode
  useEffect(() => {
    if (hasTriggeredInitialMode.current) return;
    hasTriggeredInitialMode.current = true;

    if (initialMode === 'scan') {
      // Delay slightly to ensure component is fully mounted
      setTimeout(() => handleRegionSelect(), 100);
    } else if (initialMode === 'upload') {
      setTimeout(() => fileInputRef.current?.click(), 100);
    }
  }, [initialMode]);

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
    try {
      const accountData = parseOtpAuthUrl(qrData);

      dispatch({
        type: 'addCode',
        payload: accountData
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('qr_error_unknown'));
    }
  };

  // Region selection - inject content script and let user select area
  const handleRegionSelect = async () => {
    setError('');
    setLoading(true);

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        throw new Error(t('qr_error_no_active_tab'));
      }

      // Check if we can inject script (not on chrome:// pages, etc.)
      if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('edge://')) {
        throw new Error(t('qr_error_restricted_page'));
      }

      // Inject the content script if not already injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/region-selector.content.js']
        });
      } catch (e) {
        // Script might already be injected, try to continue
        console.log('Script injection note:', e);
      }

      // Close the popup window - this allows the user to interact with the page
      // We'll use a different approach: open a new window for selection

      // Send message to start region selection
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'startRegionSelection'
      });

      if (response.error) {
        if (response.error === 'Selection cancelled') {
          setLoading(false);
          return;
        }
        throw new Error(response.error);
      }

      // Process the selected region image
      if (response.imageData) {
        await processImage(response.imageData);
      }
    } catch (err) {
      console.error('Region selection error:', err);
      if (err instanceof Error) {
        // Check for specific error types
        if (err.message.includes('Cannot access') || err.message.includes('chrome://')) {
          setError(t('qr_error_restricted_page'));
        } else if (err.message.includes('Selection cancelled')) {
          // User cancelled, don't show error
        } else if (err.message.includes('Selection too small')) {
          setError(t('qr_error_selection_too_small'));
        } else if (err.message.includes('Could not establish connection')) {
          setError(t('qr_error_connection_failed'));
        } else {
          setError(err.message);
        }
      } else {
        setError(t('qr_error_capture_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Process image and detect QR code
  const processImage = async (dataUrl: string): Promise<void> => {
    console.log('[QRScanner] processImage called');
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        console.log('[QRScanner] Image loaded, dimensions:', img.width, 'x', img.height);
        if (!canvasRef.current) {
          console.error('[QRScanner] Canvas ref is null');
          reject(new Error(t('qr_error_canvas_unavailable')));
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) {
          console.error('[QRScanner] Cannot get 2d context');
          reject(new Error(t('qr_error_canvas_unavailable')));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        console.log('[QRScanner] Calling jsQR with imageData:', imageData.width, 'x', imageData.height);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        console.log('[QRScanner] jsQR result:', code ? 'QR found: ' + code.data : 'No QR found');

        if (code) {
          handleQRCodeDetected(code.data);
          resolve();
        } else {
          // Try with inverted colors
          console.log('[QRScanner] Trying with inverted colors...');
          const invertedCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          console.log('[QRScanner] Inverted jsQR result:', invertedCode ? 'QR found: ' + invertedCode.data : 'No QR found');

          if (invertedCode) {
            handleQRCodeDetected(invertedCode.data);
            resolve();
          } else {
            setError(t('qr_error_not_found'));
            resolve();
          }
        }
      };

      img.onerror = (err) => {
        console.error('[QRScanner] Image load error:', err);
        reject(new Error(t('qr_error_image_load_failed')));
      };

      img.src = dataUrl;
    });
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[QRScanner] handleFileUpload triggered');
    const file = e.target.files?.[0];
    if (!file) {
      console.log('[QRScanner] No file selected');
      return;
    }

    console.log('[QRScanner] File selected:', file.name, file.type, file.size);
    setError('');
    setLoading(true);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.log('[QRScanner] Invalid file type:', file.type);
      setError(t('qr_error_not_image'));
      setLoading(false);
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.log('[QRScanner] File too large:', file.size);
      setError(t('qr_error_file_too_large'));
      setLoading(false);
      return;
    }

    try {
      const reader = new FileReader();

      reader.onload = async (event) => {
        console.log('[QRScanner] FileReader onload');
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          console.log('[QRScanner] Processing image, dataUrl length:', dataUrl.length);
          try {
            await processImage(dataUrl);
          } catch (err) {
            console.error('[QRScanner] processImage error:', err);
            setError(err instanceof Error ? err.message : t('qr_error_unknown'));
          }
        }
        setLoading(false);
      };

      reader.onerror = (err) => {
        console.error('[QRScanner] FileReader error:', err);
        setError(t('qr_error_file_read_failed'));
        setLoading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('[QRScanner] Exception:', err);
      setError(t('qr_error_file_read_failed'));
      setLoading(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="qr-scanner">
      <div className="scanner-header">
        <h2>{t('scan_qr_code')}</h2>
        <button
          className="icon-btn"
          onClick={onClose}
          title={t('close')}
          aria-label={t('close')}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="scanner-body">
        <p className="scanner-description">{t('qr_scanner_description')}</p>

        <div className="scanner-options">
          <button
            className="scanner-option-btn"
            onClick={handleRegionSelect}
            disabled={loading}
          >
            <div className="option-icon">
              {loading ? <LoadingIcon /> : <RegionSelectIcon />}
            </div>
            <div className="option-text">
              <span className="option-title">{t('qr_select_region')}</span>
              <span className="option-desc">{t('qr_select_region_desc')}</span>
            </div>
          </button>

          <button
            className="scanner-option-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            <div className="option-icon">
              <UploadIcon />
            </div>
            <div className="option-text">
              <span className="option-title">{t('qr_upload_image')}</span>
              <span className="option-desc">{t('qr_upload_image_desc')}</span>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>

        {error && (
          <div className="scanner-error">
            <ErrorIcon />
            <span>{error}</span>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
