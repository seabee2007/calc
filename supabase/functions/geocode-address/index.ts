import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { geocodeAddressSmart } from "../_shared/mapboxGeocode.ts";

const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");

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

    const { address } = await req.json();
    if (!address || typeof address !== "string" || !address.trim()) {
      return new Response(JSON.stringify({ error: "address is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const point = await geocodeAddressSmart(address.trim(), MAPBOX_TOKEN);

    return new Response(
      JSON.stringify({
        formattedAddress: point.placeName,
        latitude: point.lat,
        longitude: point.lng,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("geocode-address exception:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
