/**
 * Pure subscription welcome email rules — safe to import from Vitest without Deno deps.
 */
import { getPlanUsageLimit, type PlanId } from "./usageLimits.ts";

export type PaidPlanId = "starter" | "professional" | "business";

export type SubscriptionWelcomeEmailType =
  | "subscription_welcome_starter"
  | "subscription_welcome_professional"
  | "subscription_welcome_business";

export const PAID_PLAN_RANK: Record<PaidPlanId, number> = {
  starter: 0,
  professional: 1,
  business: 2,
};

export const SUBSCRIPTION_WELCOME_EMAIL_TYPE_BY_PLAN: Record<
  PaidPlanId,
  SubscriptionWelcomeEmailType
> = {
  starter: "subscription_welcome_starter",
  professional: "subscription_welcome_professional",
  business: "subscription_welcome_business",
};

export const SUBSCRIPTION_WELCOME_TEMPLATE_BY_PLAN = {
  starter: "subscriptionWelcomeStarter",
  professional: "subscriptionWelcomeProfessional",
  business: "subscriptionWelcomeBusiness",
} as const;

export const ACTIVE_PAID_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export interface SubscriptionRowSnapshot {
  plan_id?: string | null;
  status?: string | null;
  stripe_subscription_id?: string | null;
}

export function isPaidPlanId(planId: string | null | undefined): planId is PaidPlanId {
  return planId === "starter" || planId === "professional" || planId === "business";
}

export function isActivePaidSubscriptionStatus(status: string | null | undefined): boolean {
  return typeof status === "string" && ACTIVE_PAID_SUBSCRIPTION_STATUSES.has(status);
}

export function planRank(planId: string | null | undefined): number {
  if (!isPaidPlanId(planId)) return -1;
  return PAID_PLAN_RANK[planId];
}

export function shouldSendSubscriptionWelcomeEmail(input: {
  planId: string;
  status: string;
  previousRow?: SubscriptionRowSnapshot | null;
}): boolean {
  if (!isPaidPlanId(input.planId)) return false;
  if (!isActivePaidSubscriptionStatus(input.status)) return false;

  const previousPlanId = input.previousRow?.plan_id ?? null;
  const previousStatus = input.previousRow?.status ?? null;
  const newRank = planRank(input.planId);
  const previousRank = isActivePaidSubscriptionStatus(previousStatus)
    ? planRank(previousPlanId)
    : -1;

  if (previousRank < 0) return true;
  return newRank > previousRank;
}

export function buildSubscriptionUsageSummary(planId: PaidPlanId): string {
  const emailLimit = getPlanUsageLimit(planId as PlanId, "email_send");
  const weatherLimit = getPlanUsageLimit(planId as PlanId, "weather_request");
  const aiLimit = getPlanUsageLimit(planId as PlanId, "ai_request");

  const parts = [
    `${emailLimit.toLocaleString()} project emails`,
    `${weatherLimit.toLocaleString()} weather lookups`,
  ];

  if (aiLimit > 0) {
    parts.push(`${aiLimit.toLocaleString()} AI requests`);
  }

  const planLabel = planId.charAt(0).toUpperCase() + planId.slice(1);
  return `${planLabel} includes ${parts.join(", ")}, and other monthly usage limits. View current usage in Settings → Billing.`;
}

function resolveSubscriptionEmailAppUrl(): string {
  const url = (
    Deno.env.get("APP_URL") ??
    Deno.env.get("SITE_URL") ??
    Deno.env.get("PUBLIC_APP_URL") ??
    ""
  ).replace(/\/$/, "");
  if (!url) {
    throw new Error("APP_URL is not configured.");
  }
  return url;
}

export { resolveSubscriptionEmailAppUrl };
