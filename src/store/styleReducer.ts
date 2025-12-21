// Style reducer for managing UI style settings
export interface StyleState {
  info: boolean;
  menuShown: boolean;
  timeout: boolean;
  isEditing: boolean;
  slidein: boolean;
  slideout: boolean;
  fadein: boolean;
  fadeout: boolean;
  show: boolean;
  notificationFadein: boolean;
  notificationFadeout: boolean;
  qrfadein: boolean;
  qrfadeout: boolean;
}

export type StyleAction =
  | { type: 'showInfo' }
  | { type: 'hideInfo' }
  | { type: 'setInfo'; payload: boolean }
  | { type: 'showMenu' }
  | { type: 'hideMenu' }
  | { type: 'setMenuShown'; payload: boolean }
  | { type: 'startEdit' }
  | { type: 'stopEdit' };

const initialState: StyleState = {
  info: false,
  menuShown: false,
  timeout: false,
  isEditing: false,
  slidein: false,
  slideout: false,
  fadein: false,
  fadeout: false,
  show: false,
  notificationFadein: false,
  notificationFadeout: false,
  qrfadein: false,
  qrfadeout: false,
};

export function styleReducer(state = initialState, action: StyleAction): StyleState {
  switch (action.type) {
    case 'showInfo':
      return {
        ...state,
        info: true
      };
    
    case 'hideInfo':
      return {
        ...state,
        info: false
      };
    
    case 'setInfo':
      return {
        ...state,
        info: action.payload
      };
    
    case 'showMenu':
      return {
        ...state,
        menuShown: true
      };
    
    case 'hideMenu':
      return {
        ...state,
        menuShown: false
      };
    
    case 'setMenuShown':
      return {
        ...state,
        menuShown: action.payload
      };

    case 'startEdit':
      return {
        ...state,
        isEditing: true
      };

    case 'stopEdit':
      return {
        ...state,
        isEditing: false
      };

    default:
      return state;
  }
}