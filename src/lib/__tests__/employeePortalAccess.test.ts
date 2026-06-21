import { describe, expect, it } from 'vitest';
import {
  employeePortalBlockedMessage,
  employeePortalBlockedTitle,
  resolveEmployeePortalAccess,
} from '../employeePortalAccess';
import type { ResolvedAppAccess } from '../../services/appAccessService';

function baseAccess(
  overrides: Partial<ResolvedAppAccess> = {},
): ResolvedAppAccess {
  return {
    userId: 'employee-1',
    isOwner: false,
    isWorkspaceAdmin: false,
    isFieldEmployeeAccount: true,
    employeeMembershipRemoved: false,
    acceptedEmployeeMemberships: [],
    employeePortalAccess: null,
    defaultRoute: '/employee/dashboard',
    ...overrides,
  };
}

describe('resolveEmployeePortalAccess', () => {
  it('prefers secure RPC employee portal access result', () => {
    const access = baseAccess({
      employeePortalAccess: {
        allowed: true,
        reason: 'allowed',
        workspaceId: 'owner-1',
        employerPlanId: 'starter',
        employeeMembershipId: 'employee-1',
        seatAssigned: true,
        repaired: false,
      },
    });

    expect(resolveEmployeePortalAccess(access, false)).toEqual({
      allowed: true,
      reason: 'allowed',
    });
  });

  it('returns workspace_not_found message for missing workspace', () => {
    const access = baseAccess({
      employeePortalAccess: {
        allowed: false,
        reason: 'workspace_not_found',
        workspaceId: 'missing-owner',
        employerPlanId: null,
        employeeMembershipId: 'employee-1',
        seatAssigned: false,
        repaired: false,
      },
    });

    expect(employeePortalBlockedMessage('workspace_not_found')).toContain(
      'not connected to the company workspace',
    );
    expect(resolveEmployeePortalAccess(access, false).reason).toBe('workspace_not_found');
  });

  it('returns seat-limit message when RPC reports seat_limit_reached', () => {
    expect(employeePortalBlockedMessage('seat_limit_reached')).toBe(
      'Your company has reached its field-seat limit. Contact your account owner.',
    );
  });

  it('returns invite setup incomplete message', () => {
    expect(employeePortalBlockedMessage('invite_acceptance_incomplete')).toContain(
      'not connected to the company workspace',
    );
  });

  it('returns access removed message for membership_removed', () => {
    expect(employeePortalBlockedTitle('membership_removed')).toBe('Access removed');
    expect(employeePortalBlockedMessage('membership_removed')).toContain(
      'Your access to this company workspace has been removed',
    );
    expect(employeePortalBlockedMessage('membership_removed')).not.toMatch(/subscription|billing|upgrade/i);
  });
});

describe('employee onboarding separation', () => {
  it('employee portal access never uses employee personal subscription fields from access object', () => {
    const access = baseAccess({
      employeePortalAccess: {
        allowed: true,
        reason: 'allowed',
        workspaceId: 'owner-1',
        employerPlanId: 'starter',
        employeeMembershipId: 'employee-1',
        seatAssigned: true,
        repaired: false,
      },
      acceptedEmployeeMemberships: [
        {
          workspaceId: 'owner-1',
          membershipId: 'employee-1',
          status: 'accepted',
          role: 'employee',
          hasAssignedFieldSeat: true,
          employerPlanId: 'starter',
          employerFieldPortalEnabled: true,
        },
      ],
    });

    expect(access.employeePortalAccess?.employerPlanId).toBe('starter');
    expect(access.userId).toBe('employee-1');
  });
});
