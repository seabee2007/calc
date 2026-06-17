/**
 * Usage credit pack catalog — keep in sync with src/lib/usageCreditPacks.ts
 */
import type { UsageUnit } from "./usageLimits.ts";

export type UsageCreditPackId = "ai_100" | "weather_map_500" | "email_500";

export interface UsageCreditPackUnitAllocation {
  usageUnit: UsageUnit;
  quantity: number;
}

export interface UsageCreditPackDefinition {
  packId: UsageCreditPackId;
  label: string;
  stripeLookupKey: string;
  units: UsageCreditPackUnitAllocation[];
}

export const USAGE_CREDIT_PACK_LOOKUP_KEYS = {
  ai_request_pack_100: "arden_ai_request_pack_100",
  weather_map_pack_500: "arden_weather_map_pack_500",
  email_send_pack_500: "arden_email_send_pack_500",
} as const;

/** Weather/map pack splits 500 pooled credits evenly across four metered units. */
export const USAGE_CREDIT_PACKS: Record<UsageCreditPackId, UsageCreditPackDefinition> = {
  ai_100: {
    packId: "ai_100",
    label: "AI Credit Pack (100)",
    stripeLookupKey: USAGE_CREDIT_PACK_LOOKUP_KEYS.ai_request_pack_100,
    units: [{ usageUnit: "ai_request", quantity: 100 }],
  },
  weather_map_500: {
    packId: "weather_map_500",
    label: "Weather / Map Credit Pack (500)",
    stripeLookupKey: USAGE_CREDIT_PACK_LOOKUP_KEYS.weather_map_pack_500,
    units: [
      { usageUnit: "weather_request", quantity: 125 },
      { usageUnit: "geocode_request", quantity: 125 },
      { usageUnit: "travel_request", quantity: 125 },
      { usageUnit: "place_search", quantity: 125 },
    ],
  },
  email_500: {
    packId: "email_500",
    label: "Email Credit Pack (500)",
    stripeLookupKey: USAGE_CREDIT_PACK_LOOKUP_KEYS.email_send_pack_500,
    units: [{ usageUnit: "email_send", quantity: 500 }],
  },
};

const PACK_IDS = new Set<string>(Object.keys(USAGE_CREDIT_PACKS));

export function isUsageCreditPackId(value: unknown): value is UsageCreditPackId {
  return typeof value === "string" && PACK_IDS.has(value);
}

export function getUsageCreditPack(packId: UsageCreditPackId): UsageCreditPackDefinition {
  return USAGE_CREDIT_PACKS[packId];
}

export function creditPackIdForUsageUnit(usageUnit: UsageUnit): UsageCreditPackId | null {
  if (usageUnit === "ai_request") return "ai_100";
  if (
    usageUnit === "weather_request" ||
    usageUnit === "geocode_request" ||
    usageUnit === "travel_request" ||
    usageUnit === "place_search"
  ) {
    return "weather_map_500";
  }
  if (usageUnit === "email_send") return "email_500";
  return null;
}

export function canPurchaseCreditPacks(planId: string): boolean {
  return planId !== "free";
}
