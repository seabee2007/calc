import type { Profile, UserRole } from '../types/fieldPlanner';
import { isEmployeeRole } from '../types/fieldPlanner';

export function employeeProfileNamesIncomplete(
  profileOrFields:
    | Profile
    | null
    | undefined
    | {
        firstName?: string | null;
        lastName?: string | null;
      },
): boolean {
  if (!profileOrFields) return true;

  const firstName =
    'firstName' in profileOrFields && profileOrFields.firstName !== undefined
      ? profileOrFields.firstName
      : (profileOrFields as Profile).firstName;
  const lastName =
    'lastName' in profileOrFields && profileOrFields.lastName !== undefined
      ? profileOrFields.lastName
      : (profileOrFields as Profile).lastName;

  return !firstName?.trim() || !lastName?.trim();
}

export function employeeNeedsOnboarding(
  profileOrFields:
    | Profile
    | null
    | undefined
    | {
        role?: UserRole;
        employerId?: string | null;
        firstName?: string | null;
        lastName?: string | null;
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

  return Boolean(
    role &&
      isEmployeeRole(role) &&
      employerId &&
      employeeProfileNamesIncomplete(profileOrFields),
  );
}

export function shouldAutoCompleteEmployeeOnboarding(
  profile: Profile | null | undefined,
): boolean {
  if (!profile) return false;
  return Boolean(
    isEmployeeRole(profile.role) &&
      profile.employerId &&
      !employeeProfileNamesIncomplete(profile) &&
      !profile.onboardingCompletedAt,
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
