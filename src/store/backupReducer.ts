/**
 * Backup Reducer | 备份 Reducer
 *
 * Manages WebDAV backup state.
 * 管理 WebDAV 备份状态。
 */

export interface BackupState {
  webdavConfigured: boolean;
  lastBackupTime?: number;
}

export type BackupAction =
  | { type: 'init' }
  | { type: 'setWebdavConfigured'; payload: boolean }
  | { type: 'setLastBackupTime'; payload: number };

const initialState: BackupState = {
  webdavConfigured: false,
};

export function backupReducer(state = initialState, action: BackupAction): BackupState {
  switch (action.type) {
    case 'init':
      return state;

    case 'setWebdavConfigured':
      return { ...state, webdavConfigured: action.payload };

    case 'setLastBackupTime':
      return { ...state, lastBackupTime: action.payload };

    default:
      return state;
  }
}
