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
  /** Server-side completion marker — sole source of truth for owner onboarding. */
  profileOnboardingCompletedAt?: string | null;
  isTestOnboardingRoute?: boolean;
  /** @deprecated Not used for gating — company_settings may exist from bootstrap. */
  companySettings?: CompanySettingsOnboardingSnapshot;
  /** @deprecated Not used for gating — legal acceptance runs before onboarding. */
  profileAgreementAcceptedAt?: string | null;
  /** @deprecated Prefer profileOnboardingCompletedAt. */
  localOnboardingCompleted?: boolean;
}

/** True when company settings were saved with meaningful owner-entered data. */
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

  if (input.profileOnboardingCompletedAt) {
    return false;
  }

  return true;
}

export function readLocalOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markOnboardingCompletedLocally(): void {
  try {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  } catch {
    // Ignore storage failures — server-side profile flag is the source of truth.
  }
}
