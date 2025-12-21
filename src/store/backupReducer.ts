// Backup reducer for managing backup settings
export interface BackupState {
  dropboxEncrypted: boolean;
  driveEncrypted: boolean;
  oneDriveEncrypted: boolean;
  dropboxToken?: string;
  driveToken?: string;
  oneDriveToken?: string;
}

export type BackupAction = 
  | { type: 'setEnc'; payload: { service: 'dropbox' | 'drive' | 'onedrive'; value: boolean } }
  | { type: 'setDropboxToken'; payload: string }
  | { type: 'setDriveToken'; payload: string }
  | { type: 'setOneDriveToken'; payload: string }
  | { type: 'clearDropboxToken' }
  | { type: 'clearDriveToken' }
  | { type: 'clearOneDriveToken' };

const initialState: BackupState = {
  dropboxEncrypted: false,
  driveEncrypted: false,
  oneDriveEncrypted: false,
};

export function backupReducer(state = initialState, action: BackupAction): BackupState {
  switch (action.type) {
    case 'setEnc':
      switch (action.payload.service) {
        case 'dropbox':
          return { ...state, dropboxEncrypted: action.payload.value };
        case 'drive':
          return { ...state, driveEncrypted: action.payload.value };
        case 'onedrive':
          return { ...state, oneDriveEncrypted: action.payload.value };
        default:
          return state;
      }
    
    case 'setDropboxToken':
      return {
        ...state,
        dropboxToken: action.payload
      };
    
    case 'setDriveToken':
      return {
        ...state,
        driveToken: action.payload
      };
    
    case 'setOneDriveToken':
      return {
        ...state,
        oneDriveToken: action.payload
      };
    
    case 'clearDropboxToken':
      return {
        ...state,
        dropboxToken: undefined
      };
    
    case 'clearDriveToken':
      return {
        ...state,
        driveToken: undefined
      };
    
    case 'clearOneDriveToken':
      return {
        ...state,
        oneDriveToken: undefined
      };
    
    default:
      return state;
  }
}