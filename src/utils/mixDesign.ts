/** ACI-style mix design helpers for Mix Design Advisor */

export const MIX_DESIGN_PSI_OPTIONS = [
  { value: '2500', labelImperial: '2,500 PSI', labelMetric: '17 MPa (2,500 PSI)' },
  { value: '3000', labelImperial: '3,000 PSI', labelMetric: '21 MPa (3,000 PSI)' },
  { value: '3500', labelImperial: '3,500 PSI', labelMetric: '24 MPa (3,500 PSI)' },
  { value: '4000', labelImperial: '4,000 PSI', labelMetric: '28 MPa (4,000 PSI)' },
  { value: '5000', labelImperial: '5,000 PSI', labelMetric: '35 MPa (5,000 PSI)' },
] as const;

export type MixExposure = 'F1' | 'F2' | 'F3' | 'none';
export type MixClimate = 'temperate' | 'tropical';

export interface MixDesignRecommendation {
  waterCementRatio: number;
  targetAir: [number, number];
  aeFactor: number;
  evaporationRate: {
    imperial: number;
    metric: number;
  };
  recommendations: string[];
}

/** Base w/c by design strength (ACI 211.1 style targets). */
export function getBaseWaterCementRatio(psi: number): number {
  if (psi >= 5000) return 0.45;
  if (psi >= 4000) return 0.5;
  if (psi >= 3500) return 0.54;
  if (psi >= 3000) return 0.55;
  return 0.58;
}

/** Max w/c for durability — not increased for hot weather. */
export function getMaxAllowedWaterCementRatio(params: {
  psi: number;
  exposure: MixExposure;
  sulfateExposure?: boolean;
  chlorideExposure?: boolean;
  marineCoastal?: boolean;
}): number {
  let maxWc = getBaseWaterCementRatio(params.psi);
  if (params.exposure === 'F2') maxWc = Math.min(maxWc, 0.5);
  if (params.exposure === 'F3') maxWc = Math.min(maxWc, 0.45);
  if (params.sulfateExposure) maxWc = Math.min(maxWc, 0.45);
  if (params.chlorideExposure || params.marineCoastal) maxWc = Math.min(maxWc, 0.4);
  return maxWc;
}

export function parseMixDesignPsi(value: string): number {
  const n = parseInt(String(value).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 4000;
}

/** Menzel-style evaporation rate — inputs always °F and mph. */
export function calculateEvaporationRateImperial(
  tempF: number,
  humidityPercent: number,
  windMph: number,
): { imperial: number; metric: number } {
  const RH = Math.min(1, Math.max(0, humidityPercent / 100));
  const V = Math.max(0, windMph);
  const E_us =
    (Math.pow(tempF, 2.5) - RH * Math.pow(tempF, 2.5)) * (1 + 0.4 * V) * 1e-6;
  const E_metric = E_us * 4.88243;
  return { imperial: E_us, metric: E_metric };
}

export function getEvaporationRiskLevel(metricRate: number): {
  level: 'Low' | 'Moderate' | 'High';
  color: 'green' | 'yellow' | 'red';
} {
  if (metricRate <= 0.5) return { level: 'Low', color: 'green' };
  if (metricRate <= 1.0) return { level: 'Moderate', color: 'yellow' };
  return { level: 'High', color: 'red' };
}

function getMitigationSteps(metricRate: number): string[] {
  if (metricRate <= 0.5) {
    return [
      'Standard curing procedures are adequate',
      'Monitor surface moisture during finishing',
      'Apply curing compound after final finishing',
    ];
  }
  if (metricRate <= 1.0) {
    return [
      'Erect windbreaks or sun-shades around placement area',
      'Begin light fogging every 15-30 minutes',
      'Apply curing compound when bleeding stops',
      'Consider rescheduling placement for better conditions',
    ];
  }
  return [
    'IMMEDIATE ACTION REQUIRED',
    'Apply evaporation retarder right after screeding',
    'Cover surface with wet burlap or poly sheeting',
    'Mandatory wet curing for minimum 24 hours',
    'Use windbreaks and sunshades',
    'Reschedule placement if possible',
  ];
}

export function suggestConcreteParameters(params: {
  tempF: number;
  humidityPercent: number;
  windMph: number;
  psi: number;
  exposure: MixExposure;
  climate: MixClimate;
}): MixDesignRecommendation {
  const { tempF, humidityPercent, windMph, psi, exposure, climate } = params;
  const tempC = ((tempF - 32) * 5) / 9;

  const wc = getMaxAllowedWaterCementRatio({
    psi,
    exposure,
    sulfateExposure: false,
    chlorideExposure: false,
    marineCoastal: false,
  });

  const airContent =
    climate === 'tropical'
      ? { none: [2, 4], F1: [3, 5], F2: [4, 6], F3: [5, 7] }[exposure]
      : { none: [3, 5], F1: [4, 6], F2: [5, 7], F3: [6, 8] }[exposure];

  const aeAdjustment = tempC > 38 ? 1.25 : tempC < 4 ? 0.6 : 1.0;
  const evapRate = calculateEvaporationRateImperial(tempF, humidityPercent, windMph);

  const recommendations: string[] = [];

  if (climate === 'temperate' && tempF < 40) {
    recommendations.push('Use Type C non-chloride accelerator');
    recommendations.push('Heat mixing water (max 140°F/60°C)');
    recommendations.push('Protect concrete from freezing');
  }

  if (tempF > 90 || (climate === 'tropical' && tempF > 85)) {
    recommendations.push('CRITICAL: Use Type D water-reducing retarder');
    recommendations.push('Schedule placement for early morning or evening');
    recommendations.push(
      'Consider using chilled water or ice as partial water replacement',
    );
    recommendations.push('Use light-colored curing compounds to reduce heat absorption');
  }

  if (climate === 'tropical') {
    recommendations.push('Use Type F or G superplasticizer for improved workability');
    recommendations.push('Consider using fly ash to reduce heat of hydration');
    if (humidityPercent > 80) {
      recommendations.push('Increase setting time with appropriate admixtures');
    }
  }

  recommendations.push(...getMitigationSteps(evapRate.metric));

  if (humidityPercent < 30) {
    recommendations.push('Increase curing compound application rate by 25%');
    recommendations.push('Use synthetic fiber reinforcement');
  }

  return {
    waterCementRatio: wc,
    targetAir: airContent as [number, number],
    aeFactor: aeAdjustment,
    evaporationRate: evapRate,
    recommendations,
  };
}

/** Weather API returns °F and mph — normalize for mix formulas. */
export function weatherToMixInputs(
  temperatureF: number,
  humidityPercent: number,
  windMph: number,
): { tempF: number; humidityPercent: number; windMph: number } {
  return {
    tempF: temperatureF,
    humidityPercent: humidityPercent,
    windMph: windMph,
  };
}
