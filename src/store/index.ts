/**
 * Store Index | 状态管理入口
 *
 * Exports all reducers, types, and context hooks.
 * 导出所有 reducer、类型和 context hooks。
 */

// Export all reducers and types | 导出所有 reducers 和类型
export { accountsReducer } from './accountsReducer';
export type { AccountsState, AccountsAction } from './accountsReducer';

export { styleReducer } from './styleReducer';
export type { StyleState, StyleAction } from './styleReducer';

export { menuReducer } from './menuReducer';
export type { MenuState, MenuAction } from './menuReducer';

export { notificationReducer } from './notificationReducer';
export type { NotificationState, NotificationAction } from './notificationReducer';

export { backupReducer } from './backupReducer';
export type { BackupState, BackupAction } from './backupReducer';

// Export the store context and hooks | 导出 store context 和 hooks
export { StoreProvider, useStore, useAccounts, useStyle, useMenu, useNotification, useBackup } from './StoreContext';
