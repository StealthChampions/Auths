# Migration Guide: Vue to React with wxt

This document provides guidance on migrating the remaining Vue components to React.

## Completed Steps

1. ✅ Installed wxt framework and React 19
2. ✅ Configured TypeScript with React JSX support
3. ✅ Created basic entry points (popup, options, background)
4. ✅ Copied static assets (images, SVG icons, translations)
5. ✅ Set up build system (wxt + Vite)
6. ✅ Renamed project to "auths"

## Next Steps

### 1. State Management

The original app uses Vuex with multiple store modules. You need to choose a state management solution:

**Option A: React Context + useReducer** (recommended for simpler state)
```tsx
// Example: Create a context for accounts
import { createContext, useContext, useReducer } from 'react';

interface AccountsState {
  entries: OTPEntry[];
  // ... other state
}

const AccountsContext = createContext<AccountsState | undefined>(undefined);
```

**Option B: Zustand** (recommended for complex state, easier migration from Vuex)
```bash
npm install zustand
```

```tsx
import { create } from 'zustand';

const useAccountsStore = create((set) => ({
  entries: [],
  addEntry: (entry) => set((state) => ({ entries: [...state.entries, entry] })),
  // ... other actions
}));
```

**Option C: Redux Toolkit** (if you prefer Redux ecosystem)

### 2. Migrate Store Modules

The original app has these Vuex modules in `src/store/`:
- `Accounts` - Main OTP entries and codes
- `Backup` - Cloud backup state
- `CurrentView` - View routing
- `Menu` - Menu state
- `Notification` - Toast notifications
- `Qr` - QR code scanning
- `Advisor` - Security advisor
- `Style` - UI styling/theme

Create equivalent React hooks or Zustand stores for each.

### 3. Migrate Core Components

#### Priority 1: Essential Components

1. **EntryComponent** (`src/components/Popup/EntryComponent.vue`)
   - Displays a single OTP entry with code
   - Shows countdown timer
   - Copy to clipboard functionality
   - Edit/Delete actions

2. **AddAccountPage** (`src/components/Popup/AddAccountPage.vue`)
   - Form to add new OTP account
   - QR code scanning
   - Manual entry

3. **EnterPasswordPage** (`src/components/Popup/EnterPasswordPage.vue`)
   - Password input for encrypted vaults
   - Auto-unlock feature

#### Priority 2: Settings & Configuration

4. **PreferencesPage** (`src/components/Popup/PreferencesPage.vue`)
   - App settings
   - Theme options
   - Auto-lock timer

5. **BackupPage** (`src/components/Popup/BackupPage.vue`)
   - Backup/restore functionality
   - Export/import

#### Priority 3: Cloud Integration

6. **DropboxPage**, **DrivePage**, **OneDrivePage**
   - OAuth flows
   - Cloud sync

### 4. Port Utility Functions

Key files in `src/models/` that need to be ported:

- ✅ **otp.ts** - OTP generation algorithms (can be used as-is)
- ✅ **storage.ts** - Browser storage wrapper (can be used as-is)
- ✅ **encryption.ts** - Encryption/decryption (can be used as-is)
- ⚠️  **key-utilities.ts** - Helper functions (may need updates)
- ⚠️  **backup.ts** - Cloud backup classes (may need updates for React)

### 5. Implement Features

#### OTP Code Generation

```tsx
import { OTPEntry, OTPType } from '@/src/models/otp';

function useOTPCode(entry: OTPEntry) {
  const [code, setCode] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateCode = () => {
      const newCode = entry.generate();
      setCode(newCode);

      // Calculate progress for TOTP
      if (entry.type === OTPType.totp) {
        const period = entry.period || 30;
        const now = Math.floor(Date.now() / 1000);
        const timeLeft = period - (now % period);
        setProgress((timeLeft / period) * 100);
      }
    };

    updateCode();
    const interval = setInterval(updateCode, 1000);
    return () => clearInterval(interval);
  }, [entry]);

  return { code, progress };
}
```

#### Drag and Drop (for reordering entries)

Consider using [@dnd-kit/core](https://dndkit.com/) or [react-beautiful-dnd](https://github.com/atlassian/react-beautiful-dnd):

```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

#### QR Code Scanning

The original uses `jsqr` which is already installed:

```tsx
import jsQR from 'jsqr';

function QRScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const scanQR = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      // Capture and scan frames
    }
  };

  // ... implementation
}
```

### 6. Styling

The original app uses SCSS files in `sass/`. You have several options:

**Option A: Convert to CSS Modules**
```tsx
import styles from './Component.module.css';

function Component() {
  return <div className={styles.container}>...</div>;
}
```

**Option B: Use styled-components or Emotion**
```bash
npm install styled-components
```

**Option C: Use Tailwind CSS**
```bash
npm install -D tailwindcss postcss autoprefixer
```

### 7. Testing

The original has tests in `src/test/`. You'll need to:

1. Install React testing libraries:
```bash
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest jsdom
```

2. Convert Vue tests to React tests:
```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app', () => {
  render(<App />);
  expect(screen.getByText('Auths')).toBeInTheDocument();
});
```

### 8. i18n (Internationalization)

The extension uses Chrome's built-in i18n system with `_locales/` folders. Access translations:

```tsx
function useI18n() {
  const getMessage = (key: string, substitutions?: string[]) => {
    return chrome.i18n.getMessage(key, substitutions);
  };

  return { getMessage, t: getMessage };
}

// Usage:
function Component() {
  const { t } = useI18n();
  return <h1>{t('extName')}</h1>;
}
```

## Development Workflow

1. Start with one component at a time
2. Port the component's template to JSX
3. Convert Vue script to React hooks
4. Port styles (CSS/SCSS)
5. Test the component
6. Move to the next component

## Helpful Resources

- [wxt Documentation](https://wxt.dev/)
- [React Documentation](https://react.dev/)
- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/)
- [Original Vue Components](./src/components/)

## Common Migration Patterns

### Vue → React Equivalents

| Vue | React |
|-----|-------|
| `data()` | `useState()` |
| `computed` | `useMemo()` |
| `watch` | `useEffect()` |
| `methods` | Regular functions |
| `mounted()` | `useEffect(() => {}, [])` |
| `v-if` | `condition && <Component />` |
| `v-for` | `array.map()` |
| `v-model` | `value` + `onChange` |
| `$emit()` | Pass callback props |
| Vuex store | Context/Zustand/Redux |

## Tips

1. **Keep the original code**: Don't delete the Vue files until the React version is working
2. **Test frequently**: Build and test the extension after each component migration
3. **One feature at a time**: Don't try to migrate everything at once
4. **Use TypeScript**: Take advantage of type safety to catch errors early
5. **Reuse models**: The OTP generation, encryption, and storage models can be used as-is

Good luck with the migration! 🚀
