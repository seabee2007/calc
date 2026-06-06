export const FULLSCREEN_EXPERIENCE_TIP_DISMISSED_KEY = 'concreteCalcFullscreenTipDismissed';

export const FULLSCREEN_EXPERIENCE_TIP_SESSION_KEY = 'concreteCalcFullscreenTipShownThisSession';

export const FULLSCREEN_EXPERIENCE_TIP_DELAY_MS = 500;

const BLOCKED_EXACT_PATHS = new Set(['/login', '/signup', '/reset-password', '/test-onboarding']);

const BLOCKED_PATH_PREFIXES = [
  '/proposal/',
  '/change-order/',
  '/contract/',
  '/client/project/',
] as const;

export function isFullscreenExperienceTipPathAllowed(pathname: string): boolean {
  if (BLOCKED_EXACT_PATHS.has(pathname)) return false;
  return !BLOCKED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isFullscreenExperienceTipDismissed(storage: Storage | null = getLocalStorage()): boolean {
  if (!storage) return false;
  return storage.getItem(FULLSCREEN_EXPERIENCE_TIP_DISMISSED_KEY) === 'true';
}

export function setFullscreenExperienceTipDismissed(storage: Storage | null = getLocalStorage()): void {
  if (!storage) return;
  storage.setItem(FULLSCREEN_EXPERIENCE_TIP_DISMISSED_KEY, 'true');
}

export function wasFullscreenExperienceTipShownThisSession(
  storage: Storage | null = getSessionStorage(),
): boolean {
  if (!storage) return false;
  return storage.getItem(FULLSCREEN_EXPERIENCE_TIP_SESSION_KEY) === 'true';
}

export function markFullscreenExperienceTipShownThisSession(
  storage: Storage | null = getSessionStorage(),
): void {
  if (!storage) return;
  storage.setItem(FULLSCREEN_EXPERIENCE_TIP_SESSION_KEY, 'true');
}

export function shouldShowFullscreenExperienceTip(options: {
  hasUser: boolean;
  pathname: string;
  localStorage?: Storage | null;
  sessionStorage?: Storage | null;
}): boolean {
  if (!options.hasUser) return false;
  if (!isFullscreenExperienceTipPathAllowed(options.pathname)) return false;
  if (isFullscreenExperienceTipDismissed(options.localStorage ?? getLocalStorage())) return false;
  if (wasFullscreenExperienceTipShownThisSession(options.sessionStorage ?? getSessionStorage())) {
    return false;
  }
  return true;
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}
