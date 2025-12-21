# Quick Start Guide

## What's Been Done

Your project has been successfully migrated from Vue.js to React with the wxt framework:

1. **Project renamed** from "authenticator-extension" to "auths"
2. **wxt framework** installed and configured
3. **React 19** and TypeScript set up
4. **Build system** working (wxt + Vite)
5. **Basic structure** created:
   - Popup page (main UI)
   - Options page (settings)
   - Background service worker
6. **Static assets** migrated (images, SVG icons, translations)

## Try It Now

### 1. Build the Extension

```bash
npm run build
```

This creates a production build in `.output/chrome-mv3/`

### 2. Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3/` folder

### 3. Test the Extension

- Click the extension icon in your browser toolbar
- You should see the basic Auths popup interface
- Right-click the icon → "Options" to see the options page

### 4. Development Mode

For live development with hot reload:

```bash
npm run dev
```

This starts a dev server that watches for changes. The extension will automatically reload when you edit files.

## What's Next

The basic infrastructure is ready, but the core functionality needs to be implemented:

### Immediate Next Steps

1. **Set up state management** (Context API, Zustand, or Redux)
   - See `MIGRATION.md` for options

2. **Migrate core components**:
   - Entry list component (display OTP codes)
   - Add account form
   - Entry card with code display

3. **Implement OTP generation**:
   - The OTP models in `src/models/otp.ts` are ready to use
   - You just need to integrate them with React components

4. **Add storage integration**:
   - The storage models in `src/models/storage.ts` work as-is
   - Create React hooks to interface with them

### Example: Add Your First Component

Create a new component in `components/Popup/EntryCard.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { OTPEntry } from '@/src/models/otp';

interface EntryCardProps {
  entry: OTPEntry;
}

export function EntryCard({ entry }: EntryCardProps) {
  const [code, setCode] = useState('000000');

  useEffect(() => {
    const updateCode = () => {
      setCode(entry.generate());
    };

    updateCode();
    const interval = setInterval(updateCode, 1000);
    return () => clearInterval(interval);
  }, [entry]);

  return (
    <div className="entry-card">
      <div className="entry-info">
        <div className="entry-issuer">{entry.issuer}</div>
        <div className="entry-account">{entry.account}</div>
      </div>
      <div className="entry-code">{code}</div>
    </div>
  );
}
```

Then import and use it in `components/Popup/App.tsx`.

## File Structure

```
entrypoints/           → Extension entry points (auto-discovered by wxt)
├── background.ts      → Service worker
├── popup/
│   ├── index.html    → Popup HTML
│   ├── index.tsx     → Popup entry
│   └── style.css     → Popup styles
└── options/
    ├── index.html    → Options HTML
    ├── index.tsx     → Options entry
    └── style.css     → Options styles

components/            → Shared React components
├── Popup/            → Popup-specific components
└── Options/          → Options-specific components

src/                  → Original source (models are reusable!)
└── models/           → Data models (OTP, storage, encryption, etc.)

public/               → Static assets (copied to output)
├── images/
├── svg/
└── _locales/         → Translations

.output/              → Build output (gitignored)
└── chrome-mv3/       → Chrome extension build
```

## Commands Reference

```bash
# Development
npm run dev              # Start dev server for Chrome
npm run dev:firefox      # Start dev server for Firefox

# Production Build
npm run build            # Build for Chrome
npm run build:firefox    # Build for Firefox

# Create Distribution Packages
npm run zip              # Create Chrome .zip
npm run zip:firefox      # Create Firefox .zip

# Type Checking
npm run postinstall      # Generate wxt types
```

## Resources

- 📖 [wxt Documentation](https://wxt.dev/)
- 📖 [React Documentation](https://react.dev/)
- 📄 [MIGRATION.md](./MIGRATION.md) - Detailed migration guide
- 📁 [Original Vue Components](./src/components/) - Reference for migration

## Need Help?

Check out these files for guidance:
- `MIGRATION.md` - Detailed migration patterns and examples
- `README.md` - Full project documentation
- Original Vue components in `src/components/` for reference

Happy coding! 🚀
