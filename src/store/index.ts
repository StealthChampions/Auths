// Export all reducers and types
export { accountsReducer } from './accountsReducer';
export type { AccountsState, AccountsAction } from './accountsReducer';

export { styleReducer } from './styleReducer';
export type { StyleState, StyleAction } from './styleReducer';

export { menuReducer } from './menuReducer';
export type { MenuState, MenuAction } from './menuReducer';

export { notificationReducer } from './notificationReducer';
export type { NotificationState, NotificationAction } from './notificationReducer';

export { currentViewReducer } from './currentViewReducer';
export type { CurrentViewState, CurrentViewAction } from './currentViewReducer';

export { backupReducer } from './backupReducer';
export type { BackupState, BackupAction } from './backupReducer';

export { permissionsReducer } from './permissionsReducer';
export type { PermissionsState, PermissionsAction } from './permissionsReducer';

export { qrReducer } from './qrReducer';
export type { QrState, QrAction } from './qrReducer';

export { advisorReducer } from './advisorReducer';
export type { AdvisorState, AdvisorAction } from './advisorReducer';

// Export the store context and hooks
export { StoreProvider, useStore, useAccounts, useStyle, useMenu, useNotification, useCurrentView, useBackup, usePermissions, useQr, useAdvisor } from './StoreContext';