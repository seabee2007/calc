import type { PlanId } from './entitlements';

/** Metered usage units tracked in usage_events. */
export type UsageUnit =
  | 'ai_request'
  | 'weather_request'
  | 'geocode_request'
  | 'travel_request'
  | 'place_search'
  | 'email_send';

export const USAGE_UNITS: UsageUnit[] = [
  'ai_request',
  'weather_request',
  'geocode_request',
  'travel_request',
  'place_search',
  'email_send',
];

/** Feature keys written to usage_events for Phase 1 metered edge functions. */
export type UsageFeatureKey =
  | 'ai.ask_concrete'
  | 'ai.scope_summary'
  | 'ai.project_scope_professionalize'
  | 'ai.estimate_divisions'
  | 'ai.suggest_divisions'
  | 'ai.batch_plant_pricing'
  | 'ai.batch_plant_contact'
  | 'ai.labor_crew_review'
  | 'weather.forecast'
  | 'mapbox.geocode'
  | 'mapbox.travel_time'
  | 'mapbox.place_search'
  | 'email.transactional'
  | 'email.employee_invite';

/** Monthly limits by plan and usage unit (-1 = unlimited). */
export const PLAN_USAGE_LIMITS: Record<PlanId, Record<UsageUnit, number>> = {
  free: {
    ai_request: 0,
    weather_request: 25,
    geocode_request: 10,
    travel_request: 10,
    place_search: 10,
    email_send: 10,
  },
  starter: {
    ai_request: 50,
    weather_request: 250,
    geocode_request: 100,
    travel_request: 100,
    place_search: 100,
    email_send: 100,
  },
  professional: {
    ai_request: 250,
    weather_request: 1000,
    geocode_request: 500,
    travel_request: 500,
    place_search: 500,
    email_send: 500,
  },
  business: {
    ai_request: 1000,
    weather_request: 5000,
    geocode_request: 2000,
    travel_request: 2000,
    place_search: 2000,
    email_send: 2000,
  },
};

export function getPlanUsageLimit(planId: PlanId, usageUnit: UsageUnit): number {
  return PLAN_USAGE_LIMITS[planId][usageUnit];
}

export interface UsagePeriod {
  start: string;
  end: string;
}

/** UTC calendar month window for monthly quotas. */
export function getUsagePeriod(referenceDate = new Date()): UsagePeriod {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

export interface UsageLimitCheckInput {
  planId: PlanId;
  usageUnit: UsageUnit;
  used: number;
  quantity?: number;
}

export interface UsageLimitCheckResult {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
}

export function checkUsageAllowed(input: UsageLimitCheckInput): UsageLimitCheckResult {
  const quantity = input.quantity ?? 1;
  const limit = getPlanUsageLimit(input.planId, input.usageUnit);
  if (limit < 0) {
    return { allowed: true, limit, used: input.used, remaining: -1 };
  }
  const remaining = Math.max(0, limit - input.used);
  const allowed = input.used + quantity <= limit;
  return { allowed, limit, used: input.used, remaining };
}

export interface UsageLimitReachedPayload {
  error: 'usage_limit_reached';
  featureKey: UsageFeatureKey;
  usageUnit: UsageUnit;
  limit: number;
  used: number;
  planId: PlanId;
  upgradeRequired: true;
  buyMoreAvailable?: boolean;
  creditRemaining?: number;
}

export function buildUsageLimitReachedPayload(
  featureKey: UsageFeatureKey,
  usageUnit: UsageUnit,
  planId: PlanId,
  check: UsageLimitCheckResult,
  options?: { buyMoreAvailable?: boolean; creditRemaining?: number },
): UsageLimitReachedPayload {
  return {
    error: 'usage_limit_reached',
    featureKey,
    usageUnit,
    limit: check.limit,
    used: check.used,
    planId,
    upgradeRequired: true,
    buyMoreAvailable: options?.buyMoreAvailable ?? planId !== 'free',
    creditRemaining: options?.creditRemaining ?? 0,
  };
}

export function isUsageLimitReachedPayload(
  value: unknown,
): value is UsageLimitReachedPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return payload.error === 'usage_limit_reached';
}

/** User-facing copy for limit blocks (no Stripe re-up yet). */
export function usageLimitMessage(usageUnit: UsageUnit): string {
  switch (usageUnit) {
    case 'ai_request':
      return "You've reached your monthly AI request limit. Buy more credits, upgrade your plan, or try again next billing period.";
    case 'weather_request':
      return "You've reached your monthly Weather Forecast limit. Buy more credits, upgrade your plan, or try again next billing period.";
    case 'geocode_request':
      return "You've reached your monthly geocoding limit. Buy more credits, upgrade your plan, or try again next billing period.";
    case 'travel_request':
      return "You've reached your monthly travel-time lookup limit. Buy more credits, upgrade your plan, or try again next billing period.";
    case 'place_search':
      return "You've reached your monthly place search limit. Buy more credits, upgrade your plan, or try again next billing period.";
    case 'email_send':
      return "You've reached your monthly email send limit. Buy more credits, upgrade your plan, or try again next billing period.";
    default:
      return "You've reached your monthly usage limit. Buy more credits, upgrade your plan, or try again next billing period.";
  }
}
