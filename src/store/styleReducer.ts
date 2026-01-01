/**
 * Style Reducer | 样式 Reducer
 *
 * Manages UI style state like edit mode.
 * 管理 UI 样式状态，如编辑模式。
 */

export interface StyleState {
  isEditing: boolean;
}

export type StyleAction =
  | { type: 'startEdit' }
  | { type: 'stopEdit' };

const initialState: StyleState = {
  isEditing: false,
};

export function styleReducer(state = initialState, action: StyleAction): StyleState {
  switch (action.type) {
    case 'startEdit':
      return {
        ...state,
        isEditing: true
      };

    case 'stopEdit':
      return {
        ...state,
        isEditing: false
      };

    default:
      return state;
  }
}