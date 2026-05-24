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
  address: string,
): Promise<GeocodedAddressResult> {
  if (!FN_BASE || !ANON_KEY) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL or VITE_SUPABASE_ANON_KEY');
  }

  const trimmed = address.trim();
  if (!trimmed) {
    throw new Error('Enter a street address, city, and ZIP code.');
  }

  const res = await fetch(`${FN_BASE}/geocode-address`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({ address: trimmed }),
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
