import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, Truck, Clock, Calendar, MapPin, Loader, Save } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { calculateConcreteCost, EMPTY_PRICING, formatPrice, getNearestLocation } from '../../utils/pricing';
import { LocationPricing } from '../../types';
import { useProjectStore } from '../../store';

interface PricingCalculatorProps {
  volume: number;
  psi?: string;
  calculationId?: string;
  onPricingCalculated?: (pricing: {
    concreteCost: number;
    pricePerYard: number;
    deliveryFees: {
      baseDeliveryFee: number;
      smallLoadFee: number;
      distanceFee: number;
      totalDeliveryFees: number;
    };
    additionalServices: {
      pumpTruckFee: number;
      saturdayFee: number;
      afterHoursFee: number;
      totalAdditionalFees: number;
    };
    totalCost: number;
    supplier?: {
      id: string;
      name: string;
      location: string;
    };
  } | null) => void;
  onPricingSaved?: (success: boolean, message: string) => void;
}

const PricingCalculator: React.FC<PricingCalculatorProps> = ({ 
  volume, 
  psi = '3000', 
  calculationId,
  onPricingCalculated,
  onPricingSaved 
}) => {
  const [distance, setDistance] = useState(10);
  const [needsPumpTruck, setNeedsPumpTruck] = useState(false);
  const [isSaturday, setIsSaturday] = useState(false);
  const [isAfterHours, setIsAfterHours] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [supplier, setSupplier] = useState<LocationPricing | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [locationInput, setLocationInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const { currentProject, updateCalculation } = useProjectStore();

  const handleUseLocation = async () => {
    setGpsLoading(true);
    setLocationError(null);
    setLocationPermissionDenied(false);

    try {
      // Clear any cached permissions and ensure fresh location request
      const options = {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout for better reliability
        maximumAge: 0 // Always get fresh location
      };

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        // Clear previous error states
        setLocationError(null);
        setLocationPermissionDenied(false);
        
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          options
        );
      });

      const loc = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        address: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
      };

      // Try to get a readable address
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
        );
        if (response.ok) {
          const data = await response.json();
          const address = data.address || {};
          const parts = [address.road, address.city, address.state].filter((part): part is string => Boolean(part));
          if (parts.length > 0) {
            loc.address = parts.join(', ');
          }
        }
      } catch (geocodeError) {
        console.warn('Geocoding failed, using coordinates as address');
      }

      setUserLocation(loc);
      const nearest = getNearestLocation(loc);
      setSupplier(nearest);
      
    } catch (error: any) {
      console.error('Location error:', error);
      
      // Handle different types of geolocation errors
      if (error.code === 1 || error.code === GeolocationPositionError?.PERMISSION_DENIED) {
        setLocationPermissionDenied(true);
        setLocationError('Location permission denied. Please enable location services in your device settings and try again.');
      } else if (error.code === 2 || error.code === GeolocationPositionError?.POSITION_UNAVAILABLE) {
        setLocationError('Unable to determine your location. Please check your device settings and try again.');
      } else if (error.code === 3 || error.code === GeolocationPositionError?.TIMEOUT) {
        setLocationError('Location request timed out. Please try again.');
      } else if (error.message && error.message.includes('not supported')) {
        setLocationError('Geolocation is not supported by your browser.');
      } else {
        setLocationError('Unable to get location. Please check your connection and try again.');
      }
    } finally {
      setGpsLoading(false);
    }
  };

  const handleLocationSearch = async () => {
    if (!locationInput.trim()) return;

    setSearchLoading(true);
    setLocationError(null);

    try {
      // Use OpenStreetMap Nominatim API to geocode the location
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationInput)}`
      );
      
      if (!response.ok) throw new Error('Location search failed');
      
      const data = await response.json();
      if (data && data[0]) {
        const loc = {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
          address: data[0].display_name
        };
        setUserLocation(loc);
        const nearest = getNearestLocation(loc);
        setSupplier(nearest);
      } else {
        setLocationError('Location not found. Please try a different search.');
      }
    } catch (error) {
      setLocationError('Error searching location. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const pricing = useMemo(() => {
    return calculateConcreteCost(
      volume,
      psi,
      distance,
      { 
        needsPumpTruck, 
        isSaturdayDelivery: isSaturday, 
        isAfterHoursDelivery: isAfterHours 
      },
      supplier
    );
  }, [volume, psi, distance, needsPumpTruck, isSaturday, isAfterHours, supplier]);

  // Call the callback when pricing data changes
  useEffect(() => {
    if (onPricingCalculated) {
      if (pricing && supplier) {
        // Only call with complete pricing when we have a supplier
        const pricingData = {
          ...pricing,
          supplier: {
            id: supplier.id,
            name: supplier.name,
            location: supplier.address
          }
        };
        onPricingCalculated(pricingData);
      } else {
        // Call with null when no complete pricing is available
        onPricingCalculated(null);
      }
    }
  }, [pricing, supplier, onPricingCalculated]);

  // Handle save pricing button
  const handleSavePricing = async () => {
    if (!pricing || !supplier || !currentProject || !calculationId) {
      const message = !pricing || !supplier 
        ? 'Please calculate pricing with a valid location first' 
        : 'No project or calculation selected';
      onPricingSaved?.(false, message);
      return;
    }

    setIsSaving(true);
    try {
      // Find the current calculation
      const calculation = currentProject.calculations.find(calc => calc.id === calculationId);
      if (!calculation) {
        throw new Error('Calculation not found');
      }

      // Update the calculation with pricing data
      const pricingData = {
        ...pricing,
        supplier: {
          id: supplier.id,
          name: supplier.name,
          location: supplier.address
        }
      };

      const updatedCalculation = {
        ...calculation,
        result: {
          ...calculation.result,
          pricing: pricingData
        },
        updatedAt: new Date().toISOString()
      };

      await updateCalculation(currentProject.id, calculationId, updatedCalculation);
      onPricingSaved?.(true, 'Pricing saved successfully!');
    } catch (error) {
      console.error('Error saving pricing:', error);
      onPricingSaved?.(false, 'Failed to save pricing. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ready-Mixed Concrete Estimate</h3>
        <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
      </div>

      <section className="mb-6">
        <p className="text-gray-600 dark:text-gray-300 mb-2">
          Volume: {volume.toFixed(2)} yd³
          {supplier && volume < supplier.pricing.deliveryFees.minimumOrder && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">Orders below minimum incur fees</span>
          )}
        </p>
      </section>

      <div className="mb-6">
        <p className="flex items-center text-amber-600 dark:text-amber-400 mb-4">
          <MapPin className="h-4 w-4 mr-1" />
          Select your location to see pricing
        </p>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="text"
              placeholder="City Name/Zip Code"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLocationSearch();
              }}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLocationSearch}
                disabled={searchLoading || !locationInput.trim()}
                icon={searchLoading ? <Loader className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                className="flex-1 sm:flex-none"
              >
                Search
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUseLocation}
                disabled={gpsLoading}
                icon={gpsLoading ? <Loader className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                className="flex-1 sm:flex-none"
              >
                {locationPermissionDenied ? 'Retry Location' : 'Use my location'}
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Delivery Distance (miles)
            </label>
            <Input
              type="number"
              min="0"
              value={distance}
              onChange={(e) => setDistance(parseFloat(e.target.value) || 0)}
              fullWidth
              error={locationError || undefined}
            />
          </div>
        </div>

        {(userLocation || supplier) && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
            {userLocation && (
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-1 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Location:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{userLocation.address}</p>
                </div>
              </div>
            )}
            
            {supplier && (
              <div className="flex items-start">
                <Truck className="h-4 w-4 text-green-600 dark:text-green-400 mt-1 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Nearest Supplier:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{supplier.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">{supplier.address}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="pumpTruck"
            checked={needsPumpTruck}
            onChange={(e) => setNeedsPumpTruck(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded"
          />
          <label htmlFor="pumpTruck" className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
            <Truck className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
            Need Pump Truck
          </label>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="saturdayDelivery"
            checked={isSaturday}
            onChange={(e) => setIsSaturday(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded"
          />
          <label htmlFor="saturdayDelivery" className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
            <Calendar className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
            Saturday Delivery
          </label>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="afterHoursDelivery"
            checked={isAfterHours}
            onChange={(e) => setIsAfterHours(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded"
          />
          <label htmlFor="afterHoursDelivery" className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
            <Clock className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
            After Hours Delivery
          </label>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Price Breakdown</h3>
        
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600 dark:text-gray-300">Concrete ({psi} PSI)</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatPrice(pricing?.pricePerYard || 0)}/yd³</span>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <div className="text-gray-900 dark:text-white">
                <div className="sm:hidden">
                  <div>Concrete Cost</div>
                  <div className="text-sm font-normal text-gray-600 dark:text-gray-400">({volume.toFixed(2)} yd³)</div>
                </div>
                <div className="hidden sm:block">
                  Concrete Cost ({volume.toFixed(2)} yd³)
                </div>
              </div>
              <span className="text-green-700 dark:text-green-400">{formatPrice(pricing?.concreteCost || 0)}</span>
            </div>
          </div>
          
          {pricing?.deliveryFees && (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Delivery Fees</h4>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Base Delivery Fee</span>
                  <span className="text-gray-900 dark:text-white">{formatPrice(pricing.deliveryFees.baseDeliveryFee)}</span>
                </div>
                {pricing.deliveryFees.smallLoadFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Small Load Fee</span>
                    <span className="text-gray-900 dark:text-white">{formatPrice(pricing.deliveryFees.smallLoadFee)}</span>
                  </div>
                )}
                {pricing.deliveryFees.distanceFee > 0 && supplier && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">
                      Distance Fee ({Math.max(0, distance - supplier.pricing.deliveryFees.baseDistance)} miles beyond {supplier.pricing.deliveryFees.baseDistance} mile base)
                    </span>
                    <span className="text-gray-900 dark:text-white">{formatPrice(pricing.deliveryFees.distanceFee)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between font-medium text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-600">
                <span>Total Delivery Fees</span>
                <span>{formatPrice(pricing.deliveryFees.totalDeliveryFees)}</span>
              </div>
            </div>
          )}
          
          {pricing?.additionalServices && (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Additional Services</h4>
              <div className="space-y-1 mb-3">
                {pricing.additionalServices.pumpTruckFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Pump Truck</span>
                    <span className="text-gray-900 dark:text-white">{formatPrice(pricing.additionalServices.pumpTruckFee)}</span>
                  </div>
                )}
                {pricing.additionalServices.saturdayFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Saturday Delivery</span>
                    <span className="text-gray-900 dark:text-white">{formatPrice(pricing.additionalServices.saturdayFee)}</span>
                  </div>
                )}
                {pricing.additionalServices.afterHoursFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">After Hours Delivery</span>
                    <span className="text-gray-900 dark:text-white">{formatPrice(pricing.additionalServices.afterHoursFee)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between font-medium text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-600">
                <span>Total Additional Fees</span>
                <span>{formatPrice(pricing.additionalServices.totalAdditionalFees)}</span>
              </div>
            </div>
          )}
          
          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
            <div className="flex justify-between text-lg font-bold">
              <span className="text-gray-900 dark:text-white">Total Estimated Cost</span>
              <span className="text-green-700 dark:text-green-400">{formatPrice(pricing?.totalCost || 0)}</span>
            </div>
            {!supplier ? (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                Please select your location to see accurate pricing for your area.
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                * Prices are estimates only. Final pricing may vary based on actual conditions and market fluctuations.
              </p>
            )}
          </div>
        </div>

        {/* Save Pricing Button */}
        {pricing && supplier && currentProject && calculationId && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
            <Button
              onClick={handleSavePricing}
              disabled={isSaving}
              icon={isSaving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {isSaving ? 'Saving Pricing...' : 'Save Pricing to Calculation'}
            </Button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              This will update the calculation with the current pricing data
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default PricingCalculator;