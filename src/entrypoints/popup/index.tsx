/**
 * Popup Entry Point | Popup 入口文件
 *
 * Main entry point for the extension popup window.
 * Initializes React app with global providers (Store, I18n).
 *
 * 扩展弹窗的主入口文件。
 * 初始化 React 应用并注入全局 Provider（状态管理、国际化）。
 */

import ReactDOM from 'react-dom/client';
import React from 'react';
import '@/assets/styles/modern-theme.scss';
import { StoreProvider } from '@/store/StoreContext';
import { I18nProvider } from '@/i18n';
import Popup from './Popup';

// Create root element and render the app
// 创建根元素并渲染应用
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
