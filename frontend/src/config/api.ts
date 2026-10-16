/**
 * API Configuration for ClearClick AI.
 * Handles dynamic API base URL resolution across:
 * 1. User-configured custom server (stored in localStorage)
 * 2. Vite environment variable (import.meta.env.VITE_API_BASE_URL)
 * 3. Default relative origin (same-origin FastAPI host or Vite dev proxy)
 */

const STORAGE_KEY = 'clearclick_api_url';

export function getCustomApiUrl(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setCustomApiUrl(url: string | null): void {
  if (typeof window === 'undefined') return;
  if (url && url.trim()) {
    localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/+$/, ''));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getApiBaseUrl(): string {
  // 1. Check user override in localStorage
  const custom = getCustomApiUrl();
  if (custom) return custom;

  // 2. Check build-time environment variable
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 3. Fallback to same-origin relative path
  return '';
}

export function buildApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return base ? `${base}${cleanEndpoint}` : cleanEndpoint;
}
