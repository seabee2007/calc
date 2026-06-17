import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildUsageLimitReachedPayload,
  checkUsageAllowedPure,
  getPlanUsageLimit,
  getUsagePeriod,
  type PlanId,
  type UsageFeatureKey,
  type UsageLimitCheckResult,
  type UsagePeriod,
  type UsageUnit,
} from "./usageLimits.ts";
import {
  checkUsageWithCreditsPure,
  consumeUsageCreditPack,
  getCreditPackRemaining,
  type UsageLimitCheckWithCredits,
} from "./usageCredits.ts";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const VALID_PLAN_IDS = new Set<PlanId>(["free", "starter", "professional", "business"]);

export interface UsageContext {
  userId: string;
  employerId: string;
  planId: PlanId;
}

export interface RecordUsageEventInput {
  featureKey: UsageFeatureKey;
  usageUnit: UsageUnit;
  quantity?: number;
  source?: string;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}

function resolveEffectivePlanFromRow(
  row: { plan_id: string; status: string } | null | undefined,
): PlanId {
  if (!row || !ACTIVE_SUBSCRIPTION_STATUSES.has(String(row.status))) {
    return "free";
  }
  const planId = String(row.plan_id) as PlanId;
  return VALID_PLAN_IDS.has(planId) ? planId : "free";
}

/** Resolve billing employer and plan from authenticated user (server-side only). */
export async function resolveUsageContext(
  admin: SupabaseClient,
  userId: string,
): Promise<UsageContext> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, employer_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[usage] profile lookup failed", profileError);
  }

  const employerId =
    profile?.employer_id && typeof profile.employer_id === "string"
      ? profile.employer_id
      : userId;

  const { data: subscription, error: subscriptionError } = await admin
    .from("subscriptions")
    .select("plan_id, status")
    .eq("user_id", employerId)
    .maybeSingle();

  if (subscriptionError) {
    console.error("[usage] subscription lookup failed", subscriptionError);
  }

  const planId = resolveEffectivePlanFromRow(
    subscription
      ? { plan_id: String(subscription.plan_id), status: String(subscription.status) }
      : null,
  );

  return { userId, employerId, planId };
}

export { getUsagePeriod, getPlanUsageLimit };

export async function getUsageUsed(
  admin: SupabaseClient,
  context: UsageContext,
  usageUnit: UsageUnit,
  period: UsagePeriod = getUsagePeriod(),
): Promise<number> {
  const { data, error } = await admin
    .from("usage_events")
    .select("quantity")
    .eq("employer_id", context.employerId)
    .eq("usage_unit", usageUnit)
    .gte("created_at", period.start)
    .lt("created_at", period.end);

  if (error) {
    console.error("[usage] aggregate read failed", error);
    throw new Error("Could not read usage totals.");
  }

  return (data ?? []).reduce((sum, row) => {
    const quantity = Number(row.quantity ?? 0);
    return sum + (Number.isFinite(quantity) ? quantity : 0);
  }, 0);
}

export async function checkUsageAllowed(
  admin: SupabaseClient,
  context: UsageContext,
  usageUnit: UsageUnit,
  quantity = 1,
  period: UsagePeriod = getUsagePeriod(),
): Promise<UsageLimitCheckWithCredits> {
  const used = await getUsageUsed(admin, context, usageUnit, period);
  const creditRemaining = await getCreditPackRemaining(admin, context.employerId, usageUnit);
  return checkUsageWithCreditsPure(context.planId, usageUnit, used, creditRemaining, quantity);
}

export function usageLimitResponse(
  featureKey: UsageFeatureKey,
  usageUnit: UsageUnit,
  planId: PlanId,
  check: UsageLimitCheckWithCredits,
  corsHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify(
      buildUsageLimitReachedPayload(featureKey, usageUnit, planId, check, {
        buyMoreAvailable: check.buyMoreAvailable,
        creditRemaining: check.creditRemaining,
      }),
    ),
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function recordUsageWithCreditAccounting(
  admin: SupabaseClient,
  context: UsageContext,
  input: RecordUsageEventInput,
): Promise<void> {
  const quantity = input.quantity ?? 1;
  const period = getUsagePeriod();
  const used = await getUsageUsed(admin, context, input.usageUnit, period);
  const baseCheck = checkUsageAllowedPure(context.planId, input.usageUnit, used, quantity);
  let metadata = input.metadata ?? {};

  if (!baseCheck.allowed) {
    const creditPackId = await consumeUsageCreditPack(
      admin,
      context.employerId,
      context.userId,
      input.usageUnit,
      quantity,
    );
    metadata = {
      ...metadata,
      source: "credit_pack",
      creditPackId,
    };
  }

  await recordUsageEvent(admin, context, {
    ...input,
    metadata,
    quantity,
  });
}

export async function recordUsageEvent(
  admin: SupabaseClient,
  context: UsageContext,
  input: RecordUsageEventInput,
): Promise<void> {
  const payload = {
    user_id: context.userId,
    employer_id: context.employerId,
    plan_id: context.planId,
    feature_key: input.featureKey,
    usage_unit: input.usageUnit,
    quantity: input.quantity ?? 1,
    source: input.source ?? "edge",
    request_id: input.requestId ?? null,
    metadata: input.metadata ?? {},
  };

  const { error } = await admin.from("usage_events").insert(payload);

  if (error) {
    if (error.code === "23505" && input.requestId) {
      return;
    }
    console.error("[usage] insert failed", error);
    throw new Error("Could not record usage event.");
  }
}

export interface ConsumeUsageInput extends RecordUsageEventInput {
  quantity?: number;
}

export interface ConsumeUsageResult {
  context: UsageContext;
  check: UsageLimitCheckResult;
  recorded: boolean;
}

/** Check limit then record one usage event when allowed. */
export async function consumeUsage(
  admin: SupabaseClient,
  userId: string,
  input: ConsumeUsageInput,
): Promise<
  | { ok: true; result: ConsumeUsageResult }
  | { ok: false; context: UsageContext; check: UsageLimitCheckResult }
> {
  const context = await resolveUsageContext(admin, userId);
  const quantity = input.quantity ?? 1;
  const check = await checkUsageAllowed(admin, context, input.usageUnit, quantity);

  if (!check.allowed) {
    return { ok: false, context, check };
  }

  await recordUsageWithCreditAccounting(admin, context, input);
  return { ok: true, result: { context, check, recorded: true } };
}

/** Preflight helper: resolve context + check without recording. */
export async function preflightUsage(
  admin: SupabaseClient,
  userId: string,
  usageUnit: UsageUnit,
  quantity = 1,
): Promise<{ context: UsageContext; check: UsageLimitCheckResult }> {
  const context = await resolveUsageContext(admin, userId);
  const check = await checkUsageAllowed(admin, context, usageUnit, quantity);
  return { context, check };
}

export function createServiceRoleClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing Supabase service role configuration.");
  }
  return createClient(url, key);
}
