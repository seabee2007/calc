import type { LocationPricing, ConcretePricing } from '../types';
import type { BatchPlantResult } from '../services/batchPlantService';
import type {
  BatchPlantPricingLookupResult,
  BatchPlantPricingLookupInput,
} from '../services/batchPlantPricingService';
import { getNearestLocation } from './pricing';

export interface PlantPricingBundle {
  supplier: LocationPricing;
  pricingSource: 'ai_estimate' | 'regional_default';
  pricingNotes: string;
  deliveryDistanceMiles: number;
}

export function regionalDefaultsFromLocation(coords: {
  latitude: number;
  longitude: number;
}): {
  defaults: BatchPlantPricingLookupInput['regionalDefaults'];
  nearest: LocationPricing;
} {
  const nearest = getNearestLocation(coords);
  const p = nearest.pricing;
  return {
    nearest,
    defaults: {
      basePrice: p.basePrice,
      psiPriceAdjustments: { ...p.psiPriceAdjustments },
      baseDeliveryFee: p.deliveryFees.baseDeliveryFee,
      minimumOrder: p.deliveryFees.minimumOrder,
      smallLoadFee: p.deliveryFees.smallLoadFee,
      distanceFeePerMile: p.deliveryFees.distanceFee,
      baseDistanceMiles: p.deliveryFees.baseDistance,
      saturdayDeliveryFee: p.additionalServices.saturdayDeliveryFee,
      afterHoursFee: p.additionalServices.afterHoursFee,
      pumpTruckFee:
        p.additionalServices.pumpTruckFees[nearest.id] ??
        Object.values(p.additionalServices.pumpTruckFees)[0] ??
        1200,
      regionLabel: nearest.name,
    },
  };
}

function toConcretePricing(
  lookup: Pick<
    BatchPlantPricingLookupResult,
    'pricing' | 'source'
  >,
  plantId: string,
  regionalPumpFallback: number,
): ConcretePricing {
  const p = lookup.pricing;
  return {
    basePrice: p.basePrice,
    psiPriceAdjustments: { ...p.psiPriceAdjustments },
    deliveryFees: { ...p.deliveryFees },
    additionalServices: {
      pumpTruckFees: {
        [plantId]:
          p.additionalServices.pumpTruckFees[plantId] ??
          Object.values(p.additionalServices.pumpTruckFees)[0] ??
          regionalPumpFallback,
      },
      saturdayDeliveryFee: p.additionalServices.saturdayDeliveryFee,
      afterHoursFee: p.additionalServices.afterHoursFee,
    },
  };
}

export function buildSupplierFromPlant(
  plant: BatchPlantResult,
  pricingLookup: BatchPlantPricingLookupResult,
  jobsiteCoords: { latitude: number; longitude: number },
  deliveryDistanceMiles: number,
): PlantPricingBundle {
  const plantId = `plant-${plant.latitude.toFixed(3)}-${plant.longitude.toFixed(3)}`.replace(
    /\./g,
    '',
  );
  const { nearest } = regionalDefaultsFromLocation(jobsiteCoords);
  const regionalPump =
    nearest.pricing.additionalServices.pumpTruckFees[nearest.id] ??
    Object.values(nearest.pricing.additionalServices.pumpTruckFees)[0] ??
    1200;

  const pricing = toConcretePricing(pricingLookup, plantId, regionalPump);

  const supplier: LocationPricing = {
    id: plantId,
    name: plant.plantName,
    address: plant.formattedAddress,
    latitude: plant.latitude,
    longitude: plant.longitude,
    pricing,
  };

  return {
    supplier,
    pricingSource: pricingLookup.source,
    pricingNotes: pricingLookup.notes,
    deliveryDistanceMiles,
  };
}

/** Map edge-function flat JSON into client lookup result. */
export function mapPricingApiResponse(data: {
  usedAiPricing: boolean;
  basePrice: number;
  psiPriceAdjustments: Record<string, number>;
  deliveryFees: ConcretePricing['deliveryFees'];
  additionalServices: {
    saturdayDeliveryFee: number;
    afterHoursFee: number;
    pumpTruckFee: number;
  };
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  source: 'ai_estimate' | 'regional_default';
}): BatchPlantPricingLookupResult {
  const plantId = 'plant';
  return {
    usedAiPricing: data.usedAiPricing,
    pricing: {
      basePrice: data.basePrice,
      psiPriceAdjustments: data.psiPriceAdjustments,
      deliveryFees: data.deliveryFees,
      additionalServices: {
        pumpTruckFees: { [plantId]: data.additionalServices.pumpTruckFee },
        saturdayDeliveryFee: data.additionalServices.saturdayDeliveryFee,
        afterHoursFee: data.additionalServices.afterHoursFee,
      },
    },
    confidence: data.confidence,
    notes: data.notes,
    source: data.source,
  };
}
