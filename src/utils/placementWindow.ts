import { recommendedTruckCount } from './readyMixDelivery';

export const ASTM_C94_MAX_MINUTES = 90;
export const ASTM_C94_MAX_DRUM_REVOLUTIONS = 300;
export const PLASTIC_SHRINKAGE_THRESHOLD_LB_FT2_HR = 0.2;

export type TimeRiskLevel = 'ok' | 'caution' | 'critical';
export type SlumpRiskLevel = 'low' | 'moderate' | 'high';
export type EvaporationRiskLevel = 'low' | 'moderate' | 'high';

export interface DeliveryWindowAnalysis {
  travelTimeMin: number;
  trafficBufferMin: number;
  siteWaitMin: number;
  dischargeMin: number;
  totalElapsedMin: number;
  allowedMinutes: number;
  remainingMinutes: number;
  riskLevel: TimeRiskLevel;
  riskLabel: string;
  statusLabel: string;
}

export interface PlacementProductionAnalysis {
  placementDurationHours: number;
  /** Recommended minutes between truck arrivals (discharge-based, not full placement per load). */
  truckSpacingMinutes: number;
  truckDischargeMinutes: number;
  recommendedTrucks: number;
  /** Minutes to discharge one load at the given rate. */
  minutesPerLoadDischarge: number;
  /** Minutes to spread one full load at crew placement rate (for capacity warnings). */
  minutesPerLoadPlacement: number;
}

export interface SlumpRiskAnalysis {
  requiredSlump: number;
  placementMethod: string;
  riskLevel: SlumpRiskLevel;
  riskLabel: string;
  recommendation: string;
}

export interface HotWeatherAnalysis {
  evaporationRateLbFt2Hr: number;
  evaporationRateKgM2H: number;
  riskLevel: EvaporationRiskLevel;
  riskLabel: string;
  actions: string[];
}

function parseNum(value: string | number | undefined, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const n = parseFloat(value ?? '');
  return Number.isFinite(n) ? n : fallback;
}

export function analyzeDeliveryWindow(params: {
  travelTimeMin: number | string;
  trafficBufferMin: number | string;
  siteWaitMin: number | string;
  dischargeMin: number | string;
  allowedMinutes?: number;
}): DeliveryWindowAnalysis {
  const allowedMinutes = params.allowedMinutes ?? ASTM_C94_MAX_MINUTES;
  const travelTimeMin = Math.max(0, parseNum(params.travelTimeMin));
  const trafficBufferMin = Math.max(0, parseNum(params.trafficBufferMin));
  const siteWaitMin = Math.max(0, parseNum(params.siteWaitMin));
  const dischargeMin = Math.max(0, parseNum(params.dischargeMin));

  const totalElapsedMin =
    travelTimeMin + trafficBufferMin + siteWaitMin + dischargeMin;
  const remainingMinutes = allowedMinutes - totalElapsedMin;

  let riskLevel: TimeRiskLevel;
  let riskLabel: string;
  let statusLabel: string;

  if (remainingMinutes >= 30) {
    riskLevel = 'ok';
    riskLabel = 'Enough time';
    statusLabel = 'GOOD';
  } else if (remainingMinutes >= 15) {
    riskLevel = 'caution';
    riskLabel = 'Tight window';
    statusLabel = 'CAUTION';
  } else {
    riskLevel = 'critical';
    riskLabel = 'High rejection / delay risk';
    statusLabel = 'HIGH RISK';
  }

  return {
    travelTimeMin,
    trafficBufferMin,
    siteWaitMin,
    dischargeMin,
    totalElapsedMin,
    allowedMinutes,
    remainingMinutes,
    riskLevel,
    riskLabel,
    statusLabel,
  };
}

export function analyzePlacementProduction(params: {
  totalVolumeYd: number;
  placementRateYdPerHr: number | string;
  truckCapacityYd: number | string;
  dischargeRateYdPerHr?: number | string;
  recommendedTrucks?: number;
}): PlacementProductionAnalysis {
  const totalVolumeYd = Math.max(0, params.totalVolumeYd);
  const placementRate = Math.max(0.1, parseNum(params.placementRateYdPerHr, 20));
  const truckCapacityYd = Math.max(0.1, parseNum(params.truckCapacityYd, 10));
  const dischargeRate = Math.max(0.1, parseNum(params.dischargeRateYdPerHr, 30));

  const placementDurationHours = totalVolumeYd / placementRate;
  const recommendedTrucks =
    params.recommendedTrucks ??
    (totalVolumeYd > 0
      ? recommendedTruckCount(totalVolumeYd, truckCapacityYd)
      : 0);

  const minutesPerLoadDischarge = (truckCapacityYd / dischargeRate) * 60;
  const minutesPerLoadPlacement = (truckCapacityYd / placementRate) * 60;
  const truckDischargeMinutes = minutesPerLoadDischarge;

  // Arrival spacing: next truck when the previous truck finishes discharging.
  // Fresh concrete can be placed while earlier loads are still being worked — finishing
  // a full load before the next truck arrives is not required for a monolithic pour.
  const truckSpacingMinutes =
    recommendedTrucks <= 1 ? 0 : minutesPerLoadDischarge;

  return {
    placementDurationHours,
    truckSpacingMinutes,
    truckDischargeMinutes,
    recommendedTrucks,
    minutesPerLoadDischarge,
    minutesPerLoadPlacement,
  };
}

export function analyzeSlumpRisk(params: {
  requiredSlump: number | string;
  placementMethod: string;
  elapsedMinutes?: number;
  concreteTempF?: number;
  isPump?: boolean;
}): SlumpRiskAnalysis {
  const requiredSlump = parseNum(params.requiredSlump, 4);
  const elapsed = parseNum(params.elapsedMinutes);
  const temp = parseNum(params.concreteTempF, 70);
  const isPump = params.isPump ?? params.placementMethod === 'pump';

  let riskLevel: SlumpRiskLevel = 'low';
  if (elapsed > 60 || temp > 85 || isPump) riskLevel = 'moderate';
  if (elapsed > 75 || temp > 90 || (isPump && elapsed > 45)) riskLevel = 'high';

  const riskLabel =
    riskLevel === 'high' ? 'High' : riskLevel === 'moderate' ? 'Moderate' : 'Low';

  return {
    requiredSlump,
    placementMethod: params.placementMethod || 'general',
    riskLevel,
    riskLabel,
    recommendation:
      'Slump must match project specifications and mix design. Do not add water beyond approved limits. Use admixtures when needed.',
  };
}

/** ACI 305 simplified Menzel form (matches pourScoring). */
export function aci305EvaporationLbFt2Hr(
  airTempF: number,
  humidityPercent: number,
  windMph: number,
  concreteTempF?: number,
): number {
  const Tc = concreteTempF ?? airTempF + 5;
  const Ta = airTempF;
  const RH = Math.min(100, Math.max(0, humidityPercent)) / 100;
  const V = Math.max(0, windMph);
  const E =
    (Math.pow(Tc, 2.5) - RH * Math.pow(Ta, 2.5)) * (1 + 0.4 * V) * 1e-6;
  return Math.max(0, E);
}

export function analyzeHotWeather(params: {
  airTempF: number | string;
  humidityPercent: number | string;
  windMph: number | string;
  concreteTempF?: number | string;
}): HotWeatherAnalysis {
  const airTempF = parseNum(params.airTempF, 70);
  const humidityPercent = parseNum(params.humidityPercent, 50);
  const windMph = parseNum(params.windMph, 5);
  const concreteTempF = parseNum(params.concreteTempF, airTempF + 5);

  const evaporationRateLbFt2Hr = aci305EvaporationLbFt2Hr(
    airTempF,
    humidityPercent,
    windMph,
    concreteTempF,
  );
  const evaporationRateKgM2H = evaporationRateLbFt2Hr * 4.88243;

  let riskLevel: EvaporationRiskLevel = 'low';
  if (evaporationRateLbFt2Hr >= PLASTIC_SHRINKAGE_THRESHOLD_LB_FT2_HR) {
    riskLevel = 'moderate';
  }
  if (evaporationRateLbFt2Hr >= 0.3) {
    riskLevel = 'high';
  }

  const actions: string[] = [];
  if (riskLevel !== 'low') {
    actions.push('Use wind breaks or fogging');
    actions.push('Apply evaporation retarder after screeding');
    actions.push('Begin curing immediately after finishing');
  }
  if (riskLevel === 'high') {
    actions.push('Reduce truck spacing to limit onsite wait');
    actions.push('Consider earlier pour time or reschedule to cooler hours');
  }

  return {
    evaporationRateLbFt2Hr,
    evaporationRateKgM2H,
    riskLevel,
    riskLabel: riskLevel === 'high' ? 'High' : riskLevel === 'moderate' ? 'Moderate' : 'Low',
    actions,
  };
}

export function timeRiskColor(level: TimeRiskLevel): string {
  switch (level) {
    case 'ok':
      return 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800';
    case 'caution':
      return 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800';
    case 'critical':
      return 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
  }
}
