import { LengthUnit, VolumeUnit } from './types';
import { MixProfileType } from './curing';

// Project types
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  calculations: Calculation[];
  wasteFactor?: number;
  pourDate?: string;
  mixProfile?: MixProfileType;
}

export interface Calculation {
  id: string;
  type: 'slab' | 'footer' | 'column' | 'sidewalk' | 'thickened_edge_slab';
  dimensions: Record<string, number>;
  result: {
    volume: number; // cubic yards
    bags: number; // 80lb bags
    recommendations: string[];
  };
  weather?: Weather;
  createdAt: string;
  mixDesign?: ConcreteMixDesign;
}

// Weather related types
export interface Weather {
  temperature: number;
  humidity: number;
  conditions: string;
  windSpeed: number;
  precipitation: number;
  location: {
    city: string;
    country: string;
  };
  forecast: ForecastDay[];
}

export interface ForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  avgTemp: number;
  maxWindSpeed: number;
  chanceOfRain: number;
  totalPrecipitation: number;
  conditions: string;
}

// Units
export type Unit = 'imperial' | 'metric';
export type LengthUnit = 'feet' | 'inches' | 'meters' | 'centimeters';
export type VolumeUnit = 'cubic_yards' | 'cubic_feet' | 'cubic_meters';

// User preferences
export interface UserPreferences {
  units: Unit;
  lengthUnit: LengthUnit;
  volumeUnit: VolumeUnit;
}

// Concrete Mix Design types
export interface ConcreteMixDesign {
  psi: number;
  ratio: {
    cement: number;
    sand: number;
    aggregate: number;
  };
  waterCementRatio: number;
  slump: {
    min: number;
    max: number;
  };
  materials: {
    cement: number; // in lbs
    sand: number; // in lbs
    aggregate: number; // in lbs
    water: number; // in gallons
  };
}

export const CONCRETE_MIX_DESIGNS: Record<string, Omit<ConcreteMixDesign, 'materials'>> = {
  '2500': {
    psi: 2500,
    ratio: { cement: 1, sand: 3, aggregate: 6 },
    waterCementRatio: 0.60,
    slump: { min: 2, max: 3 }
  },
  '3000': {
    psi: 3000,
    ratio: { cement: 1, sand: 2, aggregate: 4 },
    waterCementRatio: 0.55,
    slump: { min: 3, max: 4 }
  },
  '4000': {
    psi: 4000,
    ratio: { cement: 1, sand: 1.75, aggregate: 3.5 },
    waterCementRatio: 0.50,
    slump: { min: 3, max: 4 }
  },
  '5000': {
    psi: 5000,
    ratio: { cement: 1, sand: 1.5, aggregate: 3 },
    waterCementRatio: 0.45,
    slump: { min: 2, max: 3 }
  }
};