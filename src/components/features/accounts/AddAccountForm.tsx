/**
 * Add Account Form Component | 添加账户表单组件
 *
 * Form for manually adding new OTP accounts.
 * 用于手动添加新 OTP 账户的表单。
 */

import React, { useState } from 'react';
import { useAccounts, useNotification } from '@/store';
import { useI18n } from '@/i18n';

// SVG Icons | SVG 图标
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { entries, dispatch } = useAccounts();
  const { dispatch: notificationDispatch } = useNotification();
  const { t } = useI18n();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    if (!issuer.trim()) {
      notificationDispatch({ type: 'alert', payload: t('please_enter_account_name') });
      return;
    }

    if (!secret.trim()) {
      notificationDispatch({ type: 'alert', payload: t('please_enter_secret_key') });
      return;
    }

    // Validate Base32 secret
    const base32Regex = /^[A-Z2-7]+=*$/i;
    if (!base32Regex.test(secret.trim())) {
      notificationDispatch({ type: 'alert', payload: t('invalid_secret_key') });
      return;
    }

    // Check for duplicate account (same issuer and secret)
    const normalizedSecret = secret.trim().toUpperCase().replace(/\s/g, '');
    const isDuplicate = entries?.some((entry: any) => {
      const entrySecret = (entry.secret || '').toUpperCase().replace(/\s/g, '');
      return entry.issuer === issuer.trim() && entrySecret === normalizedSecret;
    });

    if (isDuplicate) {
      notificationDispatch({ type: 'error', payload: t('account_already_exists') });
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

    notificationDispatch({ type: 'success', payload: t('account_added_successfully') });
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

        {/* Advanced Options Toggle | 高级选项切换 */}
        <div className="form-group">
          <button
            type="button"
            className="advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              padding: '8px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span style={{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▶</span>
            {t('advanced_options') || 'Advanced Options'}
          </button>
        </div>

        {showAdvanced && (
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
        )}



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
