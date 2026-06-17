/**
 * Stripe Checkout + webhook helpers for one-time usage credit packs.
 * Keep in sync with supabase/functions/_shared/usageCreditPackCheckout.ts
 */
import type { UsageUnit } from './usageLimits';
import type { UsageCreditPackId, UsageCreditPackUnitAllocation } from './usageCreditPacks';
import { getUsageCreditPack, isUsageCreditPackId } from './usageCreditPacks';

export interface UsageCreditPackCheckoutMetadata {
  type: 'usage_credit_pack';
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
    type: 'usage_credit_pack',
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
    return parsed
      .filter(
        (entry): entry is UsageCreditPackUnitAllocation =>
          entry &&
          typeof entry === 'object' &&
          typeof entry.usageUnit === 'string' &&
          Number.isFinite(Number(entry.quantity)),
      )
      .map((entry) => ({
        usageUnit: entry.usageUnit as UsageUnit,
        quantity: Number(entry.quantity),
      }));
  } catch {
    return [];
  }
}

export function buildCreditPackInsertRows(input: {
  sessionId: string;
  paymentIntentId: string | null;
  customerId: string | null;
  metadata: UsageCreditPackCheckoutMetadata;
  units: UsageCreditPackUnitAllocation[];
}): Array<Record<string, unknown>> {
  return input.units.map((unit) => ({
    user_id: input.metadata.user_id,
    employer_id: input.metadata.employer_id,
    stripe_checkout_session_id: input.sessionId,
    stripe_payment_intent_id: input.paymentIntentId,
    stripe_customer_id: input.customerId,
    usage_unit: unit.usageUnit,
    quantity_purchased: unit.quantity,
    quantity_remaining: unit.quantity,
    status: 'active',
    expires_at: input.metadata.expires_at,
    metadata: {
      pack_id: input.metadata.pack_id,
      source: 'stripe_checkout',
    },
  }));
}

export function resolveCreditPackUnitsFromCheckoutMetadata(
  metadata: Record<string, string | undefined>,
): UsageCreditPackUnitAllocation[] {
  const packId = metadata.pack_id;
  if (!isUsageCreditPackId(packId)) return [];
  const pack = getUsageCreditPack(packId);
  const units = parsePackUnitsFromMetadata(metadata.pack_units);
  return units.length > 0 ? units : pack.units;
}

export function creditPackLabel(packId: UsageCreditPackId): string {
  return getUsageCreditPack(packId).label;
}
