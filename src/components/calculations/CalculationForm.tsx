import React, { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Calculator as Calculate, CloudSun, DollarSign, Package } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Card from '../ui/Card';
import PricingCalculator from './PricingCalculator';
import QuikreteModal from './QuikreteModal';
import { 
  calculateSlabVolume, 
  calculateFooterVolume, 
  calculateRectColumnVolume, 
  calculateRoundColumnVolume,
  calculateSidewalkVolume,
  calculateThickenedEdgeSlabVolume,
  convertVolume,
  calculateBags,
  generateRecommendations,
  convertToDecimalFeet
} from '../../utils/calculations';
import { getWeatherByLocation } from '../../services/weatherService';
import { useProjectStore } from '../../store';
import { usePreferencesStore } from '../../store';
import { Calculation, Weather } from '../../types';
import WeatherInfo from '../weather/WeatherInfo';
import LocationPrompt from '../weather/LocationPrompt';

interface CalculationFormProps {
  onSave?: (calculation: Calculation) => void;
  onTypeChange?: (type: string) => void;
  initialShowWeather?: boolean;
}

type CalculationType = 'slab' | 'footer' | 'column' | 'sidewalk' | 'thickened_edge_slab';
type ColumnType = 'rectangular' | 'round';

interface FormInputs {
  length_feet: number | null;
  length_inches: number | null;
  length_fraction: string;
  width_feet: number | null;
  width_inches: number | null;
  width_fraction: string;
  thickness_feet: number | null;
  thickness_inches: number | null;
  thickness_fraction: string;
  base_thickness_feet: number | null;
  base_thickness_inches: number | null;
  base_thickness_fraction: string;
  edge_thickness_feet: number | null;
  edge_thickness_inches: number | null;
  edge_thickness_fraction: string;
  edge_width_feet: number | null;
  edge_width_inches: number | null;
  edge_width_fraction: string;
  depth_feet: number | null;
  depth_inches: number | null;
  depth_fraction: string;
  height_feet: number | null;
  height_inches: number | null;
  height_fraction: string;
  diameter_feet: number | null;
  diameter_inches: number | null;
  diameter_fraction: string;
}

const fractionOptions = [
  { value: '0', label: '0' },
  { value: '0.125', label: '1/8' },
  { value: '0.25', label: '1/4' },
  { value: '0.375', label: '3/8' },
  { value: '0.5', label: '1/2' },
  { value: '0.625', label: '5/8' },
  { value: '0.75', label: '3/4' },
  { value: '0.875', label: '7/8' }
];

const CalculationForm: React.FC<CalculationFormProps> = ({ 
  onSave, 
  onTypeChange,
  initialShowWeather = false 
}) => {
  const { preferences } = usePreferencesStore();
  const { currentProject } = useProjectStore();
  const { register, handleSubmit, control, formState: { errors }, reset, watch } = useForm<FormInputs>({
    defaultValues: {
      length_feet: null,
      length_inches: null,
      length_fraction: '0',
      width_feet: null,
      width_inches: null,
      width_fraction: '0',
      thickness_feet: null,
      thickness_inches: null,
      thickness_fraction: '0',
      base_thickness_feet: null,
      base_thickness_inches: null,
      base_thickness_fraction: '0',
      edge_thickness_feet: null,
      edge_thickness_inches: null,
      edge_thickness_fraction: '0',
      edge_width_feet: null,
      edge_width_inches: null,
      edge_width_fraction: '0',
      depth_feet: null,
      depth_inches: null,
      depth_fraction: '0',
      height_feet: null,
      height_inches: null,
      height_fraction: '0',
      diameter_feet: null,
      diameter_inches: null,
      diameter_fraction: '0'
    }
  });
  
  const [calculationType, setCalculationType] = useState<CalculationType>('slab');
  const [columnType, setColumnType] = useState<ColumnType>('rectangular');
  const [calculationResult, setCalculationResult] = useState<Calculation['result'] | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [showWeather, setShowWeather] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [selectedPsi, setSelectedPsi] = useState<string>('3000');
  const [showPricing, setShowPricing] = useState(false);
  const [showQuikreteModal, setShowQuikreteModal] = useState(false);
  const [selectedQuikreteProduct, setSelectedQuikreteProduct] = useState<{
    type: string;
    weight: number;
    yield: number;
  } | null>(null);
  const [lastCalculatedVolume, setLastCalculatedVolume] = useState<number | null>(null);
  const weatherSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialShowWeather) {
      setShowLocationPrompt(true);
    }
  }, [initialShowWeather]);

  useEffect(() => {
    if (weather && weatherSectionRef.current) {
      weatherSectionRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [weather]);

  // Auto-update bags when Quikrete product changes
  useEffect(() => {
    if (lastCalculatedVolume !== null && calculationResult) {
      const newBags = selectedQuikreteProduct 
        ? calculateBags(lastCalculatedVolume, selectedQuikreteProduct.yield)
        : calculateBags(lastCalculatedVolume);
      
      setCalculationResult({
        ...calculationResult,
        bags: newBags
      });
    }
  }, [selectedQuikreteProduct, lastCalculatedVolume]);
  
  const handleLocationReceived = async (lat: number, lon: number) => {
    const weatherData = await getWeatherByLocation(lat, lon);
    if (weatherData) {
      setWeather(weatherData);
    }
  };
  
  const toggleWeather = () => {
    if (!showWeather) {
      setShowLocationPrompt(true);
    } else {
      setShowWeather(false);
      setWeather(null);
    }
  };
  
  const togglePricing = () => {
    setShowPricing(!showPricing);
  };

  const handleQuikreteSelect = (product: { type: string; weight: number; yield: number }) => {
    setSelectedQuikreteProduct(product);
    setShowQuikreteModal(false);
  };
  
  const calculateVolume = (data: FormInputs) => {
    let volumeCubicFeet = 0;
    let dimensions: Record<string, number> = {};
    
    const getDimension = (base: string): number => {
      const feet = data[`${base}_feet` as keyof FormInputs] || 0;
      const inches = data[`${base}_inches` as keyof FormInputs] || 0;
      const fraction = parseFloat(data[`${base}_fraction` as keyof FormInputs] || '0');
      
      return convertToDecimalFeet(feet, inches, fraction);
    };

    // Check if any dimensions are provided
    const hasInputs = Object.keys(data).some(key => {
      if (key.endsWith('_feet')) {
        return data[key as keyof FormInputs] > 0;
      }
      return false;
    });

    if (!hasInputs) {
      setCalculationResult({
        volume: 0,
        bags: 0,
        recommendations: ['Please input dimensions for calculation']
      });
      setLastCalculatedVolume(null);
      return;
    }
    
    switch (calculationType) {
      case 'slab':
        dimensions = {
          length: getDimension('length'),
          width: getDimension('width'),
          thickness: getDimension('thickness')
        };
        volumeCubicFeet = calculateSlabVolume(
          dimensions.length,
          dimensions.width,
          dimensions.thickness,
          'feet'
        );
        break;

      case 'thickened_edge_slab':
        dimensions = {
          length: getDimension('length'),
          width: getDimension('width'),
          baseThickness: getDimension('base_thickness'),
          edgeThickness: getDimension('edge_thickness'),
          edgeWidth: getDimension('edge_width')
        };
        volumeCubicFeet = calculateThickenedEdgeSlabVolume(
          dimensions.length,
          dimensions.width,
          dimensions.baseThickness,
          dimensions.edgeThickness,
          dimensions.edgeWidth,
          'feet'
        );
        break;
        
      case 'footer':
        dimensions = {
          length: getDimension('length'),
          width: getDimension('width'),
          depth: getDimension('depth')
        };
        volumeCubicFeet = calculateFooterVolume(
          dimensions.length,
          dimensions.width,
          dimensions.depth,
          'feet'
        );
        break;
        
      case 'column':
        if (columnType === 'rectangular') {
          dimensions = {
            length: getDimension('length'),
            width: getDimension('width'),
            height: getDimension('height')
          };
          volumeCubicFeet = calculateRectColumnVolume(
            dimensions.width,
            dimensions.length,
            dimensions.height,
            'feet'
          );
        } else {
          dimensions = {
            diameter: getDimension('diameter'),
            height: getDimension('height')
          };
          volumeCubicFeet = calculateRoundColumnVolume(
            dimensions.diameter,
            dimensions.height,
            'feet'
          );
        }
        break;
        
      case 'sidewalk':
        dimensions = {
          length: getDimension('length'),
          width: getDimension('width'),
          thickness: getDimension('thickness')
        };
        volumeCubicFeet = calculateSidewalkVolume(
          dimensions.length,
          dimensions.width,
          dimensions.thickness,
          'feet'
        );
        break;
    }
    
    const volume = convertVolume(volumeCubicFeet, preferences.volumeUnit);
    setLastCalculatedVolume(volume);
    
    const bags = selectedQuikreteProduct 
      ? calculateBags(volume, selectedQuikreteProduct.yield)
      : calculateBags(volume);
    
    const recommendations = weather ? 
      generateRecommendations(
        weather.temperature,
        weather.humidity,
        weather.windSpeed,
        calculationType,
        dimensions
      ) : 
      generateRecommendations(
        70,
        50,
        5,
        calculationType,
        dimensions
      );
    
    const result = {
      volume: parseFloat(volume.toFixed(2)),
      bags: bags,
      recommendations
    };
    
    setCalculationResult(result);
    
    if (onSave) {
      const calculation: Calculation = {
        id: '',
        type: calculationType,
        dimensions,
        result,
        weather: weather || undefined,
        createdAt: new Date().toISOString()
      };
      
      onSave(calculation);
    }
  };
  
  const handleCalculationTypeChange = (value: string) => {
    setCalculationType(value as CalculationType);
    setCalculationResult(null);
    setLastCalculatedVolume(null);
    reset({
      ...watch()
    });
    if (onTypeChange) {
      onTypeChange(value);
    }
  };
  
  const handleColumnTypeChange = (value: string) => {
    setColumnType(value as ColumnType);
    setCalculationResult(null);
    setLastCalculatedVolume(null);
    reset();
  };

  const handlePsiChange = (value: string) => {
    setSelectedPsi(value);
  };

  const renderDimensionInputs = (baseName: string, label: string) => (
    <div className="grid grid-cols-3 gap-2">
      <div className="flex flex-col">
        <div className="h-6 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </div>
        <Controller
          name={`${baseName}_feet` as keyof FormInputs}
          control={control}
          rules={{
            min: { value: 0, message: 'Must be 0 or greater' }
          }}
          render={({ field, fieldState }) => (
            <Input
              type="number"
              min="0"
              placeholder="0"
              fullWidth
              error={fieldState.error?.message}
              {...field}
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
              value={field.value === null ? '' : field.value}
            />
          )}
        />
      </div>
      
      <div className="flex flex-col">
        <div className="h-6 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Inches
        </div>
        <Controller
          name={`${baseName}_inches` as keyof FormInputs}
          control={control}
          rules={{
            min: { value: 0, message: 'Must be 0-11' },
            max: { value: 11, message: 'Must be 0-11' }
          }}
          render={({ field, fieldState }) => (
            <Input
              type="number"
              min="0"
              max="11"
              placeholder="0"
              fullWidth
              error={fieldState.error?.message}
              {...field}
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
              value={field.value === null ? '' : field.value}
            />
          )}
        />
      </div>
      
      <div className="flex flex-col">
        <div className="h-6 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Fraction
        </div>
        <Controller
          name={`${baseName}_fraction` as keyof FormInputs}
          control={control}
          render={({ field }) => (
            <Select
              options={fractionOptions}
              fullWidth
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>
    </div>
  );
  
  const renderFields = () => {
    switch (calculationType) {
      case 'slab':
        return (
          <>
            {renderDimensionInputs('length', 'Length')}
            {renderDimensionInputs('width', 'Width')}
            {renderDimensionInputs('thickness', 'Thickness')}
          </>
        );

      case 'thickened_edge_slab':
        return (
          <>
            {renderDimensionInputs('length', 'Length')}
            {renderDimensionInputs('width', 'Width')}
            {renderDimensionInputs('base_thickness', 'Base Thickness')}
            {renderDimensionInputs('edge_thickness', 'Edge Thickness')}
            {renderDimensionInputs('edge_width', 'Edge Width')}
          </>
        );
        
      case 'footer':
        return (
          <>
            {renderDimensionInputs('length', 'Length')}
            {renderDimensionInputs('width', 'Width')}
            {renderDimensionInputs('depth', 'Depth')}
          </>
        );
        
      case 'column':
        return (
          <>
            <Select
              label="Column Type"
              options={[
                { value: 'rectangular', label: 'Rectangular' },
                { value: 'round', label: 'Round' }
              ]}
              value={columnType}
              onChange={handleColumnTypeChange}
              fullWidth
            />
            
            {columnType === 'rectangular' ? (
              <>
                {renderDimensionInputs('length', 'Length')}
                {renderDimensionInputs('width', 'Width')}
              </>
            ) : (
              renderDimensionInputs('diameter', 'Diameter')
            )}
            
            {renderDimensionInputs('height', 'Height')}
          </>
        );
        
      case 'sidewalk':
        return (
          <>
            {renderDimensionInputs('length', 'Length')}
            {renderDimensionInputs('width', 'Width')}
            {renderDimensionInputs('thickness', 'Thickness')}
          </>
        );
    }
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Concrete Calculator</h2>
        
        <form onSubmit={handleSubmit(calculateVolume)} className="space-y-4">
          <Select
            label="Calculation Type"
            options={[
              { value: 'slab', label: 'Concrete Slab' },
              { value: 'thickened_edge_slab', label: 'Thickened Edge Slab' },
              { value: 'footer', label: 'Footer/Footing' },
              { value: 'column', label: 'Column' },
              { value: 'sidewalk', label: 'Sidewalk' }
            ]}
            value={calculationType}
            onChange={handleCalculationTypeChange}
            fullWidth
          />
          
          <Select
            label="Concrete Strength"
            options={[
              { value: '2500', label: '2500 PSI' },
              { value: '3000', label: '3000 PSI' },
              { value: '4000', label: '4000 PSI' },
              { value: '5000', label: '5000 PSI' }
            ]}
            value={selectedPsi}
            onChange={handlePsiChange}
            fullWidth
          />
          
          {renderFields()}
          
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
            <div className="flex flex-col items-center justify-center space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Get weather-based recommendations for your concrete pour
              </p>
              <Button 
                type="button"
                onClick={toggleWeather}
                icon={<CloudSun size={20} />}
                className="w-full max-w-md"
              >
                {showWeather ? 'Hide Weather Data' : 'Include Weather Data'}
              </Button>
            </div>
          </div>
          
          {weather && (
            <div className="mt-4" ref={weatherSectionRef}>
              <WeatherInfo weather={weather} />
            </div>
          )}
          
          <div className="pt-4">
            <Button 
              type="submit" 
              fullWidth 
              icon={<Calculate size={18} />}
            >
              Calculate
            </Button>
          </div>
        </form>
      </Card>
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Results</h2>
        
        {calculationResult ? (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100">Concrete Required</h3>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">Volume</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {calculationResult.volume} {preferences.volumeUnit === 'cubic_yards' ? 'yd³' : preferences.volumeUnit === 'cubic_feet' ? 'ft³' : 'm³'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {selectedQuikreteProduct ? `${selectedQuikreteProduct.weight}lb QUIKRETE® ${selectedQuikreteProduct.type}` : '80lb Bags'}
                    </p>
                    <button
                      onClick={() => setShowQuikreteModal(true)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      <Package size={16} />
                    </button>
                  </div>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {calculationResult.bags}
                  </p>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-800">
                <Button 
                  type="button" 
                  variant="outline"
                  size="sm"
                  onClick={togglePricing}
                  icon={<DollarSign size={16} />}
                  className="w-full"
                >
                  {showPricing ? 'Hide Pricing' : 'Show Pricing Estimate'}
                </Button>
              </div>
            </div>
            
            {showPricing && calculationResult.volume > 0 && (
              <PricingCalculator 
                volume={calculationResult.volume} 
                psi={selectedPsi}
              />
            )}
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Recommendations</h3>
              <ul className="space-y-2">
                {calculationResult.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm mr-2">
                      {index + 1}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Calculate className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              Enter dimensions and calculate to see results
            </p>
          </div>
        )}
      </Card>

      <LocationPrompt
        isOpen={showLocationPrompt}
        onClose={() => setShowLocationPrompt(false)}
        onLocationReceived={(lat, lon) => {
          handleLocationReceived(lat, lon);
          setShowWeather(true);
        }}
      />

      <QuikreteModal
        isOpen={showQuikreteModal}
        onClose={() => setShowQuikreteModal(false)}
        onSelect={handleQuikreteSelect}
      />
    </div>
  );
};

export default CalculationForm;