import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Beaker, Thermometer, Droplets, Wind, Calculator, AlertTriangle, Info, MapPin, Scale, Clock, CheckCircle, XCircle } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import LocationPermissionAlert from '../components/ui/LocationPermissionAlert';
import { getWeatherByLocation } from '../services/weatherService';
import { Weather } from '../types';
import AdmixtureCalculator from '../components/mix/AdmixtureCalculator';
import SpecGenerator from '../components/mix/SpecGenerator';
import { generateMixSpecPDF } from '../utils/pdf';

interface MixDesignRecommendation {
  waterCementRatio: number;
  targetAir: [number, number];
  aeFactor: number;
  evaporationRate: {
    imperial: number;
    metric: number;
  };
  recommendations: string[];
}

const MixDesignAdvisor: React.FC = () => {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPsi, setSelectedPsi] = useState<string>('4000');
  const [exposure, setExposure] = useState<'F1' | 'F2' | 'F3' | 'none'>('F1');
  const [recommendation, setRecommendation] = useState<MixDesignRecommendation | null>(null);
  const [unitSystem, setUnitSystem] = useState<'imperial' | 'metric'>('imperial');
  const [climate, setClimate] = useState<'temperate' | 'tropical'>('temperate');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationReceived, setLocationReceived] = useState(false);

  const calculateEvaporationRate = (temp: number, humidity: number, windSpeed: number) => {
    const TcF = unitSystem === 'metric' ? (temp * 9/5) + 32 : temp;
    const TaF = TcF;
    const RH = humidity / 100;
    const V = unitSystem === 'metric' ? windSpeed * 0.621371 : windSpeed;

    const E_us = (Math.pow(TcF, 2.5) - RH * Math.pow(TaF, 2.5)) * (1 + 0.4 * V) * 1e-6;
    const E_metric = E_us * 4.88243;

    return { imperial: E_us, metric: E_metric };
  };

  const getEvaporationRiskLevel = (rate: number) => {
    if (rate <= 0.5) return { level: 'Low', color: 'green', icon: <CheckCircle className="h-6 w-6 text-green-500" /> };
    if (rate <= 1.0) return { level: 'Moderate', color: 'yellow', icon: <AlertTriangle className="h-6 w-6 text-yellow-500" /> };
    return { level: 'High', color: 'red', icon: <XCircle className="h-6 w-6 text-red-500" /> };
  };

  const getMitigationSteps = (rate: number): string[] => {
    if (rate <= 0.5) return [
      'Standard curing procedures are adequate',
      'Monitor surface moisture during finishing',
      'Apply curing compound after final finishing'
    ];
    
    if (rate <= 1.0) return [
      'Erect windbreaks or sun-shades around pour area',
      'Begin light fogging every 15-30 minutes',
      'Apply curing compound when bleeding stops',
      'Consider rescheduling pour for better conditions'
    ];
    
    return [
      'IMMEDIATE ACTION REQUIRED',
      'Apply evaporation retarder right after screeding',
      'Cover surface with wet burlap or poly sheeting',
      'Mandatory wet curing for minimum 24 hours',
      'Use windbreaks and sunshades',
      'Reschedule pour if possible'
    ];
  };

  const suggestConcreteParameters = (
    temp: number,
    humidity: number,
    windSpeed: number,
    psi: number,
    exposure: 'F1' | 'F2' | 'F3' | 'none'
  ): MixDesignRecommendation => {
    const tempF = unitSystem === 'metric' ? (temp * 9/5) + 32 : temp;
    const tempC = unitSystem === 'metric' ? temp : (temp - 32) * 5/9;
    
    const baseWc = { 3500: 0.54, 4000: 0.50, 5000: 0.45 }[psi] || 0.50;
    
    const delta = Math.max(0, (tempC - 21) / 11) * 0.025;
    const wc = Math.min(0.60, baseWc + delta);
    
    const airContent = climate === 'tropical' ? 
      { 'none': [2, 4], 'F1': [3, 5], 'F2': [4, 6], 'F3': [5, 7] }[exposure] :
      { 'none': [3, 5], 'F1': [4, 6], 'F2': [5, 7], 'F3': [6, 8] }[exposure];
    
    const aeAdjustment = tempC > 38 ? 1.25 : tempC < 4 ? 0.60 : 1.0;
    
    const evapRate = calculateEvaporationRate(tempF, humidity, windSpeed);
    
    const recommendations: string[] = [];
    
    if (climate === 'temperate') {
      if (tempF < 40) {
        recommendations.push('Use Type C non-chloride accelerator');
        recommendations.push('Heat mixing water (max 140°F/60°C)');
        recommendations.push('Protect concrete from freezing');
      }
    }

    if (tempF > 90 || (climate === 'tropical' && tempF > 85)) {
      recommendations.push('CRITICAL: Use Type D water-reducing retarder');
      recommendations.push('Schedule pour for early morning or evening');
      recommendations.push('Consider using chilled water or ice as partial water replacement');
      recommendations.push('Use light-colored curing compounds to reduce heat absorption');
    }

    if (climate === 'tropical') {
      recommendations.push('Use Type F or G superplasticizer for improved workability');
      recommendations.push('Consider using fly ash to reduce heat of hydration');
      if (humidity > 80) {
        recommendations.push('Increase setting time with appropriate admixtures');
      }
    }

    recommendations.push(...getMitigationSteps(evapRate.metric));

    if (humidity < 30) {
      recommendations.push('Increase curing compound application rate by 25%');
      recommendations.push('Use synthetic fiber reinforcement');
    }

    return {
      waterCementRatio: wc,
      targetAir: airContent as [number, number],
      aeFactor: aeAdjustment,
      evaporationRate: evapRate,
      recommendations
    };
  };

  const handleLocationReceived = async (latitude: number, longitude: number) => {
    setLoading(true);
    setLocationError(null);
    setLocationReceived(true);

    try {
      const weatherData = await getWeatherByLocation(latitude, longitude);

      if (weatherData) {
        setWeather(weatherData);
        
        const rec = suggestConcreteParameters(
          unitSystem === 'metric' ? 
            ((weatherData.temperature - 32) * 5/9) : 
            weatherData.temperature,
          weatherData.humidity,
          unitSystem === 'metric' ? 
            (weatherData.windSpeed * 1.60934) : 
            weatherData.windSpeed,
          parseInt(selectedPsi),
          exposure
        );
        setRecommendation(rec);
      } else {
        setLocationError('Unable to get weather data. Please try again.');
      }
    } catch (error) {
      console.error('Error getting weather:', error);
      setLocationError('Error getting weather data. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationError = (error: string) => {
    setLocationError(error);
    setLocationReceived(false);
  };

  const handleCalculateWithoutLocation = () => {
    // Provide default weather conditions for manual calculation
    const defaultWeather = {
      temperature: 70, // 70°F default
      humidity: 50, // 50% default
      windSpeed: 5 // 5 mph default
    };

    const rec = suggestConcreteParameters(
      unitSystem === 'metric' ? 
        ((defaultWeather.temperature - 32) * 5/9) : 
        defaultWeather.temperature,
      defaultWeather.humidity,
      unitSystem === 'metric' ? 
        (defaultWeather.windSpeed * 1.60934) : 
        defaultWeather.windSpeed,
      parseInt(selectedPsi),
      exposure
    );
    setRecommendation(rec);
    setLocationError(null);
  };

  const formatTemperature = (temp: number): string => {
    if (unitSystem === 'metric') {
      const celsius = (temp - 32) * 5/9;
      return `${celsius.toFixed(1)}°C`;
    }
    return `${temp}°F`;
  };

  const formatWindSpeed = (speed: number): string => {
    if (unitSystem === 'metric') {
      const kmh = speed * 1.60934;
      return `${kmh.toFixed(1)} km/h`;
    }
    return `${speed} mph`;
  };

  const aeDosageRange = () => {
    const baseRange = [0.5, 1.0];
    return baseRange.map(dose => dose * recommendation!.aeFactor);
  };

  const wrDosage = () => {
    return [3.0, 5.0];
  };

  const getAccelRetarder = () => {
    const temp = weather?.temperature || 70;
    if (temp < 50) {
      return { type: 'Accelerator', range: '16-32' };
    }
    return { type: 'Retarder', range: '2-4' };
  };

  const handleDownloadSpec = async () => {
    if (recommendation) {
      console.log('Download button clicked, calling generateMixSpecPDF');
      try {
        const success = await generateMixSpecPDF(
          selectedPsi,
          recommendation.targetAir,
          recommendation.waterCementRatio,
          [
            `Air-Entraining Agent (${aeDosageRange()[0].toFixed(2)}-${aeDosageRange()[1].toFixed(2)} oz/cwt)`,
            `Water Reducer (${wrDosage()[0].toFixed(1)}-${wrDosage()[1].toFixed(1)} oz/cwt)`,
            `${getAccelRetarder().type} (${getAccelRetarder().range} oz/cwt)`
          ]
        );
        
        if (success) {
          console.log('PDF generation successful');
        } else {
          console.log('PDF generation failed, fallback used');
        }
      } catch (error) {
        console.error('Error in handleDownloadSpec:', error);
        alert('Failed to generate PDF. Please try again.');
      }
    } else {
      console.log('No recommendation available for download');
      alert('Please calculate mix design first to download specifications.');
    }
  };

  const StepCircle: React.FC<{ number: number }> = ({ number }) => (
    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-medium">
      {number}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            Mix-Design Advisor
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            Get ACI-based concrete mix recommendations based on current weather conditions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Mix Design Parameters</h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <StepCircle number={1} />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Choose Unit System</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    options={[
                      { value: 'imperial', label: 'Imperial (°F, mph)' },
                      { value: 'metric', label: 'Metric (°C, km/h)' }
                    ]}
                    value={unitSystem}
                    onChange={(value) => setUnitSystem(value as 'imperial' | 'metric')}
                    fullWidth
                  />
                  <Select
                    options={[
                      { value: 'temperate', label: 'Temperate (Freeze-Thaw)' },
                      { value: 'tropical', label: 'Tropical (No Freeze)' }
                    ]}
                    value={climate}
                    onChange={(value) => setClimate(value as 'temperate' | 'tropical')}
                    fullWidth
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-3">
                  <StepCircle number={2} />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Select Design Strength</h3>
                </div>
                <Select
                  options={[
                    { value: '3500', label: unitSystem === 'metric' ? '24 MPa (3,500 PSI)' : '3,500 PSI' },
                    { value: '4000', label: unitSystem === 'metric' ? '28 MPa (4,000 PSI)' : '4,000 PSI' },
                    { value: '5000', label: unitSystem === 'metric' ? '35 MPa (5,000 PSI)' : '5,000 PSI' }
                  ]}
                  value={selectedPsi}
                  onChange={setSelectedPsi}
                  fullWidth
                />
              </div>

              <div>
                <div className="flex items-center gap-3 mb-3">
                  <StepCircle number={3} />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Set Exposure Condition</h3>
                </div>
                <Select
                  options={[
                    { value: 'none', label: 'No Exposure' },
                    { value: 'F1', label: 'F1 - Moderate' },
                    { value: 'F2', label: 'F2 - Severe' },
                    { value: 'F3', label: 'F3 - Very Severe' }
                  ]}
                  value={exposure}
                  onChange={(value) => setExposure(value as 'F1' | 'F2' | 'F3' | 'none')}
                  fullWidth
                />
              </div>

              <div>
                <div className="flex items-center gap-3 mb-3">
                  <StepCircle number={4} />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Get Weather-Based Recommendations</h3>
                </div>
                
                {!locationReceived && !weather && (
                  <div className="space-y-3">
                    <LocationPermissionAlert
                      onLocationReceived={handleLocationReceived}
                      onError={handleLocationError}
                      compact={false}
                    />
                    
                    {locationError && (
                      <div className="border-t pt-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Or calculate with standard conditions:
                        </p>
                        <Button
                          onClick={handleCalculateWithoutLocation}
                          variant="outline"
                          fullWidth
                          icon={<Calculator size={18} />}
                        >
                          Calculate with Default Weather (70°F, 50% humidity)
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                
                {loading && (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Getting weather data...</span>
                  </div>
                )}
              </div>
            </div>

            {weather && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current Conditions</h3>
                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                    <MapPin size={16} className="mr-1" />
                    <span className="text-sm">{weather.location.city}, {weather.location.country}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-blue-600 dark:text-blue-300">Temperature</span>
                    </div>
                    <p className="text-xl font-semibold text-blue-900 dark:text-blue-100 mt-1">
                      {formatTemperature(weather.temperature)}
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-blue-600 dark:text-blue-300">Humidity</span>
                    </div>
                    <p className="text-xl font-semibold text-blue-900 dark:text-blue-100 mt-1">
                      {weather.humidity}%
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Wind className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-blue-600 dark:text-blue-300">Wind Speed</span>
                    </div>
                    <p className="text-xl font-semibold text-blue-900 dark:text-blue-100 mt-1">
                      {formatWindSpeed(weather.windSpeed)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {recommendation && (
            <>
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Mix Design Recommendations</h2>
                <div className="space-y-6">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Evaporation Rate Risk</h3>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Current Rate</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">
                          {recommendation.evaporationRate.metric.toFixed(2)} kg/m²·hr
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getEvaporationRiskLevel(recommendation.evaporationRate.metric).icon}
                        <span className={`font-medium text-${getEvaporationRiskLevel(recommendation.evaporationRate.metric).color}-600 dark:text-${getEvaporationRiskLevel(recommendation.evaporationRate.metric).color}-400`}>
                          {getEvaporationRiskLevel(recommendation.evaporationRate.metric).level} Risk
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-gray-700 dark:text-gray-300">Low Risk (≤ 0.5): Standard curing adequate</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span className="text-gray-700 dark:text-gray-300">Moderate Risk (0.5-1.0): Take precautions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-gray-700 dark:text-gray-300">High Risk (&gt; 1.0): Immediate action required</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Mix Properties</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Water-Cement Ratio</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">
                          {recommendation.waterCementRatio.toFixed(2)}
                        </p>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Target Air Content</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-white">
                          {recommendation.targetAir[0]}% - {recommendation.targetAir[1]}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Required Actions</h3>
                    <div className="space-y-2">
                      {recommendation.recommendations.map((rec, index) => (
                        <div 
                          key={index}
                          className={`p-3 rounded-lg flex items-start gap-2 ${
                            rec.startsWith('CRITICAL') || rec.startsWith('IMMEDIATE')
                              ? 'bg-red-50 dark:bg-red-900/50 text-red-800 dark:text-red-200' 
                              : rec.includes('Consider') || rec.includes('Monitor')
                              ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {rec.startsWith('CRITICAL') || rec.startsWith('IMMEDIATE') ? (
                            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          ) : rec.includes('Consider') || rec.includes('Monitor') ? (
                            <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Clock className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          )}
                          <p className="text-sm">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">Important Note</h4>
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Start curing immediately when bleed water sheen disappears (typically 30-60 minutes after placement).
                      Maintain chosen curing method for at least 7 days, or 14 days if exposure is severe.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <AdmixtureCalculator 
                  temperature={weather?.temperature || 70}
                  unitsImperial={unitSystem === 'imperial'}
                />
                
                <SpecGenerator
                  psi={selectedPsi}
                  airContent={recommendation.targetAir}
                  waterCementRatio={recommendation.waterCementRatio}
                  admixtures={[
                    `Air-Entraining Agent (${aeDosageRange()[0].toFixed(2)}-${aeDosageRange()[1].toFixed(2)} oz/cwt)`,
                    `Water Reducer (${wrDosage()[0].toFixed(1)}-${wrDosage()[1].toFixed(1)} oz/cwt)`,
                    `${getAccelRetarder().type} (${getAccelRetarder().range} oz/cwt)`
                  ]}
                  onDownload={handleDownloadSpec}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MixDesignAdvisor;