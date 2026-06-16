import { describe, expect, it } from 'vitest';
import {
  getBillingStatusLabel,
  getCustomerFacingCurrentPlanId,
  getProfilePlanLabel,
} from '../profilePlanLabel';

describe('getProfilePlanLabel', () => {
  it('returns Free when there is no subscription row', () => {
    expect(getProfilePlanLabel({ plan: 'starter', status: null, subscription: null })).toEqual({
      label: 'Free',
      tone: 'muted',
    });
  });

  it('returns Free for a customer-only row without a Stripe subscription id', () => {
    expect(
      getProfilePlanLabel({
        plan: 'starter',
        status: 'inactive',
        subscription: {
          id: 'sub-row',
          userId: 'user-1',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: null,
          planId: 'starter',
          status: 'inactive',
          currentPeriodStart: null,
          currentPeriodEnd: null,
          trialEnd: null,
          cancelAtPeriodEnd: false,
          activeProjectLimit: null,
          includedFieldSeats: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    ).toEqual({
      label: 'Free',
      tone: 'muted',
    });
  });

  it('returns Trial for trialing status', () => {
    expect(
      getProfilePlanLabel({
        plan: 'starter',
        status: 'trialing',
        subscription: {
          id: 'sub-row',
          userId: 'user-1',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          planId: 'starter',
          status: 'trialing',
          currentPeriodStart: null,
          currentPeriodEnd: null,
          trialEnd: null,
          cancelAtPeriodEnd: false,
          activeProjectLimit: null,
          includedFieldSeats: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    ).toEqual({
      label: 'Trial',
      tone: 'trial',
    });
  });

  it('returns Professional plan for an active professional subscription', () => {
    expect(
      getProfilePlanLabel({
        plan: 'professional',
        status: 'active',
        subscription: {
          id: 'sub-row',
          userId: 'user-1',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          planId: 'professional',
          status: 'active',
          currentPeriodStart: null,
          currentPeriodEnd: null,
          trialEnd: null,
          cancelAtPeriodEnd: false,
          activeProjectLimit: null,
          includedFieldSeats: 5,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    ).toEqual({
      label: 'Professional plan',
      tone: 'default',
    });
  });

  it('returns Business plan for an active business subscription', () => {
    expect(
      getProfilePlanLabel({
        plan: 'business',
        status: 'active',
        subscription: {
          id: 'sub-row',
          userId: 'user-1',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          planId: 'business',
          status: 'active',
          currentPeriodStart: null,
          currentPeriodEnd: null,
          trialEnd: null,
          cancelAtPeriodEnd: false,
          activeProjectLimit: null,
          includedFieldSeats: 15,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    ).toEqual({
      label: 'Business plan',
      tone: 'default',
    });
  });

  it('returns Past due for past_due status', () => {
    expect(
      getProfilePlanLabel({
        plan: 'professional',
        status: 'past_due',
        subscription: {
          id: 'sub-row',
          userId: 'user-1',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          planId: 'professional',
          status: 'past_due',
          currentPeriodStart: null,
          currentPeriodEnd: null,
          trialEnd: null,
          cancelAtPeriodEnd: false,
          activeProjectLimit: null,
          includedFieldSeats: 5,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    ).toEqual({
      label: 'Past due',
      tone: 'warning',
    });
  });
});

describe('getBillingStatusLabel', () => {
  it('returns No active subscription when there is no subscription row', () => {
    expect(
      getBillingStatusLabel({ plan: 'starter', status: null, subscription: null }),
    ).toBe('No active subscription');
  });

  it('returns Active for an active Stripe subscription', () => {
    expect(
      getBillingStatusLabel({
        plan: 'business',
        status: 'active',
        subscription: {
          id: 'sub-row',
          userId: 'user-1',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          planId: 'business',
          status: 'active',
          currentPeriodStart: null,
          currentPeriodEnd: null,
          trialEnd: null,
          cancelAtPeriodEnd: false,
          activeProjectLimit: null,
          includedFieldSeats: 15,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    ).toBe('Active');
  });
});

describe('getCustomerFacingCurrentPlanId', () => {
  it('returns null when there is no subscription row', () => {
    expect(
      getCustomerFacingCurrentPlanId({ plan: 'starter', status: null, subscription: null }),
    ).toBeNull();
  });

  it('returns null for customer-only rows without a Stripe subscription id', () => {
    expect(
      getCustomerFacingCurrentPlanId({
        plan: 'starter',
        status: 'inactive',
        subscription: {
          id: 'sub-row',
          userId: 'user-1',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: null,
          planId: 'starter',
          status: 'inactive',
          currentPeriodStart: null,
          currentPeriodEnd: null,
          trialEnd: null,
          cancelAtPeriodEnd: false,
          activeProjectLimit: null,
          includedFieldSeats: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    ).toBeNull();
  });

  it('returns professional for an active professional subscription', () => {
    expect(
      getCustomerFacingCurrentPlanId({
        plan: 'professional',
        status: 'active',
        subscription: {
          id: 'sub-row',
          userId: 'user-1',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          planId: 'professional',
          status: 'active',
          currentPeriodStart: null,
          currentPeriodEnd: null,
          trialEnd: null,
          cancelAtPeriodEnd: false,
          activeProjectLimit: null,
          includedFieldSeats: 5,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    ).toBe('professional');
  });
});
