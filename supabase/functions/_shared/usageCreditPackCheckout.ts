/**
 * Stripe Checkout + webhook helpers for one-time usage credit packs.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import {
  getUsageCreditPack,
  isUsageCreditPackId,
  type UsageCreditPackUnitAllocation,
} from "./usageCreditPacks.ts";

export interface UsageCreditPackCheckoutMetadata {
  type: "usage_credit_pack";
  pack_id: string;
  user_id: string;
  employer_id: string;
  expires_at: string;
  pack_units: string;
}

export function buildUsageCreditPackCheckoutMetadata(input: {
  packId: string;
  userId: string;
  employerId: string;
  expiresAt: string;
  units: UsageCreditPackUnitAllocation[];
}): UsageCreditPackCheckoutMetadata {
  return {
    type: "usage_credit_pack",
    pack_id: input.packId,
    user_id: input.userId,
    employer_id: input.employerId,
    expires_at: input.expiresAt,
    pack_units: JSON.stringify(input.units),
  };
}

export function parsePackUnitsFromMetadata(
  raw: string | null | undefined,
): UsageCreditPackUnitAllocation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is UsageCreditPackUnitAllocation =>
        entry &&
        typeof entry === "object" &&
        typeof entry.usageUnit === "string" &&
        Number.isFinite(Number(entry.quantity)),
    ).map((entry) => ({
      usageUnit: entry.usageUnit,
      quantity: Number(entry.quantity),
    }));
  } catch {
    return [];
  }
}

export function buildCreditPackInsertRows(input: {
  session: Stripe.Checkout.Session;
  metadata: UsageCreditPackCheckoutMetadata;
  units: UsageCreditPackUnitAllocation[];
}): Array<Record<string, unknown>> {
  const paymentIntentId = typeof input.session.payment_intent === "string"
    ? input.session.payment_intent
    : input.session.payment_intent?.id ?? null;
  const customerId = typeof input.session.customer === "string"
    ? input.session.customer
    : input.session.customer?.id ?? null;

  return input.units.map((unit) => ({
    user_id: input.metadata.user_id,
    employer_id: input.metadata.employer_id,
    stripe_checkout_session_id: input.session.id,
    stripe_payment_intent_id: paymentIntentId,
    stripe_customer_id: customerId,
    usage_unit: unit.usageUnit,
    quantity_purchased: unit.quantity,
    quantity_remaining: unit.quantity,
    status: "active",
    expires_at: input.metadata.expires_at,
    metadata: {
      pack_id: input.metadata.pack_id,
      source: "stripe_checkout",
    },
  }));
}

export async function insertUsageCreditPacksFromCheckout(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const metadata = session.metadata ?? {};
  if (metadata.type !== "usage_credit_pack") {
    throw new Error("Not a usage credit pack checkout session.");
  }

  const packId = metadata.pack_id;
  if (!isUsageCreditPackId(packId)) {
    throw new Error(`Invalid usage credit pack id: ${String(packId)}`);
  }

  const pack = getUsageCreditPack(packId);
  const units = parsePackUnitsFromMetadata(metadata.pack_units);
  const resolvedUnits = units.length > 0 ? units : pack.units;

  const checkoutMetadata: UsageCreditPackCheckoutMetadata = {
    type: "usage_credit_pack",
    pack_id: packId,
    user_id: String(metadata.user_id ?? session.client_reference_id ?? ""),
    employer_id: String(metadata.employer_id ?? metadata.user_id ?? ""),
    expires_at: String(metadata.expires_at),
    pack_units: metadata.pack_units ?? JSON.stringify(resolvedUnits),
  };

  if (!checkoutMetadata.user_id || !checkoutMetadata.employer_id || !checkoutMetadata.expires_at) {
    throw new Error("Usage credit pack checkout metadata incomplete.");
  }

  const rows = buildCreditPackInsertRows({
    session,
    metadata: checkoutMetadata,
    units: resolvedUnits,
  });

  const { error } = await admin.from("usage_credit_packs").insert(rows);
  if (error) {
    if (error.code === "23505") {
      console.log("[usage-credit-pack] checkout already processed", { sessionId: session.id });
      return;
    }
    throw error;
  }
}
