import ReactDOM from 'react-dom/client';
import React from 'react';
import './style.css';
import { StoreProvider } from '@/store/StoreContext';
import Import from '@/components/import/Import';

const root = document.getElementById('root');

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <StoreProvider>
        <Import />
      </StoreProvider>
    </React.StrictMode>
  );
}