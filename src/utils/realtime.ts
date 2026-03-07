import { getUserToken, toApiUrl } from './http';

export interface AppRealtimeDetail {
  channel?: string;
  event: string;
  payload?: Record<string, any> | null;
  timestamp?: string;
}

export const APP_REALTIME_EVENT = 'app:realtime';

export function buildRealtimeStreamUrl(userId: number) {
  const token = getUserToken();
  const query = new URLSearchParams({
    userId: String(Math.max(0, Number(userId || 0))),
    token,
  });
  return toApiUrl(`/api/realtime/stream?${query.toString()}`);
}

export function dispatchRealtimeEvent(detail: AppRealtimeDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_REALTIME_EVENT, { detail }));
}
