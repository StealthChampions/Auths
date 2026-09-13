# <img src="public/images/icon.svg" width="32" height="32" alt="Auths Logo" style="vertical-align: bottom;"> Auths

[English](./README.md)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.4-green.svg)](package.json)
[![Build](https://img.shields.io/badge/Build-WXT-orange.svg)](https://wxt.dev)

**Auths** 是一款安全且现代化的双重验证 (2FA / TOTP) 浏览器扩展。基于 React 和 WXT 框架构建，在提供整洁视觉体验的同时，确保数据的安全性。

---

## ✨ 核心特性

- **现代 UI**: 简洁的设计风格，支持深色模式和流畅动画。
- **本地存储**: 数据永不离开浏览器。可选的带密码备份导出使用 **AES-256-GCM + PBKDF2-SHA256** 加密。
- **账户管理**: 支持置顶、拖拽排序与搜索。**智能筛选**可根据当前网站自动显示相关验证码。
- **服务图标**: 为可识别的服务显示图标（基于 issuer 名称从 Google favicon 服务获取）。
- **实时验证**: 精准的验证码生成与进度指示。
- **WebDAV 备份 (可选)**: 备份与同步账户到您自己的 WebDAV 服务器（强制 HTTPS；上传内容包含账户数据，仅存储在您的服务器上）。
- **二维码扫描**: 内置屏幕二维码扫描器，可直接从网页添加账户。

---

## 🛠 技术栈

- **框架**: [WXT](https://wxt.dev) (Web Extension Tools)
- **UI 库**: [React 18](https://reactjs.org/)
- **样式**: SCSS / CSS Variables
- **加密**: Web Crypto API, `crypto-js`
- **扫码**: `jsqr`
- **状态管理**: React Context + Hooks

---

## 🚀 快速开始

### 开发安装

1. **克隆仓库**:
   ```bash
   git clone https://github.com/StealthChampions/Auths.git
   cd Auths
   ```

2. **安装依赖**:
   ```bash
   npm install
   ```

3. **启动开发服务器**:
   ```bash
   npm run dev
   ```
   此命令会自动打开一个加载了该扩展的 Chrome 浏览器实例。

4. **构建生产版本**:
   ```bash
   npm run build
   ```
   构建产物（zip 包及文件夹）将生成在 `.output/` 目录下。

### 手动加载

1. 在浏览器地址栏输入 `chrome://extensions/`。
2. 打开右上角的 **开发者模式 (Developer mode)** 开关。
3. 点击左上角的 **加载已解压的扩展程序 (Load unpacked)**。
4. 选择构建生成的 `.output/chrome-mv3` 文件夹。

---

## 🔒 安全

我们视安全为生命线。
- **数据仅存本地**: 账户存储在浏览器本地存储中，除非您主动启用 WebDAV 备份或导出备份文件，数据永不离开设备。
- **加密导出**: 可选的带密码备份导出在浏览器内使用 AES-256-GCM（PBKDF2-SHA256 密钥派生）加密；旧版 AES-CBC 备份仍可导入。
- **零追踪**: 我们不收集任何个人数据或使用行为分析。
- **漏洞报告**: 如发现潜在安全问题，请参阅我们的 [安全政策 (Security Policy)](SECURITY.md)。

---

## 🤝 参与贡献

欢迎任何形式的贡献！请随意提交 Pull Request。

1. Fork 本仓库。
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)。
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)。
4. 推送到远程分支 (`git push origin feature/AmazingFeature`)。
5. 开启 Pull Request。

---

## 📄 许可证

本项目基于 Apache 2.0 许可证分发。详情请参阅 `LICENSE` 文件。

---

<p align="center">
  Developed with ❤️ by <a href="https://github.com/StealthChampions">StealthChampions</a>
</p>
