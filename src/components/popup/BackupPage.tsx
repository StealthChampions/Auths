import { useState } from 'react';
import './BackupPage.css';
import { EntryStorage } from '../../models/storage';
import { Encryption } from '../../models/encryption';

interface BackupPageProps {
  onBack: () => void;
  encryption: Encryption | null;
  onReload: () => void;
}

export default function BackupPage({ onBack, encryption, onReload }: BackupPageProps) {
  const [importing, setImporting] = useState(false);

  const handleExportFile = async () => {
    try {
      const data = await EntryStorage.backupGetExport(
        encryption || new Encryption('', ''),
        false
      );

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auths-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      alert('备份文件已下载');
    } catch {
      alert('导出失败');
    }
  };

  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);

            if (!encryption) {
              alert('导入失败：需要先设置密码');
              return;
            }

            // Import data
            await EntryStorage.import(encryption, data);
            await onReload();
            alert('导入成功！');
          } catch {
            alert('导入失败：文件格式错误');
          } finally {
            setImporting(false);
          }
        };
        reader.readAsText(file);
      } catch {
        alert('文件读取失败');
        setImporting(false);
      }
    };
    input.click();
  };

  return (
    <div className="backup-page">
      <div className="backup-header">
        <button className="back-btn" onClick={onBack}>
          ← 返回
        </button>
        <h1>备份 & 恢复</h1>
      </div>

      <div className="backup-content">
        <section className="backup-section">
          <h2>本地备份</h2>
          <p className="section-desc">
            将账户数据导出为文件，或从文件恢复
          </p>

          <div className="backup-actions">
            <button className="btn-action" onClick={handleExportFile}>
              <span className="icon">⬇️</span>
              <div>
                <div className="action-title">导出到文件</div>
                <div className="action-desc">下载 JSON 备份文件</div>
              </div>
            </button>

            <button className="btn-action" onClick={handleImportFile} disabled={importing}>
              <span className="icon">⬆️</span>
              <div>
                <div className="action-title">{importing ? '导入中...' : '从文件恢复'}</div>
                <div className="action-desc">选择备份文件导入</div>
              </div>
            </button>
          </div>
        </section>

        <section className="backup-section">
          <h2>WebDAV 同步</h2>
          <p className="section-desc">
            使用 WebDAV 协议同步到自托管服务器
          </p>
          <div className="backup-actions">
            <button className="btn-action" onClick={() => alert('请在设置中配置 WebDAV')}>
              <span className="icon">🔗</span>
              <div>
                <div className="action-title">配置 WebDAV</div>
                <div className="action-desc">连接到你的私有云存储</div>
              </div>
            </button>
          </div>
        </section>

        <section className="backup-section warning">
          <h2>重要提示</h2>
          <ul>
            <li>备份文件包含敏感信息，请妥善保管</li>
            <li>建议定期创建备份</li>
            <li>恢复数据前请确认文件来源可信</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
