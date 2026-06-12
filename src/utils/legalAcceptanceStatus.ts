import type { UserLegalAcceptance } from '../types/legalAcceptance';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '../constants/legalVersions';

export interface LegalAcceptanceStatusDisplay {
  termsVersion: string;
  privacyVersion: string;
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  hasAcceptedCurrentTerms: boolean;
  hasAcceptedCurrentPrivacy: boolean;
  hasAcceptedCurrentLegal: boolean;
}

/**
 * Maps a stored acceptance row into Settings-friendly display fields.
 * Pass `latestAcceptance` from useLegalAcceptance() or getLatestLegalAcceptance().
 */
export function formatLegalAcceptanceStatus(
  latestAcceptance: UserLegalAcceptance | null,
): LegalAcceptanceStatusDisplay {
  const termsVersion = latestAcceptance?.termsVersion ?? CURRENT_TERMS_VERSION;
  const privacyVersion = latestAcceptance?.privacyVersion ?? CURRENT_PRIVACY_VERSION;

  const hasAcceptedCurrentTerms =
    latestAcceptance?.termsVersion === CURRENT_TERMS_VERSION;
  const hasAcceptedCurrentPrivacy =
    latestAcceptance?.privacyVersion === CURRENT_PRIVACY_VERSION;

  return {
    termsVersion,
    privacyVersion,
    termsAcceptedAt: latestAcceptance?.termsAcceptedAt ?? null,
    privacyAcceptedAt: latestAcceptance?.privacyAcceptedAt ?? null,
    hasAcceptedCurrentTerms,
    hasAcceptedCurrentPrivacy,
    hasAcceptedCurrentLegal: hasAcceptedCurrentTerms && hasAcceptedCurrentPrivacy,
  };
}
