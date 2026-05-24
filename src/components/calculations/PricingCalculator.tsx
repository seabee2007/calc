import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, Truck, Clock, Calendar, MapPin, Loader } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { calculateConcreteCost, formatPrice, getNearestLocation } from '../../utils/pricing';
import { volumeToCubicYards } from '../../utils/readyMixDelivery';
import { LocationPricing, VolumeUnit } from '../../types';
import { geocodeAddress, GeocodedLocation } from '../../utils/location';
import ReadyMixDelivery from './ReadyMixDelivery';

export type PricingCalculatorVariant = 'calculator' | 'planner';

interface PricingCalculatorProps {
  volume: number;
  volumeUnit?: VolumeUnit;
  psi?: string;
  variant?: PricingCalculatorVariant;
  initialLocation?: GeocodedLocation | null;
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
}

const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  volume,
  volumeUnit = 'cubic_yards',
  psi = '3000',
  variant = 'calculator',
  initialLocation = null,
  onPricingCalculated,
}) => {
  const isPlanner = variant === 'planner';

  const [distance, setDistance] = useState(10);
  const [needsPumpTruck, setNeedsPumpTruck] = useState(false);
  const [isSaturday, setIsSaturday] = useState(false);
  const [isAfterHours, setIsAfterHours] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [supplier, setSupplier] = useState<LocationPricing | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const applyLocation = (loc: GeocodedLocation) => {
    setUserLocation(loc);
    setLocationInput(loc.address);
    setSupplier(getNearestLocation(loc));
    setLocationError(null);
  };

  useEffect(() => {
    if (initialLocation) {
      applyLocation(initialLocation);
    }
  }, [initialLocation]);

  const handleLocationSearch = async () => {
    if (!locationInput.trim()) return;

    setSearchLoading(true);
    setLocationError(null);

    try {
      const loc = await geocodeAddress(locationInput);
      if (loc) {
        applyLocation(loc);
      } else {
        setLocationError('Location not found. Please try a different search.');
      }
    } catch {
      setLocationError('Error searching location. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const volumeYd = useMemo(
    () => volumeToCubicYards(volume, volumeUnit),
    [volume, volumeUnit],
  );

  const pricing = useMemo(() => {
    return calculateConcreteCost(
      volumeYd,
      psi,
      distance,
      {
        needsPumpTruck,
        isSaturdayDelivery: isSaturday,
        isAfterHoursDelivery: isAfterHours,
      },
      supplier,
    );
  }, [volumeYd, psi, distance, needsPumpTruck, isSaturday, isAfterHours, supplier]);

  useEffect(() => {
    if (onPricingCalculated) {
      if (pricing && supplier) {
        onPricingCalculated({
          ...pricing,
          supplier: {
            id: supplier.id,
            name: supplier.name,
            location: supplier.address,
          },
        });
      } else {
        onPricingCalculated(null);
      }
    }
  }, [pricing, supplier, onPricingCalculated]);

  const volumeUnitLabel =
    volumeUnit === 'cubic_yards' ? 'yd³' : volumeUnit === 'cubic_feet' ? 'ft³' : 'm³';

  return (
    <Card className="p-4">
      {isPlanner ? (
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Ready-Mixed Concrete
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Delivery planning, supplier location, and cost estimate
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      ) : (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Price Breakdown
        </h3>
      )}

      {isPlanner && <ReadyMixDelivery volume={volume} volumeUnit={volumeUnit} />}

      {isPlanner && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
            Cost Estimate
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {volume.toFixed(2)} {volumeUnitLabel}
            <span className="text-gray-500 dark:text-gray-500">
              {' '}
              ({volumeYd.toFixed(2)} yd³ for pricing)
            </span>
            {supplier && volumeYd < supplier.pricing.deliveryFees.minimumOrder && (
              <span className="block mt-1 text-amber-600 dark:text-amber-400">
                Orders below minimum incur fees
              </span>
            )}
          </p>
        </div>
      )}

      <div className={isPlanner ? '' : 'mb-4'}>
        {!isPlanner && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {volume.toFixed(2)} {volumeUnitLabel}
            <span className="text-gray-500 dark:text-gray-500">
              {' '}
              ({volumeYd.toFixed(2)} yd³)
            </span>
            {supplier && volumeYd < supplier.pricing.deliveryFees.minimumOrder && (
              <span className="block mt-1 text-amber-600 dark:text-amber-400">
                Orders below minimum incur fees
              </span>
            )}
          </p>
        )}

        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Location & Delivery
        </h4>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Job site location
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="City name or zip code"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLocationSearch();
                }}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleLocationSearch}
                disabled={searchLoading || !locationInput.trim()}
                icon={
                  searchLoading ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )
                }
              >
                Apply
              </Button>
            </div>
            {locationError && (
              <p className="text-sm text-red-600 dark:text-red-400">{locationError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Delivery Distance (miles)
            </label>
            <Input
              type="number"
              min="0"
              value={distance}
              onChange={(e) => setDistance(parseFloat(e.target.value) || 0)}
              fullWidth
            />
          </div>
        </div>

        {(userLocation || supplier) && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
            {userLocation && (
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-1 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Your Location:
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {userLocation.address}
                  </p>
                </div>
              </div>
            )}

            {supplier && (
              <div className="flex items-start">
                <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-1 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nearest Supplier:
                  </p>
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
            id={isPlanner ? 'planner-pumpTruck' : 'pumpTruck'}
            checked={needsPumpTruck}
            onChange={(e) => setNeedsPumpTruck(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded"
          />
          <label
            htmlFor={isPlanner ? 'planner-pumpTruck' : 'pumpTruck'}
            className="text-sm text-gray-600 dark:text-gray-300 flex items-center"
          >
            <Truck className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
            Need Pump Truck
          </label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id={isPlanner ? 'planner-saturdayDelivery' : 'saturdayDelivery'}
            checked={isSaturday}
            onChange={(e) => setIsSaturday(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded"
          />
          <label
            htmlFor={isPlanner ? 'planner-saturdayDelivery' : 'saturdayDelivery'}
            className="text-sm text-gray-600 dark:text-gray-300 flex items-center"
          >
            <Calendar className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
            Saturday Delivery
          </label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id={isPlanner ? 'planner-afterHoursDelivery' : 'afterHoursDelivery'}
            checked={isAfterHours}
            onChange={(e) => setIsAfterHours(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded"
          />
          <label
            htmlFor={isPlanner ? 'planner-afterHoursDelivery' : 'afterHoursDelivery'}
            className="text-sm text-gray-600 dark:text-gray-300 flex items-center"
          >
            <Clock className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
            After Hours Delivery
          </label>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
        {isPlanner && (
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Price Breakdown
          </h3>
        )}

        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600 dark:text-gray-300">Concrete ({psi} PSI)</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatPrice(pricing?.pricePerYard || 0)}/yd³
              </span>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <div className="text-gray-900 dark:text-white">
                <div className="sm:hidden">
                  <div>Concrete Cost</div>
                  <div className="text-sm font-normal text-gray-600 dark:text-gray-400">
                    ({volumeYd.toFixed(2)} yd³)
                  </div>
                </div>
                <div className="hidden sm:block">
                  Concrete Cost ({volumeYd.toFixed(2)} yd³)
                </div>
              </div>
              <span className="text-blue-700 dark:text-blue-300">
                {formatPrice(pricing?.concreteCost || 0)}
              </span>
            </div>
          </div>

          {pricing?.deliveryFees && (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Delivery Fees</h4>
              <div className="space-y-1 mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Base Delivery Fee</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatPrice(pricing.deliveryFees.baseDeliveryFee)}
                  </span>
                </div>
                {pricing.deliveryFees.smallLoadFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Small Load Fee</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatPrice(pricing.deliveryFees.smallLoadFee)}
                    </span>
                  </div>
                )}
                {pricing.deliveryFees.distanceFee > 0 && supplier && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">
                      Distance Fee (
                      {Math.max(0, distance - supplier.pricing.deliveryFees.baseDistance)} miles
                      beyond {supplier.pricing.deliveryFees.baseDistance} mile base)
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {formatPrice(pricing.deliveryFees.distanceFee)}
                    </span>
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
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Additional Services
              </h4>
              <div className="space-y-1 mb-3">
                {pricing.additionalServices.pumpTruckFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Pump Truck</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatPrice(pricing.additionalServices.pumpTruckFee)}
                    </span>
                  </div>
                )}
                {pricing.additionalServices.saturdayFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Saturday Delivery</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatPrice(pricing.additionalServices.saturdayFee)}
                    </span>
                  </div>
                )}
                {pricing.additionalServices.afterHoursFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">After Hours Delivery</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatPrice(pricing.additionalServices.afterHoursFee)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex justify-between font-medium text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-600">
                <span>Total Additional Fees</span>
                <span>{formatPrice(pricing.additionalServices.totalAdditionalFees)}</span>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
            <div className="flex justify-between text-lg font-bold">
              <span className="text-gray-900 dark:text-white">Total Estimated Cost</span>
              <span className="text-blue-700 dark:text-blue-300">
                {formatPrice(pricing?.totalCost || 0)}
              </span>
            </div>
            {!supplier ? (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                Please select your location to see accurate pricing for your area.
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                * Prices are estimates only. Final pricing may vary based on actual conditions and
                market fluctuations.
              </p>
            )}
          </div>
        </div>

      </div>
    </Card>
  );
};

export default PricingCalculator;
