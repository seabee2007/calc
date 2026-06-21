import type { UserRole } from '../types/fieldPlanner';
import { isEmployeeRole, isOwnerRole } from '../types/fieldPlanner';
import type { ResolvedAppAccess } from '../services/appAccessService';
import { isOwnerAppAccess } from './appAccessRouting';
import { employeeNeedsOnboarding } from './employeeOnboarding';

export type RootAccessKind =
  | 'loading'
  | 'signed_out'
  | 'owner'
  | 'admin'
  | 'employee'
  | 'new_owner';

export type RootRouteDecision =
  | { type: 'loading' }
  | { type: 'redirect'; to: string; reason: string; accessKind: RootAccessKind };

export function resolveRootAccessKind(params: {
  authLoading: boolean;
  hasSession: boolean;
  accessLoading: boolean;
  access: ResolvedAppAccess | null;
}): RootAccessKind {
  if (params.authLoading) {
    return 'loading';
  }

  if (!params.hasSession) {
    return 'signed_out';
  }

  if (params.accessLoading || !params.access) {
    return 'loading';
  }

  if (params.access.isOwner) return 'owner';
  if (params.access.isWorkspaceAdmin) return 'admin';
  if (
    params.access.acceptedEmployeeMemberships.length > 0 ||
    params.access.isFieldEmployeeAccount ||
    params.access.employeeMembershipRemoved
  ) {
    return 'employee';
  }
  return 'new_owner';
}

export function ownerNeedsOnboarding(params: {
  profileRole?: UserRole;
  profileOnboardingCompletedAt?: string | null;
}): boolean {
  return Boolean(
    params.profileRole &&
      isOwnerRole(params.profileRole) &&
      !params.profileOnboardingCompletedAt,
  );
}

export function resolveRootRouteTarget(params: {
  authLoading: boolean;
  hasSession: boolean;
  accessLoading: boolean;
  access: ResolvedAppAccess | null;
  profileRole?: UserRole;
  profileEmployerId?: string | null;
  profileOnboardingCompletedAt?: string | null;
}): RootRouteDecision {
  const accessKind = resolveRootAccessKind(params);

  if (params.authLoading || params.accessLoading) {
    return { type: 'loading' };
  }

  if (!params.hasSession) {
    return {
      type: 'redirect',
      to: '/login',
      reason: 'root-signed-out',
      accessKind: 'signed_out',
    };
  }

  if (!params.access) {
    return { type: 'loading' };
  }

  if (isOwnerAppAccess(params.access)) {
    const needsOnboarding = ownerNeedsOnboarding({
      profileRole: params.profileRole,
      profileOnboardingCompletedAt: params.profileOnboardingCompletedAt,
    });

    return {
      type: 'redirect',
      to: needsOnboarding ? '/onboarding' : '/dashboard',
      reason: needsOnboarding ? 'root-owner-onboarding' : 'root-owner-dashboard',
      accessKind: params.access.isOwner ? 'owner' : 'admin',
    };
  }

  if (
    params.access.acceptedEmployeeMemberships.length > 0 ||
    params.access.isFieldEmployeeAccount ||
    params.access.employeeMembershipRemoved
  ) {
    const needsEmployeeOnboarding =
      params.profileRole &&
      isEmployeeRole(params.profileRole) &&
      employeeNeedsOnboarding({
        role: params.profileRole,
        employerId: params.profileEmployerId ?? null,
        onboardingCompletedAt: params.profileOnboardingCompletedAt ?? null,
      });

    return {
      type: 'redirect',
      to: needsEmployeeOnboarding ? '/employee/onboarding' : '/employee/dashboard',
      reason: needsEmployeeOnboarding ? 'root-employee-onboarding' : 'root-employee-dashboard',
      accessKind: 'employee',
    };
  }

  return {
    type: 'redirect',
    to: '/onboarding',
    reason: 'root-new-owner-onboarding',
    accessKind: 'new_owner',
  };
}

/** Signed-out visitors must never land on protected workspace routes. */
export function isProtectedWorkspacePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return (
    normalized === '/onboarding' ||
    normalized === '/dashboard' ||
    normalized.startsWith('/employee')
  );
}

export function resolveSignedOutProtectedRouteRedirect(pathname: string): string | null {
  if (!isProtectedWorkspacePath(pathname)) return null;
  return '/login';
}
