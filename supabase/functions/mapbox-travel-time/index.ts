import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { geocodeAddressSmart } from "../_shared/mapboxGeocode.ts";
import { getDrivingRouteMiles } from "../_shared/mapboxDirections.ts";

const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");

interface GeocodedPoint {
  lng: number;
  lat: number;
  placeName: string;
}

async function geocode(address: string): Promise<GeocodedPoint> {
  return geocodeAddressSmart(address, MAPBOX_TOKEN!);
}

async function getRouteWithGeometry(
  origin: GeocodedPoint,
  destination: GeocodedPoint,
) {
  const profiles = ["mapbox/driving-traffic", "mapbox/driving"] as const;

  for (const profile of profiles) {
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url =
      `https://api.mapbox.com/directions/v5/${profile}/${coords}` +
      `?alternatives=false&geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn("Mapbox directions error:", profile, res.status, await res.text());
      continue;
    }

    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) continue;

    return {
      distanceMeters: route.distance as number,
      distanceMiles: (route.distance as number) / 1609.344,
      durationSeconds: route.duration as number,
      travelMinutes: Math.round((route.duration as number) / 60),
      geometry: route.geometry,
    };
  }

  throw new Error("Could not calculate route.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!MAPBOX_TOKEN) {
      return new Response(JSON.stringify({ error: "Missing Mapbox token." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const plantAddress = String(body.plantAddress ?? "").trim();
    const jobsiteAddress = String(body.jobsiteAddress ?? "").trim();

    if (!plantAddress || !jobsiteAddress) {
      return new Response(
        JSON.stringify({ error: "Plant address and jobsite address are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    async function resolvePoint(
      address: string,
      lat?: number,
      lng?: number,
    ): Promise<GeocodedPoint> {
      if (
        typeof lat === "number" &&
        typeof lng === "number" &&
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        return { lat, lng, placeName: address };
      }
      return geocode(address);
    }

    const plant = await resolvePoint(
      plantAddress,
      body.plantLatitude,
      body.plantLongitude,
    );
    const jobsite = await resolvePoint(
      jobsiteAddress,
      body.jobsiteLatitude,
      body.jobsiteLongitude,
    );

    const routeSummary = await getDrivingRouteMiles(plant, jobsite, MAPBOX_TOKEN!);
    if (!routeSummary) {
      throw new Error("Could not calculate route.");
    }

    let routeGeometry: unknown;
    try {
      const detailed = await getRouteWithGeometry(plant, jobsite);
      routeGeometry = detailed.geometry;
    } catch {
      routeGeometry = undefined;
    }

    const avgSpeedMph =
      routeSummary.travelMinutes > 0
        ? Number(
          (routeSummary.distanceMiles / (routeSummary.travelMinutes / 60)).toFixed(1),
        )
        : 0;

    return new Response(
      JSON.stringify({
        plant,
        jobsite,
        distanceMiles: routeSummary.distanceMiles,
        travelMinutes: routeSummary.travelMinutes,
        avgSpeedMph,
        routeGeometry,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("mapbox-travel-time exception:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
