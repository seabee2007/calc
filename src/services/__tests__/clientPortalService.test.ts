import { describe, expect, it, vi, afterEach } from 'vitest';
import { getPublicAppUrl } from '../../config/brand';
import { buildClientPortalUrl, getClientPortalUrl } from '../../services/clientPortalService';

describe('getPublicAppUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the current origin on the app host', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://app.ardenprojectos.com', hostname: 'app.ardenprojectos.com' },
    });

    expect(getPublicAppUrl('/client/project/token-123')).toBe(
      'https://app.ardenprojectos.com/client/project/token-123',
    );
  });

  it('allows localhost during local development', () => {
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:5173', hostname: 'localhost' },
    });

    expect(getPublicAppUrl('/client/project/token-123')).toBe(
      'http://localhost:5173/client/project/token-123',
    );
  });

  it('falls back to the configured app URL on the marketing host', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://ardenprojectos.com', hostname: 'ardenprojectos.com' },
    });

    expect(getPublicAppUrl('/client/project/token-123')).toBe(
      'https://app.ardenprojectos.com/client/project/token-123',
    );
  });
});

describe('buildClientPortalUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a client portal path from the public app URL', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://app.ardenprojectos.com', hostname: 'app.ardenprojectos.com' },
    });

    expect(buildClientPortalUrl('token-123')).toBe(
      'https://app.ardenprojectos.com/client/project/token-123',
    );
  });

  it('allows localhost during local development', () => {
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:5173', hostname: 'localhost' },
    });

    expect(buildClientPortalUrl('token-123')).toBe(
      'http://localhost:5173/client/project/token-123',
    );
  });

  it('does not emit localhost on the marketing host', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://ardenprojectos.com', hostname: 'ardenprojectos.com' },
    });

    expect(buildClientPortalUrl('token-123')).not.toContain('localhost');
    expect(buildClientPortalUrl('token-123')).toBe(
      'https://app.ardenprojectos.com/client/project/token-123',
    );
  });

  it('keeps getClientPortalUrl as a deprecated alias', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://app.ardenprojectos.com', hostname: 'app.ardenprojectos.com' },
    });

    expect(getClientPortalUrl('token-123')).toBe(buildClientPortalUrl('token-123'));
  });
});
