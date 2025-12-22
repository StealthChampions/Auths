/**
 * Backup reducer - Phase 1 MVP
 * 仅保留 WebDAV 备份状态管理
 */

export interface BackupState {
  webdavConfigured: boolean;
  lastBackupTime?: number;
}

export type BackupAction =
  | { type: 'setWebdavConfigured'; payload: boolean }
  | { type: 'setLastBackupTime'; payload: number };

const initialState: BackupState = {
  webdavConfigured: false,
};

export function backupReducer(state = initialState, action: BackupAction): BackupState {
  switch (action.type) {
    case 'setWebdavConfigured':
      return { ...state, webdavConfigured: action.payload };

    case 'setLastBackupTime':
      return { ...state, lastBackupTime: action.payload };

    default:
      return state;
  }
}
