// CurrentView reducer for managing current view state
export interface CurrentViewState {
  info: boolean;
  currentView: string;
}

export type CurrentViewAction = 
  | { type: 'changeView'; payload: string }
  | { type: 'setInfo'; payload: boolean };

const initialState: CurrentViewState = {
  info: false,
  currentView: 'LoadingPage',
};

export function currentViewReducer(state = initialState, action: CurrentViewAction): CurrentViewState {
  switch (action.type) {
    case 'changeView':
      return {
        ...state,
        currentView: action.payload
      };
    
    case 'setInfo':
      return {
        ...state,
        info: action.payload
      };
    
    default:
      return state;
  }
}