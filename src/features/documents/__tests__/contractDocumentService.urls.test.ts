import { describe, expect, it, vi, afterEach } from 'vitest';
import { getPublicContractUrl } from '../services/contractDocumentService';

describe('getPublicContractUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the current origin on the app host', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://app.ardenprojectos.com', hostname: 'app.ardenprojectos.com' },
    });

    expect(getPublicContractUrl('contract-token-123')).toBe(
      'https://app.ardenprojectos.com/contract/contract-token-123',
    );
  });

  it('allows localhost during local development', () => {
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:5173', hostname: 'localhost' },
    });

    expect(getPublicContractUrl('contract-token-123')).toBe(
      'http://localhost:5173/contract/contract-token-123',
    );
  });

  it('falls back to the configured app URL on the marketing host', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://ardenprojectos.com', hostname: 'ardenprojectos.com' },
    });

    expect(getPublicContractUrl('contract-token-123')).toBe(
      'https://app.ardenprojectos.com/contract/contract-token-123',
    );
    expect(getPublicContractUrl('contract-token-123')).not.toContain('localhost');
  });

  it('includes the token in the path', () => {
    vi.stubGlobal('window', {
      location: { origin: 'https://app.ardenprojectos.com', hostname: 'app.ardenprojectos.com' },
    });

    expect(getPublicContractUrl('sign-token-xyz')).toContain('sign-token-xyz');
  });
});
