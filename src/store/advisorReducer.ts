// Advisor reducer for managing advisor state
export interface AdvisorState {
  // Add advisor-specific state properties as needed
}

export type AdvisorAction = 
  | { type: 'setAdvisorData'; payload: any }
  | { type: 'clearAdvisorData' };

const initialState: AdvisorState = {
  // Initialize advisor state
};

export function advisorReducer(state = initialState, action: AdvisorAction): AdvisorState {
  switch (action.type) {
    case 'setAdvisorData':
      return {
        ...state,
        ...action.payload
      };
    
    case 'clearAdvisorData':
      return initialState;
    
    default:
      return state;
  }
}