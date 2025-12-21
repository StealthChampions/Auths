// Permissions reducer for managing permissions
export interface PermissionsState {
  permissions: any[];
}

export type PermissionsAction = 
  | { type: 'setPermissions'; payload: any[] };

const initialState: PermissionsState = {
  permissions: [],
};

export function permissionsReducer(state = initialState, action: PermissionsAction): PermissionsState {
  switch (action.type) {
    case 'setPermissions':
      return {
        ...state,
        permissions: action.payload
      };
    
    default:
      return state;
  }
}