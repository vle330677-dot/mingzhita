// src/utils/http.ts
export const USER_TOKEN_KEY = 'USER_TOKEN';
export const ADMIN_TOKEN_KEY = 'ADMIN_TOKEN';
export const USER_NAME_KEY = 'USER_NAME';
export const ADMIN_NAME_KEY = 'ADMIN_NAME';
const API_BASE = ((import.meta as any).env?.VITE_API_BASE || '').replace(/\/+$/, '');

type AuthMode = 'user' | 'admin' | 'none';
type JsonLikeBody = Record<string, any> | any[];
type ApiOptions = Omit<RequestInit, 'body' | 'headers'> & {
  auth?: AuthMode;
  rawBody?: boolean;
  headers?: HeadersInit;
  body?: BodyInit | JsonLikeBody | null;
};

export function getUserToken() {
  return localStorage.getItem(USER_TOKEN_KEY) || '';
}
export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}
export function clearUserSession() {
  localStorage.removeItem(USER_TOKEN_KEY);
  localStorage.removeItem(USER_NAME_KEY);
}
export function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_NAME_KEY);
}

export class ApiError extends Error {
  status: number;
  code?: string;
  payload?: any;

  constructor(message: string, status: number, code?: string, payload?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export function toApiUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  if (!API_BASE) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}

function shouldAutoJsonEncode(body: ApiOptions['body'], rawBody: boolean) {
  if (rawBody || body === undefined || body === null) return false;
  if (typeof body !== 'object') return false;
  if (body instanceof FormData) return false;
  if (body instanceof Blob) return false;
  if (body instanceof URLSearchParams) return false;
  if (body instanceof ArrayBuffer) return false;
  if (ArrayBuffer.isView(body)) return false;
  return true;
}

export async function apiFetch<T = any>(url: string, options: ApiOptions = {}): Promise<T> {
  const { auth = 'none', rawBody = false, headers, body, ...rest } = options;

  const h: Record<string, string> = {
    ...(headers as Record<string, string>),
  };

  if (auth === 'user') {
    const token = getUserToken();
    if (token) h.Authorization = `Bearer ${token}`;
  } else if (auth === 'admin') {
    const token = getAdminToken();
    if (token) h.Authorization = `Bearer ${token}`;
  }

  let finalBody = body as BodyInit | null | undefined;
  if (shouldAutoJsonEncode(body, rawBody)) {
    h['Content-Type'] = h['Content-Type'] || 'application/json';
    finalBody = JSON.stringify(body);
  }

  const res = await fetch(toApiUrl(url), {
    ...rest,
    headers: h,
    body: finalBody,
  });

  const ct = res.headers.get('content-type') || '';
  const payload = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text().catch(() => '');

  if (!res.ok) {
    const message = (payload as any)?.message || `HTTP ${res.status}`;
    const code = (payload as any)?.code;

    if (res.status === 401 && (code === 'SESSION_KICKED' || code === 'SESSION_REVOKED')) {
      clearUserSession();
      window.dispatchEvent(
        new CustomEvent('auth:kicked', {
          detail: {
            code,
            message: (payload as any)?.message || '账号已在其他地方登录',
          },
        })
      );
    }

    if (res.status === 401 && auth === 'admin') {
      clearAdminSession();
      window.dispatchEvent(
        new CustomEvent('auth:admin_expired', {
          detail: {
            code: code || 'ADMIN_SESSION_EXPIRED',
            message: (payload as any)?.message || '管理员会话失效，请重新登录',
          },
        })
      );
    }

    throw new ApiError(message, res.status, code, payload);
  }

  return payload as T;
}
