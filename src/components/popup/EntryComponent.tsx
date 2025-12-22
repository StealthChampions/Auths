import React, { useState, useEffect } from 'react';
import { useAccounts, useStyle } from '../../store';
import { useI18n } from '../../i18n';
import { KeyUtilities } from '../../models/key-utilities';
import { OTPType, OTPAlgorithm } from '../../models/otp';

// SVG Icons
const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L15 8L21 9L16.5 14L18 21L12 17L6 21L7.5 14L3 9L9 8L12 2Z" fill="currentColor" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6" stroke="currentColor" strokeWidth="2" />
    <path d="M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6" stroke="currentColor" strokeWidth="2" />
    <path d="M10 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M14 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 12L10 17L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 4H4C3.44772 4 3 4.44772 3 5V20C3 20.5523 3.44772 21 4 21H19C19.5523 21 20 20.5523 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M18.5 2.5C19.3284 1.67157 20.6716 1.67157 21.5 2.5C22.3284 3.32843 22.3284 4.67157 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ServiceIcon = ({ issuer, account, icon }: { issuer: string; account: string; icon?: string }) => {
  const [error, setError] = useState(false);

  if (icon) {
    return <img src={icon} alt={issuer} className="service-icon" onError={() => setError(true)} />;
  }

  const getIconUrl = (issuer: string) => {
    const domainMap: Record<string, string> = {
      'google': 'google.com',
      'github': 'github.com',
      'facebook': 'facebook.com',
      'twitter': 'twitter.com',
      'discord': 'discord.com',
      'microsoft': 'microsoft.com',
      'amazon': 'amazon.com',
      'apple': 'apple.com',
      'binance': 'binance.com',
      'coinbase': 'coinbase.com',
      'dropbox': 'dropbox.com',
      'slack': 'slack.com',
      'telegram': 'telegram.org',
      'kraken': 'kraken.com',
      'epic': 'epicgames.com',
      'steam': 'steampowered.com',
      'ubisoft': 'ubisoft.com',
      'ea': 'ea.com',
      'blizzard': 'blizzard.com',
      'battle.net': 'battle.net',
      'proton': 'proton.me',
      'outlook': 'outlook.com',
      'adobe': 'adobe.com'
    };

    const lowerIssuer = (issuer || '').toLowerCase();
    for (const [key, domain] of Object.entries(domainMap)) {
      if (lowerIssuer.includes(key)) return domain;
    }
    return null;
  };

  const domain = getIconUrl(issuer);
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
  onEdit
}: EntryComponentProps) {
  const { dispatch } = useAccounts();
  const { style } = useStyle();
  const { t } = useI18n();
  const [code, setCode] = useState(entry.code);
  const [timeLeft, setTimeLeft] = useState(0);
  const [progress, setProgress] = useState(100);
  const [copied, setCopied] = useState(false);

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
          0 // clock offset
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
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

  const isHOTP = entry.type === 2;
  const isEncrypted = entry.secret === null;
  const isLowTime = timeLeft <= 5 && entry.type === 1;

  const classNames = [
    'entry',
    entry.pinned ? 'pinned' : '',
    filtered ? 'filtered' : '',
    notSearched ? 'not-searched' : '',
    isLowTime ? 'timeout' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      tabIndex={tabindex}
      onClick={handleCopy}
      role="button"
      aria-label={`Copy code for ${entry.issuer}`}
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

        {style.isEditing && (
          <div className="entry-actions-top">
            <button
              className="action-btn edit-btn"
              onClick={handleEdit}
              title={t('edit')}
              aria-label={t('edit')}
            >
              <EditIcon />
            </button>
            <button
              className="action-btn pin-btn"
              onClick={handlePin}
              title={entry.pinned ? t('unpin') : t('pin')}
              aria-label={entry.pinned ? t('unpin') : t('pin')}
            >
              <PinIcon />
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

      {/* Copy Indicator */}
      {copied && (
        <div className="copy-indicator">
          <CheckIcon />
          {t('copied')}
        </div>
      )}
    </div>
  );
}
