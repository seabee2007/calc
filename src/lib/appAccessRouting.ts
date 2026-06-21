import type { Profile, UserRole } from '../types/fieldPlanner';
import { isEmployeeRole, isOwnerRole } from '../types/fieldPlanner';
import type { ResolvedAppAccess } from '../services/appAccessService';

export type AppAccessRole = 'owner' | 'admin' | 'employee' | 'unassigned';

export interface AppAccessInput {
  ownsWorkspace: boolean;
  isWorkspaceAdmin: boolean;
  hasAcceptedEmployeeMembership: boolean;
}

export function isSafeAppPath(path: string | null | undefined): path is string {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
}

export function isEmployeePortalPath(path: string): boolean {
  return path === '/employee' || path.startsWith('/employee/');
}

export function resolveAppAccessRole(access: AppAccessInput): AppAccessRole {
  if (access.ownsWorkspace) return 'owner';
  if (access.isWorkspaceAdmin) return 'admin';
  if (access.hasAcceptedEmployeeMembership) return 'employee';
  return 'unassigned';
}

export function resolveAppHomeRoute(access: AppAccessInput): string {
  const role = resolveAppAccessRole(access);
  if (role === 'owner' || role === 'admin') return '/dashboard';
  if (role === 'employee') return '/employee/dashboard';
  return '/onboarding';
}

export function accessInputFromProfile(
  profile: Pick<Profile, 'role' | 'employerId'> | null | undefined,
): AppAccessInput {
  const role = profile?.role;
  return {
    ownsWorkspace: role === 'owner',
    isWorkspaceAdmin: role === 'admin',
    hasAcceptedEmployeeMembership: Boolean(role && isEmployeeRole(role) && profile?.employerId),
  };
}

export function accessInputFromRole(role: UserRole | string | null | undefined): AppAccessInput {
  return {
    ownsWorkspace: role === 'owner',
    isWorkspaceAdmin: role === 'admin',
    hasAcceptedEmployeeMembership: Boolean(role && isEmployeeRole(role as UserRole)),
  };
}

export function accessInputFromResolvedAccess(access: ResolvedAppAccess): AppAccessInput {
  return {
    ownsWorkspace: access.isOwner,
    isWorkspaceAdmin: access.isWorkspaceAdmin,
    hasAcceptedEmployeeMembership: access.acceptedEmployeeMemberships.length > 0,
  };
}

export function resolveAppHomeRouteFromAccess(access: ResolvedAppAccess): string {
  return access.defaultRoute;
}

export function isAuthorizedForRoute(access: ResolvedAppAccess, path: string): boolean {
  if (!isSafeAppPath(path)) return false;

  if (access.isOwner || access.isWorkspaceAdmin) {
    return !isEmployeePortalPath(path);
  }

  if (access.defaultRoute === '/employee/dashboard') {
    return isEmployeePortalPath(path);
  }

  return false;
}

export function resolvePostLoginRoute(
  access: ResolvedAppAccess,
  returnTo?: string | null,
): string {
  if (isSafeAppPath(returnTo) && isAuthorizedForRoute(access, returnTo)) {
    return returnTo;
  }
  return access.defaultRoute;
}

export function resolveAuthorizedPostLoginRoute(
  access: AppAccessInput,
  requestedPath?: string | null,
): string {
  const homeRoute = resolveAppHomeRoute(access);
  if (!isSafeAppPath(requestedPath)) return homeRoute;

  const role = resolveAppAccessRole(access);
  if (role === 'owner' || role === 'admin') {
    return isEmployeePortalPath(requestedPath) ? homeRoute : requestedPath;
  }
  if (role === 'employee') {
    return isEmployeePortalPath(requestedPath) ? requestedPath : homeRoute;
  }
  return homeRoute;
}

export function resolveSignedOutRoute(_returnTo?: string | null): '/login' {
  return '/login';
}

export function isOwnerAppRole(role: UserRole | undefined): boolean {
  return isOwnerRole(role);
}

export function isAcceptedEmployeePortalRole(
  profile: Pick<Profile, 'role' | 'employerId'> | null | undefined,
): boolean {
  return Boolean(profile?.role && isEmployeeRole(profile.role) && profile.employerId);
}

export function isOwnerAppAccess(access: ResolvedAppAccess | null | undefined): boolean {
  return Boolean(access?.isOwner || access?.isWorkspaceAdmin);
}
