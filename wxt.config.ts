import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '__MSG_extName__',
    short_name: '__MSG_extShortName__',
    description: '__MSG_extDesc__',
    default_locale: 'en',
    icons: {
      16: 'images/icon16.png',
      19: 'images/icon19.png',
      38: 'images/icon38.png',
      48: 'images/icon48.png',
      128: 'images/icon128.png'
    },
    action: {
      default_icon: {
        16: 'images/icon16.png',
        19: 'images/icon19.png',
        38: 'images/icon38.png',
        48: 'images/icon48.png',
        128: 'images/icon128.png'
      }
    },
    permissions: ['activeTab', 'storage', 'scripting', 'clipboardWrite'],
    optional_permissions: ['alarms', 'notifications', 'tabs'],
    optional_host_permissions: ['*://*/*'],
    host_permissions: [],
    // Firefox-specific settings | Firefox 特定设置
    browser_specific_settings: {
      gecko: {
        id: 'auths@stealthchampions.dev',
        strict_min_version: '109.0',
        // @ts-expect-error - Firefox requires this for new extensions
        data_collection_permissions: {
          required: ['none']
        }
      }
    }
  },
  hooks: {
    // The region-selector content script uses runtime registration and is
    // injected on demand via chrome.scripting.executeScript from the popup.
    // activeTab grants the temporary host access needed for that injection,
    // so WXT's auto-derived host permissions are removed to keep the install
    // prompt minimal ("active tab only" instead of "all sites").
    // 区域选择脚本为运行时注册，由 popup 按需 executeScript 注入；
    // activeTab 已提供所需临时权限，这里清掉自动推导的 host 权限，
    // 安装提示保持最小（仅当前标签页，而非所有网站）。
    'build:manifestGenerated': (_wxt, manifest) => {
      manifest.host_permissions = [];
      // Drop the auto-generated empty content_scripts array.
      // 同时移除自动生成的空 content_scripts 数组。
      if (Array.isArray(manifest.content_scripts) && manifest.content_scripts.length === 0) {
        delete manifest.content_scripts;
      }
    },
  },
  vite: () => ({
    define: {
      global: 'globalThis',
    },
  }),
});
