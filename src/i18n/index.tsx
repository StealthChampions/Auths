import React, { createContext, useContext, ReactNode } from 'react';

// Helper function to get message from chrome.i18n
function getMessage(key: string, substitutions?: string | string[]): string {
  try {
    const message = chrome.i18n.getMessage(key, substitutions);
    return message || key;
  } catch {
    // Fallback for development or non-extension environment
    return key;
  }
}

// Create a proxy-like object that returns translations
function createTranslationProxy(): Record<string, string> {
  return new Proxy({} as Record<string, string>, {
    get(_, prop: string) {
      return getMessage(prop);
    }
  });
}

interface I18nContextType {
  t: (key: string, substitutions?: string | string[]) => string;
  getMessage: (key: string, substitutions?: string | string[]) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const value: I18nContextType = {
    t: getMessage,
    getMessage
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

// Export getMessage for use outside of React components
export { getMessage };
