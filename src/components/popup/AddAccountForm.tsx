import React, { useState } from 'react';
import { useAccounts } from '../../store';
import { useI18n } from '../../i18n';

// SVG Icons
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

interface AddAccountFormProps {
  onClose: () => void;
}

export default function AddAccountForm({ onClose }: AddAccountFormProps) {
  const [issuer, setIssuer] = useState('');
  const [account, setAccount] = useState('');
  const [secret, setSecret] = useState('');
  const [period, setPeriod] = useState(30);
  const [digits, setDigits] = useState(6);
  const [error, setError] = useState('');
  const { dispatch } = useAccounts();
  const { t } = useI18n();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate inputs
    if (!issuer.trim()) {
      setError(t('please_enter_account_name'));
      return;
    }

    if (!secret.trim()) {
      setError(t('please_enter_secret_key'));
      return;
    }

    // Validate Base32 secret
    const base32Regex = /^[A-Z2-7]+=*$/i;
    if (!base32Regex.test(secret.trim())) {
      setError(t('invalid_secret_key'));
      return;
    }

    // Add account
    dispatch({
      type: 'addCode',
      payload: {
        issuer: issuer.trim(),
        account: account.trim() || '',
        secret: secret.trim().toUpperCase(),
        type: 1, // TOTP
        period,
        digits,
        algorithm: 1, // SHA1
      }
    });

    onClose();
  };

  return (
    <div className="add-account-form">
      <div className="form-header">
        <h2>{t('add_account')}</h2>
        <button className="icon-btn" onClick={onClose} title={t('close')} aria-label={t('close')}>
          <CloseIcon />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="issuer">{t('account_name')} *</label>
          <input
            type="text"
            id="issuer"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder={t('account_name_placeholder')}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="account">{t('username_optional')}</label>
          <input
            type="text"
            id="account"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder={t('username_placeholder')}
          />
        </div>

        <div className="form-group">
          <label htmlFor="secret">{t('secret_key')} *</label>
          <input
            type="text"
            id="secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value.toUpperCase())}
            placeholder={t('secret_key_placeholder')}
            required
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="period">{t('refresh_period')}</label>
            <select
              id="period"
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            >
              <option value={30}>30 {t('seconds')}</option>
              <option value={60}>60 {t('seconds')}</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="digits">{t('code_length')}</label>
            <select
              id="digits"
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
            {t('add')}
          </button>
        </div>
      </form>
    </div>
  );
}
