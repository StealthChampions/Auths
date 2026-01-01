/**
 * Background Service Worker | 后台服务脚本
 *
 * Handles extension lifecycle events, keyboard commands, and message communication.
 * Provides screen capture, QR code parsing, and account storage functionality.
 *
 * 处理扩展生命周期事件、键盘命令和消息通信。
 * 提供屏幕截图、二维码解析和账户存储功能。
 */

export default defineBackground(() => {
  // Localized messages for toast notifications
  // 用于 Toast 通知的本地化消息
  const messages: Record<string, Record<string, string>> = {
    en: {
      account_added_successfully: 'Account added successfully!',
      account_already_exists: 'This account already exists!',
      qr_add_failed: 'Failed to add account',
      qr_error_not_found: 'QR code not found in image',
    },
    zh_CN: {
      account_added_successfully: '账户添加成功！',
      account_already_exists: '该账户已存在，请勿重复添加。',
      qr_add_failed: '添加账户失败',
      qr_error_not_found: '图片中未找到二维码',
    }
  };

  // Get user's language preference from storage
  // 从存储中获取用户的语言偏好
  async function getUserLanguage(): Promise<string> {
    try {
      const result = await chrome.storage.local.get('UserSettings');
      const settings = result.UserSettings || {};
      const lang = settings.language || 'system';
      if (lang === 'system') {
        // Use browser language | 使用浏览器语言
        const browserLang = chrome.i18n.getUILanguage();
        return browserLang.startsWith('zh') ? 'zh_CN' : 'en';
      }
      return lang;
    } catch {
      return 'zh_CN'; // Default to Chinese | 默认中文
    }
  }

  // Get localized message
  // 获取本地化消息
  async function getMessage(key: string): Promise<string> {
    const lang = await getUserLanguage();
    return messages[lang]?.[key] || messages['en'][key] || key;
  }

  // Handle extension installation
  // 处理扩展安装事件
  chrome.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
    if (details.reason === 'install') {
      // Extension installed | 扩展已安装
    } else if (details.reason === 'update') {
      // Extension updated | 扩展已更新
    }
  });

  // Handle commands
  // 处理快捷键命令
  chrome.commands.onCommand.addListener((command: string) => {
    if (command === 'scan-qr') {
      // Handle QR scan command | 处理扫描二维码命令
    } else if (command === 'autofill') {
      // Handle autofill command | 处理自动填充命令
    }
  });

  // Parse otpauth URL
  // 解析 otpauth URL
  function parseOtpAuthUrl(url: string) {
    if (!url.startsWith('otpauth://')) {
      throw new Error('Not a valid otpauth URL');
    }

    const urlObj = new URL(url);
    if (urlObj.protocol !== 'otpauth:') {
      throw new Error('Not a valid otpauth URL');
    }

    const type = urlObj.host;
    if (type !== 'totp' && type !== 'hotp') {
      throw new Error('Unsupported OTP type');
    }

    const label = decodeURIComponent(urlObj.pathname.substring(1));
    const params = new URLSearchParams(urlObj.search);

    let issuer = params.get('issuer') || '';
    let account = '';

    if (label.includes(':')) {
      const parts = label.split(':');
      if (!issuer) issuer = parts[0];
      account = parts[1] || '';
    } else {
      account = label;
    }

    const secret = params.get('secret');
    if (!secret) {
      throw new Error('No secret found in URL');
    }

    const base32Regex = /^[A-Z2-7]+=*$/i;
    if (!base32Regex.test(secret)) {
      throw new Error('Invalid secret key');
    }

    const period = parseInt(params.get('period') || '30');
    const digits = parseInt(params.get('digits') || '6');
    const algorithm = params.get('algorithm')?.toUpperCase() || 'SHA1';

    return {
      type: type === 'hotp' ? 2 : 1,
      issuer: issuer || 'Unknown',
      account,
      secret: secret.toUpperCase(),
      period,
      digits,
      algorithm: algorithm === 'SHA256' ? 2 : algorithm === 'SHA512' ? 3 : 1,
      counter: parseInt(params.get('counter') || '0'),
    };
  }

  // Generate unique hash
  // 生成唯一哈希值
  function generateHash(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // Handle messages from content scripts and popup
  // 处理来自 content script 和 popup 的消息
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'captureVisibleTab') {
      chrome.tabs.captureVisibleTab(undefined, { format: 'png' })
        .then((dataUrl) => {
          sendResponse({ dataUrl });
        })
        .catch((error) => {
          sendResponse({ error: error.message });
        });
      return true;
    }

    // Handle getMessage request from content script
    // 处理来自 content script 的获取消息请求
    if (message.action === 'getMessage') {
      (async () => {
        const msg = await getMessage(message.key);
        sendResponse({ message: msg });
      })();
      return true;
    }

    // Handle QR code data from content script - save account directly
    // 处理来自 content script 的二维码数据 - 直接保存账户
    if (message.action === 'saveQRAccount') {
      console.log('[Auths Background] Received QR data:', message.qrData);
      (async () => {
        try {
          const accountData = parseOtpAuthUrl(message.qrData);
          console.log('[Auths Background] Parsed account:', accountData);

          // Add hash and other fields
          // 添加哈希值和其他字段
          const newEntry = {
            ...accountData,
            hash: generateHash(),
            pinned: false,
            code: '',
          };

          // Load existing entries and check for duplicates
          // 加载现有条目并检查重复
          const result = await chrome.storage.local.get(['entries']);
          const entries = result.entries || [];

          // Check for duplicate account (same issuer and secret)
          // 检查重复账户（相同的发行者和密钥）
          const isDuplicate = entries.some((entry: any) =>
            entry.secret === accountData.secret &&
            entry.issuer === accountData.issuer
          );

          if (isDuplicate) {
            console.log('[Auths Background] Duplicate account detected');
            const duplicateMsg = await getMessage('account_already_exists');
            sendResponse({
              success: false,
              error: 'account_already_exists',
              message: duplicateMsg,
              isDuplicate: true
            });
            return;
          }

          entries.push(newEntry);
          await chrome.storage.local.set({ entries });

          console.log('[Auths Background] Account saved successfully');
          const successMsg = await getMessage('account_added_successfully');

          // Send notification if permission granted | 如果有权限则发送通知
          const hasNotificationPermission = await chrome.permissions.contains({ permissions: ['notifications'] });
          if (hasNotificationPermission) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: '/images/icon128.png',
              title: 'Auths',
              message: successMsg
            });
          }

          sendResponse({ success: true, account: accountData, message: successMsg });
        } catch (error) {
          console.error('[Auths Background] Error parsing QR:', error);
          const failedMsg = await getMessage('qr_add_failed');
          sendResponse({ success: false, error: (error as Error).message, message: failedMsg });
        }
      })();
      return true;
    }
  });
});

