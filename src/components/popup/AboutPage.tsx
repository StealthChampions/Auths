import './AboutPage.css';

interface AboutPageProps {
  onBack: () => void;
}

export default function AboutPage({ onBack }: AboutPageProps) {
  return (
    <div className="about-page">
      <div className="about-header">
        <button className="back-btn" onClick={onBack}>
          ← 返回
        </button>
        <h1>关于</h1>
      </div>

      <div className="about-content">
        <div className="app-info">
          <div className="app-icon">🔐</div>
          <h2>Auths</h2>
          <p className="version">版本 0.1.0</p>
          <p className="tagline">轻量级的两步验证代码生成器</p>
        </div>

        <section className="info-section">
          <h3>功能特点</h3>
          <ul className="feature-list">
            <li>✓ 生成 TOTP/HOTP 验证码</li>
            <li>✓ 支持多种加密算法</li>
            <li>✓ 本地安全存储</li>
            <li>✓ 云备份支持</li>
            <li>✓ 密码保护</li>
            <li>✓ 自动填充功能</li>
          </ul>
        </section>

        <section className="info-section">
          <h3>开源信息</h3>
          <p>Auths 是一个开源项目</p>
          <div className="links">
            <a
              href="https://github.com/StealthChampions/Auths"
              target="_blank"
              rel="noopener noreferrer"
              className="link-btn"
            >
              <span>📦</span>
              <span>GitHub 仓库</span>
            </a>
            <a
              href="https://github.com/StealthChampions/Auths/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="link-btn"
            >
              <span>🐛</span>
              <span>报告问题</span>
            </a>
            <a
              href="https://otp.ee/quickstart"
              target="_blank"
              rel="noopener noreferrer"
              className="link-btn"
            >
              <span>📖</span>
              <span>使用指南</span>
            </a>
          </div>
        </section>

        <section className="info-section">
          <h3>许可证</h3>
          <p>本项目基于 Apache 2.0 许可证开源</p>
        </section>

        <section className="info-section">
          <h3>致谢</h3>
          <p>感谢所有为此项目做出贡献的开发者</p>
          <p className="small-text">
            基于 <a href="https://github.com/StealthChampions/Auths" target="_blank" rel="noopener noreferrer">Authenticator Extension</a> 开发
          </p>
        </section>

        <section className="info-section">
          <h3>隐私政策</h3>
          <p>
            Auths 不会收集您的任何个人信息。所有数据都安全地存储在您的浏览器本地存储或您选择的云服务中。
          </p>
        </section>

        <footer className="about-footer">
          <p>© 2025 Auths. All rights reserved.</p>
          <p className="small-text">
            使用 ❤️ 和 React 构建
          </p>
        </footer>
      </div>
    </div>
  );
}
