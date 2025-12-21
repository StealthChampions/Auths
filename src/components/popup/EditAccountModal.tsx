import React, { useState } from 'react';
import { useAccounts, useNotification } from '../../store';
import { useI18n } from '../../i18n';

// SVG Icons
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

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
  algorithm?: number;
}

interface EditAccountModalProps {
  entry: OTPEntryInterface;
  onClose: () => void;
  onSave: () => void;
}

export default function EditAccountModal({ entry, onClose, onSave }: EditAccountModalProps) {
  const [issuer, setIssuer] = useState(entry.issuer || '');
  const [account, setAccount] = useState(entry.account || '');
  const [period, setPeriod] = useState(entry.period || 30);
  const [digits, setDigits] = useState(entry.digits || 6);
  const [error, setError] = useState('');
  const { dispatch } = useAccounts();
  const { dispatch: notificationDispatch } = useNotification();
  const { t } = useI18n();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate inputs
    if (!issuer.trim()) {
      setError(t('please_enter_account_name'));
      return;
    }

    // Update account
    dispatch({
      type: 'updateEntry',
      payload: {
        hash: entry.hash,
        issuer: issuer.trim(),
        account: account.trim() || '',
        period,
        digits,
      }
    });

    notificationDispatch({ type: 'alert', payload: t('updateSuccess') });
    onSave();
  };

  return (
    <div className="add-account-form">
      <div className="form-header">
        <h2>{t('edit_account')}</h2>
        <button className="icon-btn" onClick={onClose} title={t('close')} aria-label={t('close')}>
          <CloseIcon />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="edit-issuer">{t('account_name')} *</label>
          <input
            type="text"
            id="edit-issuer"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder={t('account_name_placeholder')}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="edit-account">{t('username_optional')}</label>
          <input
            type="text"
            id="edit-account"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder={t('username_placeholder')}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="edit-period">{t('refresh_period')}</label>
            <select
              id="edit-period"
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            >
              <option value={30}>30 {t('seconds')}</option>
              <option value={60}>60 {t('seconds')}</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="edit-digits">{t('code_length')}</label>
            <select
              id="edit-digits"
              value={digits}
              onChange={(e) => setDigits(Number(e.target.value))}
            >
              <option value={6}>6 {t('digits')}</option>
              <option value={8}>8 {t('digits')}</option>
            </select>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('close')}
          </button>
          <button type="submit" className="btn-primary">
            {t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
