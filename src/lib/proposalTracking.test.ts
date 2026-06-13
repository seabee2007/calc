import { describe, expect, it, vi, afterEach } from 'vitest';
import { getPublicProposalUrl } from './proposalTracking';

describe('getPublicProposalUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the current origin on the app host', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://app.ardenprojectos.com', hostname: 'app.ardenprojectos.com' },
    });

    expect(getPublicProposalUrl('token-123')).toBe(
      'https://app.ardenprojectos.com/proposal/token-123',
    );
  });

  it('falls back to the configured app URL on the marketing host', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://ardenprojectos.com', hostname: 'ardenprojectos.com' },
    });

    expect(getPublicProposalUrl('token-123')).toBe(
      'https://app.ardenprojectos.com/proposal/token-123',
    );
  });
});
