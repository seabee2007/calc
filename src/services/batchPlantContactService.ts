import { getMeteredAuthHeaders } from './meteredFunctionClient';
import { parseEdgeFunctionJson } from '../lib/usageMetering';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;

export interface BatchPlantContactLookup {
  phone: string | null;
  email: string | null;
  dispatchContact: string | null;
  website: string | null;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  source: 'ai_public_directory';
}

export interface BatchPlantContactLookupInput {
  plantName: string;
  plantAddress: string;
  latitude?: number;
  longitude?: number;
}

export async function lookupBatchPlantContact(
  input: BatchPlantContactLookupInput,
): Promise<BatchPlantContactLookup> {
  if (!FN_BASE) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL');
  }

  const plantName = input.plantName.trim();
  const plantAddress = input.plantAddress.trim();
  if (!plantName && !plantAddress) {
    throw new Error('Batch plant name or address is required for contact lookup.');
  }

  const res = await fetch(`${FN_BASE}/batch-plant-contact`, {
    method: 'POST',
    headers: await getMeteredAuthHeaders(),
    body: JSON.stringify({
      plantName,
      plantAddress,
      latitude: input.latitude,
      longitude: input.longitude,
    }),
  });

  const data = await parseEdgeFunctionJson<BatchPlantContactLookup & { error?: string; code?: string }>(
    res,
  );

  if ('error' in data && data.error) {
    throw new Error(data.error);
  }

  return data as BatchPlantContactLookup;
}
