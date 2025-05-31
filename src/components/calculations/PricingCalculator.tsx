import React, { useState, useMemo } from 'react';
<<<<<<< HEAD
import { DollarSign, Truck, MapPin, Loader } from 'lucide-react';
=======
import { DollarSign, Truck, Clock, Calendar, MapPin, Loader } from 'lucide-react';
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { calculateConcreteCost, EMPTY_PRICING, formatPrice, getUserLocation, getNearestLocation } from '../../utils/pricing';
import { LocationPricing } from '../../types';

interface PricingCalculatorProps {
  volume: number;
  psi?: string;
}

const PricingCalculator: React.FC<PricingCalculatorProps> = ({ volume, psi = '3000' }) => {
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

  const handleUseLocation = async () => {
    setGpsLoading(true);
    setLocationError(null);
    setLocationPermissionDenied(false);

    try {
      const loc = await getUserLocation();
      setUserLocation(loc);
      const nearest = getNearestLocation(loc);
      setSupplier(nearest);
    } catch (error: any) {
      if (error.code === 1) { // Permission denied
        setLocationPermissionDenied(true);
        setLocationError('Location permission denied. Please enable location services and try again.');
      } else {
        setLocationError('Unable to get location. Please try again.');
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

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
<<<<<<< HEAD
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ready-Mixed Concrete Estimate</h3>
        <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
      </div>

      <section className="mb-6">
        <p className="text-gray-600 dark:text-gray-300 mb-2">
          Volume: {volume.toFixed(2)} yd³
          {supplier && volume < supplier.pricing.deliveryFees.minimumOrder && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">Orders below minimum incur fees</span>
=======
        <h3 className="text-lg font-semibold text-gray-900">Ready-Mixed Concrete Estimate</h3>
        <DollarSign className="h-6 w-6 text-green-600" />
      </div>

      <section className="mb-6">
        <p className="text-gray-600 mb-2">
          Volume: {volume.toFixed(2)} yd³
          {supplier && volume < supplier.pricing.deliveryFees.minimumOrder && (
            <span className="ml-2 text-amber-600">Orders below minimum incur fees</span>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
          )}
        </p>
      </section>

      <div className="mb-6">
<<<<<<< HEAD
        <p className="flex items-center text-amber-600 dark:text-amber-400 mb-4">
=======
        <p className="flex items-center text-amber-600 mb-4">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
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
<<<<<<< HEAD
              error={locationError || undefined}
=======
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
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
<<<<<<< HEAD
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
=======
            <label className="block text-sm font-medium text-gray-700 mb-2">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
              Delivery Distance (miles)
            </label>
            <Input
              type="number"
              min="0"
              value={distance}
              onChange={(e) => setDistance(parseFloat(e.target.value) || 0)}
              fullWidth
<<<<<<< HEAD
              error={locationError || undefined}
=======
              error={locationError}
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
            />
          </div>
        </div>

        {(userLocation || supplier) && (
<<<<<<< HEAD
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
            {userLocation && (
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-1 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Location:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{userLocation.address}</p>
=======
          <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
            {userLocation && (
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-blue-600 mt-1 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Your Location:</p>
                  <p className="text-sm text-gray-600">{userLocation.address}</p>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                </div>
              </div>
            )}
            
            {supplier && (
              <div className="flex items-start">
<<<<<<< HEAD
                <Truck className="h-4 w-4 text-green-600 dark:text-green-400 mt-1 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Nearest Supplier:</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{supplier.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">{supplier.address}</p>
=======
                <Truck className="h-4 w-4 text-green-600 mt-1 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Nearest Supplier:</p>
                  <p className="text-sm text-gray-600">{supplier.name}</p>
                  <p className="text-sm text-gray-500">{supplier.address}</p>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
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
<<<<<<< HEAD
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-900 rounded"
          />
          <label htmlFor="pumpTruck" className="text-sm text-gray-700 dark:text-gray-300">
            Pump truck required
=======
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="pumpTruck" className="text-sm text-gray-600 flex items-center">
            <Truck className="h-4 w-4 mr-1 text-gray-500" />
            Need Pump Truck
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
          </label>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
<<<<<<< HEAD
            id="saturday"
            checked={isSaturday}
            onChange={(e) => setIsSaturday(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-900 rounded"
          />
          <label htmlFor="saturday" className="text-sm text-gray-700 dark:text-gray-300">
            Saturday delivery
=======
            id="saturdayDelivery"
            checked={isSaturday}
            onChange={(e) => setIsSaturday(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="saturdayDelivery" className="text-sm text-gray-600 flex items-center">
            <Calendar className="h-4 w-4 mr-1 text-gray-500" />
            Saturday Delivery
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
          </label>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
<<<<<<< HEAD
            id="afterHours"
            checked={isAfterHours}
            onChange={(e) => setIsAfterHours(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-900 rounded"
          />
          <label htmlFor="afterHours" className="text-sm text-gray-700 dark:text-gray-300">
            After-hours delivery (5 PM - 8 AM)
=======
            id="afterHoursDelivery"
            checked={isAfterHours}
            onChange={(e) => setIsAfterHours(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="afterHoursDelivery" className="text-sm text-gray-600 flex items-center">
            <Clock className="h-4 w-4 mr-1 text-gray-500" />
            After Hours Delivery
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
          </label>
        </div>
      </div>

<<<<<<< HEAD
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Price Breakdown</h3>
        
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600 dark:text-gray-300">Concrete ({psi} PSI)</span>
              <span className="font-medium text-gray-900 dark:text-white">{formatPrice(pricing?.pricePerYard || 0)}/yd³</span>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <span className="text-gray-900 dark:text-white">Concrete Cost ({volume.toFixed(2)} yd³)</span>
              <span className="text-green-700 dark:text-green-400">{formatPrice(pricing?.concreteCost || 0)}</span>
=======
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Breakdown</h3>
        
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Concrete ({psi} PSI)</span>
              <span className="font-medium">{formatPrice(pricing?.pricePerYard || 0)}/yd³</span>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <span>Concrete Cost ({volume.toFixed(2)} yd³)</span>
              <span className="text-green-700">{formatPrice(pricing?.concreteCost || 0)}</span>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
            </div>
          </div>
          
          {pricing?.deliveryFees && (
<<<<<<< HEAD
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
=======
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Delivery Fees</h4>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Base Delivery Fee</span>
                  <span>{formatPrice(pricing.deliveryFees.baseDeliveryFee)}</span>
                </div>
                {pricing.deliveryFees.smallLoadFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Small Load Fee</span>
                    <span>{formatPrice(pricing.deliveryFees.smallLoadFee)}</span>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  </div>
                )}
                {pricing.deliveryFees.distanceFee > 0 && supplier && (
                  <div className="flex justify-between">
<<<<<<< HEAD
                    <span className="text-gray-600 dark:text-gray-300">
                      Distance Fee ({Math.max(0, distance - supplier.pricing.deliveryFees.baseDistance)} miles beyond {supplier.pricing.deliveryFees.baseDistance} mile base)
                    </span>
                    <span className="text-gray-900 dark:text-white">{formatPrice(pricing.deliveryFees.distanceFee)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-gray-900 dark:text-white">Total Delivery Fees</span>
                <span className="text-gray-900 dark:text-white">{formatPrice(pricing.deliveryFees.totalDeliveryFees)}</span>
=======
                    <span className="text-gray-600">
                      Distance Fee ({Math.max(0, distance - supplier.pricing.deliveryFees.baseDistance)} miles beyond {supplier.pricing.deliveryFees.baseDistance} mile base)
                    </span>
                    <span>{formatPrice(pricing.deliveryFees.distanceFee)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-gray-200">
                <span>Total Delivery Fees</span>
                <span>{formatPrice(pricing.deliveryFees.totalDeliveryFees)}</span>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
              </div>
            </div>
          )}
          
          {pricing?.additionalServices && (
<<<<<<< HEAD
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Additional Services</h4>
              <div className="space-y-1 mb-3">
                {pricing.additionalServices.pumpTruckFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Pump Truck</span>
                    <span className="text-gray-900 dark:text-white">{formatPrice(pricing.additionalServices.pumpTruckFee)}</span>
=======
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Additional Services</h4>
              <div className="space-y-1 mb-3">
                {pricing.additionalServices.pumpTruckFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pump Truck</span>
                    <span>{formatPrice(pricing.additionalServices.pumpTruckFee)}</span>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  </div>
                )}
                {pricing.additionalServices.saturdayFee > 0 && (
                  <div className="flex justify-between">
<<<<<<< HEAD
                    <span className="text-gray-600 dark:text-gray-300">Saturday Delivery</span>
                    <span className="text-gray-900 dark:text-white">{formatPrice(pricing.additionalServices.saturdayFee)}</span>
=======
                    <span className="text-gray-600">Saturday Delivery</span>
                    <span>{formatPrice(pricing.additionalServices.saturdayFee)}</span>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  </div>
                )}
                {pricing.additionalServices.afterHoursFee > 0 && (
                  <div className="flex justify-between">
<<<<<<< HEAD
                    <span className="text-gray-600 dark:text-gray-300">After Hours Delivery</span>
                    <span className="text-gray-900 dark:text-white">{formatPrice(pricing.additionalServices.afterHoursFee)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-gray-900 dark:text-white">Total Additional Fees</span>
                <span className="text-gray-900 dark:text-white">{formatPrice(pricing.additionalServices.totalAdditionalFees)}</span>
=======
                    <span className="text-gray-600">After Hours Delivery</span>
                    <span>{formatPrice(pricing.additionalServices.afterHoursFee)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-gray-200">
                <span>Total Additional Fees</span>
                <span>{formatPrice(pricing.additionalServices.totalAdditionalFees)}</span>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
              </div>
            </div>
          )}
          
<<<<<<< HEAD
          <div className="bg-green-50 dark:bg-green-900/50 p-4 rounded-lg">
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
=======
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex justify-between text-lg font-bold">
              <span>Total Estimated Cost</span>
              <span className="text-green-700">{formatPrice(pricing?.totalCost || 0)}</span>
            </div>
            {!supplier ? (
              <p className="text-sm text-amber-600 mt-2">
                Please select your location to see accurate pricing for your area.
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-2">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                * Prices are estimates only. Final pricing may vary based on actual conditions and market fluctuations.
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PricingCalculator;