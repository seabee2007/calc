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
  parseUSCityState,
  type GeocodedPoint,
} from "../_shared/mapboxGeocode.ts";
import { getDrivingRouteMiles } from "../_shared/mapboxDirections.ts";

const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");

const TOP_CANDIDATE_COUNT = 5;

const SEARCH_TERMS = [
  "ready mix concrete",
  "ready-mix concrete",
  "concrete batch plant",
  "concrete supplier",
  "concrete plant",
  "redi-mix",
  "readymix",
];

const PLANT_KEYWORDS = [
  "ready mix",
  "ready-mix",
  "readymix",
  "redi-mix",
  "redi mix",
  "batch plant",
  "concrete plant",
  "concrete supplier",
  "concrete",
  "batch",
  "cement",
  "aggregate",
  "mixer",
  "hawaiian rock",
  "smithbridge",
  "hanson",
  "surroca",
  "nexlevel",
  "greenhill",
  "schwarz",
  "ozinga",
  "cemex",
  "lafarge",
  "vulcan",
  "metro ready mix",
  "razorback concrete",
  "capital ready mix",
];

/** Reject POIs that are clearly not ready-mix / batch plants. */
const EXCLUDED_KEYWORDS = [
  "home security",
  "security system",
  "security service",
  "safestreets",
  "adt ",
  " simplisafe",
  "alarm",
  "restaurant",
  "hotel",
  "motel",
  "bank",
  "insurance",
  "law firm",
  "attorney",
  "church",
  "school",
  "hospital",
  "clinic",
  "gas station",
  "grocery",
  "walmart",
  "target",
  "auto repair",
  "car wash",
  "salon",
  "barber",
  "fitness",
  "gym",
  "self storage",
  "storage unit",
  "real estate",
  "furniture store",
  "roofing",
  "plumbing",
  "hvac",
  "electrician",
  "landscap",
  "nursery",
  "pet ",
  "veterinar",
  "dental",
  "medical",
  "pharmacy",
  "coffee",
  "pizza",
  "taco",
  "burger",
  "hardware store",
  "hardware",
  "home depot",
  "lowes",
  "menards",
  "general contractor",
  "contractors",
  "concrete finisher",
  "concrete finishers",
  "pumping company",
  "pump service",
];

const STRONG_PLANT_SIGNALS = [
  "ready mix",
  "ready-mix",
  "readymix",
  "redi-mix",
  "redi mix",
  "batch plant",
  "concrete plant",
  "concrete supplier",
  "mix concrete",
];

const WEAK_CONCRETE_EXCLUDES = [
  "concrete contractor",
  "concrete cutting",
  "decorative concrete",
  "concrete pumping",
  "concrete finishing",
  "stamped concrete",
  "concrete repair",
  "concrete restoration",
];

/** Curated ready-mix plants by US state — geocoded when Mapbox POI search is sparse. */
const US_KNOWN_BATCH_PLANTS: Record<
  string,
  Array<{ name: string; address: string }>
> = {
  OK: [
    {
      name: "SurRoca Redi-Mix (Tulsa)",
      address: "8908 West 81st Street, Tulsa, OK 74131, United States",
    },
    {
      name: "SurRoca Redi-Mix (Tulsa Whirlpool)",
      address: "7044 Whirlpool Drive, Tulsa, OK 74117, United States",
    },
    {
      name: "NexLevel Redi-Mix",
      address: "10819 S 257th E Ave, Broken Arrow, OK 74014, United States",
    },
  ],
  AR: [
    {
      name: "Metro Ready Mix (Little Rock)",
      address: "1200 East Roosevelt Road, Little Rock, AR 72206, United States",
    },
    {
      name: "Capital Ready Mix",
      address: "8000 Scott Hamilton Drive, Little Rock, AR 72209, United States",
    },
    {
      name: "Razorback Concrete (North Little Rock)",
      address: "3800 Lynch Drive, North Little Rock, AR 72117, United States",
    },
  ],
};

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
  /** Driving distance plant → jobsite when Directions API succeeds. */
  distanceMiles: number;
  /** Straight-line miles (fallback / reference). */
  straightLineMiles?: number;
  /** Estimated drive time when Directions API succeeds. */
  driveMinutes?: number;
  confidence: "high" | "medium" | "low";
  source: string;
}

const CONFIDENCE_RANK: Record<BatchPlantResult["confidence"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function candidateHaystack(candidate: SearchCandidate): string {
  return `${candidate.name} ${candidate.address} ${candidate.poiCategories.join(" ")}`
    .toLowerCase();
}

function isExcludedPlantCandidate(candidate: SearchCandidate): boolean {
  const hay = candidateHaystack(candidate);
  return EXCLUDED_KEYWORDS.some((kw) => hay.includes(kw));
}

function isLikelyBatchPlant(candidate: SearchCandidate): boolean {
  if (
    candidate.searchTerm.startsWith("curated-") ||
    candidate.searchTerm === "guam-curated"
  ) {
    return true;
  }

  if (isExcludedPlantCandidate(candidate)) return false;

  const hay = candidateHaystack(candidate);

  if (WEAK_CONCRETE_EXCLUDES.some((kw) => hay.includes(kw))) return false;

  if (STRONG_PLANT_SIGNALS.some((kw) => hay.includes(kw))) return true;

  const plantCategories = [
    "ready-mix",
    "ready mix",
    "concrete",
    "building materials",
    "supplier",
    "cement",
  ];
  if (
    candidate.poiCategories.some((cat) =>
      plantCategories.some((p) => cat.toLowerCase().includes(p))
    )
  ) {
    return true;
  }

  // Brand / keyword match — require a concrete-industry term, not generic words alone
  const brandHit = PLANT_KEYWORDS.some((kw) => hay.includes(kw));
  if (!brandHit) return false;

  // Single weak tokens like "mixer" or "batch" alone are not enough
  const hasStrongAdjacent =
    hay.includes("concrete") ||
    hay.includes("cement") ||
    hay.includes("ready") ||
    hay.includes("redi") ||
    hay.includes("mix") ||
    hay.includes("plant") ||
    hay.includes("aggregate");

  return hasStrongAdjacent;
}

function filterLikelyBatchPlants(
  candidates: SearchCandidate[],
): SearchCandidate[] {
  return candidates.filter(isLikelyBatchPlant);
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

function featureCoordinates(
  feature: Record<string, unknown>,
): { lat: number; lng: number } | null {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const nested = props.coordinates as
    | { latitude?: number; longitude?: number }
    | undefined;
  if (
    typeof nested?.latitude === "number" &&
    typeof nested?.longitude === "number"
  ) {
    return { lat: nested.latitude, lng: nested.longitude };
  }

  const geometry = feature.geometry as { coordinates?: [number, number] } | undefined;
  const coords = geometry?.coordinates;
  if (!coords) return null;
  const [lng, lat] = coords;
  return { lat, lng };
}

function mapSearchBoxFeatures(
  features: Record<string, unknown>[],
  origin: GeocodedPoint,
  query: string,
): SearchCandidate[] {
  return features
    .map((feature: Record<string, unknown>, index: number) => {
      const point = featureCoordinates(feature);
      if (!point) return null;

      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const { lat, lng } = point;
      const name = String(props.name ?? props.full_address ?? "Unknown plant");
      const address = formatAddress(props, name);
      const distanceMiles = haversineMiles(origin.lat, origin.lng, lat, lng);

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

async function fetchSearchBox(
  origin: GeocodedPoint,
  query: string,
  options?: { types?: string; limit?: number },
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({
    q: query,
    proximity: `${origin.lng},${origin.lat}`,
    limit: String(options?.limit ?? 10),
    country: "US",
    access_token: MAPBOX_TOKEN!,
  });

  if (options?.types) params.set("types", options.types);

  if (isGuamLocation(origin)) {
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
  return Array.isArray(data.features) ? data.features : [];
}

async function searchNearbyPlants(
  origin: GeocodedPoint,
  query: string,
): Promise<SearchCandidate[]> {
  const [poiFeatures, broadFeatures] = await Promise.all([
    fetchSearchBox(origin, query, { types: "poi", limit: 10 }),
    fetchSearchBox(origin, query, { limit: 8 }),
  ]);

  const merged = [...poiFeatures, ...broadFeatures];
  return filterLikelyBatchPlants(mapSearchBoxFeatures(merged, origin, query));
}

/** Geocoding API — finds businesses Mapbox may omit from POI-only search. */
async function searchGeocodeBusinesses(
  origin: GeocodedPoint,
  query: string,
): Promise<SearchCandidate[]> {
  const params = new URLSearchParams({
    q: query,
    proximity: `${origin.lng},${origin.lat}`,
    limit: "8",
    country: "US",
    access_token: MAPBOX_TOKEN!,
  });

  const res = await fetch(
    `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
  );
  if (!res.ok) return [];

  const data = await res.json();
  const features = Array.isArray(data.features) ? data.features : [];

  return filterLikelyBatchPlants(
    features
      .map((feature: Record<string, unknown>, index: number) => {
        const geometry = feature.geometry as { coordinates?: [number, number] } | undefined;
        const coords = geometry?.coordinates;
        if (!coords) return null;

        const props = (feature.properties ?? {}) as Record<string, unknown>;
        const [lng, lat] = coords;
        const name = String(props.name ?? props.full_address ?? "Unknown");
        const address = formatAddress(props, name);

        return {
          id: String(props.mapbox_id ?? `geocode-${query}-${index}`),
          name,
          address,
          latitude: lat,
          longitude: lng,
          distanceMiles: Number(
            haversineMiles(origin.lat, origin.lng, lat, lng).toFixed(2),
          ),
          poiCategories: ["geocode-business"],
          searchTerm: `geocode:${query}`,
        } satisfies SearchCandidate;
      })
      .filter((candidate: SearchCandidate | null): candidate is SearchCandidate =>
        candidate !== null
      ),
  );
}

function buildRegionalSearchQueries(projectLocation: string): string[] {
  const { city, state } = parseUSCityState(projectLocation);
  if (!city && !state) return [];

  const queries: string[] = [];
  const cityState = [city, state].filter(Boolean).join(" ");
  if (cityState) {
    queries.push(`ready mix concrete ${cityState}`);
    queries.push(`concrete plant ${cityState}`);
    queries.push(`redi-mix ${cityState}`);
  }
  if (city) {
    queries.push(`ready mix ${city}`);
    queries.push(`${city} concrete supplier`);
  }
  return queries;
}

async function resolveCuratedRegionalPlants(
  origin: GeocodedPoint,
  projectLocation: string,
): Promise<SearchCandidate[]> {
  if (isGuamLocation(origin)) return [];

  const { state } = parseUSCityState(projectLocation);
  const plants = state ? US_KNOWN_BATCH_PLANTS[state] : undefined;
  if (!plants?.length) return [];

  const candidates: SearchCandidate[] = [];

  for (const plant of plants) {
    try {
      const point = await geocodeAddressSmart(plant.address, MAPBOX_TOKEN!, {
        proximity: [origin.lng, origin.lat],
      });
      candidates.push({
        id: `curated-${state}-${plant.name}`,
        name: plant.name,
        address: point.placeName,
        latitude: point.lat,
        longitude: point.lng,
        distanceMiles: Number(
          haversineMiles(origin.lat, origin.lng, point.lat, point.lng).toFixed(2),
        ),
        poiCategories: ["ready-mix", "curated"],
        searchTerm: `curated-${state}`,
      });
    } catch (err) {
      console.warn("Curated regional plant geocode failed:", plant.name, err);
    }
  }

  return candidates;
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
      const point = await geocodeAddressSmart(plant.address, MAPBOX_TOKEN, {
        proximity: [origin.lng, origin.lat],
      });
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
  if (candidate.searchTerm.startsWith("curated-")) score += 10;
  if (candidate.searchTerm.startsWith("geocode:")) score += 3;

  return score;
}

function confidenceFromScore(score: number): BatchPlantResult["confidence"] {
  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}

/** Deterministic ranking: drive time → drive distance → plant confidence score. */
function compareBatchPlantsByRanking(
  a: BatchPlantResult,
  b: BatchPlantResult,
): number {
  const aTime = a.driveMinutes ?? Number.MAX_SAFE_INTEGER;
  const bTime = b.driveMinutes ?? Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;

  if (a.distanceMiles !== b.distanceMiles) {
    return a.distanceMiles - b.distanceMiles;
  }

  return CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
}

function rankBatchPlantsByDriveTime(
  results: BatchPlantResult[],
): BatchPlantResult[] {
  const withRoute = results.filter(
    (r) => r.driveMinutes != null && r.driveMinutes > 0,
  );
  const pool = withRoute.length > 0 ? withRoute : results;

  if (withRoute.length > 0 && withRoute.length < results.length) {
    console.warn(
      `[find-batch-plant] ${results.length - withRoute.length} candidate(s) excluded from ranking — no driving route`,
      results
        .filter((r) => !r.driveMinutes || r.driveMinutes <= 0)
        .map((r) => r.plantName),
    );
  }

  return [...pool].sort(compareBatchPlantsByRanking);
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
    distanceMiles: 0,
    straightLineMiles: candidate.distanceMiles,
    confidence,
    source: "Mapbox",
  };
}

/** Re-geocode plant address so distance uses street-level coords, not coarse POI pins. */
async function refinePlantCoordinates(
  result: BatchPlantResult,
  origin: GeocodedPoint,
  originalCoords: { lat: number; lng: number },
): Promise<BatchPlantResult> {
  const geocodeQuery = result.formattedAddress
    .toLowerCase()
    .includes(result.plantName.toLowerCase())
    ? result.formattedAddress
    : `${result.plantName}, ${result.formattedAddress}`;

  try {
    const point = await geocodeAddressSmart(geocodeQuery, MAPBOX_TOKEN!, {
      proximity: [origin.lng, origin.lat],
    });
    const shiftMiles = haversineMiles(
      originalCoords.lat,
      originalCoords.lng,
      point.lat,
      point.lng,
    );
    if (shiftMiles > 5) {
      console.warn(
        `[find-batch-plant] re-geocode moved "${result.plantName}" ${shiftMiles.toFixed(1)} mi; keeping search coordinates`,
        { from: originalCoords, to: { lat: point.lat, lng: point.lng } },
      );
      return result;
    }
    return {
      ...result,
      latitude: point.lat,
      longitude: point.lng,
      formattedAddress: point.placeName,
    };
  } catch {
    return result;
  }
}

const DIRECTIONS_CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

async function enrichAllCandidatesWithDriving(
  origin: GeocodedPoint,
  candidates: SearchCandidate[],
): Promise<BatchPlantResult[]> {
  return mapWithConcurrency(candidates, DIRECTIONS_CONCURRENCY, async (candidate) => {
    const originalCoords = {
      lat: candidate.latitude,
      lng: candidate.longitude,
    };
    let result = toBatchPlantResult(
      candidate,
      confidenceFromScore(scoreCandidate(candidate)),
    );
    result = await refinePlantCoordinates(result, origin, originalCoords);
    result = await enrichWithDrivingDistance(origin, result);
    return result;
  });
}

async function enrichWithDrivingDistance(
  origin: GeocodedPoint,
  result: BatchPlantResult,
): Promise<BatchPlantResult> {
  const straightLineMiles = haversineMiles(
    origin.lat,
    origin.lng,
    result.latitude,
    result.longitude,
  );

  let driving = await getDrivingRouteMiles(
    { lat: result.latitude, lng: result.longitude },
    origin,
    MAPBOX_TOKEN!,
  );

  if (!driving) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    driving = await getDrivingRouteMiles(
      { lat: result.latitude, lng: result.longitude },
      origin,
      MAPBOX_TOKEN!,
    );
  }

  if (driving) {
    return {
      ...result,
      distanceMiles: driving.distanceMiles,
      straightLineMiles: Number(straightLineMiles.toFixed(2)),
      driveMinutes: driving.travelMinutes,
    };
  }

  console.warn(
    `[find-batch-plant] driving route failed for "${result.plantName}" — straight-line ${straightLineMiles.toFixed(1)} mi (not used for ranking when other routes exist)`,
    {
      plant: { lat: result.latitude, lng: result.longitude },
      jobsite: { lat: origin.lat, lng: origin.lng },
    },
  );

  return {
    ...result,
    straightLineMiles: Number(straightLineMiles.toFixed(2)),
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
    const regionalQueries = buildRegionalSearchQueries(projectLocation.trim());

    const searchResults = onGuam
      ? await Promise.all([
          resolveCuratedGuamPlants(origin),
          searchNamedGuamPlants(origin),
          ...SEARCH_TERMS.map((term) => searchNearbyPlants(origin, term)),
        ])
      : await Promise.all([
          resolveCuratedRegionalPlants(origin, projectLocation.trim()),
          ...SEARCH_TERMS.map((term) => searchNearbyPlants(origin, term)),
          ...regionalQueries.map((q) => searchNearbyPlants(origin, q)),
          ...regionalQueries.map((q) => searchGeocodeBusinesses(origin, q)),
          searchNamedGuamPlants(origin),
        ]);

    const candidates = filterCandidatesForOrigin(
      origin,
      dedupeCandidates(filterLikelyBatchPlants(searchResults.flat())),
    );

    console.log("[find-batch-plant] jobsite:", {
      address: origin.placeName,
      latitude: origin.lat,
      longitude: origin.lng,
      onGuam,
    });
    console.log("[find-batch-plant] filtered candidate count:", candidates.length);
    console.log(
      "[find-batch-plant] candidate names:",
      candidates.map((c) => c.name),
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

    const enriched = await enrichAllCandidatesWithDriving(origin, candidates);
    const ranked = rankBatchPlantsByDriveTime(enriched);
    const topCandidates = ranked.slice(0, TOP_CANDIDATE_COUNT);
    const selectedPlant = ranked[0];

    if (!selectedPlant) {
      return new Response(
        JSON.stringify({
          error: "No nearby batch plant found. Please enter the batch plant address manually.",
          code: "NOT_FOUND",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(
      "[find-batch-plant] drive times:",
      ranked.map((c) => ({
        name: c.plantName,
        driveMinutes: c.driveMinutes ?? null,
        distanceMiles: c.distanceMiles,
        confidence: c.confidence,
      })),
    );
    console.log("[find-batch-plant] selected winner:", {
      name: selectedPlant.plantName,
      driveMinutes: selectedPlant.driveMinutes ?? null,
      distanceMiles: selectedPlant.distanceMiles,
      confidence: selectedPlant.confidence,
    });

    const jobsite = {
      formattedAddress: origin.placeName,
      latitude: origin.lat,
      longitude: origin.lng,
    };

    return new Response(
      JSON.stringify({
        ...selectedPlant,
        selectedPlant,
        candidates: topCandidates,
        jobsite,
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
