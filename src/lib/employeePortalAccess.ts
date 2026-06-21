import type { ResolvedAppAccess } from '../services/appAccessService';

export type EmployeePortalAccessReason =
  | 'allowed'
  | 'no_accepted_membership'
  | 'no_workspace'
  | 'field_portal_not_in_employer_plan'
  | 'no_assigned_field_seat'
  | 'employer_subscription_not_found'
  | 'access_resolution_failed'
  | 'owner_or_admin';

export function employeePortalBlockedMessage(reason: EmployeePortalAccessReason): string {
  switch (reason) {
    case 'field_portal_not_in_employer_plan':
      return 'This feature is not included in your company’s plan. Contact your account owner.';
    case 'no_assigned_field_seat':
      return 'Your company has reached its field-seat limit. Contact your account owner.';
    case 'employer_subscription_not_found':
      return 'Your company subscription could not be verified. Contact your account owner.';
    case 'no_accepted_membership':
    case 'no_workspace':
      return 'Your company membership could not be verified. Contact your account owner.';
    case 'access_resolution_failed':
      return 'Field portal access could not be verified. Contact your account owner.';
    default:
      return 'Field portal unavailable. Contact your account owner.';
  }
}

export function resolveEmployeePortalAccess(
  access: ResolvedAppAccess | null,
  resolutionFailed: boolean,
): { allowed: boolean; reason: EmployeePortalAccessReason } {
  if (resolutionFailed || !access) {
    return { allowed: false, reason: 'access_resolution_failed' };
  }
  if (access.isOwner || access.isWorkspaceAdmin) {
    return { allowed: false, reason: 'owner_or_admin' };
  }

  const membership = access.acceptedEmployeeMemberships[0];
  if (!membership) {
    return { allowed: false, reason: 'no_accepted_membership' };
  }
  if (!membership.workspaceId) {
    return { allowed: false, reason: 'no_workspace' };
  }
  if (!membership.employerPlanId) {
    return { allowed: false, reason: 'employer_subscription_not_found' };
  }
  if (!membership.employerFieldPortalEnabled) {
    return { allowed: false, reason: 'field_portal_not_in_employer_plan' };
  }
  if (!membership.hasAssignedFieldSeat) {
    return { allowed: false, reason: 'no_assigned_field_seat' };
  }
  return { allowed: true, reason: 'allowed' };
}
