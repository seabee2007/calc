import { describe, expect, it, vi, afterEach } from 'vitest';
import { getPublicChangeOrderUrl } from '../changeOrderTracking';

describe('getPublicChangeOrderUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the current origin on the app host', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://app.ardenprojectos.com', hostname: 'app.ardenprojectos.com' },
    });

    expect(getPublicChangeOrderUrl('co-token-123')).toBe(
      'https://app.ardenprojectos.com/change-order/co-token-123',
    );
  });

  it('allows localhost during local development', () => {
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:5173', hostname: 'localhost' },
    });

    expect(getPublicChangeOrderUrl('co-token-123')).toBe(
      'http://localhost:5173/change-order/co-token-123',
    );
  });

  it('falls back to the configured app URL on the marketing host', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://ardenprojectos.com', hostname: 'ardenprojectos.com' },
    });

    expect(getPublicChangeOrderUrl('co-token-123')).toBe(
      'https://app.ardenprojectos.com/change-order/co-token-123',
    );
    expect(getPublicChangeOrderUrl('co-token-123')).not.toContain('https://ardenprojectos.com/change-order');
  });

  it('includes the token in the path', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://app.ardenprojectos.com', hostname: 'app.ardenprojectos.com' },
    });

    expect(getPublicChangeOrderUrl('abc-public-token')).toContain('abc-public-token');
  });
});
