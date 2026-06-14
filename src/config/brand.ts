import type { NavigateFunction } from 'react-router-dom';

export const BRAND_NAME = 'Arden Project OS';
export const BRAND_SHORT_NAME = 'Arden';
export const SUPPORT_EMAIL = 'support@ardenprojectos.com';

export const MARKETING_URL =
  import.meta.env.VITE_MARKETING_URL ?? 'https://ardenprojectos.com';

export const APP_URL =
  import.meta.env.VITE_APP_URL ?? 'https://app.ardenprojectos.com';

export const AUTH_URL =
  import.meta.env.VITE_AUTH_URL ?? 'https://auth.ardenprojectos.com';

const MARKETING_HOSTS = new Set([
  'ardenprojectos.com',
  'www.ardenprojectos.com',
  'concrete-calc.com',
  'www.concrete-calc.com',
]);

export function normalizeUrlBase(url: string): string {
  return url.trim().replace(/\/$/, '');
}

export function getAppUrl(path = ''): string {
  const base = normalizeUrlBase(APP_URL);
  if (!path) return base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/** Public app URL for shareable links — uses current origin on the app host, configured APP_URL elsewhere. */
export function getPublicAppUrl(path = ''): string {
  const origin =
    typeof window !== 'undefined' && !isMarketingHost()
      ? window.location.origin
      : getAppUrl();
  if (!path) return origin;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}

export function getMarketingUrl(path = ''): string {
  const base = normalizeUrlBase(MARKETING_URL);
  if (!path) return base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function getAppLoginUrl(): string {
  return getAppUrl('/login');
}

export function getAppSignupUrl(): string {
  return getAppUrl('/signup');
}

export function isMarketingHost(hostname?: string): boolean {
  const host =
    hostname ??
    (typeof window !== 'undefined' ? window.location.hostname : '');
  return MARKETING_HOSTS.has(host.toLowerCase());
}

export function goToAppAuth(
  path: '/login' | '/signup',
  navigate?: NavigateFunction,
): void {
  if (typeof window === 'undefined') return;

  if (isMarketingHost()) {
    window.location.assign(getAppUrl(path));
    return;
  }

  navigate?.(path);
}
