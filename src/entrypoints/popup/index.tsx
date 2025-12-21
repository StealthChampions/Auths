import ReactDOM from 'react-dom/client';
import React from 'react';
import '@/assets/styles/modern-theme.scss';
import { StoreProvider } from '@/store/StoreContext';
import { I18nProvider } from '@/i18n';
import Popup from '@/components/popup/Popup';

// Create root element and render the app
const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <StoreProvider>
        <I18nProvider>
          <Popup />
        </I18nProvider>
      </StoreProvider>
    </React.StrictMode>
  );
}
