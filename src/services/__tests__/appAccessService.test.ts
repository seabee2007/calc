import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  resolveDefaultRouteFromAccess,
  resolveAppAccess,
} from '../appAccessService';
import { fetchProfile, fetchTeamProfiles } from '../profileService';
import { fetchSubscription } from '../subscriptionService';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../profileService', () => ({
  fetchProfile: vi.fn(),
  fetchTeamProfiles: vi.fn(),
}));

vi.mock('../subscriptionService', () => ({
  fetchSubscription: vi.fn(),
  resolveEffectivePlanFromRow: (row: { planId: string; status: string } | null) =>
    row?.status === 'active' ? row.planId : 'free',
}));

describe('resolveAppAccess', () => {
  beforeEach(() => {
    vi.mocked(fetchProfile).mockReset();
    vi.mocked(fetchTeamProfiles).mockReset();
    vi.mocked(fetchSubscription).mockReset();
    vi.mocked(supabase.from).mockReset();
  });

  it('prioritizes owner workspace ownership over employee membership', async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      id: 'owner-1',
      role: 'owner',
      employerId: null,
      displayName: 'Owner',
      firstName: null,
      lastName: null,
      phone: null,
      businessAddressStreet: null,
      businessAddressStreet2: null,
      businessAddressCity: null,
      businessAddressState: null,
      businessAddressPostalCode: null,
      agreementAcceptedAt: null,
      agreementVersion: null,
      onboardingCompletedAt: null,
      onboardingVersion: null,
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(fetchSubscription).mockImplementation(async (userId: string) =>
      userId === 'owner-1'
        ? {
            id: 'sub-1',
            userId: 'owner-1',
            planId: 'starter',
            status: 'active',
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            trialEnd: null,
            cancelAtPeriodEnd: false,
            activeProjectLimit: null,
            includedFieldSeats: 1,
            createdAt: '',
            updatedAt: '',
          }
        : null,
    );
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
      }),
    } as never);

    const access = await resolveAppAccess('owner-1');

    expect(access.isOwner).toBe(true);
    expect(access.defaultRoute).toBe('/dashboard');
    expect(access.acceptedEmployeeMemberships).toEqual([]);
    expect(fetchTeamProfiles).not.toHaveBeenCalled();
  });

  it('does not classify pending invite profiles as accepted employee memberships', async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      id: 'user-1',
      role: 'employee',
      employerId: null,
      displayName: 'Pending',
      firstName: null,
      lastName: null,
      phone: null,
      businessAddressStreet: null,
      businessAddressStreet2: null,
      businessAddressCity: null,
      businessAddressState: null,
      businessAddressPostalCode: null,
      agreementAcceptedAt: null,
      agreementVersion: null,
      onboardingCompletedAt: null,
      onboardingVersion: null,
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(fetchSubscription).mockResolvedValue(null);
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      }),
    } as never);

    const access = await resolveAppAccess('user-1');

    expect(access.acceptedEmployeeMemberships).toEqual([]);
    expect(access.defaultRoute).toBe('/onboarding');
  });

  it('resolves employee portal access from employer subscription', async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      id: 'employee-1',
      role: 'employee',
      employerId: 'owner-1',
      displayName: 'Field User',
      firstName: null,
      lastName: null,
      phone: null,
      businessAddressStreet: null,
      businessAddressStreet2: null,
      businessAddressCity: null,
      businessAddressState: null,
      businessAddressPostalCode: null,
      agreementAcceptedAt: null,
      agreementVersion: null,
      onboardingCompletedAt: null,
      onboardingVersion: null,
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(fetchSubscription).mockImplementation(async (userId: string) =>
      userId === 'owner-1'
        ? {
            id: 'sub-1',
            userId: 'owner-1',
            planId: 'starter',
            status: 'active',
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            trialEnd: null,
            cancelAtPeriodEnd: false,
            activeProjectLimit: null,
            includedFieldSeats: 1,
            createdAt: '',
            updatedAt: '',
          }
        : null,
    );
    vi.mocked(fetchTeamProfiles).mockResolvedValue([
      {
        id: 'employee-1',
        role: 'employee',
        employerId: 'owner-1',
        displayName: 'Field User',
        firstName: null,
        lastName: null,
        phone: null,
        businessAddressStreet: null,
        businessAddressStreet2: null,
        businessAddressCity: null,
        businessAddressState: null,
        businessAddressPostalCode: null,
        agreementAcceptedAt: null,
        agreementVersion: null,
        onboardingCompletedAt: null,
        onboardingVersion: null,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      }),
    } as never);

    const access = await resolveAppAccess('employee-1');

    expect(access.defaultRoute).toBe('/employee/dashboard');
    expect(access.acceptedEmployeeMemberships[0]?.employerPlanId).toBe('starter');
    expect(access.acceptedEmployeeMemberships[0]?.employerFieldPortalEnabled).toBe(true);
  });

  it('routes ineligible accepted employees to /employee/dashboard for guard-side blocking', async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      id: 'employee-1',
      role: 'employee',
      employerId: 'owner-1',
      displayName: 'Field User',
      firstName: null,
      lastName: null,
      phone: null,
      businessAddressStreet: null,
      businessAddressStreet2: null,
      businessAddressCity: null,
      businessAddressState: null,
      businessAddressPostalCode: null,
      agreementAcceptedAt: null,
      agreementVersion: null,
      onboardingCompletedAt: null,
      onboardingVersion: null,
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(fetchSubscription).mockResolvedValue(null);
    vi.mocked(fetchTeamProfiles).mockResolvedValue([
      {
        id: 'employee-1',
        role: 'employee',
        employerId: 'owner-1',
        displayName: 'Field User',
        firstName: null,
        lastName: null,
        phone: null,
        businessAddressStreet: null,
        businessAddressStreet2: null,
        businessAddressCity: null,
        businessAddressState: null,
        businessAddressPostalCode: null,
        agreementAcceptedAt: null,
        agreementVersion: null,
        onboardingCompletedAt: null,
        onboardingVersion: null,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      }),
    } as never);

    const access = await resolveAppAccess('employee-1');

    expect(access.defaultRoute).toBe('/employee/dashboard');
    expect(access.acceptedEmployeeMemberships[0]?.employerFieldPortalEnabled).toBe(false);
  });

  it('treats accounts with own active subscription as owner even when profile tags employee', async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      id: 'owner-mislabeled',
      role: 'employee',
      employerId: 'some-other-owner',
      displayName: 'Mislabeled Owner',
      firstName: null,
      lastName: null,
      phone: null,
      businessAddressStreet: null,
      businessAddressStreet2: null,
      businessAddressCity: null,
      businessAddressState: null,
      businessAddressPostalCode: null,
      agreementAcceptedAt: null,
      agreementVersion: null,
      onboardingCompletedAt: null,
      onboardingVersion: null,
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(fetchSubscription).mockImplementation(async (userId: string) =>
      userId === 'owner-mislabeled'
        ? {
            id: 'sub-owner',
            userId: 'owner-mislabeled',
            planId: 'business',
            status: 'active',
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            trialEnd: null,
            cancelAtPeriodEnd: false,
            activeProjectLimit: null,
            includedFieldSeats: 3,
            createdAt: '',
            updatedAt: '',
          }
        : null,
    );
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      }),
    } as never);

    const access = await resolveAppAccess('owner-mislabeled');

    expect(access.isOwner).toBe(true);
    expect(access.defaultRoute).toBe('/dashboard');
    expect(access.acceptedEmployeeMemberships).toEqual([]);
    expect(fetchTeamProfiles).not.toHaveBeenCalled();
  });
});

describe('resolveDefaultRouteFromAccess', () => {
  it('routes owners to dashboard even when employee memberships exist', () => {
    expect(
      resolveDefaultRouteFromAccess({
        isOwner: true,
        isWorkspaceAdmin: false,
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
      }),
    ).toBe('/dashboard');
  });
});
