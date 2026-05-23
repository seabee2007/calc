import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const BASE_URL = "https://api.weatherapi.com/v1";

interface ForecastRequest {
  latitude?: number;
  longitude?: number;
  query?: string;
  days?: number;
  includeHistory?: boolean;
  includeAlerts?: boolean;
  mode?: "full" | "forecast";
}

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

    const alertsParam = includeAlerts ? "&alerts=yes" : "";
    const forecastUrl =
      `${BASE_URL}/forecast.json?key=${apiKey}&q=${encodeURIComponent(q)}&days=${days}&aqi=no${alertsParam}`;

    const forecastResponse = await fetch(forecastUrl);
    if (!forecastResponse.ok) {
      const errText = await forecastResponse.text();
      console.error("WeatherAPI forecast error:", errText);
      return new Response(JSON.stringify({ error: "Weather API returned an error" }), {
        status: forecastResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const forecastData = await forecastResponse.json();
    const forecast = forecastData.forecast.forecastday.map(mapForecastDay);

    if (mode === "forecast") {
      return new Response(
        JSON.stringify({
          location: {
            city: forecastData.location.name,
            country: forecastData.location.country,
            latitude: forecastData.location.lat,
            longitude: forecastData.location.lon,
          },
          forecast,
        }),
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

    return new Response(
      JSON.stringify({
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
      }),
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
