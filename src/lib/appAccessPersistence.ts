import { LOGIN_INTENT_STORAGE_KEY } from './loginIntent';

export const APP_RETURN_TO_KEY = 'arden:app:returnTo';
export const APP_WORKSPACE_ROLE_CACHE_KEY = 'arden:app:workspaceRoleCache';
export const APP_EMPLOYEE_PORTAL_STATE_KEY = 'arden:app:employeePortalState';

export function clearPersistedReturnTo(): void {
  try {
    sessionStorage.removeItem(APP_RETURN_TO_KEY);
  } catch {
    // ignore storage failures
  }
}

export function clearWorkspaceRoleCache(): void {
  try {
    localStorage.removeItem(APP_WORKSPACE_ROLE_CACHE_KEY);
  } catch {
    // ignore storage failures
  }
}

export function clearEmployeePortalState(): void {
  try {
    localStorage.removeItem(APP_EMPLOYEE_PORTAL_STATE_KEY);
  } catch {
    // ignore storage failures
  }
}

export function clearLoginIntent(): void {
  try {
    sessionStorage.removeItem(LOGIN_INTENT_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

/** Clears route/access caches that must not survive logout or account switches. */
export function clearPersistedAppAccessState(): void {
  clearLoginIntent();
  clearPersistedReturnTo();
  clearWorkspaceRoleCache();
  clearEmployeePortalState();
}

export function readPersistedReturnTo(): string | null {
  try {
    const value = sessionStorage.getItem(APP_RETURN_TO_KEY);
    return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
  } catch {
    return null;
  }
}

export function writePersistedReturnTo(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//')) return;
  try {
    sessionStorage.setItem(APP_RETURN_TO_KEY, path);
  } catch {
    // ignore storage failures
  }
}
