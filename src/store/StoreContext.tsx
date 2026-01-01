/**
 * Store Context | 状态管理 Context
 *
 * Provides global state management using React Context and useReducer.
 * Combines multiple reducers for different state slices.
 *
 * 使用 React Context 和 useReducer 提供全局状态管理。
 * 组合多个 reducer 处理不同的状态切片。
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { accountsReducer, AccountsState, AccountsAction } from './accountsReducer';
import { styleReducer, StyleState, StyleAction } from './styleReducer';
import { menuReducer, MenuState, MenuAction } from './menuReducer';
import { notificationReducer, NotificationState, NotificationAction } from './notificationReducer';
import { backupReducer, BackupState, BackupAction } from './backupReducer';

// Define the shape of our global state | 定义全局状态结构
interface GlobalState {
  accounts: AccountsState;
  style: StyleState;
  menu: MenuState;
  notification: NotificationState;
  backup: BackupState;
}

// Create the context | 创建 Context
const StoreContext = createContext<{
  state: GlobalState;
  dispatch: React.Dispatch<any>;
} | undefined>(undefined);

// Create a provider component
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer((state: GlobalState, action: any) => {
    switch (action.type) {
      case 'accounts':
        return { ...state, accounts: accountsReducer(state.accounts, action.payload) };
      case 'style':
        return { ...state, style: styleReducer(state.style, action.payload) };
      case 'menu':
        return { ...state, menu: menuReducer(state.menu, action.payload) };
      case 'notification':
        return { ...state, notification: notificationReducer(state.notification, action.payload) };

      case 'backup':
        return { ...state, backup: backupReducer(state.backup, action.payload) };



      default:
        return state;
    }
  }, {
    accounts: accountsReducer(undefined, { type: 'init' } as any),
    style: styleReducer(undefined, { type: 'init' } as any),
    menu: menuReducer(undefined, { type: 'init' } as any),
    notification: notificationReducer(undefined, { type: 'init' } as any),

    backup: backupReducer(undefined, { type: 'init' } as any),



  });

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

// Create a custom hook to use the store
export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}

// Hooks for each module
export function useAccounts() {
  const { state, dispatch } = useStore();
  return {
    ...state.accounts,
    dispatch: (action: AccountsAction) => dispatch({ type: 'accounts', payload: action })
  };
}

export function useStyle() {
  const { state, dispatch } = useStore();
  return {
    style: state.style,
    dispatch: (action: StyleAction) => dispatch({ type: 'style', payload: action })
  };
}

export function useMenu() {
  const { state, dispatch } = useStore();
  return {
    menu: state.menu,
    dispatch: (action: MenuAction) => dispatch({ type: 'menu', payload: action })
  };
}

export function useNotification() {
  const { state, dispatch } = useStore();
  return {
    notification: state.notification,
    dispatch: (action: NotificationAction) => dispatch({ type: 'notification', payload: action })
  };
}



export function useBackup() {
  const { state, dispatch } = useStore();
  return {
    backup: state.backup,
    dispatch: (action: BackupAction) => dispatch({ type: 'backup', payload: action })
  };
}




