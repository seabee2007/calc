export type LoginIntent = 'field' | 'admin';

export const LOGIN_INTENT_STORAGE_KEY = 'arden_login_intent';

export function setLoginIntent(intent: LoginIntent): void {
  try {
    sessionStorage.setItem(LOGIN_INTENT_STORAGE_KEY, intent);
  } catch {
    // ignore storage failures
  }
}

export function consumeLoginIntent(): LoginIntent | null {
  try {
    const value = sessionStorage.getItem(LOGIN_INTENT_STORAGE_KEY);
    sessionStorage.removeItem(LOGIN_INTENT_STORAGE_KEY);
    if (value === 'field' || value === 'admin') return value;
    return null;
  } catch {
    return null;
  }
}
