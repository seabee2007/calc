const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface MapboxGeocodedPoint {
  lng: number;
  lat: number;
  placeName: string;
}

export interface MapboxTravelTimeResult {
  plant: MapboxGeocodedPoint;
  jobsite: MapboxGeocodedPoint;
  distanceMiles: number;
  travelMinutes: number;
  avgSpeedMph: number;
  routeGeometry?: GeoJSON.LineString;
}

export interface MapboxTravelTimeError {
  error: string;
}

export async function getMapboxTravelTime(
  plantAddress: string,
  jobsiteAddress: string,
): Promise<MapboxTravelTimeResult> {
  if (!FN_BASE || !ANON_KEY) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL or VITE_SUPABASE_ANON_KEY');
  }

  const plant = plantAddress.trim();
  const jobsite = jobsiteAddress.trim();

  if (!plant || !jobsite) {
    throw new Error('Batch plant and jobsite addresses are required.');
  }

  const res = await fetch(`${FN_BASE}/mapbox-travel-time`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ plantAddress: plant, jobsiteAddress: jobsite }),
  });

  const data = (await res.json()) as MapboxTravelTimeResult | MapboxTravelTimeError;

  if (!res.ok) {
    const message =
      'error' in data && data.error
        ? data.error
        : `Travel time request failed (${res.status})`;
    throw new Error(message);
  }

  if ('error' in data && data.error) {
    throw new Error(data.error);
  }

  return data as MapboxTravelTimeResult;
}
