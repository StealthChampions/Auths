// Accounts reducer for managing OTP accounts
export interface AccountsState {
  entries: any[];
  filter: string;
  showSearch: boolean;
  shouldShowPassphrase: boolean;
  defaultEncryption?: string;
  encryption: any;
  initComplete: boolean;
}

export type AccountsAction =
  | { type: 'updateCodes' }
  | { type: 'setEntries'; payload: any[] }
  | { type: 'setFilter'; payload: string }
  | { type: 'showSearch' }
  | { type: 'hideSearch' }
  | { type: 'stopFilter' }
  | { type: 'initComplete' }
  | { type: 'setShouldShowPassphrase'; payload: boolean }
  | { type: 'setDefaultEncryption'; payload: string }
  | { type: 'setEncryption'; payload: any }
  | { type: 'showNotification' }
  | { type: 'pinEntry'; payload: string }
  | { type: 'deleteCode'; payload: string }
  | { type: 'addCode'; payload: any }
  | { type: 'updateEntry'; payload: { hash: string; issuer?: string; account?: string; period?: number; digits?: number } };

const initialState: AccountsState = {
  entries: [],
  filter: '',
  showSearch: false,
  shouldShowPassphrase: false,
  initComplete: false,
  encryption: null,
};

export function accountsReducer(state = initialState, action: AccountsAction): AccountsState {
  switch (action.type) {
    case 'updateCodes':
      // Update OTP codes for all entries
      return {
        ...state,
        entries: state.entries.map(entry => ({
          ...entry,
          code: generateOTPCode(entry) // This would be implemented
        }))
      };
    
    case 'setEntries':
      return {
        ...state,
        entries: action.payload
      };
    
    case 'setFilter':
      return {
        ...state,
        filter: action.payload
      };
    
    case 'showSearch':
      return {
        ...state,
        showSearch: true
      };
    
    case 'hideSearch':
      return {
        ...state,
        showSearch: false
      };
    
    case 'stopFilter':
      return {
        ...state,
        filter: ''
      };
    
    case 'initComplete':
      return {
        ...state,
        initComplete: true
      };
    
    case 'setShouldShowPassphrase':
      return {
        ...state,
        shouldShowPassphrase: action.payload
      };
    
    case 'setDefaultEncryption':
      return {
        ...state,
        defaultEncryption: action.payload
      };
    
    case 'setEncryption':
      return {
        ...state,
        encryption: action.payload
      };
    
    case 'showNotification':
      // This would typically be handled by the notification reducer
      return state;
    
    case 'pinEntry':
      const pinnedEntries = state.entries.map(entry =>
        entry.hash === action.payload
          ? { ...entry, pinned: !entry.pinned }
          : entry
      );
      saveEntriesToStorage(pinnedEntries);
      return {
        ...state,
        entries: pinnedEntries
      };

    case 'deleteCode':
      const filteredEntries = state.entries.filter(entry => entry.hash !== action.payload);
      // 保存到 storage
      saveEntriesToStorage(filteredEntries);
      return {
        ...state,
        entries: filteredEntries
      };

    case 'addCode':
      // 生成唯一 hash
      const newEntry = {
        ...action.payload,
        hash: action.payload.hash || generateHash(),
        pinned: false,
        code: '',
      };
      const newEntries = [...state.entries, newEntry];
      // 保存到 storage
      saveEntriesToStorage(newEntries);
      return {
        ...state,
        entries: newEntries
      };

    case 'updateEntry':
      const updatedEntries = state.entries.map(entry =>
        entry.hash === action.payload.hash
          ? {
              ...entry,
              issuer: action.payload.issuer !== undefined ? action.payload.issuer : entry.issuer,
              account: action.payload.account !== undefined ? action.payload.account : entry.account,
              period: action.payload.period !== undefined ? action.payload.period : entry.period,
              digits: action.payload.digits !== undefined ? action.payload.digits : entry.digits,
            }
          : entry
      );
      saveEntriesToStorage(updatedEntries);
      return {
        ...state,
        entries: updatedEntries
      };

    default:
      return state;
  }
}

// 生成唯一 hash
function generateHash(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 保存 entries 到 chrome.storage
function saveEntriesToStorage(entries: any[]) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ entries });
  }
}

// Helper function to generate OTP code (placeholder)
function generateOTPCode(entry: any): string {
  // This would implement the actual OTP generation logic
  return '123456';
}