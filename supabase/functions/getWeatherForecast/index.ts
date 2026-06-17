import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";
import {
  isUsageConfigured,
  requireUsageQuota,
  trackMeteredUsage,
  usageConfigErrorResponse,
} from "../_shared/meterUsage.ts";
import {
  createServiceRoleClient,
  resolveUsageContext,
  type UsageContext,
} from "../_shared/usage.ts";

const BASE_URL = "https://api.weatherapi.com/v1";

interface ForecastRequest {
  latitude?: number;
  longitude?: number;
  query?: string;
  days?: number;
  includeHistory?: boolean;
  includeAlerts?: boolean;
  mode?: "full" | "forecast";
  projectId?: string;
  locationKey?: string;
  locationLabel?: string;
  forceRefresh?: boolean;
}

type ForecastPayload = Record<string, unknown> & {
  forecast?: unknown[];
};

function locationQuery(body: ForecastRequest): string | null {
  if (typeof body.query === "string" && body.query.trim()) {
    return body.query.trim();
  }
  if (
    typeof body.latitude === "number" &&
    typeof body.longitude === "number" &&
    Number.isFinite(body.latitude) &&
    Number.isFinite(body.longitude)
  ) {
    return `${body.latitude},${body.longitude}`;
  }
  return null;
}

function normalizeLocationKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildLocationKey(body: ForecastRequest, q: string): string {
  if (typeof body.locationKey === "string" && body.locationKey.trim()) {
    return normalizeLocationKey(body.locationKey);
  }
  if (typeof body.projectId === "string" && body.projectId.trim()) {
    return `project:${body.projectId.trim()}`;
  }
  if (
    typeof body.latitude === "number" &&
    typeof body.longitude === "number" &&
    Number.isFinite(body.latitude) &&
    Number.isFinite(body.longitude)
  ) {
    return `latlng:${body.latitude.toFixed(4)},${body.longitude.toFixed(4)}`;
  }
  return `query:${normalizeLocationKey(q)}`;
}

function withCacheMetadata(
  payload: ForecastPayload,
  cache: { fetched_at: string; expires_at: string },
  options: { cached: boolean; usageCharged: boolean; stale?: boolean; providerError?: boolean },
): ForecastPayload {
  return {
    ...payload,
    cached: options.cached,
    stale: options.stale ?? new Date(cache.expires_at).getTime() <= Date.now(),
    providerError: options.providerError ?? false,
    fetchedAt: cache.fetched_at,
    expiresAt: cache.expires_at,
    usageCharged: options.usageCharged,
  };
}

async function readCache(
  admin: ReturnType<typeof createServiceRoleClient>,
  context: UsageContext,
  locationKey: string,
): Promise<{
  forecast_json: ForecastPayload;
  fetched_at: string;
  expires_at: string;
} | null> {
  const { data, error } = await admin
    .from("weather_forecast_cache")
    .select("forecast_json, fetched_at, expires_at")
    .eq("employer_id", context.employerId)
    .eq("user_id", context.userId)
    .eq("location_key", locationKey)
    .maybeSingle();

  if (error) {
    console.error("[weather-cache] read failed", error);
    return null;
  }
  return data as {
    forecast_json: ForecastPayload;
    fetched_at: string;
    expires_at: string;
  } | null;
}

async function upsertCache(
  admin: ReturnType<typeof createServiceRoleClient>,
  context: UsageContext,
  input: {
    projectId?: string;
    locationKey: string;
    locationLabel: string;
    latitude?: number | null;
    longitude?: number | null;
    address?: string | null;
    payload: ForecastPayload;
    fetchedAt: string;
    expiresAt: string;
  },
): Promise<void> {
  const row = {
    employer_id: context.employerId,
    user_id: context.userId,
    project_id: input.projectId ?? null,
    location_key: input.locationKey,
    location_label: input.locationLabel,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    address: input.address ?? null,
    forecast_json: input.payload,
    source: "weather_api",
    fetched_at: input.fetchedAt,
    expires_at: input.expiresAt,
  };

  const { data: updated, error: updateError } = await admin
    .from("weather_forecast_cache")
    .update(row)
    .eq("employer_id", context.employerId)
    .eq("user_id", context.userId)
    .eq("location_key", input.locationKey)
    .select("id");

  if (updateError) {
    console.error("[weather-cache] update failed", updateError);
  }

  if ((updated ?? []).length > 0) return;

  const { error: insertError } = await admin
    .from("weather_forecast_cache")
    .insert(row);

  if (insertError) {
    // If a concurrent request inserted the row first, update it.
    if (insertError.code === "23505") {
      const { error: retryError } = await admin
        .from("weather_forecast_cache")
        .update(row)
        .eq("employer_id", context.employerId)
        .eq("user_id", context.userId)
        .eq("location_key", input.locationKey);
      if (retryError) console.error("[weather-cache] retry update failed", retryError);
      return;
    }
    console.error("[weather-cache] insert failed", insertError);
  }
}

function parseLocalHour(timeStr: string): number {
  const part = String(timeStr).split(" ")[1];
  if (!part) return 0;
  return parseInt(part.split(":")[0], 10) || 0;
}

function mapForecastDay(day: Record<string, unknown>) {
  const dayData = day.day as Record<string, unknown>;
  const condition = dayData.condition as Record<string, unknown>;
  const rawHours = (day.hour as Record<string, unknown>[] | undefined) ?? [];

  const hourly = rawHours.map((h) => {
    const hourCondition = h.condition as Record<string, unknown> | undefined;
    return {
      hour: parseLocalHour(String(h.time ?? "")),
      temp: Number(h.temp_f) || 0,
      windSpeed: Number(h.wind_mph) || 0,
      humidity: Number(h.humidity) || 0,
      chanceOfRain: Number(h.chance_of_rain) || 0,
      conditions: String(hourCondition?.text ?? condition.text ?? ""),
    };
  });

  return {
    date: day.date,
    maxTemp: dayData.maxtemp_f,
    minTemp: dayData.mintemp_f,
    avgTemp: dayData.avgtemp_f,
    maxWindSpeed: dayData.maxwind_mph,
    chanceOfRain: dayData.daily_chance_of_rain,
    totalPrecipitation: dayData.totalprecip_in,
    conditions: condition.text,
    avgHumidity: dayData.avghumidity,
    hourly: hourly.length > 0 ? hourly : undefined,
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

  const authResult = await requireAuth(req, corsHeaders);
  if (!authResult.ok) return authResult.response;

  if (!isUsageConfigured()) {
    return usageConfigErrorResponse(corsHeaders);
  }

  const apiKey = Deno.env.get("WEATHER_API_KEY");
  if (!apiKey) {
    console.error("WEATHER_API_KEY is not configured");
    return new Response(JSON.stringify({ error: "Weather service not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: ForecastRequest = await req.json();
    const q = locationQuery(body);

    if (!q) {
      return new Response(
        JSON.stringify({ error: "Provide latitude/longitude or a query (city name)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createServiceRoleClient();
    const usageContext = await resolveUsageContext(admin, authResult.user.id);

    const maxForecastDays = Math.min(
      14,
      Math.max(1, parseInt(Deno.env.get("MAX_FORECAST_DAYS") ?? "5", 10) || 5),
    );
    const maxHistoryDays = Math.min(
      7,
      Math.max(1, parseInt(Deno.env.get("MAX_HISTORY_DAYS") ?? "7", 10) || 7),
    );
    const mode = body.mode === "forecast" ? "forecast" : "full";
    const days = Math.min(maxForecastDays, Math.max(1, body.days ?? (mode === "forecast" ? 5 : 3)));
    const includeAlerts = body.includeAlerts !== false;
    const includeHistory = body.includeHistory !== false && mode === "full";
    const locationKey = buildLocationKey(body, q);
    const locationLabel = body.locationLabel?.trim() || q;
    const cachedRow = await readCache(admin, usageContext, locationKey);

    if (body.forceRefresh !== true && cachedRow) {
      return new Response(
        JSON.stringify(
          withCacheMetadata(cachedRow.forecast_json, cachedRow, {
            cached: true,
            usageCharged: false,
          }),
        ),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const quota = await requireUsageQuota(
      authResult.user.id,
      "weather.forecast",
      "weather_request",
      corsHeaders,
    );
    if (!quota.ok) return quota.response;

    const alertsParam = includeAlerts ? "&alerts=yes" : "";
    const forecastUrl =
      `${BASE_URL}/forecast.json?key=${apiKey}&q=${encodeURIComponent(q)}&days=${days}&aqi=no${alertsParam}`;

    const forecastResponse = await fetch(forecastUrl);
    if (!forecastResponse.ok) {
      const errText = await forecastResponse.text();
      console.error("WeatherAPI forecast error:", errText);
      if (cachedRow) {
        return new Response(
          JSON.stringify(
            withCacheMetadata(cachedRow.forecast_json, cachedRow, {
              cached: true,
              stale: true,
              providerError: true,
              usageCharged: false,
            }),
          ),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "Weather API returned an error" }), {
        status: forecastResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const forecastData = await forecastResponse.json();
    const forecast = forecastData.forecast.forecastday.map(mapForecastDay);

    if (mode === "forecast") {
      const fetchedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
      const payload: ForecastPayload = {
        location: {
          city: forecastData.location.name,
          country: forecastData.location.country,
          latitude: forecastData.location.lat,
          longitude: forecastData.location.lon,
        },
        forecast,
      };
      await trackMeteredUsage(usageContext, {
        featureKey: "weather.forecast",
        usageUnit: "weather_request",
        requestId: req.headers.get("x-request-id"),
        metadata: { locationKey, cached: false },
      });
      await upsertCache(admin, usageContext, {
        projectId: body.projectId,
        locationKey,
        locationLabel,
        latitude: forecastData.location.lat,
        longitude: forecastData.location.lon,
        address: typeof body.query === "string" ? body.query.trim() : null,
        payload,
        fetchedAt,
        expiresAt,
      });
      return new Response(
        JSON.stringify(
          withCacheMetadata(payload, { fetched_at: fetchedAt, expires_at: expiresAt }, {
            cached: false,
            usageCharged: true,
            stale: false,
          }),
        ),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let historical: {
      date: string;
      avgTemp: number;
      totalPrecip: number;
      maxWind: number;
    }[] = [];

    if (includeHistory) {
      const today = new Date();
      for (let i = 1; i <= maxHistoryDays; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const historyUrl =
          `${BASE_URL}/history.json?key=${apiKey}&q=${encodeURIComponent(q)}&dt=${dateStr}`;

        const historyResponse = await fetch(historyUrl);
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          const day = historyData.forecast.forecastday[0].day;
          historical.push({
            date: dateStr,
            avgTemp: day.avgtemp_f,
            totalPrecip: day.totalprecip_in,
            maxWind: day.maxwind_mph,
          });
        }
      }
    }

    const alerts = forecastData.alerts?.alert?.map((alert: Record<string, string>) => ({
      title: alert.headline,
      severity: alert.severity,
      description: alert.desc,
      effective: alert.effective,
      expires: alert.expires,
    })) ?? [];

    const fetchedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const payload: ForecastPayload = {
      temperature: forecastData.current.temp_f,
      humidity: forecastData.current.humidity,
      conditions: forecastData.current.condition.text,
      windSpeed: forecastData.current.wind_mph,
      precipitation: forecastData.current.precip_in,
      location: {
        city: forecastData.location.name,
        country: forecastData.location.country,
      },
      forecast,
      alerts,
      historical,
    };

    await trackMeteredUsage(usageContext, {
      featureKey: "weather.forecast",
      usageUnit: "weather_request",
      requestId: req.headers.get("x-request-id"),
      metadata: { locationKey, cached: false },
    });
    await upsertCache(admin, usageContext, {
      projectId: body.projectId,
      locationKey,
      locationLabel,
      latitude: forecastData.location.lat,
      longitude: forecastData.location.lon,
      address: typeof body.query === "string" ? body.query.trim() : null,
      payload,
      fetchedAt,
      expiresAt,
    });

    return new Response(
      JSON.stringify(
        withCacheMetadata(payload, { fetched_at: fetchedAt, expires_at: expiresAt }, {
          cached: false,
          usageCharged: true,
          stale: false,
        }),
      ),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("getWeatherForecast exception:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
