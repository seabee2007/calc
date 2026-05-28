import type { GeocodedPoint } from "./mapboxGeocode.ts";

export interface DrivingRouteSummary {
  distanceMiles: number;
  travelMinutes: number;
}

/** Driving distance via Mapbox Directions (plant → jobsite). */
export async function getDrivingRouteMiles(
  plant: { lat: number; lng: number },
  jobsite: GeocodedPoint,
  token: string,
): Promise<DrivingRouteSummary | null> {
  const coords = `${plant.lng},${plant.lat};${jobsite.lng},${jobsite.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}` +
    `?alternatives=false&overview=false&access_token=${token}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("Directions API error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route?.distance || !route?.duration) return null;

    return {
      distanceMiles: Number((route.distance / 1609.344).toFixed(2)),
      travelMinutes: Math.round(route.duration / 60),
    };
  } catch (err) {
    console.warn("getDrivingRouteMiles failed:", err);
    return null;
  }
}
