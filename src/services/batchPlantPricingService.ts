import type { ConcretePricing } from '../types';
import { mapPricingApiResponse } from '../utils/supplierPricing';
import { getMeteredAuthHeaders } from './meteredFunctionClient';
import { parseEdgeFunctionJson } from '../lib/usageMetering';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;

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
  if (!FN_BASE) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL');
  }

  const res = await fetch(`${FN_BASE}/batch-plant-pricing`, {
    method: 'POST',
    headers: await getMeteredAuthHeaders(),
    body: JSON.stringify({
      plantName: input.plantName.trim(),
      plantAddress: input.plantAddress.trim(),
      plantLatitude: input.plantLatitude,
      plantLongitude: input.plantLongitude,
      jobsiteAddress: input.jobsiteAddress?.trim(),
      regionalDefaults: input.regionalDefaults,
    }),
  });

  if (res.status === 404) {
    throw new Error('batch-plant-pricing function is not deployed');
  }

  const data = await parseEdgeFunctionJson<
    Parameters<typeof mapPricingApiResponse>[0] & { error?: string }
  >(res);

  if ('error' in data && data.error) {
    throw new Error(data.error);
  }

  return mapPricingApiResponse(data);
}
