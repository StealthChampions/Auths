/**
 * Accounts Reducer | 账户 Reducer
 *
 * Manages OTP account entries state including add, delete, pin, and filter operations.
 * 管理 OTP 账户条目状态，包括添加、删除、置顶和过滤操作。
 */

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
  | { type: 'updateEntry'; payload: { hash: string; issuer?: string; account?: string; folder?: string; period?: number; digits?: number } }
  | { type: 'moveEntryUp'; payload: string }
  | { type: 'moveEntryDown'; payload: string }
  | { type: 'reorderEntry'; payload: { fromHash: string; toHash: string } };

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
            folder: action.payload.folder !== undefined ? action.payload.folder : entry.folder,
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

    case 'moveEntryUp': {
      const hash = action.payload;
      const index = state.entries.findIndex(e => e.hash === hash);
      if (index === -1) return state;

      const currentEntry = state.entries[index];
      const newEntries = [...state.entries];

      // Find previous entry with same pinned state
      let swapIndex = -1;
      for (let i = index - 1; i >= 0; i--) {
        if (Boolean(state.entries[i].pinned) === Boolean(currentEntry.pinned)) {
          swapIndex = i;
          break;
        }
      }

      if (swapIndex !== -1) {
        [newEntries[index], newEntries[swapIndex]] = [newEntries[swapIndex], newEntries[index]];
        saveEntriesToStorage(newEntries);
        return { ...state, entries: newEntries };
      }
      return state;
    }

    case 'moveEntryDown': {
      const hash = action.payload;
      const index = state.entries.findIndex(e => e.hash === hash);
      if (index === -1) return state;

      const currentEntry = state.entries[index];
      const newEntries = [...state.entries];

      // Find next entry with same pinned state
      let swapIndex = -1;
      for (let i = index + 1; i < state.entries.length; i++) {
        if (Boolean(state.entries[i].pinned) === Boolean(currentEntry.pinned)) {
          swapIndex = i;
          break;
        }
      }

      if (swapIndex !== -1) {
        [newEntries[index], newEntries[swapIndex]] = [newEntries[swapIndex], newEntries[index]];
        saveEntriesToStorage(newEntries);
        return { ...state, entries: newEntries };
      }
      return state;
    }

    case 'reorderEntry': {
      const { fromHash, toHash } = action.payload;
      if (fromHash === toHash) return state;

      const fromIndex = state.entries.findIndex(e => e.hash === fromHash);
      const toIndex = state.entries.findIndex(e => e.hash === toHash);

      if (fromIndex === -1 || toIndex === -1) return state;

      const fromEntry = state.entries[fromIndex];
      const toEntry = state.entries[toIndex];

      // Prevent dragging between pinned and unpinned groups
      if (Boolean(fromEntry.pinned) !== Boolean(toEntry.pinned)) {
        return state;
      }

      const newEntries = [...state.entries];
      const [movedEntry] = newEntries.splice(fromIndex, 1);
      newEntries.splice(toIndex, 0, movedEntry);

      saveEntriesToStorage(newEntries);
      return { ...state, entries: newEntries };
    }

    default:
      return state;
  }
}

// 生成唯一 hash | Generate unique hash
function generateHash(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// 保存 entries 到 chrome.storage 并更新修改时间戳
function saveEntriesToStorage(entries: any[]) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({
      entries,
      entriesLastModified: Date.now()
    });
  }
}

// Helper function to generate OTP code (placeholder)
function generateOTPCode(entry: any): string {
  // This would implement the actual OTP generation logic
  return '123456';
}