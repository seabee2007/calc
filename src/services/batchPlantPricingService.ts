import type { ConcretePricing } from '../types';
import { mapPricingApiResponse } from '../utils/supplierPricing';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface BatchPlantPricingLookupInput {
  plantName: string;
  plantAddress: string;
  plantLatitude?: number;
  plantLongitude?: number;
  jobsiteAddress?: string;
  regionalDefaults?: {
    basePrice: number;
    psiPriceAdjustments: Record<string, number>;
    baseDeliveryFee: number;
    minimumOrder: number;
    smallLoadFee: number;
    distanceFeePerMile: number;
    baseDistanceMiles: number;
    saturdayDeliveryFee: number;
    afterHoursFee: number;
    pumpTruckFee: number;
    regionLabel?: string;
  };
}

export interface BatchPlantPricingLookupResult {
  usedAiPricing: boolean;
  pricing: ConcretePricing;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  source: 'ai_estimate' | 'regional_default';
}

export async function lookupBatchPlantPricing(
  input: BatchPlantPricingLookupInput,
): Promise<BatchPlantPricingLookupResult> {
  if (!FN_BASE || !ANON_KEY) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL or VITE_SUPABASE_ANON_KEY');
  }

  const res = await fetch(`${FN_BASE}/batch-plant-pricing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      plantName: input.plantName.trim(),
      plantAddress: input.plantAddress.trim(),
      plantLatitude: input.plantLatitude,
      plantLongitude: input.plantLongitude,
      jobsiteAddress: input.jobsiteAddress?.trim(),
      regionalDefaults: input.regionalDefaults,
    }),
  });

  const data = (await res.json()) as Parameters<typeof mapPricingApiResponse>[0] & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error ?? `Pricing lookup failed (${res.status})`);
  }

  if ('error' in data && data.error) {
    throw new Error(data.error);
  }

  return mapPricingApiResponse(data);
}
