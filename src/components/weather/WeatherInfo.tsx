import React from 'react';
import { Weather } from '../../types';
import { Sun, Cloud, CloudRain, Wind, Thermometer, Droplets, Calendar, MapPin, CloudLightning, Snowflake, CloudFog, CloudDrizzle, CloudHail, CloudSnow } from 'lucide-react';
import Card from '../ui/Card';
import { format } from 'date-fns';

interface WeatherInfoProps {
  weather: Weather;
  className?: string;
}

const WeatherInfo: React.FC<WeatherInfoProps> = ({ weather, className = '' }) => {
  const getWeatherIcon = (conditions: string) => {
    const conditionsLower = conditions.toLowerCase();
    
    // Sunny/Clear conditions
    if (conditionsLower.includes('sunny') || conditionsLower.includes('clear')) {
      return <Sun className="h-8 w-8 text-yellow-500" />;
    }
    
    // Thunder conditions
    if (conditionsLower.includes('thunder')) {
      return <CloudLightning className="h-8 w-8 text-yellow-600" />;
    }
    
    // Snow conditions
    if (conditionsLower.includes('snow') || conditionsLower.includes('blizzard')) {
      return <CloudSnow className="h-8 w-8 text-blue-300" />;
    }
    
    // Sleet and ice conditions
    if (conditionsLower.includes('sleet') || conditionsLower.includes('ice')) {
      return <CloudHail className="h-8 w-8 text-blue-400" />;
    }
    
    // Drizzle conditions
    if (conditionsLower.includes('drizzle')) {
      return <CloudDrizzle className="h-8 w-8 text-blue-400" />;
    }
    
    // Rain conditions
    if (conditionsLower.includes('rain') || conditionsLower.includes('shower')) {
      return <CloudRain className="h-8 w-8 text-blue-500" />;
    }
    
    // Fog/Mist conditions
    if (conditionsLower.includes('fog') || conditionsLower.includes('mist')) {
      return <CloudFog className="h-8 w-8 text-gray-400" />;
    }
    
    // Cloudy conditions (including overcast)
    if (conditionsLower.includes('cloud') || conditionsLower.includes('overcast')) {
      return <Cloud className="h-8 w-8 text-gray-500" />;
    }
    
    // Default fallback
    return <Thermometer className="h-8 w-8 text-red-500" />;
  };
  
  const getTemperatureColor = (temp: number) => {
    if (temp > 85) return 'text-red-600';
    if (temp > 70) return 'text-orange-500';
    if (temp > 50) return 'text-green-500';
    return 'text-blue-500';
  };

  const formatDate = (dateString: string): string => {
    try {
      return format(new Date(dateString), 'EEE, MMM d');
    } catch {
      return 'N/A';
    }
  };
  
  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current Weather</h3>
            <div className="flex items-center text-gray-600 dark:text-gray-300">
              <MapPin size={16} className="mr-1" />
              <span className="text-sm">{weather.location.city}, {weather.location.country}</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Conditions for concrete placement</p>
        </div>
        {getWeatherIcon(weather.conditions)}
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="flex items-center">
          <Thermometer className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Temperature</p>
            <p className={`text-base font-medium ${getTemperatureColor(weather.temperature)}`}>
              {weather.temperature}°F
            </p>
          </div>
        </div>
        
        <div className="flex items-center">
          <Cloud className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Humidity</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">{weather.humidity}%</p>
          </div>
        </div>
        
        <div className="flex items-center">
          <Wind className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Wind</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">{weather.windSpeed} mph</p>
          </div>
        </div>
        
        <div className="flex items-center">
          <Droplets className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Precipitation</p>
            <p className="text-base font-medium text-gray-900 dark:text-white">
              {weather.precipitation.toFixed(2)}"
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">3-Day Forecast</h4>
            <div className="flex items-center text-gray-600 dark:text-gray-300">
              <MapPin size={14} className="mr-1" />
              <span className="text-xs">{weather.location.city}</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          {weather.forecast.map((day) => (
            <div key={day.date} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {formatDate(day.date)}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">• {day.conditions}</span>
                </div>
                {getWeatherIcon(day.conditions)}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Temperature</p>
                  <div className="space-y-1">
                    <p className="font-medium">
                      <span className={getTemperatureColor(day.maxTemp)}>High: {Math.round(day.maxTemp)}°F</span>
                    </p>
                    <p className="font-medium">
                      <span className={getTemperatureColor(day.minTemp)}>Low: {Math.round(day.minTemp)}°F</span>
                    </p>
                    <p className="font-medium">
                      <span className={getTemperatureColor(day.avgTemp)}>Avg: {Math.round(day.avgTemp)}°F</span>
                    </p>
                  </div>
                </div>
                <div>
                  <div className="mb-2">
                    <p className="text-gray-600 dark:text-gray-400">Wind</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Max: {day.maxWindSpeed} mph
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Precipitation</p>
                    <p className="font-medium text-blue-600 dark:text-blue-400">
                      {day.chanceOfRain}% ({day.totalPrecipitation.toFixed(2)}")
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-4 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-md">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          {weather.temperature > 85 
            ? "Hot weather alert: Consider using retarders and scheduling pour for cooler hours."
            : weather.temperature < 50
            ? "Cold weather alert: Consider accelerators and protection from freezing."
            : "Good conditions for concrete placement."}
        </p>
      </div>
    </Card>
  );
};

export default WeatherInfo;