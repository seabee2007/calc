import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  isInternalAccessOverrideActive,
  resolveEntitlementFromRows,
  type InternalAccessOverride,
  type SubscriptionRow,
} from '../subscriptionService';

function subscriptionRow(
  overrides: Partial<SubscriptionRow> = {},
): SubscriptionRow {
  return {
    id: 'sub-1',
    userId: 'owner-1',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    planId: 'professional',
    status: 'active',
    currentPeriodStart: null,
    currentPeriodEnd: null,
    trialEnd: null,
    cancelAtPeriodEnd: false,
    activeProjectLimit: null,
    includedFieldSeats: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function internalOverride(
  overrides: Partial<InternalAccessOverride> = {},
): InternalAccessOverride {
  return {
    id: 'override-1',
    userId: 'owner-1',
    email: 'owner@example.com',
    planId: 'enterprise',
    reason: 'Owner production access',
    grantedBy: null,
    expiresAt: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('subscription entitlement resolution', () => {
  it('grants access from an active Stripe subscription', () => {
    const entitlement = resolveEntitlementFromRows(subscriptionRow(), null);

    expect(entitlement.accessSource).toBe('stripe');
    expect(entitlement.planId).toBe('professional');
    expect(entitlement.features).toContain('design_builder');
  });

  it('denies paid access from an inactive Stripe subscription', () => {
    const entitlement = resolveEntitlementFromRows(
      subscriptionRow({ status: 'canceled' }),
      null,
    );

    expect(entitlement.accessSource).toBe('none');
    expect(entitlement.planId).toBe('free');
    expect(entitlement.features).not.toContain('design_builder');
  });

  it('lets an active internal override win over inactive Stripe state', () => {
    const entitlement = resolveEntitlementFromRows(
      subscriptionRow({ status: 'canceled', planId: 'starter' }),
      internalOverride(),
    );

    expect(entitlement.accessSource).toBe('internal_override');
    expect(entitlement.planId).toBe('business');
    expect(entitlement.limits.max_active_projects).toBe(-1);
    expect(entitlement.features).toContain('accounting_exports');
    expect(entitlement.features).toContain('design_builder');
  });

  it('ignores expired internal overrides', () => {
    const expired = internalOverride({ expiresAt: '2026-01-01T00:00:00.000Z' });

    expect(isInternalAccessOverrideActive(expired, new Date('2026-02-01T00:00:00.000Z'))).toBe(false);

    const entitlement = resolveEntitlementFromRows(
      subscriptionRow({ status: 'canceled' }),
      expired,
    );

    expect(entitlement.accessSource).toBe('none');
    expect(entitlement.planId).toBe('free');
  });

  it('does not mutate Stripe customer or subscription records', () => {
    const subscription = subscriptionRow({
      status: 'canceled',
      stripeCustomerId: 'cus_original',
      stripeSubscriptionId: 'sub_original',
    });
    const before = { ...subscription };

    const entitlement = resolveEntitlementFromRows(subscription, internalOverride());

    expect(entitlement.subscription).toBe(subscription);
    expect(subscription).toEqual(before);
    expect(entitlement.subscription?.stripeCustomerId).toBe('cus_original');
    expect(entitlement.subscription?.stripeSubscriptionId).toBe('sub_original');
  });
});

describe('internal access override migration', () => {
  const migration = readFileSync(
    'supabase/migrations/20260726133000_internal_access_overrides.sql',
    'utf8',
  );

  it('allows normal users to read only their own active unexpired override', () => {
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/for select\s+to authenticated/i);
    expect(migration).toMatch(/user_id\s*=\s*auth\.uid\(\)/i);
    expect(migration).toMatch(/is_active\s*=\s*true/i);
    expect(migration).toMatch(/expires_at\s+is\s+null\s+or\s+expires_at\s*>\s*now\(\)/i);
  });

  it('does not grant normal client write access and keeps grant helper service-role-only', () => {
    expect(migration).not.toMatch(/for insert\s+to authenticated/i);
    expect(migration).not.toMatch(/for update\s+to authenticated/i);
    expect(migration).not.toMatch(/for delete\s+to authenticated/i);
    expect(migration).toMatch(/auth\.role\(\).*service_role/is);
    expect(migration).toMatch(/grant execute .* to service_role/is);
  });
});
