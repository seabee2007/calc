import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { geocodeAddressSmart } from "../_shared/mapboxGeocode.ts";
import { formatUSAddress, validateUSAddressParts } from "../_shared/usAddress.ts";

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

    const body = await req.json();
    let query = "";

    if (body?.address && typeof body.address === "string" && body.address.trim()) {
      query = body.address.trim();
    } else if (body?.addressParts && typeof body.addressParts === "object") {
      const parts = body.addressParts as Record<string, string>;
      const validationError = validateUSAddressParts({
        street: parts.street,
        city: parts.city,
        state: parts.state,
        zip: parts.zip,
      });
      if (validationError) {
        return new Response(JSON.stringify({ error: validationError }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      query = formatUSAddress({
        street: parts.street,
        street2: parts.street2,
        city: parts.city,
        state: parts.state,
        zip: parts.zip,
      });
    } else {
      return new Response(
        JSON.stringify({
          error: "Provide address (string) or addressParts (street, city, state, zip).",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const point = await geocodeAddressSmart(query, MAPBOX_TOKEN);

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
