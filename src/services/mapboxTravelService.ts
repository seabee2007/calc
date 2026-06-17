import { getMeteredAuthHeaders } from './meteredFunctionClient';
import { parseEdgeFunctionJson } from '../lib/usageMetering';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;

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

export interface MapboxTravelCoords {
  latitude?: number;
  longitude?: number;
}

export async function getMapboxTravelTime(
  plantAddress: string,
  jobsiteAddress: string,
  options?: {
    plant?: MapboxTravelCoords;
    jobsite?: MapboxTravelCoords;
  },
): Promise<MapboxTravelTimeResult> {
  if (!FN_BASE) {
    throw new Error('Missing VITE_SUPABASE_FUNCTIONS_URL');
  }

  const plant = plantAddress.trim();
  const jobsite = jobsiteAddress.trim();

  if (!plant || !jobsite) {
    throw new Error('Batch plant and jobsite addresses are required.');
  }

  const res = await fetch(`${FN_BASE}/mapbox-travel-time`, {
    method: 'POST',
    headers: await getMeteredAuthHeaders(),
    body: JSON.stringify({
      plantAddress: plant,
      jobsiteAddress: jobsite,
      plantLatitude: options?.plant?.latitude,
      plantLongitude: options?.plant?.longitude,
      jobsiteLatitude: options?.jobsite?.latitude,
      jobsiteLongitude: options?.jobsite?.longitude,
    }),
  });

  const data = await parseEdgeFunctionJson<MapboxTravelTimeResult & MapboxTravelTimeError>(res);

  if ('error' in data && data.error) {
    throw new Error(data.error);
  }

  return data as MapboxTravelTimeResult;
}
