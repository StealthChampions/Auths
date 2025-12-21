// Menu reducer for managing menu settings
export interface MenuState {
  version: string;
  zoom: number;
  useAutofill: boolean;
  smartFilter: boolean;
  enableContextMenu: boolean;
  theme: string;
  autolock: number;
}

export type MenuAction = 
  | { type: 'setZoom'; payload: number }
  | { type: 'setAutofill'; payload: boolean }
  | { type: 'setSmartFilter'; payload: boolean }
  | { type: 'setEnableContextMenu'; payload: boolean }
  | { type: 'setTheme'; payload: string }
  | { type: 'setAutolock'; payload: number }
  | { type: 'setVersion'; payload: string };

const initialState: MenuState = {
  version: '1.0.0',
  zoom: 100,
  useAutofill: false,
  smartFilter: true,
  enableContextMenu: true,
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
    
    case 'setAutofill':
      return {
        ...state,
        useAutofill: action.payload
      };
    
    case 'setSmartFilter':
      return {
        ...state,
        smartFilter: action.payload
      };
    
    case 'setEnableContextMenu':
      return {
        ...state,
        enableContextMenu: action.payload
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