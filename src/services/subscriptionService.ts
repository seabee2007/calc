import { supabase } from '../lib/supabase';
import {
  resolveEffectivePlan,
  type PlanId,
  type SubscriptionEntitlementInput,
} from '../lib/entitlements';

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
