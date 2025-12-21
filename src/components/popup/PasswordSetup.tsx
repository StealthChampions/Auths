import React, { useState } from 'react';

interface PasswordSetupProps {
  onSetPassword: (password: string) => void;
  onCancel?: () => void;
}

export default function PasswordSetup({ onSetPassword, onCancel }: PasswordSetupProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!password) {
      setError('请输入主密码');
      return;
    }

    if (password.length < 8) {
      setError('密码长度至少8个字符');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    // Password strength check
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasLetter || !hasNumber) {
      setError('密码必须包含字母和数字');
      return;
    }

    onSetPassword(password);
  };

  const getPasswordStrength = () => {
    if (!password) return { level: 0, text: '', color: '#ddd' };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return { level: 1, text: '弱', color: '#dd4b39' };
    if (strength <= 4) return { level: 2, text: '中等', color: '#ff9800' };
    return { level: 3, text: '强', color: '#4caf50' };
  };

  const strength = getPasswordStrength();

  return (
    <div className="password-setup">
      <div className="password-setup-header">
        <h2>设置主密码</h2>
        <p className="subtitle">主密码将用于加密保护您的所有账户数据</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password">主密码</label>
          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少8个字符，包含字母和数字"
              autoFocus
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
          {password && (
            <div className="password-strength">
              <div className="strength-bar">
                <div
                  className="strength-fill"
                  style={{
                    width: `${(strength.level / 3) * 100}%`,
                    backgroundColor: strength.color
                  }}
                />
              </div>
              <span className="strength-text" style={{ color: strength.color }}>
                密码强度: {strength.text}
              </span>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">确认密码</label>
          <input
            type={showPassword ? 'text' : 'password'}
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="再次输入密码"
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="password-tips">
          <h4>密码安全提示:</h4>
          <ul>
            <li>至少8个字符</li>
            <li>包含字母和数字</li>
            <li>建议包含大小写字母和特殊字符</li>
            <li>不要使用容易被猜到的密码</li>
          </ul>
        </div>

        <div className="form-actions">
          {onCancel && (
            <button type="button" className="btn-secondary" onClick={onCancel}>
              跳过
            </button>
          )}
          <button type="submit" className="btn-primary">
            设置密码
          </button>
        </div>
      </form>
    </div>
  );
}
