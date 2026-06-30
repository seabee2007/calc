import { supabase } from '../lib/supabase';
import {
  getEffectiveLimits,
  isSubscriptionStatusActive,
  PLAN_FEATURES,
  resolveEffectivePlan,
  type FeatureKey,
  type LimitKey,
  type PlanId,
  type SubscriptionEntitlementInput,
} from '../lib/entitlements';

export type AccessSource = 'stripe' | 'trial' | 'internal_override' | 'none';

export interface SubscriptionRow {
  id: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planId: PlanId;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  activeProjectLimit: number | null;
  includedFieldSeats: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InternalAccessOverride {
  id: string;
  userId: string;
  email: string;
  planId: string;
  reason: string;
  grantedBy: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedEntitlement {
  accessSource: AccessSource;
  planId: PlanId;
  limits: Record<LimitKey, number>;
  features: FeatureKey[];
  subscription: SubscriptionRow | null;
  internalOverride: InternalAccessOverride | null;
}

function mapSubscriptionRow(row: Record<string, unknown>): SubscriptionRow {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    stripeCustomerId: (row.stripe_customer_id as string) ?? null,
    stripeSubscriptionId: (row.stripe_subscription_id as string) ?? null,
    planId: (row.plan_id as PlanId) ?? 'starter',
    status: (row.status as string) ?? 'inactive',
    currentPeriodStart: (row.current_period_start as string) ?? null,
    currentPeriodEnd: (row.current_period_end as string) ?? null,
    trialEnd: (row.trial_end as string) ?? null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    activeProjectLimit:
      row.active_project_limit == null ? null : Number(row.active_project_limit),
    includedFieldSeats:
      row.included_field_seats == null ? null : Number(row.included_field_seats),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapInternalAccessOverride(row: Record<string, unknown>): InternalAccessOverride {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    email: row.email as string,
    planId: (row.plan_id as string) ?? 'enterprise',
    reason: row.reason as string,
    grantedBy: (row.granted_by as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toEntitlementInput(row: SubscriptionRow | null): SubscriptionEntitlementInput | null {
  if (!row) return null;
  return {
    planId: row.planId,
    status: row.status,
    activeProjectLimit: row.activeProjectLimit,
    includedFieldSeats: row.includedFieldSeats,
  };
}

export async function fetchSubscription(userId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('subscriptions')) {
      return null;
    }
    throw error;
  }

  return data ? mapSubscriptionRow(data) : null;
}

export function resolveEffectivePlanFromRow(row: SubscriptionRow | null): PlanId {
  return resolveEffectivePlan(toEntitlementInput(row));
}

export function isInternalAccessOverrideActive(
  override: InternalAccessOverride | null | undefined,
  now = new Date(),
): override is InternalAccessOverride {
  if (!override?.isActive) return false;
  if (!override.expiresAt) return true;
  const expiresAt = new Date(override.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() > now.getTime();
}

export function normalizeInternalOverridePlanId(
  planId: string | null | undefined,
): PlanId {
  void planId;
  return 'business';
}

export async function fetchActiveInternalAccessOverride(
  userId: string,
): Promise<InternalAccessOverride | null> {
  const { data, error } = await supabase
    .from('internal_access_overrides')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();

  if (error) {
    if (
      error.code === 'PGRST205' ||
      error.message?.includes('internal_access_overrides')
    ) {
      return null;
    }
    throw error;
  }

  const override = data ? mapInternalAccessOverride(data) : null;
  return isInternalAccessOverrideActive(override) ? override : null;
}

function featuresForPlan(planId: PlanId): FeatureKey[] {
  return Array.from(PLAN_FEATURES[planId]);
}

export function resolveSubscriptionAccessSource(
  row: SubscriptionRow | null,
): AccessSource {
  if (!row || !isSubscriptionStatusActive(row.status)) return 'none';
  return row.status.toLowerCase() === 'trialing' ? 'trial' : 'stripe';
}

export function resolveEntitlementFromRows(
  subscription: SubscriptionRow | null,
  internalOverride: InternalAccessOverride | null,
): ResolvedEntitlement {
  if (isInternalAccessOverrideActive(internalOverride)) {
    const planId = normalizeInternalOverridePlanId(internalOverride.planId);
    return {
      accessSource: 'internal_override',
      planId,
      limits: getEffectiveLimits(planId),
      features: featuresForPlan(planId),
      subscription,
      internalOverride,
    };
  }

  const planId = resolveEffectivePlanFromRow(subscription);
  const accessSource = resolveSubscriptionAccessSource(subscription);
  return {
    accessSource,
    planId,
    limits: getEffectiveLimits(planId, {
      activeProjectLimit: subscription?.activeProjectLimit,
      includedFieldSeats: subscription?.includedFieldSeats,
    }),
    features: featuresForPlan(planId),
    subscription,
    internalOverride: null,
  };
}

export async function fetchEntitlementForUser(userId: string): Promise<ResolvedEntitlement> {
  const [subscription, internalOverride] = await Promise.all([
    fetchSubscription(userId),
    fetchActiveInternalAccessOverride(userId),
  ]);
  return resolveEntitlementFromRows(subscription, internalOverride);
}
