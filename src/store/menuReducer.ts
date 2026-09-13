import type { ThemePreference } from '@/utils/theme';

/**
 * Menu Reducer | 菜单 Reducer
 *
 * Manages menu and settings state including theme, language, etc.
 * 管理菜单和设置状态，包括主题、语言等。
 */

export interface MenuState {
  version: string;
  smartFilter: boolean;
  theme: ThemePreference;
  clipboardClearSeconds: number;
  language: string;
}

export type MenuAction =
  | { type: 'init' }
  | { type: 'setSmartFilter'; payload: boolean }
  | { type: 'setTheme'; payload: ThemePreference }
  | { type: 'setClipboardClearSeconds'; payload: number }
  | { type: 'setVersion'; payload: string }
  | { type: 'setLanguage'; payload: string };

const initialState: MenuState = {
  version: '1.0.4',
  smartFilter: true,
  theme: 'system',
  clipboardClearSeconds: 0,
  language: 'system',
};

export function menuReducer(state = initialState, action: MenuAction): MenuState {
  switch (action.type) {
    case 'init':
      return state;

    case 'setSmartFilter':
      return {
        ...state,
        smartFilter: action.payload
      };

    case 'setTheme':
      return {
        ...state,
        theme: action.payload
      };

    case 'setClipboardClearSeconds':
      return {
        ...state,
        clipboardClearSeconds: action.payload
      };

    case 'setVersion':
      return {
        ...state,
        version: action.payload
      };

    case 'setLanguage':
      return {
        ...state,
        language: action.payload
      };

    default:
      return state;
  }
}