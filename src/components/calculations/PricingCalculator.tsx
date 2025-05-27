import React, { useState, useMemo } from 'react';
import { DollarSign, Truck, Clock, Calendar, MapPin, Loader } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [supplier, setSupplier] = useState<LocationPricing | null>(null);

  const handleUseLocation = async () => {
    setLoading(true);
    setLocationError(null);
    try {
      const loc = await getUserLocation();
      setUserLocation(loc);
      const nearest = getNearestLocation(loc);
      setSupplier(nearest);
    } catch (error) {
      setLocationError('Unable to get location. Please try again.');
    } finally {
      setLoading(false);
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
    <Card className="p-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Concrete Pricing Estimate</h2>
        <DollarSign className="h-6 w-6 text-green-600" />
      </div>

      <section className="mb-6">
        <p className="text-gray-600 mb-2">
          Volume: {volume.toFixed(2)} yd³
          {supplier && volume < supplier.pricing.deliveryFees.minimumOrder && (
            <span className="ml-2 text-amber-600">Orders below minimum incur fees</span>
          )}
        </p>
      </section>

      <div className="mb-6">
        <div className="flex items-center mb-2">
          <label className="flex-1 text-sm font-medium text-gray-700">Delivery Distance (miles)</label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUseLocation}
            disabled={loading}
            icon={loading ? <Loader className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          >
            {loading ? 'Getting location...' : 'Use my location'}
          </Button>
        </div>

        <Input
          type="number"
          min="0"
          value={distance}
          onChange={(e) => setDistance(parseFloat(e.target.value) || 0)}
          fullWidth
          error={locationError}
        />

        {!supplier && (
          <p className="mt-2 text-sm text-amber-600 flex items-center">
            <MapPin className="h-4 w-4 mr-1" />
            Select your location to see pricing
          </p>
        )}

        {(userLocation || supplier) && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
            {userLocation && (
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-blue-600 mt-1 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Your Location:</p>
                  <p className="text-sm text-gray-600">{userLocation.address}</p>
                </div>
              </div>
            )}
            
            {supplier && (
              <div className="flex items-start">
                <Truck className="h-4 w-4 text-green-600 mt-1 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Nearest Supplier:</p>
                  <p className="text-sm text-gray-600">{supplier.name}</p>
                  <p className="text-sm text-gray-500">{supplier.address}</p>
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
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="pumpTruck" className="text-sm text-gray-600 flex items-center">
            <Truck className="h-4 w-4 mr-1 text-gray-500" />
            Need Pump Truck
          </label>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="saturdayDelivery"
            checked={isSaturday}
            onChange={(e) => setIsSaturday(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="saturdayDelivery" className="text-sm text-gray-600 flex items-center">
            <Calendar className="h-4 w-4 mr-1 text-gray-500" />
            Saturday Delivery
          </label>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="afterHoursDelivery"
            checked={isAfterHours}
            onChange={(e) => setIsAfterHours(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="afterHoursDelivery" className="text-sm text-gray-600 flex items-center">
            <Clock className="h-4 w-4 mr-1 text-gray-500" />
            After Hours Delivery
          </label>
        </div>
      </div>

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
            </div>
          </div>
          
          {pricing?.deliveryFees && (
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
                  </div>
                )}
                {pricing.deliveryFees.distanceFee > 0 && supplier && (
                  <div className="flex justify-between">
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
              </div>
            </div>
          )}
          
          {pricing?.additionalServices && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Additional Services</h4>
              <div className="space-y-1 mb-3">
                {pricing.additionalServices.pumpTruckFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pump Truck</span>
                    <span>{formatPrice(pricing.additionalServices.pumpTruckFee)}</span>
                  </div>
                )}
                {pricing.additionalServices.saturdayFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Saturday Delivery</span>
                    <span>{formatPrice(pricing.additionalServices.saturdayFee)}</span>
                  </div>
                )}
                {pricing.additionalServices.afterHoursFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">After Hours Delivery</span>
                    <span>{formatPrice(pricing.additionalServices.afterHoursFee)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-gray-200">
                <span>Total Additional Fees</span>
                <span>{formatPrice(pricing.additionalServices.totalAdditionalFees)}</span>
              </div>
            </div>
          )}
          
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