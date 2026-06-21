import { describe, expect, it } from 'vitest';
import {
  isAuthorizedForRoute,
  resolvePostLoginRoute,
  resolveSignedOutRoute,
} from '../appAccessRouting';
import type { ResolvedAppAccess } from '../../services/appAccessService';

const ownerAccess: ResolvedAppAccess = {
  userId: 'owner-1',
  isOwner: true,
  isWorkspaceAdmin: false,
  isFieldEmployeeAccount: false,
  acceptedEmployeeMemberships: [],
  employeePortalAccess: null,
  defaultRoute: '/dashboard',
};

const employeeAccess: ResolvedAppAccess = {
  userId: 'employee-1',
  isOwner: false,
  isWorkspaceAdmin: false,
  isFieldEmployeeAccount: true,
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
  defaultRoute: '/employee/dashboard',
};

describe('app access routing', () => {
  it('routes owners visiting root to the owner dashboard', () => {
    expect(ownerAccess.defaultRoute).toBe('/dashboard');
  });

  it('does not preserve stale employee returnTo for owners', () => {
    expect(resolvePostLoginRoute(ownerAccess, '/employee/dashboard')).toBe('/dashboard');
  });

  it('redirects employees away from owner app routes after sign-in', () => {
    expect(resolvePostLoginRoute(employeeAccess, '/dashboard')).toBe('/employee/dashboard');
  });

  it('preserves authorized employee returnTo routes', () => {
    expect(resolvePostLoginRoute(employeeAccess, '/employee/tasks')).toBe('/employee/tasks');
  });

  it('rejects signed-out restoration of employee portal routes', () => {
    expect(resolveSignedOutRoute('/employee/dashboard')).toBe('/login');
  });

  it('authorizes owner routes for owners only', () => {
    expect(isAuthorizedForRoute(ownerAccess, '/projects')).toBe(true);
    expect(isAuthorizedForRoute(ownerAccess, '/employee/dashboard')).toBe(false);
    expect(isAuthorizedForRoute(employeeAccess, '/projects')).toBe(false);
    expect(isAuthorizedForRoute(employeeAccess, '/employee/dashboard')).toBe(true);
  });
});
