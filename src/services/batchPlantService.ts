import { getMeteredAuthHeaders } from './meteredFunctionClient';
import { parseEdgeFunctionJson } from '../lib/usageMetering';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;

export interface BatchPlantResult {
  plantName: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  /** Driving distance to jobsite (Directions API), or straight-line if routing unavailable. */
  distanceMiles: number;
  straightLineMiles?: number;
  driveMinutes?: number;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  jobsite?: {
    formattedAddress: string;
    latitude: number;
    longitude: number;
  };
  /** Nearest plant by drive time (same fields as top-level when present). */
  selectedPlant?: BatchPlantResult;
  /** Top candidates ranked by drive time (up to 5). */
  candidates?: BatchPlantResult[];
}

export interface FindBatchPlantOptions {
  latitude?: number;
  longitude?: number;
}

export interface BatchPlantError {
  error: string;
  code?: string;
}

export class BatchPlantNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BatchPlantNotFoundError';
  }
}

export async function findBatchPlant(
  projectLocation: string,
  options: FindBatchPlantOptions = {},
): Promise<BatchPlantResult> {
  if (!FN_BASE) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL');
  }

  const location = projectLocation.trim();
  if (!location) {
    throw new Error('Enter a jobsite address before searching for a batch plant.');
  }

  const res = await fetch(`${FN_BASE}/find-batch-plant`, {
    method: 'POST',
    headers: await getMeteredAuthHeaders(),
    body: JSON.stringify({
      projectLocation: location,
      latitude: options.latitude,
      longitude: options.longitude,
    }),
  });

  if (res.status === 404) {
    const data = (await res.json().catch(() => ({}))) as BatchPlantError;
    throw new BatchPlantNotFoundError(
      data.error
        ? `${data.error} You can enter a plant name and address manually below.`
        : 'No nearby batch plant found for this jobsite. Verify the jobsite is correct, then try again—or enter the batch plant address manually.',
    );
  }

  const data = await parseEdgeFunctionJson<BatchPlantResult & BatchPlantError>(res);

  if ('error' in data && data.error) {
    throw new Error(data.error);
  }

  return data as BatchPlantResult;
}
