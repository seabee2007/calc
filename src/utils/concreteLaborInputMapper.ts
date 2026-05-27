import type { Calculation } from '../types';
import type { LaborEstimateInputs } from '../types/laborEstimate';
import type {
  AccessDifficulty,
  ConcreteLaborEstimateInput,
  FinishType,
  LaborPlacementMethod,
  LaborProjectType,
  ReinforcementType,
  WeatherCondition,
} from '../types/concreteLaborEstimate';
import { LABOR_RATES_2026 } from '../data/nationalLaborRates2026';
import {
  getCalculationAreaSqFt,
  parseSlabAreaSqFt,
  resolveSlabAreaSqFt,
  resolveSlabThicknessFt,
} from './placementProduction';
import type { PlacementMethod } from '../types/pourPlanner';

const { concreteLaborer, concreteFinisher, foreman } = LABOR_RATES_2026.laborRates;

const DEFAULT_BURDEN =
  concreteLaborer.hourlyRateWithBurden / concreteLaborer.hourlyRateBase;

export function mapPlacementMethod(method: string): LaborPlacementMethod {
  switch (method) {
    case 'pump':
      return 'pump';
    case 'buggy':
      return 'buggy';
    case 'bucket':
      return 'wheelbarrow';
    case 'conveyor':
    case 'chute':
    default:
      return 'chute';
  }
}

export function mapAccessDifficulty(
  accessMode: string,
  placementMethod: PlacementMethod | string,
): AccessDifficulty {
  if (accessMode !== 'auto') {
    switch (accessMode) {
      case 'chute':
        return 'easy';
      case 'pump':
      case 'conveyor':
        return 'moderate';
      case 'buggy':
        return 'difficult';
      case 'bucket':
      case 'wheelbarrow':
        return 'severe';
      default:
        break;
    }
  }
  switch (placementMethod) {
    case 'pump':
    case 'conveyor':
      return 'moderate';
    case 'buggy':
      return 'difficult';
    case 'bucket':
      return 'severe';
    default:
      return 'easy';
  }
}

export function mapWeatherCondition(mode: string): WeatherCondition {
  switch (mode) {
    case 'hot':
      return 'hot';
    case 'cold':
      return 'windy';
    case 'rain':
      return 'rainy';
    default:
      return 'normal';
  }
}

export function mapProjectType(calculation?: Calculation): LaborProjectType {
  if (!calculation?.type) return 'slab_on_grade';
  switch (calculation.type) {
    case 'sidewalk':
      return 'sidewalk';
    case 'driveway':
      return 'driveway';
    case 'footer':
      return 'footing';
    case 'column':
    case 'wall':
      return 'wall';
    case 'curb':
      return 'curb_gutter';
    default:
      return 'slab_on_grade';
  }
}

export function mapReinforcementType(
  reinforcementType: string,
  complexityFactor: string,
): ReinforcementType {
  if (reinforcementType && reinforcementType !== 'auto') {
    return reinforcementType as ReinforcementType;
  }
  if (complexityFactor === 'heavy_rebar') return 'rebar_single_mat';
  return 'none';
}

export function buildConcreteLaborEstimateInput(
  inputs: LaborEstimateInputs,
  options: {
    volumeYd: number;
    calculation?: Calculation;
  },
): ConcreteLaborEstimateInput {
  const crewTotal = Math.max(0, parseInt(inputs.crewSize, 10) || 0);
  const finishers = Math.max(0, parseInt(inputs.finishers, 10) || 0);
  const foremen = Math.max(0, parseInt(inputs.foremen, 10) || 0);
  const laborers = Math.max(0, crewTotal - finishers - foremen);

  const slabThicknessFt = resolveSlabThicknessFt(
    options.calculation,
    inputs.slabSize ?? '',
    inputs.slabThicknessIn ?? '6',
  );
  const thicknessInches = slabThicknessFt != null ? slabThicknessFt * 12 : 6;
  const volumeYd = Math.max(0, options.volumeYd);

  const areaSqFt =
    resolveSlabAreaSqFt(options.calculation, inputs.slabSize ?? '', {
      volumeYd,
      slabThicknessFt: slabThicknessFt ?? thicknessInches / 12,
    }) ?? 0;

  const burdenMultiplier =
    parseFloat(inputs.burdenMultiplier) || DEFAULT_BURDEN;

  return {
    projectType: (inputs.projectType as LaborProjectType) || mapProjectType(options.calculation),
    concreteYards: volumeYd,
    areaSqFt,
    thicknessInches,

    crew: { laborers, finishers, foremen },

    rates: {
      laborerRate: concreteLaborer.hourlyRateBase,
      finisherRate: concreteFinisher.hourlyRateBase,
      foremanRate: foreman.hourlyRateBase,
      burdenMultiplier,
      overtimeMultiplier:
        parseFloat(inputs.overtimeMultiplier) || concreteLaborer.overtimeMultiplier,
    },

    placementMethod: mapPlacementMethod(inputs.placementMethod || 'chute'),
    finishType: (inputs.finishType as FinishType) || 'broom',
    accessDifficulty:
      inputs.accessDifficulty && inputs.accessDifficulty !== 'auto'
        ? (inputs.accessDifficulty as AccessDifficulty)
        : mapAccessDifficulty(
            inputs.accessFactorMode || 'auto',
            inputs.placementMethod,
          ),
    weatherCondition:
      inputs.weatherCondition && inputs.weatherCondition !== 'auto'
        ? (inputs.weatherCondition as WeatherCondition)
        : mapWeatherCondition(inputs.weatherFactorMode || 'normal'),
    reinforcementType: mapReinforcementType(
      inputs.reinforcementType,
      inputs.complexityFactor,
    ),

    options: {
      pumpRequired: inputs.placementMethod === 'pump',
      vaporBarrier: inputs.vaporBarrier === 'true',
      curingCompound: inputs.curingCompound !== 'false',
      sawCutJoints: inputs.sawCutJoints !== 'false',
      smallJobMinimum: inputs.smallJobMinimum === 'true',
      includeCleanup: inputs.includeCleanup !== 'false',
      includeContingency: inputs.includeContingency !== 'false',
    },
  };
}

/** Area from explicit footprint or volume × thickness. */
export function resolveLaborAreaSqFt(
  calculation: Calculation | undefined,
  slabSize: string,
  volumeYd: number,
  slabThicknessIn: string,
): number {
  const thicknessFt = resolveSlabThicknessFt(calculation, slabSize, slabThicknessIn);
  return (
    resolveSlabAreaSqFt(calculation, slabSize, {
      volumeYd,
      slabThicknessFt: thicknessFt ?? (parseFloat(slabThicknessIn) / 12 || 0.5),
    }) ??
    getCalculationAreaSqFt(calculation) ??
    parseSlabAreaSqFt(slabSize) ??
    0
  );
}
