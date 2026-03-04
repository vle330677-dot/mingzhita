// src/utils/appEvents.ts
export type AppToastType = 'info' | 'success' | 'warn';

export interface AppToastPayload {
  msg: string;
  type?: AppToastType;
  duration?: number; // ms，可选
}

export const APP_TOAST_EVENT = 'app:toast';

export function emitAppToast(payload: AppToastPayload) {
  window.dispatchEvent(new CustomEvent(APP_TOAST_EVENT, { detail: payload }));
}
