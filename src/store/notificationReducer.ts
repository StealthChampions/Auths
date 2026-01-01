/**
 * Notification Reducer | 通知 Reducer
 *
 * Manages notification state for toast and dialog messages.
 * 管理 Toast 和对话框消息的通知状态。
 */

export interface NotificationState {
  message: string;
  messageIdle: boolean;
  mode: 'toast' | 'dialog';
  severity: 'success' | 'warning' | 'info' | 'error';
}

export type NotificationAction =
  | { type: 'alert'; payload: string } // Default error/warning
  | { type: 'success'; payload: string }
  | { type: 'error'; payload: string }
  | { type: 'info'; payload: string }
  | { type: 'dialog'; payload: string }
  | { type: 'clear' }
  | { type: 'setMessageIdle'; payload: boolean };

const initialState: NotificationState = {
  message: '',
  messageIdle: true,
  mode: 'toast',
  severity: 'info',
};

export function notificationReducer(state = initialState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'alert':
      return {
        ...state,
        message: action.payload,
        messageIdle: false,
        mode: 'toast',
        severity: 'error'
      };

    case 'success':
      return {
        ...state,
        message: action.payload,
        messageIdle: false,
        mode: 'toast',
        severity: 'success'
      };

    case 'error':
      return {
        ...state,
        message: action.payload,
        messageIdle: false,
        mode: 'toast',
        severity: 'error'
      };

    case 'info':
      return {
        ...state,
        message: action.payload,
        messageIdle: false,
        mode: 'toast',
        severity: 'info'
      };

    case 'dialog':
      return {
        ...state,
        message: action.payload,
        messageIdle: false,
        mode: 'dialog',
        severity: 'info' // Dialogs are generic for now
      };

    case 'clear':
      return {
        ...state,
        message: '',
        messageIdle: true,
        mode: 'toast',
        severity: 'info'
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