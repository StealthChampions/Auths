// QR reducer for managing QR code state
export interface QrState {
  data?: string;
}

export type QrAction = 
  | { type: 'setQrData'; payload: any }
  | { type: 'clearQrData' };

const initialState: QrState = {
  // Initialize QR state
};

export function qrReducer(state = initialState, action: QrAction): QrState {
  switch (action.type) {
    case 'setQrData':
      return {
        ...state,
        ...action.payload
      };
    
    case 'clearQrData':
      return initialState;
    
    default:
      return state;
  }
}