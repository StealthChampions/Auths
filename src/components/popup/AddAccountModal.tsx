import { useState } from 'react';
import './AddAccountModal.css';

interface AddAccountModalProps {
  onClose: () => void;
  onAdd: (accountData: {
    issuer: string;
    account: string;
    secret: string;
    type?: string;
    period?: number;
    digits?: number;
  }) => void;
}

export default function AddAccountModal({ onClose, onAdd }: AddAccountModalProps) {
  const [method, setMethod] = useState<'manual' | 'qr'>('manual');
  const [issuer, setIssuer] = useState('');
  const [account, setAccount] = useState('');
  const [secret, setSecret] = useState('');
  const [type, setType] = useState('1'); // 1 = TOTP, 2 = HOTP
  const [period, setPeriod] = useState('30');
  const [digits, setDigits] = useState('6');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !secret) {
      alert('请填写账户名和密钥');
      return;
    }

    // Remove spaces from secret
    const cleanSecret = secret.replace(/\s/g, '');

    onAdd({
      issuer: issuer || account,
      account,
      secret: cleanSecret,
      type,
      period: parseInt(period),
      digits: parseInt(digits),
    });
  };

  const handleQRScan = () => {
    alert('QR 码扫描功能\n\n这将打开相机扫描 QR 码。\n目前这是占位符功能。');
    // TODO: Implement QR code scanning
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-account-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>添加账户</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="method-tabs">
            <button
              className={method === 'manual' ? 'active' : ''}
              onClick={() => setMethod('manual')}
            >
              ✏️ 手动输入
            </button>
            <button
              className={method === 'qr' ? 'active' : ''}
              onClick={() => setMethod('qr')}
            >
              📷 扫描 QR 码
            </button>
          </div>

          {method === 'qr' ? (
            <div className="qr-scanner">
              <div className="qr-placeholder">
                <div className="qr-icon">📷</div>
                <p>点击下方按钮开始扫描</p>
                <button className="btn-primary" onClick={handleQRScan}>
                  开始扫描
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>账户名 (Account) *</label>
                <input
                  type="text"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="例如: user@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>服务商 (Issuer)</label>
                <input
                  type="text"
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  placeholder="例如: Google, GitHub"
                />
                <small>如果留空，将使用账户名</small>
              </div>

              <div className="form-group">
                <label>密钥 (Secret Key) *</label>
                <input
                  type="text"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="例如: JBSWY3DPEHPK3PXP"
                  required
                  style={{ fontFamily: 'monospace' }}
                />
                <small>Base32 编码的密钥，空格将被自动移除</small>
              </div>

              <div className="advanced-toggle">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="btn-toggle"
                >
                  {showAdvanced ? '▼' : '▶'} 高级选项
                </button>
              </div>

              {showAdvanced && (
                <div className="advanced-options">
                  <div className="form-group">
                    <label>类型</label>
                    <select value={type} onChange={(e) => setType(e.target.value)}>
                      <option value="1">TOTP (基于时间)</option>
                      <option value="2">HOTP (基于计数器)</option>
                      <option value="5">Hex (十六进制)</option>
                      <option value="3">Battle.net</option>
                      <option value="4">Steam</option>
                    </select>
                  </div>

                  {(type === '1' || type === '5') && (
                    <div className="form-group">
                      <label>时间周期 (秒)</label>
                      <input
                        type="number"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        min="10"
                        max="120"
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label>代码长度</label>
                    <select value={digits} onChange={(e) => setDigits(e.target.value)}>
                      <option value="6">6 位</option>
                      <option value="7">7 位</option>
                      <option value="8">8 位</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" onClick={onClose} className="btn-secondary">
                  取消
                </button>
                <button type="submit" className="btn-primary">
                  添加
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
