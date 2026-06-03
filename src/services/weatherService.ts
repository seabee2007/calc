import type { Weather, ForecastDay } from '../types';

const FN_BASE = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface ExtendedWeatherData extends Weather {
  alerts?: {
    title: string;
    severity: string;
    description: string;
    effective: string;
    expires: string;
  }[];
  historical?: {
    date: string;
    avgTemp: number;
    totalPrecip: number;
    maxWind: number;
  }[];
}

interface ForecastRequest {
  latitude?: number;
  longitude?: number;
  query?: string;
  days?: number;
  includeHistory?: boolean;
  includeAlerts?: boolean;
  mode?: 'full' | 'forecast';
}

export interface ForecastLocation {
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface ExtendedForecastResult {
  location: ForecastLocation;
  forecast: (ForecastDay & { avgHumidity?: number })[];
}

async function fetchWeather<T>(body: ForecastRequest): Promise<T | null> {
  if (!FN_BASE || !ANON_KEY) {
    console.error('Missing VITE_SUPABASE_FUNCTIONS_URL or VITE_SUPABASE_ANON_KEY');
    return null;
  }

  try {
    const res = await fetch(`${FN_BASE}/getWeatherForecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Weather function error:', res.status, errText);
      return null;
    }

    return res.json();
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
}

export async function getWeatherByLocation(
  latitude: number,
  longitude: number
): Promise<ExtendedWeatherData | null> {
  return fetchWeather<ExtendedWeatherData>({
    latitude,
    longitude,
    days: 3,
    includeHistory: true,
    includeAlerts: true,
    mode: 'full',
  });
}

export async function getWeatherByQuery(
  query: string
): Promise<ExtendedWeatherData | null> {
  return fetchWeather<ExtendedWeatherData>({
    query: query.trim(),
    days: 3,
    includeHistory: true,
    includeAlerts: true,
    mode: 'full',
  });
}

export async function getExtendedForecast(
  latitude: number,
  longitude: number,
  days: number = 7
): Promise<ExtendedForecastResult | null> {
  return fetchWeather<ExtendedForecastResult>({
    latitude,
    longitude,
    days,
    mode: 'forecast',
  });
}

export async function getForecastByQuery(
  query: string,
  days: number = 7
): Promise<ExtendedForecastResult | null> {
  return fetchWeather<ExtendedForecastResult>({
    query,
    days,
    mode: 'forecast',
  });
}
