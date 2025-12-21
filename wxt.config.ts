import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '__MSG_extName__',
    short_name: '__MSG_extShortName__',
    description: '__MSG_extDesc__',
    default_locale: 'zh_CN',
    permissions: ['activeTab', 'storage', 'identity', 'alarms', 'scripting'],
    optional_permissions: ['clipboardWrite'],
    host_permissions: [
      'https://www.google.com/',
      'https://*.dropboxapi.com/*',
      'https://www.googleapis.com/*',
      'https://accounts.google.com/o/oauth2/revoke',
      'https://graph.microsoft.com/me/*',
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      '*://*/*'
    ],
    commands: {
      _execute_action: {},
      'scan-qr': {
        description: 'Scan a QR code'
      },
      autofill: {
        description: 'Autofill the matched code'
      }
    }
  },
  vite: () => ({
    define: {
      global: 'globalThis',
    },
  }),
});
