import { supabase } from '../lib/supabase';
import type { Weather, ForecastDay } from '../types';

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

export type WeatherServiceErrorCode = 'unauthorized' | 'config';

export class WeatherServiceError extends Error {
  readonly code: WeatherServiceErrorCode;
  readonly status?: number;

  constructor(message: string, code: WeatherServiceErrorCode, status?: number) {
    super(message);
    this.name = 'WeatherServiceError';
    this.code = code;
    this.status = status;
  }
}

function getFunctionsBaseUrl(): string {
  const configured = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/$/, '');
  }
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) {
    throw new WeatherServiceError(
      'Missing VITE_SUPABASE_URL for weather requests.',
      'config',
    );
  }
  return `${base.replace(/\/$/, '')}/functions/v1`;
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new WeatherServiceError(
      'User must be authenticated to load weather forecast.',
      'unauthorized',
      401,
    );
  }
  return token;
}

async function fetchWeather<T>(body: ForecastRequest): Promise<T | null> {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('Missing VITE_SUPABASE_ANON_KEY');
    throw new WeatherServiceError('Weather service not configured.', 'config');
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (error) {
    if (error instanceof WeatherServiceError) throw error;
    throw new WeatherServiceError(
      'User must be authenticated to load weather forecast.',
      'unauthorized',
      401,
    );
  }

  const fnBase = getFunctionsBaseUrl();

  try {
    const res = await fetch(`${fnBase}/getWeatherForecast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Weather function error:', res.status, errText);
      if (res.status === 401) {
        throw new WeatherServiceError(
          'User must be authenticated to load weather forecast.',
          'unauthorized',
          401,
        );
      }
      return null;
    }

    return res.json();
  } catch (error) {
    if (error instanceof WeatherServiceError) throw error;
    console.error('Error fetching weather data:', error);
    return null;
  }
}

export async function getWeatherByLocation(
  latitude: number,
  longitude: number,
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

export async function getWeatherByQuery(query: string): Promise<ExtendedWeatherData | null> {
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
  days: number = 7,
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
  days: number = 7,
): Promise<ExtendedForecastResult | null> {
  return fetchWeather<ExtendedForecastResult>({
    query,
    days,
    mode: 'forecast',
  });
}
