/**
 * I18n Module | 国际化模块
 *
 * Provides internationalization support using React Context.
 * Loads translations from Chrome extension _locales folder.
 *
 * 使用 React Context 提供国际化支持。
 * 从 Chrome 扩展 _locales 文件夹加载翻译。
 */

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useMenu } from '../store';

// Translation messages type | 翻译消息类型
type Messages = Record<string, { message: string; description?: string }>;

// Cache for loaded translations | 已加载翻译的缓存
const translationCache: Record<string, Messages> = {};

/**
 * Load translations from JSON file | 从 JSON 文件加载翻译
 */
async function loadTranslations(locale: string): Promise<Messages> {
  if (translationCache[locale]) {
    return translationCache[locale];
  }

  try {
    // Try to load from extension's _locales folder
    const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    const response = await fetch(url);
    const messages = await response.json();
    translationCache[locale] = messages;
    return messages;
  } catch {
    // If locale not found, return empty object
    console.warn(`Failed to load translations for locale: ${locale}`);
    return {};
  }
}

/**
 * Get system language | 获取系统语言
 */
function getSystemLanguage(): string {
  const lang = navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage || 'en';
  // Convert browser language code to Chrome locale format
  if (lang.startsWith('zh')) {
    return 'zh_CN';
  }
  return 'en';
}

interface I18nContextType {
  t: (key: string, substitutions?: string | string[]) => string;
  getMessage: (key: string, substitutions?: string | string[]) => string;
  locale: string;
  setLocale: (locale: string) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { menu } = useMenu();
  const [messages, setMessages] = useState<Messages>({});
  const [currentLocale, setCurrentLocale] = useState<string>('en');

  // Determine the actual locale to use
  const getEffectiveLocale = useCallback(() => {
    if (!menu.language || menu.language === 'system') {
      return getSystemLanguage();
    }
    return menu.language;
  }, [menu.language]);

  // Load translations when locale changes
  useEffect(() => {
    const effectiveLocale = getEffectiveLocale();
    setCurrentLocale(effectiveLocale);

    const loadMessages = async () => {
      const loadedMessages = await loadTranslations(effectiveLocale);
      setMessages(loadedMessages);
    };

    loadMessages();
  }, [menu.language, getEffectiveLocale]);

  // Translation function
  const getMessage = useCallback((key: string, substitutions?: string | string[]): string => {
    const entry = messages[key];
    if (!entry) {
      // Fallback to chrome.i18n.getMessage
      try {
        const chromeMessage = chrome.i18n.getMessage(key, substitutions);
        if (chromeMessage) return chromeMessage;
      } catch {
        // Ignore error
      }
      return key;
    }

    let message = entry.message;

    // Handle substitutions ($1, $2, etc.)
    if (substitutions) {
      const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
      subs.forEach((sub, index) => {
        message = message.replace(`$${index + 1}`, sub);
      });
    }

    return message;
  }, [messages]);

  const value: I18nContextType = {
    t: getMessage,
    getMessage,
    locale: currentLocale,
    setLocale: (locale: string) => {
      // This will trigger re-load through menu state
      // The actual state change happens through the menu reducer
    }
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Export getMessage for use outside of React components (fallback to chrome.i18n)
export function getMessage(key: string, substitutions?: string | string[]): string {
  try {
    const message = chrome.i18n.getMessage(key, substitutions);
    return message || key;
  } catch {
    return key;
  }
}
