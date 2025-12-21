// Notification reducer for managing notifications
export interface NotificationState {
  message: string;
  messageIdle: boolean;
}

export type NotificationAction = 
  | { type: 'alert'; payload: string }
  | { type: 'clear' }
  | { type: 'setMessageIdle'; payload: boolean };

const initialState: NotificationState = {
  message: '',
  messageIdle: true,
};

export function notificationReducer(state = initialState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'alert':
      return {
        ...state,
        message: action.payload,
        messageIdle: false
      };
    
    case 'clear':
      return {
        ...state,
        message: '',
        messageIdle: true
      };
    
    case 'setMessageIdle':
      return {
        ...state,
        messageIdle: action.payload
      };
    
    default:
      return state;
  }
}