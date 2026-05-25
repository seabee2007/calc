import { VolumeUnit } from '../types';

export interface ReadyMixTruckType {
  id: string;
  name: string;
  capacityMin: number;
  capacityMax: number;
  capacityLabel: string;
  description: string;
}

export const READY_MIX_TRUCK_TYPES: ReadyMixTruckType[] = [
  {
    id: 'standard_rear',
    name: 'Standard rear discharge',
    capacityMin: 8,
    capacityMax: 10,
    capacityLabel: '8–10 yd³',
    description: 'Most common highway-legal mixer; suppliers often target 9–10 yd³ per load.',
  },
  {
    id: 'front_discharge',
    name: 'Front discharge',
    capacityMin: 8,
    capacityMax: 11,
    capacityLabel: '8–11 yd³',
    description: 'Front-discharge drum for tighter jobsites and direct placement.',
  },
  {
    id: 'short_load',
    name: 'Small short-load truck',
    capacityMin: 3,
    capacityMax: 6,
    capacityLabel: '3–6 yd³',
    description: 'Minimum-load or short-load delivery when a full truck is not needed.',
  },
  {
    id: 'volumetric',
    name: 'Volumetric mixer',
    capacityMin: 0,
    capacityMax: 0,
    capacityLabel: 'On-site, variable',
    description: 'Materials mixed at the jobsite; volume is flexible—confirm with your supplier.',
  },
];

/** Planning default: ~10 yd³ per truck (axle limits, slump, moisture, safety margin). */
export const DEFAULT_TRUCK_CAPACITY_YD = 10;

export type ColdJointRisk = 'Low' | 'Medium' | 'High';

export interface ReadyMixDeliveryPlan {
  volumeYd: number;
  truckType: ReadyMixTruckType;
  planningCapacityYd: number;
  recommendedTrucks: number;
  dischargeMinutesMin: number;
  dischargeMinutesMax: number;
  coldJointRisk: ColdJointRisk;
  usesVariableCapacity: boolean;
}

export function volumeToCubicYards(volume: number, unit: VolumeUnit): number {
  switch (unit) {
    case 'cubic_yards':
      return volume;
    case 'cubic_feet':
      return volume / 27;
    case 'cubic_meters':
      return volume * 1.30795;
    default:
      return volume;
  }
}

/** Trucks needed for a pour — always at least 1 when volume > 0. */
export function recommendedTruckCount(
  volumeYd: number,
  truckCapacityYd: number,
): number {
  if (volumeYd <= 0 || truckCapacityYd <= 0) return 0;
  if (volumeYd <= truckCapacityYd) return 1;
  return Math.ceil(volumeYd / truckCapacityYd);
}

export function isShortLoad(volumeYd: number, truckCapacityYd: number): boolean {
  return volumeYd > 0 && volumeYd < truckCapacityYd;
}

export function suggestTruckTypeId(volumeYd: number): string {
  if (volumeYd <= 0) return 'standard_rear';
  if (volumeYd < 6) return 'short_load';
  return 'standard_rear';
}

function planningCapacityForTruck(truck: ReadyMixTruckType): number {
  if (truck.id === 'volumetric') return 0;
  if (truck.id === 'short_load') return truck.capacityMax;
  return DEFAULT_TRUCK_CAPACITY_YD;
}

export function estimateColdJointRisk(
  truckCount: number,
  dischargeMinutesMax: number
): ColdJointRisk {
  if (truckCount >= 8 || dischargeMinutesMax > 120) return 'High';
  if (truckCount >= 6 || dischargeMinutesMax > 90) return 'Medium';
  return 'Low';
}

/** ~12–18 minutes discharge per truck (industry rule of thumb for planning). */
export function estimateDischargeMinutes(truckCount: number): {
  min: number;
  max: number;
} {
  if (truckCount <= 0) return { min: 0, max: 0 };
  return {
    min: truckCount * 12,
    max: truckCount * 18,
  };
}

export function calculateReadyMixDelivery(
  volume: number,
  volumeUnit: VolumeUnit,
  truckTypeId: string = 'standard_rear'
): ReadyMixDeliveryPlan {
  const truck =
    READY_MIX_TRUCK_TYPES.find((t) => t.id === truckTypeId) ??
    READY_MIX_TRUCK_TYPES[0];
  const volumeYd = volumeToCubicYards(volume, volumeUnit);
  const usesVariableCapacity = truck.id === 'volumetric';
  const planningCapacityYd = planningCapacityForTruck(truck);

  let recommendedTrucks = 0;
  if (usesVariableCapacity) {
    recommendedTrucks = 0;
  } else if (volumeYd > 0 && planningCapacityYd > 0) {
    recommendedTrucks = recommendedTruckCount(volumeYd, planningCapacityYd);
  }

  const { min: dischargeMinutesMin, max: dischargeMinutesMax } =
    estimateDischargeMinutes(recommendedTrucks);
  const coldJointRisk = usesVariableCapacity
    ? 'Low'
    : estimateColdJointRisk(recommendedTrucks, dischargeMinutesMax);

  return {
    volumeYd,
    truckType: truck,
    planningCapacityYd,
    recommendedTrucks,
    dischargeMinutesMin,
    dischargeMinutesMax,
    coldJointRisk,
    usesVariableCapacity,
  };
}

export function coldJointRiskClass(risk: ColdJointRisk): string {
  switch (risk) {
    case 'High':
      return 'text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
    case 'Medium':
      return 'text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800';
    default:
      return 'text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';
  }
}
