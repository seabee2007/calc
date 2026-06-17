import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  checkUsageAllowedPure,
  getPlanUsageLimit,
  getUsagePeriod,
  USAGE_UNITS,
  type PlanId,
  type UsagePeriod,
  type UsageUnit,
} from "./usageLimits.ts";
import {
  getCreditPackExpiresAt,
  getCreditPackRemaining,
} from "./usageCredits.ts";
import { getUsageUsed, resolveUsageContext, type UsageContext } from "./usage.ts";

const USAGE_UNIT_LABELS: Record<UsageUnit, string> = {
  ai_request: "AI requests",
  weather_request: "Weather forecasts",
  geocode_request: "Address lookups",
  travel_request: "Travel-time checks",
  place_search: "Place searches",
  email_send: "Email sends",
};

export interface UsageSummaryItem {
  usageUnit: UsageUnit;
  label: string;
  used: number;
  limit: number;
  remaining: number;
  creditRemaining: number;
  creditsExpireAt: string | null;
  percentUsed: number;
  resetsAt: string;
}

export interface UsageSummaryResponse {
  periodStart: string;
  periodEnd: string;
  planId: PlanId;
  items: UsageSummaryItem[];
}

export function computePercentUsed(used: number, limit: number): number {
  if (limit < 0) return 0;
  if (limit === 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function buildUsageSummaryItem(
  usageUnit: UsageUnit,
  used: number,
  planId: PlanId,
  period: UsagePeriod,
  creditRemaining = 0,
  creditsExpireAt: string | null = null,
): UsageSummaryItem {
  const check = checkUsageAllowedPure(planId, usageUnit, used, 0);
  return {
    usageUnit,
    label: USAGE_UNIT_LABELS[usageUnit],
    used: check.used,
    limit: check.limit,
    remaining: check.remaining,
    creditRemaining,
    creditsExpireAt,
    percentUsed: computePercentUsed(check.used, check.limit),
    resetsAt: period.end,
  };
}

export async function buildUsageSummary(
  admin: SupabaseClient,
  userId: string,
  period: UsagePeriod = getUsagePeriod(),
): Promise<UsageSummaryResponse & { context: UsageContext }> {
  const context = await resolveUsageContext(admin, userId);

  const items = await Promise.all(
    USAGE_UNITS.map(async (usageUnit) => {
      const used = await getUsageUsed(admin, context, usageUnit, period);
      const creditRemaining = await getCreditPackRemaining(admin, context.employerId, usageUnit);
      const creditsExpireAt = creditRemaining > 0
        ? await getCreditPackExpiresAt(admin, context.employerId, usageUnit)
        : null;
      return buildUsageSummaryItem(
        usageUnit,
        used,
        context.planId,
        period,
        creditRemaining,
        creditsExpireAt,
      );
    }),
  );

  return {
    periodStart: period.start,
    periodEnd: period.end,
    planId: context.planId,
    items,
    context,
  };
}

export function isOwnerRole(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
