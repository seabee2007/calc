import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  detectRegionHint,
  geocodeAddressSmart,
  GUAM_BATCH_PLANT_QUERIES,
  GUAM_BBOX,
  GUAM_KNOWN_BATCH_PLANTS,
  isGuamLocation,
  isWithinBbox,
  type GeocodedPoint,
} from "../_shared/mapboxGeocode.ts";

const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const SEARCH_TERMS = [
  "ready mix concrete",
  "concrete batch plant",
  "concrete supplier",
  "concrete plant",
];

const PLANT_KEYWORDS = [
  "ready mix",
  "ready-mix",
  "readymix",
  "concrete",
  "batch",
  "cement",
  "aggregate",
  "mixer",
  "hawaiian rock",
  "smithbridge",
  "hanson",
];

interface SearchCandidate {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  poiCategories: string[];
  searchTerm: string;
}

interface BatchPlantResult {
  plantName: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  confidence: "high" | "medium" | "low";
  source: string;
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatAddress(props: Record<string, unknown>, fallback: string): string {
  const full = props.full_address ?? props.place_formatted ?? props.address;
  if (typeof full === "string" && full.trim()) return full.trim();

  const parts = [props.address, props.place, props.region, props.postcode]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => String(part).trim());

  if (parts.length > 0) return parts.join(", ");
  return fallback;
}

async function searchNearbyPlants(
  origin: GeocodedPoint,
  query: string,
): Promise<SearchCandidate[]> {
  const params = new URLSearchParams({
    q: query,
    proximity: `${origin.lng},${origin.lat}`,
    origin: `${origin.lng},${origin.lat}`,
    limit: "5",
    types: "poi",
    access_token: MAPBOX_TOKEN!,
  });

  if (isGuamLocation(origin)) {
    params.set("country", "US");
    params.set("bbox", GUAM_BBOX.join(","));
  }

  const url = `https://api.mapbox.com/search/searchbox/v1/forward?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text();
    console.error("Mapbox search error:", query, res.status, errText);
    return [];
  }

  const data = await res.json();
  const features = Array.isArray(data.features) ? data.features : [];

  return features
    .map((feature: Record<string, unknown>, index: number) => {
      const geometry = feature.geometry as { coordinates?: [number, number] } | undefined;
      const coords = geometry?.coordinates;
      if (!coords) return null;

      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const [lng, lat] = coords;
      const name = String(props.name ?? props.full_address ?? "Unknown plant");
      const address = formatAddress(props, name);
      const distanceMeters = typeof props.distance === "number" ? props.distance : null;
      const distanceMiles = distanceMeters != null
        ? distanceMeters / 1609.344
        : haversineMiles(origin.lat, origin.lng, lat, lng);

      const poiCategories = Array.isArray(props.poi_category)
        ? props.poi_category.map(String)
        : [];

      return {
        id: String(props.mapbox_id ?? `${query}-${index}-${lng}-${lat}`),
        name,
        address,
        latitude: lat,
        longitude: lng,
        distanceMiles: Number(distanceMiles.toFixed(2)),
        poiCategories,
        searchTerm: query,
      } satisfies SearchCandidate;
    })
    .filter((candidate: SearchCandidate | null): candidate is SearchCandidate =>
      candidate !== null
    );
}

async function searchNamedGuamPlants(origin: GeocodedPoint): Promise<SearchCandidate[]> {
  if (!isGuamLocation(origin)) return [];

  const results = await Promise.all(
    GUAM_BATCH_PLANT_QUERIES.map((query) => searchNearbyPlants(origin, query)),
  );
  return results.flat();
}

async function resolveCuratedGuamPlants(
  origin: GeocodedPoint,
): Promise<SearchCandidate[]> {
  if (!isGuamLocation(origin) || !MAPBOX_TOKEN) return [];

  const candidates: SearchCandidate[] = [];

  for (const plant of GUAM_KNOWN_BATCH_PLANTS) {
    if (plant.address === "Guam") continue;
    try {
      const point = await geocodeAddressSmart(plant.address, MAPBOX_TOKEN);
      if (!isWithinBbox(point.lng, point.lat, GUAM_BBOX)) continue;

      candidates.push({
        id: `curated-${plant.name}`,
        name: plant.name,
        address: point.placeName,
        latitude: point.lat,
        longitude: point.lng,
        distanceMiles: Number(
          haversineMiles(origin.lat, origin.lng, point.lat, point.lng).toFixed(2),
        ),
        poiCategories: ["ready-mix", "curated"],
        searchTerm: "guam-curated",
      });
    } catch (err) {
      console.warn("Curated Guam plant geocode failed:", plant.name, err);
    }
  }

  return candidates;
}

/** Drop mainland / wrong-ocean results when the jobsite is on Guam. */
function filterCandidatesForOrigin(
  origin: GeocodedPoint,
  candidates: SearchCandidate[],
): SearchCandidate[] {
  const onGuam = isGuamLocation(origin);

  return candidates.filter((c) => {
    if (onGuam) {
      return isWithinBbox(c.longitude, c.latitude, GUAM_BBOX);
    }
    const miles = haversineMiles(origin.lat, origin.lng, c.latitude, c.longitude);
    return miles <= 250;
  });
}

function dedupeCandidates(candidates: SearchCandidate[]): SearchCandidate[] {
  const seen = new Map<string, SearchCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.name.toLowerCase()}|${candidate.latitude.toFixed(4)}|${candidate.longitude.toFixed(4)}`;
    const existing = seen.get(key);
    if (!existing || candidate.distanceMiles < existing.distanceMiles) {
      seen.set(key, candidate);
    }
  }

  return [...seen.values()].sort((a, b) => a.distanceMiles - b.distanceMiles);
}

function scoreCandidate(candidate: SearchCandidate): number {
  const haystack = `${candidate.name} ${candidate.address} ${candidate.poiCategories.join(" ")}`
    .toLowerCase();
  let score = 0;

  for (const keyword of PLANT_KEYWORDS) {
    if (haystack.includes(keyword)) score += 2;
  }

  if (haystack.includes("ready mix") || haystack.includes("ready-mix")) score += 3;
  if (haystack.includes("batch plant")) score += 4;
  if (haystack.includes("hawaiian rock")) score += 6;
  if (haystack.includes("smithbridge")) score += 6;
  if (haystack.includes("hanson")) score += 4;
  if (haystack.includes("core tech")) score += 4;
  if (candidate.searchTerm === "guam-curated") score += 12;

  score -= candidate.distanceMiles * 0.15;
  return score;
}

function pickBestCandidateFallback(
  candidates: SearchCandidate[],
): SearchCandidate | null {
  if (candidates.length === 0) return null;

  const scored = [...candidates].sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
  return scored[0] ?? null;
}

function confidenceFromScore(score: number): BatchPlantResult["confidence"] {
  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}

async function rankWithOpenAI(
  projectLocation: string,
  candidates: SearchCandidate[],
): Promise<{
  candidate: SearchCandidate;
  confidence: BatchPlantResult["confidence"];
  plantName?: string;
  formattedAddress?: string;
} | null> {
  if (!OPENAI_API_KEY || candidates.length === 0) return null;

  const payload = {
    projectLocation,
    regionNote: projectLocation.toLowerCase().includes("guam") ||
        projectLocation.includes(", GU")
      ? "Jobsite is on Guam — reject any candidate outside Guam."
      : undefined,
    candidates: candidates.slice(0, 10).map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      address: candidate.address,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      distanceMiles: candidate.distanceMiles,
      poiCategories: candidate.poiCategories,
      searchTerm: candidate.searchTerm,
    })),
  };

  const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You select the most likely actual ready-mix concrete batch plant from Mapbox POI search results, " +
            "then format the best address for Mapbox routing. Only choose from the provided candidates — " +
            "never invent names or addresses. Prefer ready-mix plants, concrete suppliers, and batch plants. " +
            "On Guam, ONLY pick plants physically located on Guam (Hawaiian Rock Products, Smithbridge Guam, Hanson Cement, Core Tech). " +
            "Never select California or mainland US plants for a Guam jobsite. " +
            'Respond with JSON only: {"candidateId": string, "plantName": string, "formattedAddress": string, "confidence": "high"|"medium"|"low", "reason": string}.',
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    }),
  });

  if (!openAiRes.ok) {
    const errText = await openAiRes.text();
    console.error("OpenAI rank error:", openAiRes.status, errText);
    return null;
  }

  const data = await openAiRes.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as {
      candidateId?: string;
      plantName?: string;
      formattedAddress?: string;
      confidence?: BatchPlantResult["confidence"];
    };

    const candidate = candidates.find((item) => item.id === parsed.candidateId) ??
      candidates[0];
    if (!candidate) return null;

    return {
      candidate,
      confidence: parsed.confidence ?? "medium",
      plantName: parsed.plantName,
      formattedAddress: parsed.formattedAddress,
    };
  } catch (err) {
    console.error("OpenAI JSON parse error:", err);
    return null;
  }
}

function toBatchPlantResult(
  candidate: SearchCandidate,
  confidence: BatchPlantResult["confidence"],
  formattedAddress?: string,
  plantName?: string,
): BatchPlantResult {
  return {
    plantName: plantName?.trim() || candidate.name,
    formattedAddress: formattedAddress?.trim() || candidate.address,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    distanceMiles: candidate.distanceMiles,
    confidence,
    source: "Mapbox",
  };
}

async function resolveProjectOrigin(
  projectLocation: string,
  latitude?: number,
  longitude?: number,
): Promise<GeocodedPoint> {
  const hint = detectRegionHint(projectLocation);

  if (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    const point: GeocodedPoint = {
      lat: latitude,
      lng: longitude,
      placeName: projectLocation,
    };
    if (
      hint.bbox &&
      !isWithinBbox(point.lng, point.lat, hint.bbox)
    ) {
      console.warn(
        "Jobsite coordinates outside expected region; re-geocoding:",
        projectLocation,
      );
      return geocodeAddressSmart(projectLocation, MAPBOX_TOKEN!);
    }
    return point;
  }

  return geocodeAddressSmart(projectLocation, MAPBOX_TOKEN!);
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

    const { projectLocation, latitude, longitude } = await req.json();
    if (!projectLocation || typeof projectLocation !== "string" || !projectLocation.trim()) {
      return new Response(
        JSON.stringify({ error: "projectLocation is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const origin = await resolveProjectOrigin(
      projectLocation.trim(),
      latitude,
      longitude,
    );

    const onGuam = isGuamLocation(origin);

    const searchResults = onGuam
      ? await Promise.all([
          resolveCuratedGuamPlants(origin),
          searchNamedGuamPlants(origin),
          ...SEARCH_TERMS.map((term) => searchNearbyPlants(origin, term)),
        ])
      : await Promise.all([
          ...SEARCH_TERMS.map((term) => searchNearbyPlants(origin, term)),
          searchNamedGuamPlants(origin),
        ]);

    const candidates = filterCandidatesForOrigin(
      origin,
      dedupeCandidates(searchResults.flat()),
    );

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No nearby batch plant found. Please enter the batch plant address manually.",
          code: "NOT_FOUND",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ranked = await rankWithOpenAI(projectLocation.trim(), candidates);
    let result: BatchPlantResult;

    if (ranked) {
      result = toBatchPlantResult(
        ranked.candidate,
        ranked.confidence,
        ranked.formattedAddress,
        ranked.plantName,
      );
    } else {
      const best = pickBestCandidateFallback(candidates);
      if (!best) {
        return new Response(
          JSON.stringify({
            error: "No nearby batch plant found. Please enter the batch plant address manually.",
            code: "NOT_FOUND",
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      result = toBatchPlantResult(
        best,
        confidenceFromScore(scoreCandidate(best)),
      );
    }

    return new Response(
      JSON.stringify({
        ...result,
        jobsite: {
          formattedAddress: origin.placeName,
          latitude: origin.lat,
          longitude: origin.lng,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("find-batch-plant exception:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
