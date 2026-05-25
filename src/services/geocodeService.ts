import {
  formatUSAddress,
  validateUSAddress,
  type USAddress,
} from '../types/address';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface GeocodedAddressResult {
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

export interface GeocodedAddressError {
  error: string;
}

function supabaseHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  };
}

export async function verifyJobsiteAddress(
  addressOrParts: string | USAddress,
): Promise<GeocodedAddressResult> {
  if (!FN_BASE || !ANON_KEY) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL or VITE_SUPABASE_ANON_KEY');
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
    headers: supabaseHeaders(),
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as GeocodedAddressResult | GeocodedAddressError;

  if (!res.ok) {
    const message =
      'error' in data && data.error
        ? data.error
        : `Address verification failed (${res.status})`;
    throw new Error(message);
  }

  if ('error' in data && data.error) {
    throw new Error(data.error);
  }

  return data as GeocodedAddressResult;
}
