import { LocationPricing, LOCATION_PRICING } from '../types';

export interface CostOptions {
  needsPumpTruck?: boolean;
  isSaturdayDelivery?: boolean;
  isAfterHoursDelivery?: boolean;
}

export interface ConcreteCostResult {
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
  supplier: LocationPricing | null;
}

export const EMPTY_PRICING: ConcreteCostResult = {
  concreteCost: 0,
  pricePerYard: 0,
  deliveryFees: { baseDeliveryFee: 0, smallLoadFee: 0, distanceFee: 0, totalDeliveryFees: 0 },
  additionalServices: { pumpTruckFee: 0, saturdayFee: 0, afterHoursFee: 0, totalAdditionalFees: 0 },
  totalCost: 0,
  supplier: null
};

export function calculateConcreteCost(
  volume: number,
  psi: string = '3000',
  distance: number = 0,
  options: CostOptions = {},
  supplier: LocationPricing | null = null
): ConcreteCostResult {
  if (!supplier) return EMPTY_PRICING;

  const pricing = supplier.pricing;
  
  // Base and PSI-adjusted pricing
  const psiAdj = pricing.psiPriceAdjustments[psi] ?? 0;
  const pricePerYard = pricing.basePrice + psiAdj;
  const concreteCost = volume * pricePerYard;
  
  // Delivery fees
  const { baseDeliveryFee, minimumOrder, smallLoadFee, distanceFee, baseDistance } = pricing.deliveryFees;
  const smallFee = volume < minimumOrder ? smallLoadFee : 0;
  const extraMiles = Math.max(0, distance - baseDistance);
  const distFee = extraMiles * distanceFee;
  const totalDelivery = baseDeliveryFee + smallFee + distFee;
  
  // Additional services
  const pumpTruckFee = options.needsPumpTruck
    ? (pricing.additionalServices.pumpTruckFees[supplier.id] || 
       Object.values(pricing.additionalServices.pumpTruckFees)[0])
    : 0;
  
  const saturdayFee = options.isSaturdayDelivery ? pricing.additionalServices.saturdayDeliveryFee : 0;
  const afterHoursFee = options.isAfterHoursDelivery ? pricing.additionalServices.afterHoursFee : 0;
  const totalAdditional = pumpTruckFee + saturdayFee + afterHoursFee;
  
  const totalCost = concreteCost + totalDelivery + totalAdditional;
  
  return {
    concreteCost: parseFloat(concreteCost.toFixed(2)),
    pricePerYard: parseFloat(pricePerYard.toFixed(2)),
    deliveryFees: {
      baseDeliveryFee: parseFloat(baseDeliveryFee.toFixed(2)),
      smallLoadFee: parseFloat(smallFee.toFixed(2)),
      distanceFee: parseFloat(distFee.toFixed(2)),
      totalDeliveryFees: parseFloat(totalDelivery.toFixed(2))
    },
    additionalServices: {
      pumpTruckFee: parseFloat(pumpTruckFee.toFixed(2)),
      saturdayFee: parseFloat(saturdayFee.toFixed(2)),
      afterHoursFee: parseFloat(afterHoursFee.toFixed(2)),
      totalAdditionalFees: parseFloat(totalAdditional.toFixed(2))
    },
    totalCost: parseFloat(totalCost.toFixed(2)),
    supplier
  };
}

export async function getUserLocation(): Promise<{
  latitude: number;
  longitude: number;
  address: string;
}> {
  const { getCurrentPosition, reverseGeocode } = await import('./location');
  
  const position = await getCurrentPosition();
  const { latitude, longitude } = position.coords;
  
  // Use our reverseGeocode utility
  const address = await reverseGeocode(latitude, longitude);

  return { latitude, longitude, address };
}

export function getNearestLocation(
  coords: { latitude: number; longitude: number },
  locations: LocationPricing[] = LOCATION_PRICING
): LocationPricing {
  let nearest = locations[0];
  let minDist = Infinity;

  for (const loc of locations) {
    // Calculate both possible distances (crossing and not crossing date line)
    const dist1 = calculateDistance(coords.latitude, coords.longitude, loc.latitude, loc.longitude);
    const dist2 = calculateDistance(coords.latitude, coords.longitude + 360, loc.latitude, loc.longitude);
    const dist3 = calculateDistance(coords.latitude, coords.longitude - 360, loc.latitude, loc.longitude);
    
    // Use the shortest distance
    const dist = Math.min(dist1, dist2, dist3);
    
    if (dist < minDist) {
      minDist = dist;
      nearest = loc;
    }
  }

  return nearest;
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth's radius in miles
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);

  // Haversine formula
  const a = 
    Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * 
    Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(price);
}