/**
 * Menu Reducer | 菜单 Reducer
 *
 * Manages menu and settings state including theme, zoom, language, etc.
 * 管理菜单和设置状态，包括主题、缩放、语言等。
 */

export interface MenuState {
  version: string;
  zoom: number;
  smartFilter: boolean;
  theme: string;
  autolock: number;
  language: string;
}

export type MenuAction =
  | { type: 'setZoom'; payload: number }
  | { type: 'setSmartFilter'; payload: boolean }
  | { type: 'setTheme'; payload: string }
  | { type: 'setAutolock'; payload: number }
  | { type: 'setVersion'; payload: string }
  | { type: 'setLanguage'; payload: string };

const initialState: MenuState = {
  version: '1.0.0',
  zoom: 100,
  smartFilter: true,
  theme: 'normal',
  autolock: 0,
  language: 'system',
};

export function menuReducer(state = initialState, action: MenuAction): MenuState {
  switch (action.type) {
    case 'setZoom':
      return {
        ...state,
        zoom: action.payload
      };

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

    case 'setAutolock':
      return {
        ...state,
        autolock: action.payload
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
