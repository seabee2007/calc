import type { PlanId } from './entitlements';
import { lookupKeyForPlan, STRIPE_PRICE_LOOKUP_KEYS } from './stripeConfig';

export type BillingInterval = 'month' | 'year';

export const VALID_PLAN_IDS: PlanId[] = ['starter', 'professional', 'business'];

const ADDON_LOOKUP_KEYS = new Set<string>([
  STRIPE_PRICE_LOOKUP_KEYS.extra_field_seat,
  STRIPE_PRICE_LOOKUP_KEYS.extra_project_pack,
  STRIPE_PRICE_LOOKUP_KEYS.ai_overage,
]);

export const LOOKUP_KEY_TO_PLAN: Record<string, PlanId> = {
  [STRIPE_PRICE_LOOKUP_KEYS.starter_monthly]: 'starter',
  [STRIPE_PRICE_LOOKUP_KEYS.starter_annual]: 'starter',
  [STRIPE_PRICE_LOOKUP_KEYS.professional_monthly]: 'professional',
  [STRIPE_PRICE_LOOKUP_KEYS.professional_annual]: 'professional',
  [STRIPE_PRICE_LOOKUP_KEYS.business_monthly]: 'business',
  [STRIPE_PRICE_LOOKUP_KEYS.business_annual]: 'business',
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && VALID_PLAN_IDS.includes(value as PlanId);
}

export function parseBillingInterval(value: unknown): BillingInterval | null {
  if (value === 'month' || value === 'monthly') return 'month';
  if (value === 'year' || value === 'annual') return 'year';
  return null;
}

export function validateCheckoutRequest(body: {
  planId?: unknown;
  billingInterval?: unknown;
}): { planId: PlanId; billingInterval: BillingInterval } | { error: string } {
  if (!isPlanId(body.planId)) {
    return { error: 'Invalid planId. Expected starter, professional, or business.' };
  }
  const billingInterval = parseBillingInterval(body.billingInterval);
  if (!billingInterval) {
    return { error: 'Invalid billingInterval. Expected month or year.' };
  }
  return { planId: body.planId, billingInterval };
}

export function checkoutLookupKey(planId: PlanId, billingInterval: BillingInterval): string {
  const interval = billingInterval === 'year' ? 'annual' : 'monthly';
  return lookupKeyForPlan(planId, interval);
}

export function resolvePlanFromStripeLookupKey(
  lookupKey: string | null | undefined,
): PlanId | null {
  if (!lookupKey || ADDON_LOOKUP_KEYS.has(lookupKey)) return null;
  return LOOKUP_KEY_TO_PLAN[lookupKey] ?? null;
}

export function resolvePlanFromStripeEvent(input: {
  priceLookupKey?: string | null;
  metadataPlanId?: string | null;
}): PlanId | null {
  const fromLookup = resolvePlanFromStripeLookupKey(input.priceLookupKey);
  if (fromLookup) return fromLookup;
  if (isPlanId(input.metadataPlanId)) return input.metadataPlanId;
  return null;
}
