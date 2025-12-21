# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Auths is a Chrome/Firefox browser extension for generating 2-Step Verification (TOTP/HOTP) codes. Built with React, TypeScript, and the WXT framework for cross-browser extension development.

## Development Commands

```bash
npm run dev              # Start dev server for Chrome
npm run dev:firefox      # Start dev server for Firefox
npm run build            # Production build for Chrome
npm run build:firefox    # Production build for Firefox
npm run zip              # Create distributable zip for Chrome
npm run zip:firefox      # Create distributable zip for Firefox
npm run test             # Run tests
```

Output directories:
- Dev: `.output/chrome-mv3-dev/` or `.output/firefox-mv3-dev/`
- Build: `.output/chrome-mv3/` or `.output/firefox-mv3/`

## Architecture

### WXT Framework Structure

The project uses WXT (Web Extension Tools) with source in `src/`:

- **`src/entrypoints/`** - Extension entry points (auto-discovered by WXT)
  - `popup/` - Main popup UI
  - `background.ts` - Service worker
  - `options/`, `permissions/`, `import/` - Additional pages

- **`src/components/`** - React components organized by entry point
  - `popup/` - Main popup components (Popup.tsx, MainBody.tsx, Settings.tsx, etc.)
  - `common/` - Reusable form inputs (TextInput, SelectInput, etc.)

### State Management

Uses React Context with multiple reducers in `src/store/`:

```typescript
// Usage pattern
import { useAccounts, useStyle, useMenu } from '@/store';

const { entries, dispatch } = useAccounts();
const { style, dispatch: styleDispatch } = useStyle();
```

Available hooks: `useAccounts`, `useStyle`, `useMenu`, `useNotification`, `useCurrentView`, `useBackup`, `usePermissions`, `useQr`, `useAdvisor`

### Internationalization

Uses Chrome's `chrome.i18n` API with messages in `public/_locales/`:
- `en/messages.json` - English (default)
- `zh_CN/messages.json` - Chinese

```typescript
import { useI18n } from '@/i18n';
const { t } = useI18n();
// Use: t('message_key')
```

### OTP Generation

Core TOTP/HOTP logic in `src/models/key-utilities.ts`:
- Supports TOTP, HOTP, Steam Guard, Battle.net
- Algorithms: SHA1, SHA256, SHA512, GOST

### Path Aliases

Configured in `tsconfig.json`:
- `@/*` → `./src/*`
- `~/*` → `./*`

## Key Files

- `wxt.config.ts` - WXT/extension configuration, manifest settings
- `src/store/StoreContext.tsx` - Global state provider
- `src/models/otp.ts` - OTP type definitions
- `src/components/popup/Popup.tsx` - Main popup component with password/lock logic
