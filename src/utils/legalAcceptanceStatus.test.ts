import { describe, expect, it } from 'vitest';
import { formatLegalAcceptanceStatus } from './legalAcceptanceStatus';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '../constants/legalVersions';
import type { UserLegalAcceptance } from '../types/legalAcceptance';

const currentAcceptance: UserLegalAcceptance = {
  id: 'acc-1',
  userId: 'user-1',
  termsVersion: CURRENT_TERMS_VERSION,
  privacyVersion: CURRENT_PRIVACY_VERSION,
  termsAcceptedAt: '2026-06-12T10:00:00.000Z',
  privacyAcceptedAt: '2026-06-12T10:00:00.000Z',
  acceptedIp: null,
  acceptedUserAgent: 'vitest',
  createdAt: '2026-06-12T10:00:00.000Z',
};

describe('formatLegalAcceptanceStatus', () => {
  it('returns accepted dates and versions for Settings display', () => {
    const status = formatLegalAcceptanceStatus(currentAcceptance);

    expect(status.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(status.privacyVersion).toBe(CURRENT_PRIVACY_VERSION);
    expect(status.termsAcceptedAt).toBe('2026-06-12T10:00:00.000Z');
    expect(status.privacyAcceptedAt).toBe('2026-06-12T10:00:00.000Z');
    expect(status.hasAcceptedCurrentLegal).toBe(true);
  });

  it('flags outdated acceptance when versions no longer match current', () => {
    const status = formatLegalAcceptanceStatus({
      ...currentAcceptance,
      termsVersion: '2025-01-01',
      privacyVersion: '2025-01-01',
    });

    expect(status.hasAcceptedCurrentTerms).toBe(false);
    expect(status.hasAcceptedCurrentPrivacy).toBe(false);
    expect(status.hasAcceptedCurrentLegal).toBe(false);
    expect(status.termsAcceptedAt).toBe('2026-06-12T10:00:00.000Z');
  });

  it('returns empty acceptance when user has no record', () => {
    const status = formatLegalAcceptanceStatus(null);

    expect(status.termsAcceptedAt).toBeNull();
    expect(status.privacyAcceptedAt).toBeNull();
    expect(status.hasAcceptedCurrentLegal).toBe(false);
  });
});
