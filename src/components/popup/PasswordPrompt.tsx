import { useState } from 'react';
import './PasswordPrompt.css';

interface PasswordPromptProps {
  onUnlock: (password: string) => Promise<boolean>;
}

export default function PasswordPrompt({ onUnlock }: PasswordPromptProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await onUnlock(password);
      if (!success) {
        setError('密码错误');
        setPassword('');
      }
    } catch (err) {
      setError('解锁失败');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-prompt">
      <div className="password-modal">
        <div className="lock-icon">🔒</div>
        <h2>Auths 已锁定</h2>
        <p>请输入密码以解锁</p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入密码"
            autoFocus
            disabled={loading}
          />

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading || !password}>
            {loading ? '解锁中...' : '解锁'}
          </button>
        </form>
      </div>
    </div>
  );
}
