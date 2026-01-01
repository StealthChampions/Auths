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
    optional_permissions: ['alarms', 'notifications'],
    optional_host_permissions: ['*://*/*'],
    host_permissions: [],
    commands: {
      _execute_action: {},
      'scan-qr': {
        description: 'Scan a QR code'
      },
      autofill: {
        description: 'Autofill the matched code'
      }
    },
    // Firefox-specific settings | Firefox 特定设置
    browser_specific_settings: {
      gecko: {
        id: 'auths@anthropic.com',
        strict_min_version: '109.0',
        // @ts-expect-error - Firefox requires this for new extensions
        data_collection_permissions: {
          required: ['none']
        }
      }
    }
  },
  vite: () => ({
    define: {
      global: 'globalThis',
    },
  }),
});
