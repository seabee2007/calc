import axios from 'axios';
import { Weather, ForecastDay } from '../types';

const WEATHER_API_KEY = 'bb3eea884660409387992012252205';
const BASE_URL = 'https://api.weatherapi.com/v1';

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

export async function getWeatherByLocation(
  latitude: number,
  longitude: number
): Promise<ExtendedWeatherData | null> {
  try {
    // Get current weather and forecast
    const forecastUrl = `${BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${latitude},${longitude}&days=3&aqi=no&alerts=yes`;
    const forecastResponse = await axios.get(forecastUrl);

    // Get historical data for the past 3 days
    const today = new Date();
    const historicalData = [];
    
    for (let i = 1; i <= 3; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const historyUrl = `${BASE_URL}/history.json?key=${WEATHER_API_KEY}&q=${latitude},${longitude}&dt=${dateStr}`;
      const historyResponse = await axios.get(historyUrl);
      
      historicalData.push({
        date: dateStr,
        avgTemp: historyResponse.data.forecast.forecastday[0].day.avgtemp_f,
        totalPrecip: historyResponse.data.forecast.forecastday[0].day.totalprecip_in,
        maxWind: historyResponse.data.forecast.forecastday[0].day.maxwind_mph
      });
    }

    const forecast: ForecastDay[] = forecastResponse.data.forecast.forecastday.map((day: any) => ({
      date: day.date,
      maxTemp: day.day.maxtemp_f,
      minTemp: day.day.mintemp_f,
      avgTemp: day.day.avgtemp_f,
      maxWindSpeed: day.day.maxwind_mph,
      chanceOfRain: day.day.daily_chance_of_rain,
      totalPrecipitation: day.day.totalprecip_in,
      conditions: day.day.condition.text
    }));

    const alerts = forecastResponse.data.alerts?.alert.map((alert: any) => ({
      title: alert.headline,
      severity: alert.severity,
      description: alert.desc,
      effective: alert.effective,
      expires: alert.expires
    })) || [];

    return {
      temperature: forecastResponse.data.current.temp_f,
      humidity: forecastResponse.data.current.humidity,
      conditions: forecastResponse.data.current.condition.text,
      windSpeed: forecastResponse.data.current.wind_mph,
      precipitation: forecastResponse.data.current.precip_in,
      location: {
        city: forecastResponse.data.location.name,
        country: forecastResponse.data.location.country
      },
      forecast,
      alerts,
      historical: historicalData
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    if (axios.isAxiosError(error)) {
      console.error('API Error details:', {
        status: error.response?.status,
        data: error.response?.data
      });
    }
    return null;
  }
}

export async function getExtendedForecast(
  latitude: number,
  longitude: number,
  days: number = 7
): Promise<ForecastDay[] | null> {
  try {
    const url = `${BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${latitude},${longitude}&days=${days}&aqi=no`;
    const response = await axios.get(url);

    return response.data.forecast.forecastday.map((day: any) => ({
      date: day.date,
      maxTemp: day.day.maxtemp_f,
      minTemp: day.day.mintemp_f,
      avgTemp: day.day.avgtemp_f,
      maxWindSpeed: day.day.maxwind_mph,
      chanceOfRain: day.day.daily_chance_of_rain,
      totalPrecipitation: day.day.totalprecip_in,
      conditions: day.day.condition.text
    }));
  } catch (error) {
    console.error('Error fetching extended forecast:', error);
    return null;
  }
}