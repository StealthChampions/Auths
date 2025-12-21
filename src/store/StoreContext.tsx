import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { accountsReducer, AccountsState, AccountsAction } from './accountsReducer';
import { styleReducer, StyleState, StyleAction } from './styleReducer';
import { menuReducer, MenuState, MenuAction } from './menuReducer';
import { notificationReducer, NotificationState, NotificationAction } from './notificationReducer';
import { currentViewReducer, CurrentViewState, CurrentViewAction } from './currentViewReducer';
import { backupReducer, BackupState, BackupAction } from './backupReducer';
import { permissionsReducer, PermissionsState, PermissionsAction } from './permissionsReducer';
import { qrReducer, QrState, QrAction } from './qrReducer';
import { advisorReducer, AdvisorState, AdvisorAction } from './advisorReducer';

// Define the shape of our global state
interface GlobalState {
  accounts: AccountsState;
  style: StyleState;
  menu: MenuState;
  notification: NotificationState;
  currentView: CurrentViewState;
  backup: BackupState;
  permissions: PermissionsState;
  qr: QrState;
  advisor: AdvisorState;
}

// Create the context
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
      case 'currentView':
        return { ...state, currentView: currentViewReducer(state.currentView, action.payload) };
      case 'backup':
        return { ...state, backup: backupReducer(state.backup, action.payload) };
      case 'permissions':
        return { ...state, permissions: permissionsReducer(state.permissions, action.payload) };
      case 'qr':
        return { ...state, qr: qrReducer(state.qr, action.payload) };
      case 'advisor':
        return { ...state, advisor: advisorReducer(state.advisor, action.payload) };
      default:
        return state;
    }
  }, {
    accounts: accountsReducer(undefined, { type: 'init' } as any),
    style: styleReducer(undefined, { type: 'init' } as any),
    menu: menuReducer(undefined, { type: 'init' } as any),
    notification: notificationReducer(undefined, { type: 'init' } as any),
    currentView: currentViewReducer(undefined, { type: 'init' } as any),
    backup: backupReducer(undefined, { type: 'init' } as any),
    permissions: permissionsReducer(undefined, { type: 'init' } as any),
    qr: qrReducer(undefined, { type: 'init' } as any),
    advisor: advisorReducer(undefined, { type: 'init' } as any),
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

export function useCurrentView() {
  const { state, dispatch } = useStore();
  return {
    ...state.currentView,
    dispatch: (action: CurrentViewAction) => dispatch({ type: 'currentView', payload: action })
  };
}

export function useBackup() {
  const { state, dispatch } = useStore();
  return {
    backup: state.backup,
    dispatch: (action: BackupAction) => dispatch({ type: 'backup', payload: action })
  };
}

export function usePermissions() {
  const { state, dispatch } = useStore();
  return {
    ...state.permissions,
    dispatch: (action: PermissionsAction) => dispatch({ type: 'permissions', payload: action })
  };
}

export function useQr() {
  const { state, dispatch } = useStore();
  return {
    qr: state.qr,
    dispatch: (action: QrAction) => dispatch({ type: 'qr', payload: action })
  };
}

export function useAdvisor() {
  const { state, dispatch } = useStore();
  return {
    ...state.advisor,
    dispatch: (action: AdvisorAction) => dispatch({ type: 'advisor', payload: action })
  };
}