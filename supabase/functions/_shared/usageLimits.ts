/**
 * Monthly usage limits — keep in sync with src/lib/usageLimits.ts
 */

export type PlanId = "free" | "starter" | "professional" | "business";

export type UsageUnit =
  | "ai_request"
  | "weather_request"
  | "geocode_request"
  | "travel_request"
  | "place_search"
  | "email_send";

export const USAGE_UNITS: UsageUnit[] = [
  "ai_request",
  "weather_request",
  "geocode_request",
  "travel_request",
  "place_search",
  "email_send",
];

export type UsageFeatureKey =
  | "ai.ask_concrete"
  | "ai.scope_summary"
  | "ai.project_scope_professionalize"
  | "ai.estimate_divisions"
  | "ai.suggest_divisions"
  | "ai.batch_plant_pricing"
  | "ai.batch_plant_contact"
  | "ai.labor_crew_review"
  | "weather.forecast"
  | "mapbox.geocode"
  | "mapbox.travel_time"
  | "mapbox.place_search"
  | "email.transactional"
  | "email.employee_invite";

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

export function getUsagePeriod(referenceDate = new Date()): UsagePeriod {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

export interface UsageLimitCheckResult {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
}

export function checkUsageAllowedPure(
  planId: PlanId,
  usageUnit: UsageUnit,
  used: number,
  quantity = 1,
): UsageLimitCheckResult {
  const limit = getPlanUsageLimit(planId, usageUnit);
  if (limit < 0) {
    return { allowed: true, limit, used, remaining: -1 };
  }
  const remaining = Math.max(0, limit - used);
  const allowed = used + quantity <= limit;
  return { allowed, limit, used, remaining };
}

export function buildUsageLimitReachedPayload(
  featureKey: UsageFeatureKey,
  usageUnit: UsageUnit,
  planId: PlanId,
  check: UsageLimitCheckResult,
  options?: { buyMoreAvailable?: boolean; creditRemaining?: number },
): Record<string, unknown> {
  return {
    error: "usage_limit_reached",
    featureKey,
    usageUnit,
    limit: check.limit,
    used: check.used,
    planId,
    upgradeRequired: true,
    buyMoreAvailable: options?.buyMoreAvailable ?? planId !== "free",
    creditRemaining: options?.creditRemaining ?? 0,
  };
}
