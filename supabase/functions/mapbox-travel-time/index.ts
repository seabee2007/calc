import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { geocodeAddressSmart } from "../_shared/mapboxGeocode.ts";

const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");

interface GeocodedPoint {
  lng: number;
  lat: number;
  placeName: string;
}

async function geocode(address: string): Promise<GeocodedPoint> {
  return geocodeAddressSmart(address, MAPBOX_TOKEN!);
}

async function getRoute(
  origin: GeocodedPoint,
  destination: GeocodedPoint,
) {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}` +
    `?alternatives=false&geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text();
    console.error("Mapbox directions error:", res.status, errText);
    throw new Error("Could not calculate route.");
  }

  const data = await res.json();
  const route = data.routes?.[0];

  if (!route) {
    throw new Error("Could not calculate route.");
  }

  return {
    distanceMeters: route.distance as number,
    distanceMiles: (route.distance as number) / 1609.344,
    durationSeconds: route.duration as number,
    travelMinutes: Math.round((route.duration as number) / 60),
    geometry: route.geometry,
  };
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

    const { plantAddress, jobsiteAddress } = await req.json();

    if (!plantAddress || !jobsiteAddress) {
      return new Response(
        JSON.stringify({ error: "Plant address and jobsite address are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const plant = await geocode(String(plantAddress).trim());
    const jobsite = await geocode(String(jobsiteAddress).trim());
    const route = await getRoute(plant, jobsite);

    const avgSpeedMph =
      route.travelMinutes > 0
        ? Number((route.distanceMiles / (route.travelMinutes / 60)).toFixed(1))
        : 0;

    return new Response(
      JSON.stringify({
        plant,
        jobsite,
        distanceMiles: Number(route.distanceMiles.toFixed(2)),
        travelMinutes: route.travelMinutes,
        avgSpeedMph,
        routeGeometry: route.geometry,
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
