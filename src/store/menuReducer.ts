/**
 * Menu reducer - Phase 1 MVP
 * 管理菜单设置状态
 */

export interface MenuState {
  version: string;
  zoom: number;
  smartFilter: boolean;
  theme: string;
  autolock: number;
}

export type MenuAction =
  | { type: 'setZoom'; payload: number }
  | { type: 'setSmartFilter'; payload: boolean }
  | { type: 'setTheme'; payload: string }
  | { type: 'setAutolock'; payload: number }
  | { type: 'setVersion'; payload: string };

const initialState: MenuState = {
  version: '1.0.0',
  zoom: 100,
  smartFilter: true,
  theme: 'normal',
  autolock: 0,
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

    default:
      return state;
  }
}
