import type { GeocodedPoint } from "./mapboxGeocode.ts";

export interface DrivingRouteSummary {
  distanceMiles: number;
  travelMinutes: number;
}

const DIRECTIONS_PROFILES = ["mapbox/driving-traffic", "mapbox/driving"] as const;

async function fetchDrivingRoute(
  plant: { lat: number; lng: number },
  jobsite: GeocodedPoint,
  token: string,
  profile: (typeof DIRECTIONS_PROFILES)[number],
): Promise<DrivingRouteSummary | null> {
  const coords = `${plant.lng},${plant.lat};${jobsite.lng},${jobsite.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/${profile}/${coords}` +
    `?alternatives=false&overview=false&access_token=${token}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text();
    console.warn(`Directions API error (${profile}):`, res.status, errText.slice(0, 200));
    return null;
  }

  const data = await res.json();
  const route = data.routes?.[0];
  if (!route?.distance || !route?.duration) {
    console.warn(`Directions API returned no route (${profile}):`, {
      plant,
      jobsite: { lat: jobsite.lat, lng: jobsite.lng },
      code: data.code,
      message: data.message,
    });
    return null;
  }

  return {
    distanceMiles: Number((route.distance / 1609.344).toFixed(2)),
    travelMinutes: Math.round(route.duration / 60),
  };
}

/** Driving distance via Mapbox Directions (plant → jobsite). */
export async function getDrivingRouteMiles(
  plant: { lat: number; lng: number },
  jobsite: GeocodedPoint,
  token: string,
): Promise<DrivingRouteSummary | null> {
  try {
    for (const profile of DIRECTIONS_PROFILES) {
      const route = await fetchDrivingRoute(plant, jobsite, token, profile);
      if (route) return route;
    }

    console.warn("getDrivingRouteMiles: all profiles failed", {
      plant,
      jobsite: { lat: jobsite.lat, lng: jobsite.lng },
    });
    return null;
  } catch (err) {
    console.warn("getDrivingRouteMiles failed:", err);
    return null;
  }
}
