import type { Calculation } from '../types/index';
import type {
  AccessFactorKey,
  ComplexityLevel,
  CrewEfficiency,
  PlacementMethod,
  WeatherFactorKey,
} from '../types/pourPlanner';

/** Default field-planning rates per worker. */
export const DEFAULT_LABORER_CY_HR = 3;
export const DEFAULT_FINISHER_SF_HR = 200;
export const DEFAULT_PLACING_CY_PER_LABOR_HR = 2.5;
export const DEFAULT_FINISHING_SF_PER_LABOR_HR = 250;

export type BottleneckSource =
  | 'placement_crew'
  | 'finishing_crew'
  | 'pump'
  | 'manual';

export const CREW_EFFICIENCY: Record<CrewEfficiency, number> = {
  excellent: 1.0,
  average: 0.85,
  new: 0.7,
};

export const ACCESS_FACTORS: Record<AccessFactorKey, number> = {
  chute: 1.0,
  pump: 0.9,
  conveyor: 0.85,
  buggy: 0.75,
  bucket: 0.5,
  wheelbarrow: 0.5,
};

export const WEATHER_FACTORS: Record<WeatherFactorKey, number> = {
  normal: 1.0,
  hot: 0.9,
  cold: 0.85,
  rain: 0.8,
};

export const COMPLEXITY_FACTORS: Record<ComplexityLevel, number> = {
  open_slab: 1.0,
  heavy_rebar: 0.85,
  curbs_edges: 0.75,
  tight_access: 0.7,
};

export interface ProductionFactors {
  efficiency: number;
  access: number;
  weather: number;
  complexity: number;
  combined: number;
}

export interface PlacementRateEstimate {
  placementCrewRateCYHr: number;
  finishingRateCYHr: number;
  rawRateCYHr: number;
  adjustedRateCYHr: number;
  /** Alias for truck scheduling — same as adjusted rate unless manual override applied upstream. */
  effectiveRateYdPerHr: number;
  limitingFactor: BottleneckSource;
  laborers: number;
  finishers: number;
  vibrators: number;
  slabAreaSqFt: number | null;
  slabThicknessFt: number | null;
  factors: ProductionFactors;
  summary: string;
  bottleneckRecommendation: string | null;
  placingLaborHours: number;
  finishingLaborHours: number;
  setupCleanupHours: number;
  baseLaborHours: number;
  adjustedLaborHours: number;
  estimatedCrewDurationHours: number;
  laborCost: number | null;
}

export function getCalculationAreaSqFt(calculation: Calculation | undefined): number | null {
  if (!calculation?.dimensions) return null;
  const d = calculation.dimensions;

  if (d.length > 0 && d.width > 0) {
    return d.length * d.width;
  }
  if (d.diameter > 0) {
    const r = d.diameter / 2;
    return Math.PI * r * r;
  }
  return null;
}

/** Thickness dimensions are stored as decimal feet in saved calculations. */
export function getCalculationThicknessFt(calculation: Calculation | undefined): number | null {
  if (!calculation?.dimensions) return null;
  const d = calculation.dimensions;

  const thickness =
    d.thickness ??
    d.baseThickness ??
    d.base_thickness ??
    d.depth;

  if (thickness != null && thickness > 0) return thickness;

  if (d.height > 0 && (calculation.type === 'column' || calculation.type === 'footer')) {
    return d.height;
  }

  return null;
}

export function parseSlabAreaSqFt(slabSize: string): number | null {
  const match = slabSize.match(/([\d.]+)\s*[×x]\s*([\d.]+)/i);
  if (!match) return null;
  const length = parseFloat(match[1]);
  const width = parseFloat(match[2]);
  if (!Number.isFinite(length) || !Number.isFinite(width) || length <= 0 || width <= 0) {
    return null;
  }
  return length * width;
}

export function parseSlabThicknessIn(slabSize: string): number | null {
  const match = slabSize.match(/([\d.]+)\s*in\s*(?:thick|base)/i);
  if (!match) return null;
  const inches = parseFloat(match[1]);
  return Number.isFinite(inches) && inches > 0 ? inches : null;
}

export function resolveSlabAreaSqFt(
  calculation: Calculation | undefined,
  slabSize: string,
): number | null {
  return getCalculationAreaSqFt(calculation) ?? parseSlabAreaSqFt(slabSize);
}

export function resolveSlabThicknessFt(
  calculation: Calculation | undefined,
  slabSize: string,
  manualThicknessIn: string,
): number {
  const fromCalc = getCalculationThicknessFt(calculation);
  if (fromCalc != null && fromCalc > 0) return fromCalc;

  const manualIn = parseFloat(manualThicknessIn);
  if (Number.isFinite(manualIn) && manualIn > 0) return manualIn / 12;

  const fromSlabSize = parseSlabThicknessIn(slabSize);
  if (fromSlabSize != null) return fromSlabSize / 12;

  return 6 / 12;
}

function parseCount(value: string | undefined, fallback = 0): number {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseRate(value: string | undefined, fallback: number): number {
  const n = parseFloat(value ?? '');
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function accessFactorFromMethod(method: PlacementMethod): number {
  switch (method) {
    case 'chute':
      return ACCESS_FACTORS.chute;
    case 'pump':
      return ACCESS_FACTORS.pump;
    case 'conveyor':
      return ACCESS_FACTORS.conveyor;
    case 'buggy':
      return ACCESS_FACTORS.buggy;
    case 'bucket':
      return ACCESS_FACTORS.bucket;
    default:
      return ACCESS_FACTORS.chute;
  }
}

export function accessKeyFromMethod(method: PlacementMethod): AccessFactorKey {
  switch (method) {
    case 'pump':
      return 'pump';
    case 'conveyor':
      return 'conveyor';
    case 'buggy':
      return 'buggy';
    case 'bucket':
      return 'bucket';
    default:
      return 'chute';
  }
}

export function resolveAccessFactor(
  mode: 'auto' | AccessFactorKey,
  placementMethod: PlacementMethod,
): number {
  if (mode !== 'auto') return ACCESS_FACTORS[mode];
  return accessFactorFromMethod(placementMethod);
}

export function resolveWeatherFactor(params: {
  mode: 'auto' | WeatherFactorKey;
  ambientTempF?: string;
  rainForecast?: boolean;
  nightPour?: boolean;
  hotWeatherRisk?: 'low' | 'moderate' | 'high';
}): number {
  if (params.mode !== 'auto') return WEATHER_FACTORS[params.mode];

  if (params.rainForecast) return WEATHER_FACTORS.rain;

  const temp = parseFloat(params.ambientTempF ?? '');
  if (Number.isFinite(temp) && temp < 40) return WEATHER_FACTORS.cold;

  if (params.hotWeatherRisk === 'high' || params.hotWeatherRisk === 'moderate') {
    return WEATHER_FACTORS.hot;
  }

  if (params.nightPour) return 0.92;

  return WEATHER_FACTORS.normal;
}

export function complexityFromCalculation(calculation: Calculation | undefined): ComplexityLevel {
  if (!calculation) return 'open_slab';
  switch (calculation.type) {
    case 'thickened_edge_slab':
      return 'curbs_edges';
    case 'footer':
    case 'column':
      return 'heavy_rebar';
    default:
      return 'open_slab';
  }
}

function resolveLaborers(crewSize: number, finishers: number): number {
  if (crewSize <= 0) return 4;
  if (finishers <= 0) return crewSize;
  return Math.max(1, crewSize - finishers);
}

function finisherCYHr(
  finishers: number,
  finisherSFHr: number,
  slabThicknessFt: number,
): number {
  if (finishers <= 0 || finisherSFHr <= 0 || slabThicknessFt <= 0) return Infinity;
  return (finishers * finisherSFHr * slabThicknessFt) / 27;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function estimatePlacementProductionRate(params: {
  crewSize: string;
  finishers: string;
  vibrators?: string;
  placementMethod: PlacementMethod;
  pumpRateYdPerHr?: string;
  calculation?: Calculation;
  slabSize?: string;
  slabThicknessIn?: string;
  laborerRateCYHr?: string;
  finisherRateSFHr?: string;
  placingProductivityCYPerLaborHour?: string;
  finishingProductivitySFPerLaborHour?: string;
  crewEfficiency?: CrewEfficiency;
  complexityFactor?: ComplexityLevel;
  accessFactorMode?: 'auto' | AccessFactorKey;
  weatherFactorMode?: 'auto' | WeatherFactorKey;
  ambientTempF?: string;
  rainForecast?: boolean;
  nightPour?: boolean;
  hotWeatherRisk?: 'low' | 'moderate' | 'high';
  concreteVolumeYd?: number;
  burdenedHourlyRate?: string;
  setupHours?: string;
  cleanupHours?: string;
}): PlacementRateEstimate {
  const crew = parseCount(params.crewSize);
  const finishers = parseCount(params.finishers);
  const vibrators = parseCount(params.vibrators ?? '0');
  const laborers = resolveLaborers(crew, finishers);

  const laborerRate = parseRate(params.laborerRateCYHr, DEFAULT_LABORER_CY_HR);
  const finisherSFHr = parseRate(params.finisherRateSFHr, DEFAULT_FINISHER_SF_HR);
  const placingProductivity = parseRate(
    params.placingProductivityCYPerLaborHour,
    DEFAULT_PLACING_CY_PER_LABOR_HR,
  );
  const finishingProductivity = parseRate(
    params.finishingProductivitySFPerLaborHour,
    DEFAULT_FINISHING_SF_PER_LABOR_HR,
  );

  const slabAreaSqFt = resolveSlabAreaSqFt(params.calculation, params.slabSize ?? '');
  const slabThicknessFt = resolveSlabThicknessFt(
    params.calculation,
    params.slabSize ?? '',
    params.slabThicknessIn ?? '',
  );

  const placementCrewRateCYHr = laborers * laborerRate;
  const finishingRateCYHr = finisherCYHr(finishers, finisherSFHr, slabThicknessFt);

  let rawRateCYHr = Math.min(placementCrewRateCYHr, finishingRateCYHr);
  let limitingFactor: BottleneckSource =
    placementCrewRateCYHr <= finishingRateCYHr ? 'placement_crew' : 'finishing_crew';

  if (!Number.isFinite(rawRateCYHr) || rawRateCYHr <= 0) {
    rawRateCYHr = placementCrewRateCYHr || 6;
    limitingFactor = 'placement_crew';
  }

  const efficiency = CREW_EFFICIENCY[params.crewEfficiency ?? 'average'];
  const access = resolveAccessFactor(params.accessFactorMode ?? 'auto', params.placementMethod);
  const weather = resolveWeatherFactor({
    mode: params.weatherFactorMode ?? 'auto',
    ambientTempF: params.ambientTempF,
    rainForecast: params.rainForecast,
    nightPour: params.nightPour,
    hotWeatherRisk: params.hotWeatherRisk,
  });
  const complexity =
    COMPLEXITY_FACTORS[params.complexityFactor ?? complexityFromCalculation(params.calculation)];

  let combinedFactor = efficiency * access * weather * complexity;

  if (vibrators >= 2 && slabAreaSqFt != null && slabAreaSqFt > 5000) {
    combinedFactor *= 1.05;
  }

  let adjustedRateCYHr = rawRateCYHr * combinedFactor;

  if (params.placementMethod === 'pump') {
    const pumpRate = parseFloat(params.pumpRateYdPerHr ?? '') || 40;
    if (pumpRate > 0 && pumpRate < adjustedRateCYHr) {
      adjustedRateCYHr = pumpRate;
      limitingFactor = 'pump';
    }
  }

  adjustedRateCYHr = Math.max(1, Math.min(60, adjustedRateCYHr));
  const effectiveRateYdPerHr = round1(adjustedRateCYHr);

  const volumeYd = Math.max(0, params.concreteVolumeYd ?? 0);
  const placingLaborHours =
    volumeYd > 0 ? volumeYd / placingProductivity : 0;
  const finishingLaborHours =
    slabAreaSqFt != null && slabAreaSqFt > 0
      ? slabAreaSqFt / finishingProductivity
      : 0;
  const setupCleanupHours =
    parseRate(params.setupHours, 2) + parseRate(params.cleanupHours, 2);
  const baseLaborHours = placingLaborHours + finishingLaborHours + setupCleanupHours;
  const laborMultiplier = weather * access * complexity;
  const adjustedLaborHours = baseLaborHours * laborMultiplier;
  const crewForDuration = crew > 0 ? crew : 1;
  const estimatedCrewDurationHours = adjustedLaborHours / crewForDuration;

  const burdenedRate = parseFloat(params.burdenedHourlyRate ?? '');
  const laborCost =
    Number.isFinite(burdenedRate) && burdenedRate > 0
      ? adjustedLaborHours * burdenedRate
      : null;

  const bottleneckRecommendation = buildBottleneckRecommendation({
    limitingFactor,
    laborers,
    finishers,
    laborerRate,
    finisherSFHr,
    slabThicknessFt,
    placementCrewRateCYHr,
    finishingRateCYHr,
    rawRateCYHr,
    combinedFactor: efficiency * access * weather * complexity,
    placementMethod: params.placementMethod,
    pumpRateYdPerHr: params.pumpRateYdPerHr,
  });

  const summaryParts: string[] = [];
  summaryParts.push(
    `${laborers} laborer${laborers !== 1 ? 's' : ''} → ${round1(placementCrewRateCYHr)} CY/hr`,
  );
  summaryParts.push(
    `${finishers} finisher${finishers !== 1 ? 's' : ''} → ${round1(finishingRateCYHr)} CY/hr`,
  );
  summaryParts.push(
    `factors ${round1(efficiency * 100)}% eff × ${round1(access * 100)}% access × ${round1(weather * 100)}% weather × ${round1(complexity * 100)}% complexity`,
  );

  return {
    placementCrewRateCYHr: round1(placementCrewRateCYHr),
    finishingRateCYHr: round1(finishingRateCYHr),
    rawRateCYHr: round1(rawRateCYHr),
    adjustedRateCYHr: effectiveRateYdPerHr,
    effectiveRateYdPerHr,
    limitingFactor,
    laborers,
    finishers,
    vibrators,
    slabAreaSqFt,
    slabThicknessFt,
    factors: {
      efficiency,
      access,
      weather,
      complexity,
      combined: round1(combinedFactor * 100) / 100,
    },
    summary: summaryParts.join(' · '),
    bottleneckRecommendation,
    placingLaborHours: round1(placingLaborHours),
    finishingLaborHours: round1(finishingLaborHours),
    setupCleanupHours: round1(setupCleanupHours),
    baseLaborHours: round1(baseLaborHours),
    adjustedLaborHours: round1(adjustedLaborHours),
    estimatedCrewDurationHours: round1(estimatedCrewDurationHours),
    laborCost: laborCost != null ? Math.round(laborCost) : null,
  };
}

function buildBottleneckRecommendation(params: {
  limitingFactor: BottleneckSource;
  laborers: number;
  finishers: number;
  laborerRate: number;
  finisherSFHr: number;
  slabThicknessFt: number;
  placementCrewRateCYHr: number;
  finishingRateCYHr: number;
  rawRateCYHr: number;
  combinedFactor: number;
  placementMethod: PlacementMethod;
  pumpRateYdPerHr?: string;
}): string | null {
  const { rawRateCYHr, combinedFactor } = params;
  if (rawRateCYHr <= 0 || combinedFactor <= 0) return null;

  if (params.limitingFactor === 'finishing_crew' && params.finishers > 0) {
    const newFinishing = finisherCYHr(
      params.finishers + 1,
      params.finisherSFHr,
      params.slabThicknessFt,
    );
    const newRaw = Math.min(params.placementCrewRateCYHr, newFinishing);
    const pct = ((newRaw - rawRateCYHr) / rawRateCYHr) * 100;
    if (pct >= 1) {
      return `Add 1 finisher to increase placement rate by ~${Math.round(pct)}%`;
    }
  }

  if (params.limitingFactor === 'placement_crew') {
    const newPlacement = (params.laborers + 1) * params.laborerRate;
    const newRaw = Math.min(newPlacement, params.finishingRateCYHr);
    const pct = ((newRaw - rawRateCYHr) / rawRateCYHr) * 100;
    if (pct >= 1) {
      return `Add 1 laborer to increase placement rate by ~${Math.round(pct)}%`;
    }
  }

  if (params.limitingFactor === 'pump') {
    const pumpRate = parseFloat(params.pumpRateYdPerHr ?? '') || 40;
    return `Pump output (${pumpRate} CY/hr) is limiting — increase pump capacity or reduce pour volume per hour`;
  }

  return null;
}

export const BOTTLENECK_LABELS: Record<BottleneckSource, string> = {
  placement_crew: 'Placement crew',
  finishing_crew: 'Finishing crew',
  pump: 'Pump output',
  manual: 'Manual override',
};
