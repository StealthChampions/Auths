import ReactDOM from 'react-dom/client';
import React from 'react';
import './style.css';
import { StoreProvider } from '@/store/StoreContext';
import Options from '@/components/options/Options';

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <StoreProvider>
        <Options />
      </StoreProvider>
    </React.StrictMode>
  );
}
