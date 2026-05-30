export interface GeocodedPoint {
  lng: number;
  lat: number;
  placeName: string;
}

export interface RegionHint {
  normalizedQuery: string;
  country?: string;
  proximity?: [number, number];
  bbox?: [number, number, number, number];
  regionLabel?: string;
}

interface MapboxFeature {
  geometry: { coordinates: [number, number] };
  properties?: Record<string, unknown>;
}

export const GUAM_BBOX: [number, number, number, number] = [
  144.619, 13.234, 145.009, 13.654,
];
const GUAM_PROXIMITY: [number, number] = [144.7937, 13.4443];

/** Territory / state hint without relying on ZIP or the word "Guam" in the string. */
const GU_STATE_PATTERN =
  /(?:^|[,\s])(?:GU|G\.U\.)(?:\s*,|\s+\d{5}|\s*,|\s+|$)/i;

const GUAM_ZIP_PATTERN = /\b969(?:1\d|2\d|3[0-2])\b/;

const US_TERRITORY_PATTERNS: Array<{
  test: RegExp;
  hint: RegionHint;
}> = [
  {
    test: GUAM_ZIP_PATTERN,
    hint: {
      normalizedQuery: "",
      country: "US",
      proximity: GUAM_PROXIMITY,
      bbox: GUAM_BBOX,
      regionLabel: "Guam",
    },
  },
  {
    test: /\bguam\b/i,
    hint: {
      normalizedQuery: "",
      country: "US",
      proximity: GUAM_PROXIMITY,
      bbox: GUAM_BBOX,
      regionLabel: "Guam",
    },
  },
  {
    test: GU_STATE_PATTERN,
    hint: {
      normalizedQuery: "",
      country: "US",
      proximity: GUAM_PROXIMITY,
      bbox: GUAM_BBOX,
      regionLabel: "Guam",
    },
  },
  {
    test: /\b9695[0-9]\b/,
    hint: {
      normalizedQuery: "",
      country: "US",
      proximity: [-64.7505, 17.735],
      bbox: [-65.085, 17.623, -64.565, 18.048],
      regionLabel: "US Virgin Islands",
    },
  },
  {
    test: /\b00[679]\d{2}\b/,
    hint: {
      normalizedQuery: "",
      country: "US",
      proximity: [-66.5901, 18.2208],
      bbox: [-67.271, 17.881, -65.242, 18.515],
      regionLabel: "Puerto Rico",
    },
  },
];

export function normalizeAddressQuery(address: string): string {
  let normalized = address.trim().replace(/\s+/g, " ");

  normalized = normalized.replace(/,\s*gu\b(?=[,\s]|$)/gi, ", Guam");
  normalized = normalized.replace(/\bgu\s+(969\d{2})\b/gi, "Guam $1");
  normalized = normalized.replace(/\b969(\d{2})\b(?![^\n,]*guam)/gi, (match) => {
    const zip = parseInt(match, 10);
    if (zip >= 96910 && zip <= 96932) {
      return `${match}`;
    }
    return match;
  });

  if (GUAM_ZIP_PATTERN.test(normalized) && !/\bguam\b/i.test(normalized)) {
    normalized = `${normalized.replace(/,\s*$/, "")}, Guam`;
  }

  return normalized;
}

/** Rough Oklahoma bounds — used to score geocodes, not hard-reject. */
export const OKLAHOMA_BBOX: [number, number, number, number] = [
  -103.0, 33.5, -94.4, 37.0,
];

const US_STATE_ABBR =
  /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i;

/** Parse ", City, ST" from a US mailing-style address. */
export function parseUSCityState(address: string): {
  city?: string;
  state?: string;
} {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 1; i--) {
    const stateMatch = parts[i].match(US_STATE_ABBR);
    if (stateMatch) {
      const state = stateMatch[1].toUpperCase();
      const city = parts[i - 1]?.trim();
      if (city && !US_STATE_ABBR.test(city)) {
        return { city, state };
      }
    }
  }
  return {};
}

const CITY_PROXIMITY: Record<string, [number, number]> = {
  "tulsa": [-95.9928, 36.154],
  "broken arrow": [-95.7897, 36.0526],
  "oklahoma city": [-97.5164, 35.4676],
  "norman": [-97.4395, 35.2226],
  "edmond": [-97.4783, 35.6528],
};

export function detectRegionHint(address: string): RegionHint {
  const normalizedQuery = normalizeAddressQuery(address);

  for (const pattern of US_TERRITORY_PATTERNS) {
    if (pattern.test.test(normalizedQuery) || pattern.test.test(address)) {
      return {
        ...pattern.hint,
        normalizedQuery,
      };
    }
  }

  const { city, state } = parseUSCityState(normalizedQuery);
  if (state === "OK" || /\boklahoma\b/i.test(normalizedQuery)) {
    const cityKey = city?.toLowerCase() ?? "";
    const proximity = CITY_PROXIMITY[cityKey] ?? [-97.5164, 35.4676];
    return {
      normalizedQuery,
      country: "US",
      proximity,
      regionLabel: "Oklahoma",
    };
  }

  if (city && state && state.length === 2) {
    return {
      normalizedQuery,
      country: "US",
      regionLabel: `${city}, ${state}`,
    };
  }

  return { normalizedQuery, country: "US" };
}

export function isWithinBbox(
  lng: number,
  lat: number,
  bbox: [number, number, number, number],
): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
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

function scoreFeature(
  feature: MapboxFeature,
  hint: RegionHint,
  queryIndex: number,
): number {
  const [lng, lat] = feature.geometry.coordinates;
  const props = feature.properties ?? {};
  let score = 100 - queryIndex * 10;

  const relevance = typeof props.relevance === "number" ? props.relevance : 0.5;
  score += relevance * 40;

  if (hint.bbox && isWithinBbox(lng, lat, hint.bbox)) {
    score += 80;
  } else if (hint.bbox) {
    score -= 120;
  }

  if (hint.proximity) {
    const [proxLng, proxLat] = hint.proximity;
    const distance = haversineMiles(proxLat, proxLng, lat, lng);
    score += Math.max(0, 50 - distance * 5);
  }

  const featureContext = JSON.stringify(props).toLowerCase();
  if (hint.regionLabel && featureContext.includes(hint.regionLabel.toLowerCase())) {
    score += 25;
  }

  const featureType = String(props.feature_type ?? "");
  if (featureType === "address" || featureType === "street") score += 15;
  if (featureType === "place" || featureType === "locality") score += 5;

  const queryHasStreetNumber = /\d/.test(hint.normalizedQuery || "");
  if (queryHasStreetNumber) {
    if (featureType === "address") score += 35;
    if (featureType === "street") score += 20;
    if (featureType === "place" || featureType === "region") score -= 25;
  }

  const queryText = (hint.normalizedQuery || "").toLowerCase();
  if (
    (queryText.includes(", ok") || queryText.includes("oklahoma")) &&
    hint.regionLabel === "Oklahoma"
  ) {
    if (isWithinBbox(lng, lat, OKLAHOMA_BBOX)) score += 70;
    else score -= 100;
  }

  if (queryText.includes("tulsa") && hint.regionLabel === "Oklahoma") {
    const tulsaDist = haversineMiles(36.154, -95.9928, lat, lng);
    score += Math.max(0, 40 - tulsaDist * 2);
  }

  return score;
}

function featureToPoint(feature: MapboxFeature, fallback: string): GeocodedPoint {
  const [lng, lat] = feature.geometry.coordinates;
  const props = feature.properties ?? {};
  return {
    lng,
    lat,
    placeName: String(props.full_address ?? props.name ?? fallback),
  };
}

async function fetchGeocodeCandidates(
  query: string,
  token: string,
  hint: RegionHint,
): Promise<MapboxFeature[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "5",
    access_token: token,
  });

  if (hint.country) params.set("country", hint.country);
  if (hint.proximity) params.set("proximity", hint.proximity.join(","));
  if (hint.bbox) params.set("bbox", hint.bbox.join(","));

  const res = await fetch(
    `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error("Mapbox geocode error:", res.status, errText);
    return [];
  }

  const data = await res.json();
  return Array.isArray(data.features) ? data.features : [];
}

export interface GeocodeOptions {
  /** Bias geocode results toward this lng,lat (e.g. jobsite). */
  proximity?: [number, number];
}

export async function geocodeAddressSmart(
  address: string,
  token: string,
  options?: GeocodeOptions,
): Promise<GeocodedPoint> {
  const trimmed = address.trim();
  const hint = detectRegionHint(trimmed);
  if (options?.proximity) {
    hint.proximity = options.proximity;
  }
  const queries = [...new Set([hint.normalizedQuery, trimmed].filter(Boolean))];

  let bestFeature: MapboxFeature | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
    const features = await fetchGeocodeCandidates(queries[queryIndex], token, hint);
    for (const feature of features) {
      const score = scoreFeature(feature, hint, queryIndex);
      if (score > bestScore) {
        bestScore = score;
        bestFeature = feature;
      }
    }
  }

  if (!bestFeature) {
    throw new Error(`Could not geocode address: ${address}`);
  }

  const [lng, lat] = bestFeature.geometry.coordinates;

  if (hint.bbox && !isWithinBbox(lng, lat, hint.bbox)) {
    throw new Error(
      `Could not verify address in ${hint.regionLabel ?? "the expected region"}. ` +
        `Try adding the city and territory (e.g. Santa Rita, GU 96915).`,
    );
  }

  return featureToPoint(bestFeature, hint.normalizedQuery);
}

export function isGuamLocation(point: GeocodedPoint): boolean {
  return isWithinBbox(point.lng, point.lat, GUAM_BBOX);
}

export const GUAM_BATCH_PLANT_QUERIES = [
  "Hawaiian Rock Products Mangilao Guam",
  "Hawaiian Rock Products Route 15 Mangilao Guam",
  "Hawaiian Rock Products Agat Guam",
  "Hawaiian Rock Products Fadian Guam",
  "Smithbridge Guam Yigo ready mix",
  "Smithbridge Guam Harmon Industrial Park",
  "Hanson Cement Guam Piti",
  "Core Tech International Guam concrete",
];

/** Curated ready-mix / batch plants on Guam — geocoded directly when POI search fails. */
export const GUAM_KNOWN_BATCH_PLANTS: Array<{ name: string; address: string }> = [
  {
    name: "Hawaiian Rock Products (Mangilao)",
    address: "1402 Route 15, Mangilao, GU 96913, United States",
  },
  {
    name: "Hawaiian Rock Products (Agat)",
    address: "Agat, GU 96928, United States",
  },
  {
    name: "Hawaiian Rock Products (Fadian)",
    address: "Fadian, GU 96918, United States",
  },
  {
    name: "Smithbridge Guam (Yigo)",
    address: "300 Chalan Padiron Haya, Route 15, Yigo, GU 96929, United States",
  },
  {
    name: "Smithbridge Guam (Harmon)",
    address: "136 Adrian Sanchez Street, Harmon Industrial Park, GU 96913, United States",
  },
  {
    name: "Hanson Cement Guam (Piti)",
    address: "Piti, GU 96915, United States",
  },
  {
    name: "Core Tech International",
    address: "Guam",
  },
];
