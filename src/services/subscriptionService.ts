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
    status: (row.status as string) ?? 'trialing',
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

export async function upsertSubscription(
  row: Partial<SubscriptionRow> & { userId: string },
): Promise<SubscriptionRow> {
  const payload: Record<string, unknown> = {
    user_id: row.userId,
    updated_at: new Date().toISOString(),
  };

  if (row.stripeCustomerId !== undefined) payload.stripe_customer_id = row.stripeCustomerId;
  if (row.stripeSubscriptionId !== undefined) {
    payload.stripe_subscription_id = row.stripeSubscriptionId;
  }
  if (row.planId !== undefined) payload.plan_id = row.planId;
  if (row.status !== undefined) payload.status = row.status;
  if (row.currentPeriodStart !== undefined) {
    payload.current_period_start = row.currentPeriodStart;
  }
  if (row.currentPeriodEnd !== undefined) payload.current_period_end = row.currentPeriodEnd;
  if (row.trialEnd !== undefined) payload.trial_end = row.trialEnd;
  if (row.cancelAtPeriodEnd !== undefined) {
    payload.cancel_at_period_end = row.cancelAtPeriodEnd;
  }
  if (row.activeProjectLimit !== undefined) {
    payload.active_project_limit = row.activeProjectLimit;
  }
  if (row.includedFieldSeats !== undefined) {
    payload.included_field_seats = row.includedFieldSeats;
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return mapSubscriptionRow(data);
}

export function resolveEffectivePlanFromRow(row: SubscriptionRow | null): PlanId {
  return resolveEffectivePlan(toEntitlementInput(row));
}
