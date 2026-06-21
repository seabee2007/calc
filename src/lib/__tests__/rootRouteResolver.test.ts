import { describe, expect, it } from 'vitest';
import {
  ownerNeedsOnboarding,
  resolveRootRouteTarget,
  resolveSignedOutProtectedRouteRedirect,
} from '../rootRouteResolver';
import type { ResolvedAppAccess } from '../../services/appAccessService';

function baseAccess(overrides: Partial<ResolvedAppAccess> = {}): ResolvedAppAccess {
  return {
    userId: 'user-1',
    isOwner: false,
    isWorkspaceAdmin: false,
    acceptedEmployeeMemberships: [],
    defaultRoute: '/onboarding',
    ...overrides,
  };
}

describe('rootRouteResolver', () => {
  it('signed-out visitor at / redirects to /login', () => {
    expect(
      resolveRootRouteTarget({
        authLoading: false,
        hasSession: false,
        accessLoading: false,
        access: null,
      }),
    ).toEqual({
      type: 'redirect',
      to: '/login',
      reason: 'root-signed-out',
      accessKind: 'signed_out',
    });
  });

  it('signed-out visitor never resolves to onboarding', () => {
    const decision = resolveRootRouteTarget({
      authLoading: false,
      hasSession: false,
      accessLoading: false,
      access: null,
    });
    expect(decision.type === 'redirect' ? decision.to : null).not.toBe('/onboarding');
  });

  it('signed-out protected routes redirect to /login', () => {
    expect(resolveSignedOutProtectedRouteRedirect('/onboarding')).toBe('/login');
    expect(resolveSignedOutProtectedRouteRedirect('/employee/dashboard')).toBe('/login');
    expect(resolveSignedOutProtectedRouteRedirect('/dashboard')).toBe('/login');
    expect(resolveSignedOutProtectedRouteRedirect('/login')).toBeNull();
  });

  it('owner with incomplete onboarding routes to /onboarding', () => {
    expect(
      resolveRootRouteTarget({
        authLoading: false,
        hasSession: true,
        accessLoading: false,
        access: baseAccess({ isOwner: true, defaultRoute: '/dashboard' }),
        profileRole: 'owner',
        profileOnboardingCompletedAt: null,
      }),
    ).toMatchObject({ type: 'redirect', to: '/onboarding' });
  });

  it('owner with completed onboarding routes to /dashboard', () => {
    expect(
      resolveRootRouteTarget({
        authLoading: false,
        hasSession: true,
        accessLoading: false,
        access: baseAccess({ isOwner: true, defaultRoute: '/dashboard' }),
        profileRole: 'owner',
        profileOnboardingCompletedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toMatchObject({ type: 'redirect', to: '/dashboard' });
  });

  it('accepted employee routes to /employee/dashboard', () => {
    expect(
      resolveRootRouteTarget({
        authLoading: false,
        hasSession: true,
        accessLoading: false,
        access: baseAccess({
          defaultRoute: '/employee/dashboard',
          acceptedEmployeeMemberships: [
            {
              workspaceId: 'owner-1',
              membershipId: 'employee-1',
              status: 'accepted',
              role: 'employee',
              hasAssignedFieldSeat: false,
              employerPlanId: null,
              employerFieldPortalEnabled: false,
            },
          ],
        }),
        profileRole: 'employee',
      }),
    ).toMatchObject({ type: 'redirect', to: '/employee/dashboard' });
  });

  it('new unassigned user routes to owner onboarding', () => {
    expect(
      resolveRootRouteTarget({
        authLoading: false,
        hasSession: true,
        accessLoading: false,
        access: baseAccess({ defaultRoute: '/onboarding' }),
      }),
    ).toMatchObject({ type: 'redirect', to: '/onboarding', accessKind: 'new_owner' });
  });

  it('ownerNeedsOnboarding is false for completed owners', () => {
    expect(
      ownerNeedsOnboarding({
        profileRole: 'owner',
        profileOnboardingCompletedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });
});
