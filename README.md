# Auths by StealthChampions

Auths is a premium, modern 2-Step Verification code generator browser extension built with React and the WXT framework. It combines high-end aesthetics with robust security to manage your 2FA/TOTP codes.

## Features

- ✨ **Premium UI**: Modern dark-themed design with glassmorphism elements and smooth, interactive transitions.
- 🎨 **Custom Themes**: Choose from curated visual variants including **Violet**, **Emerald**, **Sunset**, and **Ocean**.
- 🔄 **Real-time TOTP**: Instant code generation with a high-fidelity progress bar and "count-down" indicators.
- ☁️ **Cloud Backup**: Securely sync your accounts with Dropbox, Google Drive, or OneDrive.
- 🔒 **Password Encryption**: Protect your data with industry-standard encryption and local lock screen.
- 🔍 **Smart Search**: Quickly filter and find the right account with a responsive search bar.
- 🌐 **Multi-language**: Fully localized support for multiple global languages.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm

### Getting Started

1. **Install dependencies**:
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```
   This will start the WXT dev server and automatically build the extension.

3. **Load the extension**:
   - **Chrome/Edge**: Open `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the `.output/chrome-mv3` directory.
   - **Firefox**: Run `npm run dev:firefox` for automatic loading.

### Build for Production

```bash
# Build for Chrome
npm run build

# Build for Firefox
npm run build:firefox

# Create distribution packages (zip)
npm run zip
npm run zip:firefox
```

## Project Structure

```
auths/
├── entrypoints/          # Extension entry points (background, popup, options)
├── components/          # React components and associated styles
├── src/                 # Core logic, models, and utility functions
├── public/             # Static assets (icons, SVGs, i18n locales)
└── wxt.config.ts      # WXT framework configuration
```

## Technologies

- **Framework**: [WXT](https://wxt.dev/) - Next-gen web extension framework
- **UI Architecture**: React 19 + TypeScript
- **Styling**: Vanilla CSS + SCSS (Modern-themed components)
- **Encryption**: Argon2 + AES

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the [Apache License 2.0](LICENSE). See the [package.json](package.json) for details.

---

Developed by **[StealthChampions](https://github.com/StealthChampions)**.