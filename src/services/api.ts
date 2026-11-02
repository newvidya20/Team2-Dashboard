const AUTH_TOKEN_KEY = 'team2_server_session_v1';
const AUTH_EXPIRED_EVENT = 'team2-auth-expired';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getAuthToken(): string | null {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  else sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (
    options.body &&
    !(typeof FormData !== 'undefined' && options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const hasJsonResponse = contentType.includes('application/json');
  const payload: unknown =
    response.status === 204 || !hasJsonResponse ? null : await response.json();
  if (!response.ok) {
    if (
      response.status === 401 &&
      !url.startsWith('/api/auth/login') &&
      !url.startsWith('/api/auth/signup') &&
      token &&
      getAuthToken() === token
    ) {
      setAuthToken(null);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}.`;
    throw new ApiError(message, response.status);
  }
  if (response.status !== 204 && !hasJsonResponse) {
    throw new ApiError('The API endpoint returned a non-JSON response.', 404);
  }
  return payload as T;
}

export async function apiDownload(url: string): Promise<Blob> {
  const headers = new Headers();
  const token = getAuthToken();
  if (!token) {
    throw new ApiError('Your session is missing. Please sign in again.', 401);
  }
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { headers });
  if (!response.ok) {
    if (response.status === 401 && getAuthToken() === token) {
      setAuthToken(null);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const payload: unknown = contentType.includes('application/json') ? await response.json() : null;
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}.`;
    throw new ApiError(message, response.status);
  }
  return response.blob();
}

export function onAuthExpired(handler: () => void): () => void {
  window.addEventListener(AUTH_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
}
