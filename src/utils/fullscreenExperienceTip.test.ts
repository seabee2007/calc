import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FULLSCREEN_EXPERIENCE_TIP_DISMISSED_KEY,
  FULLSCREEN_EXPERIENCE_TIP_SESSION_KEY,
  isFullscreenExperienceTipPathAllowed,
  markFullscreenExperienceTipShownThisSession,
  setFullscreenExperienceTipDismissed,
  shouldShowFullscreenExperienceTip,
  wasFullscreenExperienceTipShownThisSession,
} from './fullscreenExperienceTip';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('fullscreenExperienceTip', () => {
  it('allows authenticated app routes and blocks auth/public pages', () => {
    expect(isFullscreenExperienceTipPathAllowed('/planner/hub')).toBe(true);
    expect(isFullscreenExperienceTipPathAllowed('/projects')).toBe(true);
    expect(isFullscreenExperienceTipPathAllowed('/login')).toBe(false);
    expect(isFullscreenExperienceTipPathAllowed('/signup')).toBe(false);
    expect(isFullscreenExperienceTipPathAllowed('/reset-password')).toBe(false);
    expect(isFullscreenExperienceTipPathAllowed('/proposal/token-1')).toBe(false);
  });

  it('shows for authenticated users on first app load only once per session', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();

    expect(
      shouldShowFullscreenExperienceTip({
        hasUser: true,
        pathname: '/planner/hub',
        localStorage,
        sessionStorage,
      }),
    ).toBe(true);

    markFullscreenExperienceTipShownThisSession(sessionStorage);

    expect(
      shouldShowFullscreenExperienceTip({
        hasUser: true,
        pathname: '/projects',
        localStorage,
        sessionStorage,
      }),
    ).toBe(false);
  });

  it('does not show without a user or after permanent dismissal', () => {
    const localStorage = createMemoryStorage();
    const sessionStorage = createMemoryStorage();

    expect(
      shouldShowFullscreenExperienceTip({
        hasUser: false,
        pathname: '/planner/hub',
        localStorage,
        sessionStorage,
      }),
    ).toBe(false);

    setFullscreenExperienceTipDismissed(localStorage);
    expect(localStorage.getItem(FULLSCREEN_EXPERIENCE_TIP_DISMISSED_KEY)).toBe('true');
    expect(
      shouldShowFullscreenExperienceTip({
        hasUser: true,
        pathname: '/planner/hub',
        localStorage,
        sessionStorage,
      }),
    ).toBe(false);
  });

  it('tracks session shown flag', () => {
    const sessionStorage = createMemoryStorage();
    expect(wasFullscreenExperienceTipShownThisSession(sessionStorage)).toBe(false);
    markFullscreenExperienceTipShownThisSession(sessionStorage);
    expect(sessionStorage.getItem(FULLSCREEN_EXPERIENCE_TIP_SESSION_KEY)).toBe('true');
    expect(wasFullscreenExperienceTipShownThisSession(sessionStorage)).toBe(true);
  });
});

describe('Fullscreen experience tip UI integration', () => {
  const hookSource = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../hooks/useFullscreenExperienceTip.ts'),
    'utf8',
  );

  const modalSource = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../components/onboarding/FullscreenExperienceModal.tsx',
    ),
    'utf8',
  );

  const appSource = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../App.tsx'),
    'utf8',
  );

  it('wires modal host after app routes with delayed authenticated check', () => {
    expect(appSource).toContain('FullscreenExperienceTipHost');
    expect(hookSource).toContain('FULLSCREEN_EXPERIENCE_TIP_DELAY_MS');
    expect(hookSource).toContain('shouldShowFullscreenExperienceTip');
    expect(hookSource).toContain('markFullscreenExperienceTipShownThisSession');
  });

  it('supports Got it and permanent dismissal via checkbox', () => {
    expect(modalSource).toContain('Best Viewing Experience');
    expect(modalSource).toContain('Don&apos;t show again');
    expect(modalSource).toContain('Got it');
    expect(modalSource).toContain('Press F11');
    expect(modalSource).toContain('Control + Command + F');
    expect(hookSource).toContain('setFullscreenExperienceTipDismissed');
    expect(hookSource).toContain('dontShowAgain');
  });
});
