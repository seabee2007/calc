import type { ResolvedAppAccess } from '../services/appAccessService';
import type { EmployeePortalAccessReason } from '../services/employeePortalAccessService';

export type { EmployeePortalAccessReason };

export function employeePortalBlockedMessage(reason: EmployeePortalAccessReason): string {
  switch (reason) {
    case 'field_portal_not_in_employer_plan':
      return 'This feature is not included in your company’s plan. Contact your account owner.';
    case 'seat_limit_reached':
    case 'seat_not_assigned':
      return 'Your company has reached its field-seat limit. Contact your account owner.';
    case 'employer_subscription_not_found':
      return 'Your company subscription could not be verified. Contact your account owner.';
    case 'invite_acceptance_incomplete':
      return 'Your employee account was created, but it was not connected to the company workspace. Ask the account owner to resend or repair the invitation.';
    case 'workspace_not_found':
      return 'Your employee account was created, but it was not connected to the company workspace. Ask the account owner to resend or repair the invitation.';
    case 'no_accepted_membership':
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

  if (access.employeePortalAccess) {
    return {
      allowed: access.employeePortalAccess.allowed,
      reason: access.employeePortalAccess.reason,
    };
  }

  const membership = access.acceptedEmployeeMemberships[0];
  if (!membership) {
    return { allowed: false, reason: 'no_accepted_membership' };
  }
  if (!membership.workspaceId) {
    return { allowed: false, reason: 'workspace_not_found' };
  }
  if (!membership.employerPlanId) {
    return { allowed: false, reason: 'employer_subscription_not_found' };
  }
  if (!membership.employerFieldPortalEnabled) {
    return { allowed: false, reason: 'field_portal_not_in_employer_plan' };
  }
  if (!membership.hasAssignedFieldSeat) {
    return { allowed: false, reason: 'seat_limit_reached' };
  }
  return { allowed: true, reason: 'allowed' };
}
