import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { consumeUsageCreditPack } from "./usageCredits.ts";
import { checkUsageAllowedPure, getUsagePeriod } from "./usageLimits.ts";
import {
  getUsageUsed,
  preflightUsage,
  recordUsageEvent,
  usageLimitResponse,
  type UsageContext,
  type UsageFeatureKey,
  type UsageUnit,
} from "./usage.ts";

let adminClient: ReturnType<typeof createClient> | null = null;

function getAdminClient(): ReturnType<typeof createClient> {
  if (!adminClient) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      throw new Error("Missing Supabase service role configuration.");
    }
    adminClient = createClient(url, key);
  }
  return adminClient;
}

export async function requireUsageQuota(
  userId: string,
  featureKey: UsageFeatureKey,
  usageUnit: UsageUnit,
  corsHeaders: Record<string, string>,
  quantity = 1,
): Promise<
  | { ok: true; context: UsageContext }
  | { ok: false; response: Response }
> {
  const admin = getAdminClient();
  const { context, check } = await preflightUsage(admin, userId, usageUnit, quantity);
  if (!check.allowed) {
    return {
      ok: false,
      response: usageLimitResponse(featureKey, usageUnit, context.planId, check, corsHeaders),
    };
  }
  return { ok: true, context };
}

export async function trackMeteredUsage(
  context: UsageContext,
  input: {
    featureKey: UsageFeatureKey;
    usageUnit: UsageUnit;
    requestId?: string | null;
    metadata?: Record<string, unknown>;
    quantity?: number;
    source?: string;
  },
): Promise<void> {
  const admin = getAdminClient();
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

export function requestIdFrom(req: Request, suffix?: string): string | undefined {
  const header = req.headers.get("x-request-id")?.trim();
  if (header) return header;
  if (suffix) return `${suffix}-${crypto.randomUUID()}`;
  return undefined;
}

export function usageConfigErrorResponse(
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: "Usage metering not configured." }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function isUsageConfigured(): boolean {
  return Boolean(Deno.env.get("SUPABASE_URL") && Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
}
