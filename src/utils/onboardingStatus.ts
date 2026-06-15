import { isOwnerRole, type UserRole } from '../types/fieldPlanner';

export const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

export interface CompanySettingsOnboardingSnapshot {
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface OnboardingStatusInput {
  profileRole?: UserRole;
  companySettings?: CompanySettingsOnboardingSnapshot;
  localOnboardingCompleted?: boolean;
  hasExistingProjects?: boolean;
  isTestOnboardingRoute?: boolean;
  /** DB-backed: profile.agreementAcceptedAt — truthy means user already accepted terms. */
  profileAgreementAcceptedAt?: string | null;
}

/** True when company settings were saved (onboarding completed or settings edited later). */
export function hasEstablishedCompanySettings(
  settings: CompanySettingsOnboardingSnapshot | undefined,
): boolean {
  if (!settings) return false;
  if (settings.companyName?.trim()) return true;

  const email = settings.email?.trim();
  const phone = settings.phone?.trim();
  const address = settings.address?.trim();
  return Boolean(email && (phone || address));
}

/**
 * Whether the owner company onboarding wizard should block the app.
 * Employees and other non-owner roles never see this flow.
 */
export function shouldShowOwnerOnboarding(input: OnboardingStatusInput): boolean {
  if (input.isTestOnboardingRoute) return true;

  if (!input.profileRole || !isOwnerRole(input.profileRole)) {
    return false;
  }

  if (input.localOnboardingCompleted) {
    return false;
  }

  // DB-backed check: if the user has already accepted the agreement, they are
  // an established user and should not see onboarding again after a cache clear.
  if (input.profileAgreementAcceptedAt) {
    return false;
  }

  if (hasEstablishedCompanySettings(input.companySettings)) {
    return false;
  }

  if (input.hasExistingProjects) {
    return false;
  }

  return true;
}

export function readLocalOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
  } catch {
    return true;
  }
}

export function markOnboardingCompletedLocally(): void {
  try {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  } catch {
    // Ignore storage failures — server-side settings remain the source of truth.
  }
}
