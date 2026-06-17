/**
 * Credit-aware usage checks — keep in sync with src/lib/usageCredits.ts
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  checkUsageAllowedPure,
  type PlanId,
  type UsageLimitCheckResult,
  type UsageUnit,
} from "./usageLimits.ts";
import { canPurchaseCreditPacks } from "./usageCreditPacks.ts";

export interface UsageLimitCheckWithCredits extends UsageLimitCheckResult {
  creditRemaining: number;
  totalRemaining: number;
  buyMoreAvailable: boolean;
}

export function checkUsageWithCreditsPure(
  planId: PlanId,
  usageUnit: UsageUnit,
  used: number,
  creditRemaining: number,
  quantity = 1,
): UsageLimitCheckWithCredits {
  const base = checkUsageAllowedPure(planId, usageUnit, used, quantity);
  const neededFromCredits = Math.max(0, quantity - base.remaining);
  const allowed = base.allowed || creditRemaining >= neededFromCredits;
  const totalRemaining = base.remaining + creditRemaining;

  return {
    ...base,
    allowed,
    creditRemaining,
    totalRemaining,
    buyMoreAvailable: canPurchaseCreditPacks(planId),
  };
}

export async function getCreditPackRemaining(
  admin: SupabaseClient,
  employerId: string,
  usageUnit: UsageUnit,
): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("usage_credit_packs")
    .select("quantity_remaining")
    .eq("employer_id", employerId)
    .eq("usage_unit", usageUnit)
    .eq("status", "active")
    .gt("expires_at", now)
    .gt("quantity_remaining", 0);

  if (error) {
    console.error("[usage] credit pack read failed", error);
    throw new Error("Could not read usage credit balances.");
  }

  return (data ?? []).reduce((sum, row) => {
    const quantity = Number(row.quantity_remaining ?? 0);
    return sum + (Number.isFinite(quantity) ? quantity : 0);
  }, 0);
}

export async function getCreditPackExpiresAt(
  admin: SupabaseClient,
  employerId: string,
  usageUnit: UsageUnit,
): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("usage_credit_packs")
    .select("expires_at")
    .eq("employer_id", employerId)
    .eq("usage_unit", usageUnit)
    .eq("status", "active")
    .gt("expires_at", now)
    .gt("quantity_remaining", 0)
    .order("expires_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[usage] credit pack expiry read failed", error);
    return null;
  }

  return data?.expires_at ? String(data.expires_at) : null;
}

export async function consumeUsageCreditPack(
  admin: SupabaseClient,
  employerId: string,
  userId: string,
  usageUnit: UsageUnit,
  quantity: number,
): Promise<string> {
  const { data, error } = await admin.rpc("consume_usage_credit_pack", {
    p_employer_id: employerId,
    p_user_id: userId,
    p_usage_unit: usageUnit,
    p_quantity: quantity,
  });

  if (error) {
    console.error("[usage] credit pack consume failed", error);
    throw new Error("Could not consume usage credits.");
  }

  if (typeof data !== "string" || !data) {
    throw new Error("Credit pack consumption returned no pack id.");
  }

  return data;
}
