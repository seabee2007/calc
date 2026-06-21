import type { Profile, UserRole } from '../types/fieldPlanner';
import { isEmployeeRole } from '../types/fieldPlanner';

export function employeeNeedsOnboarding(
  profileOrFields:
    | Profile
    | null
    | undefined
    | {
        role?: UserRole;
        employerId?: string | null;
        onboardingCompletedAt?: string | null;
      },
): boolean {
  if (!profileOrFields) return false;

  const role =
    'role' in profileOrFields && profileOrFields.role !== undefined
      ? profileOrFields.role
      : (profileOrFields as Profile).role;
  const employerId =
    'employerId' in profileOrFields && profileOrFields.employerId !== undefined
      ? profileOrFields.employerId
      : (profileOrFields as Profile).employerId;
  const onboardingCompletedAt =
    'onboardingCompletedAt' in profileOrFields &&
    profileOrFields.onboardingCompletedAt !== undefined
      ? profileOrFields.onboardingCompletedAt
      : (profileOrFields as Profile).onboardingCompletedAt;

  return Boolean(
    role &&
      isEmployeeRole(role) &&
      employerId &&
      !onboardingCompletedAt,
  );
}

export type EmployeePortalState =
  | 'loading'
  | 'needs_employee_onboarding'
  | 'allowed'
  | 'denied';

export function resolveEmployeePortalState(params: {
  authLoading: boolean;
  profileLoading: boolean;
  accessLoading: boolean;
  portalAllowed: boolean;
  profile: Profile | null | undefined;
}): EmployeePortalState {
  if (params.authLoading || params.profileLoading || params.accessLoading) {
    return 'loading';
  }
  if (!params.portalAllowed) {
    return 'denied';
  }
  if (employeeNeedsOnboarding(params.profile)) {
    return 'needs_employee_onboarding';
  }
  return 'allowed';
}
