import React, { useState } from 'react';

interface PasswordUnlockProps {
  onUnlock: (password: string) => void;
  onForgotPassword?: () => void;
  attempts?: number;
}

export default function PasswordUnlock({
  onUnlock,
  onForgotPassword,
  attempts = 0
}: PasswordUnlockProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('请输入密码');
      return;
    }

    onUnlock(password);
  };

  return (
    <div className="password-unlock">
      <div className="unlock-icon">🔒</div>
      <h2>Auths 已锁定</h2>
      <p className="unlock-subtitle">请输入主密码以解锁</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入主密码"
              autoFocus
              className="unlock-input"
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              title={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {attempts > 0 && (
          <div className="warning-message">
            密码错误，已尝试 {attempts} 次
          </div>
        )}

        <button type="submit" className="btn-primary btn-unlock">
          解锁
        </button>

        {onForgotPassword && (
          <button
            type="button"
            className="btn-link"
            onClick={onForgotPassword}
          >
            忘记密码？
          </button>
        )}
      </form>

      <div className="unlock-hint">
        <p>💡 提示: 忘记主密码将需要清除所有数据</p>
      </div>
    </div>
  );
}
