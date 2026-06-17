import {
  copyUSAddress,
  formatUSAddress,
  mergeVerifiedJobsiteAddress,
  validateUSAddress,
  type USAddress,
} from '../types/address';
import { getMeteredAuthHeaders } from './meteredFunctionClient';
import { parseEdgeFunctionJson } from '../lib/usageMetering';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;

export interface GeocodedAddressResult {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  /** Normalized fields after merging Mapbox result with user input */
  addressParts?: USAddress;
}

export interface GeocodedAddressError {
  error: string;
}

function supabaseHeaders(): Promise<HeadersInit> {
  return getMeteredAuthHeaders();
}

export async function verifyJobsiteAddress(
  addressOrParts: string | USAddress,
): Promise<GeocodedAddressResult> {
  if (!FN_BASE) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL');
  }

  let body: { address?: string; addressParts?: USAddress };

  if (typeof addressOrParts === 'string') {
    const trimmed = addressOrParts.trim();
    if (!trimmed) {
      throw new Error('Enter street, city, state, and ZIP code.');
    }
    body = { address: trimmed };
  } else {
    const validation = validateUSAddress(addressOrParts, {
      requireStreet: true,
      requireZip: false,
    });
    if (!validation.ok) {
      throw new Error(validation.errors[0]);
    }
    const formatted = formatUSAddress(addressOrParts);
    if (!formatted) {
      throw new Error('Enter street, city, state/territory, and ZIP code.');
    }
    // Always send formatted `address` for Mapbox (works with older edge deployments too).
    body = {
      address: formatted,
      addressParts: {
        street: addressOrParts.street,
        street2: addressOrParts.street2,
        city: addressOrParts.city,
        state: addressOrParts.state,
        zip: addressOrParts.zip,
        country: addressOrParts.country,
      },
    };
  }

  const res = await fetch(`${FN_BASE}/geocode-address`, {
    method: 'POST',
    headers: await supabaseHeaders(),
    body: JSON.stringify(body),
  });

  const data = await parseEdgeFunctionJson<GeocodedAddressResult & GeocodedAddressError>(res);

  if ('error' in data && data.error) {
    throw new Error(data.error);
  }

  const result = data as GeocodedAddressResult;

  if (typeof addressOrParts !== 'string') {
    const merged = mergeVerifiedJobsiteAddress(
      copyUSAddress(addressOrParts),
      result.formattedAddress,
    );
    return {
      ...result,
      addressParts: merged,
      formattedAddress: formatUSAddress(merged),
    };
  }

  return result;
}
