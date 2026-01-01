# Privacy Policy | 隐私政策

**Last Updated | 最后更新:** January 1, 2026

---

## Overview | 概述

**English:**
Auths is a browser extension for two-factor authentication (2FA/TOTP) code generation. We are committed to protecting your privacy and being transparent about our data practices.

**中文：**
Auths 是一款用于双因素认证（2FA/TOTP）验证码生成的浏览器扩展。我们致力于保护您的隐私，并对数据处理方式保持透明。

---

## Data Collection | 数据收集

**English:**
**We do not collect any personal data.**

Auths does not:
- Collect or transmit personal information
- Track your browsing activity
- Use analytics or telemetry services
- Store data on external servers
- Share any information with third parties

**中文：**
**我们不收集任何个人数据。**

Auths 不会：
- 收集或传输个人信息
- 跟踪您的浏览活动
- 使用分析或遥测服务
- 在外部服务器上存储数据
- 与第三方共享任何信息

---

## Data Storage | 数据存储

**English:**
All your data is stored **locally** on your device:

- **Account secrets**: Stored securely in your browser's local storage
- **Settings and preferences**: Stored in your browser's local storage
- **No cloud storage by default**: Your data never leaves your device unless you explicitly enable optional backup features

**中文：**
所有数据都**本地**存储在您的设备上：

- **账户密钥**：安全存储在浏览器的本地存储中
- **设置和偏好**：存储在浏览器的本地存储中
- **默认无云存储**：除非您明确启用可选备份功能，否则数据永远不会离开您的设备

---

## Optional Cloud Backup (WebDAV) | 可选云备份（WebDAV）

**English:**
If you choose to enable WebDAV backup:

- Your data is uploaded to **your own** WebDAV server
- We do not have access to your WebDAV credentials or data
- You are responsible for the security of your WebDAV server
- Host permissions are requested **per-server** only when you configure backup

**中文：**
如果您选择启用 WebDAV 备份：

- 您的数据将上传到**您自己的** WebDAV 服务器
- 我们无法访问您的 WebDAV 凭据或数据
- 您需要自行负责 WebDAV 服务器的安全
- 仅在您配置备份时**按服务器**请求主机权限

---

## Permissions | 权限说明

**English:**

| Permission | Type | Purpose |
|------------|------|---------|
| `activeTab` | Required | Detect current website URL for Smart Filter feature |
| `storage` | Required | Store your account data locally |
| `scripting` | Required | Inject QR scanner script for screen capture |
| `clipboardWrite` | Required | Copy verification codes to clipboard |
| `alarms` | Optional | Schedule auto-backup (only when enabled) |
| `notifications` | Optional | Backup completion feedback |
| `host_permissions` | Optional | WebDAV server access (per-server, only when configured) |

**中文：**

| 权限 | 类型 | 用途 |
|------|------|------|
| `activeTab` | 必需 | 检测当前网站 URL 用于智能过滤功能 |
| `storage` | 必需 | 本地存储账户数据 |
| `scripting` | 必需 | 注入二维码扫描脚本用于屏幕截取 |
| `clipboardWrite` | 必需 | 复制验证码到剪贴板 |
| `alarms` | 可选 | 调度自动备份（仅在启用时） |
| `notifications` | 可选 | 备份完成反馈通知 |
| `host_permissions` | 可选 | WebDAV 服务器访问（按服务器，仅在配置时） |

---

## Network Requests | 网络请求

**English:**
The extension only makes network requests when:

1. User initiates "Sync Time" with Google servers (to correct time drift)
2. User manually triggers WebDAV backup/restore to their own server

All network requests are user-initiated and visible to the user.

**中文：**
扩展仅在以下情况下发起网络请求：

1. 用户启动与 Google 服务器的"时间同步"（用于校正时间偏差）
2. 用户手动触发到自己服务器的 WebDAV 备份/恢复

所有网络请求均由用户主动发起且对用户可见。

---

## Security | 安全性

**English:**
- All sensitive data is stored locally in your browser
- No remote code is used - all logic is bundled within the extension
- Source code is open and auditable on [GitHub](https://github.com/user/Auths)

**中文：**
- 所有敏感数据都存储在您的浏览器本地
- 不使用远程代码 - 所有逻辑都打包在扩展内
- 源代码开放，可在 [GitHub](https://github.com/user/Auths) 上审计

---

## Children's Privacy | 儿童隐私

**English:**
Auths is not directed at children under the age of 13. We do not knowingly collect personal information from children.

**中文：**
Auths 不面向 13 岁以下的儿童。我们不会故意收集儿童的个人信息。

---

## Changes to This Policy | 政策变更

**English:**
We may update this Privacy Policy from time to time. Changes will be posted to this page with an updated revision date.

**中文：**
我们可能会不时更新本隐私政策。更改将发布在此页面，并附上更新的修订日期。

---

## Contact | 联系方式

**English:**
If you have any questions about this Privacy Policy, please:
- Open an issue on [GitHub](https://github.com/user/Auths/issues)

**中文：**
如果您对本隐私政策有任何疑问，请：
- 在 [GitHub](https://github.com/user/Auths/issues) 上提交 Issue

---

## Summary | 总结

**English:**
Auths stores all data locally. We collect nothing. Your privacy is fully protected.

**中文：**
Auths 将所有数据存储在本地。我们不收集任何信息。您的隐私受到完全保护。
