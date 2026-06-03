/** Legacy weather / forecast types (moved from former src/types.ts). */

export interface ForecastHour {
  /** Local hour 0–23 */
  hour: number;
  temp: number;
  windSpeed: number;
  humidity: number;
  chanceOfRain: number;
  conditions: string;
}

export interface ForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  avgTemp: number;
  maxWindSpeed: number;
  chanceOfRain: number;
  totalPrecipitation: number;
  conditions: string;
  avgHumidity?: number;
  /** Hourly breakdown when available from the forecast API */
  hourly?: ForecastHour[];
}

export interface Weather {
  temperature: number;
  humidity: number;
  conditions: string;
  windSpeed: number;
  precipitation: number;
  location: {
    city: string;
    country: string;
  };
  forecast: ForecastDay[];
}
