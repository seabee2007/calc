import type { AccessResolutionState } from '../services/appAccessService';
import type { RootAccessKind } from './rootRouteResolver';

export function logAppRoutingRedirect(params: {
  from: string;
  to: string;
  reason: string;
  authSessionResolved: boolean;
  accessResolutionState: AccessResolutionState;
}): void {
  if (!import.meta.env.DEV) return;
  console.info('[app-routing]', params);
}

export function logRouteRedirect(params: {
  from: string;
  to: string;
  reason: string;
}): void {
  if (!import.meta.env.DEV) return;
  console.info('[route-redirect]', params);
}

export function logRootRouteDiagnostics(params: {
  pathname: string;
  authLoading: boolean;
  hasSession: boolean;
  userId: string | null;
  accessKind: RootAccessKind;
  accessLoading: boolean;
  accessResolutionState: AccessResolutionState;
}): void {
  if (!import.meta.env.DEV) return;
  console.info('[root-route]', params);
}

export function logResolvedAppAccessDiagnostics(access: {
  userId: string;
  isOwner: boolean;
  isWorkspaceAdmin: boolean;
  acceptedEmployeeMemberships: Array<{
    workspaceId: string;
    employerPlanId: string | null;
    employerFieldPortalEnabled: boolean;
    hasAssignedFieldSeat: boolean;
  }>;
  defaultRoute: string;
}): void {
  if (!import.meta.env.DEV) return;
  console.table({
    userId: access.userId,
    isOwner: access.isOwner,
    isWorkspaceAdmin: access.isWorkspaceAdmin,
    acceptedEmployeeMembershipCount: access.acceptedEmployeeMemberships.length,
    employeeWorkspaceIds: access.acceptedEmployeeMemberships.map((m) => m.workspaceId).join(', ') || '—',
    assignedFieldSeatCount: access.acceptedEmployeeMemberships.filter((m) => m.hasAssignedFieldSeat).length,
    employerPlanIds: access.acceptedEmployeeMemberships.map((m) => m.employerPlanId ?? 'none').join(', ') || '—',
    employerFieldPortalEnabled: access.acceptedEmployeeMemberships.some((m) => m.employerFieldPortalEnabled),
    defaultRoute: access.defaultRoute,
  });
}
