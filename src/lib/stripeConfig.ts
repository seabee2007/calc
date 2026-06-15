import type { PlanId } from './entitlements';

export const STRIPE_PRICE_LOOKUP_KEYS = {
  starter_monthly: 'arden_starter_monthly',
  starter_annual: 'arden_starter_annual',
  professional_monthly: 'arden_professional_monthly',
  professional_annual: 'arden_professional_annual',
  business_monthly: 'arden_business_monthly',
  business_annual: 'arden_business_annual',
  extra_field_seat: 'arden_extra_field_seat_monthly',
  extra_project_pack: 'arden_extra_project_pack_monthly',
  ai_overage: 'arden_ai_requests_overage',
} as const;

export type StripePriceLookupKey =
  (typeof STRIPE_PRICE_LOOKUP_KEYS)[keyof typeof STRIPE_PRICE_LOOKUP_KEYS];

export const STRIPE_PRODUCT_NAMES: Record<PlanId, string> = {
  starter: 'arden_starter',
  professional: 'arden_professional',
  business: 'arden_business',
};

export function lookupKeyForPlan(
  plan: PlanId,
  interval: 'monthly' | 'annual',
): StripePriceLookupKey {
  if (plan === 'starter') {
    return interval === 'annual'
      ? STRIPE_PRICE_LOOKUP_KEYS.starter_annual
      : STRIPE_PRICE_LOOKUP_KEYS.starter_monthly;
  }
  if (plan === 'professional') {
    return interval === 'annual'
      ? STRIPE_PRICE_LOOKUP_KEYS.professional_annual
      : STRIPE_PRICE_LOOKUP_KEYS.professional_monthly;
  }
  return interval === 'annual'
    ? STRIPE_PRICE_LOOKUP_KEYS.business_annual
    : STRIPE_PRICE_LOOKUP_KEYS.business_monthly;
}
