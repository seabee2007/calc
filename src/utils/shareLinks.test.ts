import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  copyToClipboard,
  getAppShareOrigin,
  getSafeShareUrl,
  shareOrCopy,
} from './shareLinks';

describe('shareLinks', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_SHARE_ORIGIN', 'https://app.ardenprojectos.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('getAppShareOrigin uses env with fallback', () => {
    expect(getAppShareOrigin()).toBe('https://app.ardenprojectos.com');
  });

  it('getSafeShareUrl does not share localhost', () => {
    expect(getSafeShareUrl('/projects')).toBe('https://app.ardenprojectos.com/projects');
    expect(getSafeShareUrl('/')).toBe('https://app.ardenprojectos.com');
  });

  it('getSafeShareUrl replaces unsafe auth paths with app root', () => {
    expect(getSafeShareUrl('/login')).toBe('https://app.ardenprojectos.com');
    expect(getSafeShareUrl('/signup')).toBe('https://app.ardenprojectos.com');
    expect(getSafeShareUrl('/reset-password')).toBe('https://app.ardenprojectos.com');
    expect(getSafeShareUrl('/auth/callback')).toBe('https://app.ardenprojectos.com');
  });

  it('shareOrCopy falls back to clipboard when navigator.share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });

    const result = await shareOrCopy({
      title: 'Arden Project OS',
      text: 'Try Arden Project OS',
      url: 'https://app.ardenprojectos.com',
    });

    expect(result).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://app.ardenprojectos.com');
  });

  it('shareOrCopy returns cancelled when user aborts native share', async () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn().mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'AbortError' })),
    });

    const result = await shareOrCopy({ url: 'https://app.ardenprojectos.com' });
    expect(result).toBe('cancelled');
  });

  it('copyToClipboard uses navigator.clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await expect(copyToClipboard('https://app.ardenprojectos.com')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://app.ardenprojectos.com');
  });
});
