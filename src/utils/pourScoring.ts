import type { ForecastDay, ForecastHour } from '../types';

export type PourRating = 'excellent' | 'good' | 'fair' | 'poor' | 'avoid';
export type ForecastConfidence = 'high' | 'medium' | 'low';
export type EvaporationRiskLevel = 'low' | 'moderate' | 'severe';
export type Finishability = 'excellent' | 'good' | 'fair' | 'poor';
export type PlacementType = 'flatwork' | 'footing' | 'wall' | 'mass';

export interface ScoredPourDay extends ForecastDay {
  rating: PourRating;
  /** Score after penalties, before mitigation credits */
  baseScore: number;
  /** Final score (base + mitigations, clamped) */
  score: number;
  reasons: string[];
  precautions: string[];
  primaryRisks: string[];
  recommendedActions: string[];
  criticalFail: boolean;
  criticalMessage?: string;
  severeWeatherCapApplied: boolean;
  evaporationRateKgM2H?: number;
  evaporationRisk: EvaporationRiskLevel;
  finishability: Finishability;
  finishabilityIssues: string[];
  forecastConfidence: ForecastConfidence;
  appliedMitigations: string[];
  mitigationCredit: number;
}

export interface TimeOfDayWindow {
  label: string;
  startHour: number;
  endHour: number;
  estimatedScore: number;
  estimatedRating: PourRating;
}

import {
  buildWeatherContext,
  computeMitigationCredit,
  filterApplicableMitigationIds,
  type MitigationOption,
} from './pourMitigations';

export type { MitigationOption };
export {
  MITIGATION_OPTIONS,
  MITIGATION_DISCLAIMER,
  getApplicableMitigations,
  getMaxMitigationRecovery,
  buildWeatherContext,
  MAX_MITIGATION_CREDIT_DEFAULT,
} from './pourMitigations';

const RATING_ORDER: PourRating[] = ['excellent', 'good', 'fair', 'poor', 'avoid'];

const SEVERE_WEATHER_SCORE_CAP = 25;

const CRITICAL_PLACEMENT_MESSAGE =
  'ACI conditions indicate concrete placement should be delayed unless mitigation measures are in place.';

/** ACI 305R placement conditions score bands */
export function scoreToRating(score: number): PourRating {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'poor';
  return 'avoid';
}

export function ratingColor(rating: PourRating): string {
  switch (rating) {
    case 'excellent':
      return 'green';
    case 'good':
      return 'emerald';
    case 'fair':
      return 'yellow';
    case 'poor':
      return 'orange';
    case 'avoid':
      return 'red';
  }
}

export function ratingLabel(rating: PourRating): string {
  switch (rating) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'fair':
      return 'Caution';
    case 'poor':
      return 'High risk';
    case 'avoid':
      return 'Delay';
  }
}

export function confidenceLabel(confidence: ForecastConfidence): string {
  switch (confidence) {
    case 'high':
      return 'High (24 hr)';
    case 'medium':
      return 'Medium (2–3 day)';
    case 'low':
      return 'Low (4–7 day)';
  }
}

export function evaporationRiskLabel(level: EvaporationRiskLevel): string {
  switch (level) {
    case 'low':
      return 'Low';
    case 'moderate':
      return 'Moderate';
    case 'severe':
      return 'Severe';
  }
}

export function finishabilityLabel(f: Finishability): string {
  switch (f) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'fair':
      return 'Fair';
    case 'poor':
      return 'Poor';
  }
}

export function getEvaporationRiskLevel(kgM2H: number): EvaporationRiskLevel {
  if (kgM2H >= 1.0) return 'severe';
  if (kgM2H >= 0.5) return 'moderate';
  return 'low';
}

export function getForecastConfidence(dayIndex: number): ForecastConfidence {
  if (dayIndex <= 0) return 'high';
  if (dayIndex <= 2) return 'medium';
  return 'low';
}

function lbPerFt2HrToKgM2H(lb: number): number {
  return lb * 4.88243;
}

/**
 * Menzel/Uno evaporation rate (imperial → lb/ft²/h), ACI 305R field practice.
 * Uses the simplified Menzel form: E = (Tc^2.5 − RH·Ta^2.5)(1 + 0.4V)×10⁻⁶
 * (Tc = concrete °F, Ta = air °F, RH = relative humidity 0–1, V = wind mph).
 * Calibrates to ~0.18 lb/ft²/h for Tc=80°F, Ta=70°F, RH=50%, V=10 mph.
 */
export function estimateEvaporationRateLbPerFt2Hr(
  airTempF: number,
  humidityPercent: number,
  windMph: number,
  concreteTempF?: number,
): number {
  const Tc = concreteTempF ?? airTempF + 5;
  const Ta = airTempF;
  const RH = Math.min(100, Math.max(0, humidityPercent)) / 100;
  const V = Math.max(0, windMph);

  const E = (Math.pow(Tc, 2.5) - RH * Math.pow(Ta, 2.5)) * (1 + 0.4 * V) * 1e-6;
  return Math.max(0, E);
}

function estimateConcreteTemp(day: ForecastDay): number {
  return Math.min(day.maxTemp, day.avgTemp + 8);
}

function conditionsLower(conditions: string): string {
  return conditions.toLowerCase();
}

function hasLightShowers(day: ForecastDay, lower: string): boolean {
  return (
    day.chanceOfRain > 0 &&
    day.chanceOfRain <= 30 &&
    day.totalPrecipitation < 0.1 &&
    (lower.includes('shower') || lower.includes('drizzle'))
  );
}

function hasHeavyRainOrStorms(lower: string): boolean {
  return (
    lower.includes('heavy rain') ||
    lower.includes('thunder') ||
    lower.includes('storm')
  );
}

function hasLightning(lower: string): boolean {
  return lower.includes('lightning') || lower.includes('thunder');
}

function hasHail(lower: string): boolean {
  return lower.includes('hail');
}

function hasSnowOrIce(lower: string): boolean {
  return (
    lower.includes('snow') ||
    lower.includes('blizzard') ||
    lower.includes('ice') ||
    lower.includes('sleet') ||
    lower.includes('freez')
  );
}

function hasTropicalStorm(lower: string): boolean {
  return (
    lower.includes('tropical') ||
    lower.includes('hurricane') ||
    lower.includes('typhoon')
  );
}

function triggersSevereWeatherCap(lower: string): boolean {
  return (
    hasTropicalStorm(lower) ||
    hasLightning(lower) ||
    hasHail(lower) ||
    hasHeavyRainOrStorms(lower)
  );
}

interface CriticalFailResult {
  critical: boolean;
  message?: string;
  conditions: string[];
}

function detectCriticalFail(
  day: ForecastDay,
  lower: string,
): CriticalFailResult {
  const conditions: string[] = [];

  if (hasLightning(lower)) {
    conditions.push('Active lightning / thunderstorms in forecast');
  }
  if (hasTropicalStorm(lower)) {
    conditions.push('Hurricane or tropical storm conditions');
  }
  if (day.minTemp <= 32 && hasSnowOrIce(lower)) {
    conditions.push('Freezing conditions with winter precipitation');
  } else if (day.minTemp <= 20) {
    conditions.push('Extreme cold without verified protection plan');
  }
  if (hasHeavyRainOrStorms(lower)) {
    conditions.push('Heavy precipitation during expected finishing window');
  }

  if (conditions.length === 0) {
    return { critical: false, conditions: [] };
  }

  return {
    critical: true,
    message: CRITICAL_PLACEMENT_MESSAGE,
    conditions,
  };
}

function placementTypeModifier(type: PlacementType | undefined): number {
  switch (type) {
    case 'flatwork':
      return -8;
    case 'footing':
      return 5;
    case 'wall':
      return 0;
    case 'mass':
      return -5;
    default:
      return 0;
  }
}

function scoreColdWeather(minTemp: number, reasons: string[], precautions: string[]): number {
  let penalty = 0;
  if (minTemp <= 20) {
    penalty = 70;
    reasons.push(`Very high freeze risk (low ${Math.round(minTemp)}°F, ACI 306R)`);
    precautions.push(
      'Do not place without cold-weather protection plan; heat materials and monitor core temp',
    );
  } else if (minTemp <= 32) {
    penalty = 55;
    reasons.push(`Freeze damage likely (low ${Math.round(minTemp)}°F, ACI 306R)`);
    precautions.push('Use non-chloride accelerator; protect from freeze until adequate strength');
  } else if (minTemp <= 39) {
    penalty = 30;
    reasons.push(`Cold-weather procedures required (low ${Math.round(minTemp)}°F, ACI 306R)`);
    precautions.push('Heat mixing water; use Type C accelerator; maintain protection ≥40°F');
  } else if (minTemp <= 49) {
    penalty = 10;
    reasons.push(`Cool overnight low (${Math.round(minTemp)}°F) — slower hydration`);
  }
  return penalty;
}

function scoreHotWeather(maxTemp: number, reasons: string[], precautions: string[]): number {
  let penalty = 0;
  if (maxTemp > 100) {
    penalty = 55;
    reasons.push(`Severe hot-weather placement (${Math.round(maxTemp)}°F, ACI 305R)`);
    precautions.push('Avoid midday placement; use retarder, chilled water, and immediate curing');
  } else if (maxTemp > 90) {
    penalty = 40;
    reasons.push(`Rapid set / cracking risk (${Math.round(maxTemp)}°F, ACI 305R)`);
    precautions.push('Place early morning or evening; Type D retarder and fogging as needed');
  } else if (maxTemp > 85) {
    penalty = 18;
    reasons.push(`Elevated hot-weather risk (${Math.round(maxTemp)}°F)`);
    precautions.push('Schedule cooler hours; monitor slump and evaporation');
  } else if (maxTemp > 79) {
    penalty = 8;
    reasons.push(`Moderate heat (${Math.round(maxTemp)}°F)`);
    precautions.push('Have evaporation retarder and curing supplies ready');
  }
  return penalty;
}

function scoreWind(maxWindSpeed: number, reasons: string[], precautions: string[]): number {
  let penalty = 0;
  if (maxWindSpeed > 25) {
    penalty = 50;
    reasons.push(`Severe plastic shrinkage risk (wind to ${Math.round(maxWindSpeed)} mph)`);
    precautions.push('Erect windbreaks; use evaporation retarder; consider delaying placement');
  } else if (maxWindSpeed > 20) {
    penalty = 35;
    reasons.push(`High evaporation from wind (to ${Math.round(maxWindSpeed)} mph)`);
    precautions.push('Windbreaks and evaporation retarder required after screeding');
  } else if (maxWindSpeed > 15) {
    penalty = 15;
    reasons.push(`Moderate wind (to ${Math.round(maxWindSpeed)} mph)`);
    precautions.push('Use evaporation retarder after screeding');
  } else if (maxWindSpeed > 9) {
    penalty = 5;
    reasons.push(`Slight wind (to ${Math.round(maxWindSpeed)} mph)`);
  }
  return penalty;
}

/** Reduced standalone RH penalties — evaporation (Uno) carries most drying risk. */
function scoreHumidity(
  humidity: number,
  reasons: string[],
  precautions: string[],
): number {
  let penalty = 0;
  if (humidity < 20) {
    penalty = 20;
    reasons.push(`Very low humidity (${Math.round(humidity)}%) — drying risk`);
    precautions.push('Fogging and curing compound immediately after finishing');
  } else if (humidity < 36) {
    penalty = 10;
    reasons.push(`Low humidity (${Math.round(humidity)}%)`);
    precautions.push('Monitor surface moisture; use evaporation retarder');
  } else if (humidity <= 50) {
    penalty = 10;
    reasons.push(`Moderate humidity (${Math.round(humidity)}%)`);
  }
  return penalty;
}

function scoreRain(day: ForecastDay, lower: string, reasons: string[], precautions: string[]): number {
  let penalty = 0;

  if (hasHeavyRainOrStorms(lower)) {
    penalty += 50;
    reasons.push(`Heavy rain or thunderstorms in forecast`);
    precautions.push('Reschedule unless fully covered; protect fresh concrete from rainwater');
  } else if (day.chanceOfRain > 60) {
    penalty += 40;
    reasons.push(`High rain chance (${day.chanceOfRain}%)`);
    precautions.push('Reschedule unless covered; confirm radar before ordering truck');
  } else if (day.chanceOfRain > 30) {
    penalty += 20;
    reasons.push(`Rain possible (${day.chanceOfRain}%)`);
    precautions.push('Have tarps ready; monitor radar before placement');
  } else if (hasLightShowers(day, lower)) {
    penalty += 5;
    reasons.push('Light isolated showers possible');
    precautions.push('Protect surface during finishing if showers develop');
  }

  if (day.totalPrecipitation > 0.25) {
    penalty += 15;
    reasons.push(`Expected precipitation (${day.totalPrecipitation.toFixed(2)}")`);
  }

  return penalty;
}

function scoreSevereWeather(lower: string, reasons: string[], precautions: string[]): number {
  let penalty = 0;

  if (hasTropicalStorm(lower)) {
    penalty += 75;
    reasons.push(`Tropical storm conditions: ${lower}`);
    precautions.push('Do not place — wait for clearing conditions');
  } else if (hasLightning(lower)) {
    penalty += 60;
    reasons.push('Lightning in forecast');
    precautions.push('Do not place — wait for storms to pass');
  } else if (hasHail(lower)) {
    penalty += 50;
    reasons.push('Hail in forecast');
    precautions.push('Do not place until severe weather clears');
  } else if (hasSnowOrIce(lower)) {
    penalty += 50;
    reasons.push(`Winter precipitation: ${lower}`);
    precautions.push('Follow ACI 306R cold-weather procedures or reschedule');
  }

  return penalty;
}

function scorePlasticShrinkage(
  maxTemp: number,
  humidity: number,
  maxWindSpeed: number,
  reasons: string[],
  precautions: string[],
): number {
  let penalty = 0;

  if (maxTemp > 90 && humidity < 30 && maxWindSpeed > 15) {
    penalty = 30;
    reasons.push('High plastic-shrinkage risk (hot, very dry, windy — ACI 305R)');
    precautions.push('Fogging, evaporation retarder, and windbreaks required');
  } else if (maxTemp > 85 && humidity < 50 && maxWindSpeed > 10) {
    penalty = 15;
    reasons.push('Elevated plastic-shrinkage risk (heat + low RH + wind)');
    precautions.push('Use evaporation retarder and windbreaks after screeding');
  }

  return penalty;
}

function scoreConcreteTemp(
  concreteTemp: number,
  reasons: string[],
  precautions: string[],
): number {
  let penalty = 0;
  if (concreteTemp > 95) {
    penalty = 25;
    reasons.push(`Estimated concrete temp high (~${Math.round(concreteTemp)}°F)`);
    precautions.push('Cool aggregates/water; avoid long haul times; use retarder per ACI 305R');
  } else if (concreteTemp < 50) {
    penalty = 20;
    reasons.push(`Estimated concrete temp low (~${Math.round(concreteTemp)}°F)`);
    precautions.push('Heat materials; verify delivery temperature before placement');
  }
  return penalty;
}

function scoreEvaporationRate(
  evapKgM2H: number,
  reasons: string[],
  precautions: string[],
): number {
  let penalty = 0;
  if (evapKgM2H >= 1.0) {
    penalty = 25;
    reasons.push(
      `High evaporation rate (~${evapKgM2H.toFixed(2)} kg/m²/h, ACI 305R shrinkage risk)`,
    );
    precautions.push(
      'Evaporation exceeds 1.0 kg/m²/h — use fogging, retarder, and windbreaks',
    );
  } else if (evapKgM2H >= 0.5) {
    penalty = 10;
    reasons.push(`Elevated evaporation (~${evapKgM2H.toFixed(2)} kg/m²/h)`);
    precautions.push('Monitor surface drying; apply evaporation retarder after screeding');
  }
  return penalty;
}

function deriveFinishability(
  score: number,
  evapKgM2H: number,
  maxTemp: number,
  maxWindSpeed: number,
  humidity: number,
): { finishability: Finishability; issues: string[] } {
  const issues: string[] = [];

  if (evapKgM2H >= 1.0 || (maxTemp > 90 && humidity < 40 && maxWindSpeed > 15)) {
    issues.push('Rapid crusting');
    issues.push('Increased finishing labor');
    if (maxTemp > 85) issues.push('Slump loss risk');
    return { finishability: 'poor', issues };
  }

  if (evapKgM2H >= 0.5 || score < 60 || (maxTemp > 85 && maxWindSpeed > 10)) {
    if (evapKgM2H >= 0.5) issues.push('Surface may dry before finishing');
    if (maxWindSpeed > 15) issues.push('Wind-exposed edges need extra attention');
    return { finishability: 'fair', issues };
  }

  if (score >= 75 && evapKgM2H < 0.5) {
    return { finishability: score >= 90 ? 'excellent' : 'good', issues };
  }

  return { finishability: 'fair', issues };
}

function buildPrimaryRisks(reasons: string[], criticalConditions: string[]): string[] {
  const combined = [...criticalConditions, ...reasons];
  return combined.slice(0, 5);
}

function buildRecommendedActions(
  precautions: string[],
  evapKgM2H: number,
  maxTemp: number,
  maxWindSpeed: number,
  criticalFail: boolean,
): string[] {
  const actions = [...precautions];

  if (criticalFail) {
    return [
      'Delay placement until critical conditions clear',
      'Confirm engineer and project specifications before proceeding',
      ...actions.slice(0, 3),
    ];
  }

  if (evapKgM2H >= 0.5 && !actions.some((a) => a.toLowerCase().includes('evaporation'))) {
    actions.push('Use evaporation retarder after screeding');
  }
  if (maxWindSpeed > 15 && !actions.some((a) => a.toLowerCase().includes('wind'))) {
    actions.push('Install wind breaks before placement');
  }
  if (maxTemp > 85 && !actions.some((a) => a.toLowerCase().includes('morning'))) {
    actions.push('Consider earlier placement time (dawn to mid-morning)');
  }
  if (evapKgM2H >= 0.5) {
    actions.push('Start curing immediately after finishing');
    actions.push('Reduce delays between placement and finishing');
  }

  const unique = [...new Set(actions)];
  return unique.slice(0, 6);
}

interface ScoreDayOptions {
  dayIndex?: number;
  placementType?: PlacementType;
  appliedMitigations?: string[];
}

function computeBaseScore(
  day: ForecastDay & { avgHumidity?: number },
  placementType?: PlacementType,
): {
  baseScore: number;
  reasons: string[];
  precautions: string[];
  evaporationRateKgM2H: number;
  severeWeatherCapApplied: boolean;
} {
  let score = 100;
  const reasons: string[] = [];
  const precautions: string[] = [];
  const lower = conditionsLower(day.conditions);
  const humidity = day.avgHumidity ?? 50;
  const concreteTemp = estimateConcreteTemp(day);
  const airTempForEvap = (day.maxTemp + day.minTemp) / 2;

  const evapLb = estimateEvaporationRateLbPerFt2Hr(
    airTempForEvap,
    humidity,
    day.maxWindSpeed,
    concreteTemp,
  );
  const evaporationRateKgM2H = lbPerFt2HrToKgM2H(evapLb);

  score -= scoreColdWeather(day.minTemp, reasons, precautions);
  score -= scoreHotWeather(day.maxTemp, reasons, precautions);
  score -= scoreWind(day.maxWindSpeed, reasons, precautions);
  score -= scoreHumidity(humidity, reasons, precautions);
  score -= scoreRain(day, lower, reasons, precautions);
  score -= scoreSevereWeather(lower, reasons, precautions);
  score -= scorePlasticShrinkage(day.maxTemp, humidity, day.maxWindSpeed, reasons, precautions);
  score -= scoreConcreteTemp(concreteTemp, reasons, precautions);
  score -= scoreEvaporationRate(evaporationRateKgM2H, reasons, precautions);

  score += placementTypeModifier(placementType);

  let severeWeatherCapApplied = false;
  if (triggersSevereWeatherCap(lower)) {
    if (score > SEVERE_WEATHER_SCORE_CAP) {
      score = SEVERE_WEATHER_SCORE_CAP;
      severeWeatherCapApplied = true;
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    baseScore: score,
    reasons,
    precautions,
    evaporationRateKgM2H,
    severeWeatherCapApplied,
  };
}

function resolveMitigationScore(
  day: ForecastDay & { avgHumidity?: number },
  baseScore: number,
  criticalFail: boolean,
  evaporationRateKgM2H: number,
  evaporationRisk: EvaporationRiskLevel,
  mitigationIds: string[],
): {
  score: number;
  rating: PourRating;
  appliedMitigations: string[];
  mitigationCredit: number;
} {
  const ctx = buildWeatherContext(day, {
    evaporationRateKgM2H,
    evaporationRisk,
    criticalFail,
  });
  const validIds = filterApplicableMitigationIds(ctx, mitigationIds);
  const { credit, appliedIds } = computeMitigationCredit(ctx, validIds);

  let score = Math.min(100, baseScore + credit);
  let rating = scoreToRating(score);

  if (criticalFail) {
    score = Math.min(score, 25);
    rating = 'avoid';
  }

  return {
    score,
    rating,
    appliedMitigations: appliedIds,
    mitigationCredit: credit,
  };
}

export function applyMitigations(
  day: ScoredPourDay,
  mitigationIds: string[],
): ScoredPourDay {
  const resolved = resolveMitigationScore(
    day,
    day.baseScore,
    day.criticalFail,
    day.evaporationRateKgM2H ?? 0,
    day.evaporationRisk,
    mitigationIds,
  );

  const { finishability, issues } = deriveFinishability(
    resolved.score,
    day.evaporationRateKgM2H ?? 0,
    day.maxTemp,
    day.maxWindSpeed,
    day.avgHumidity ?? 50,
  );

  return {
    ...day,
    ...resolved,
    finishability,
    finishabilityIssues: issues,
  };
}

export function scorePourDay(
  day: ForecastDay & { avgHumidity?: number },
  options: ScoreDayOptions = {},
): ScoredPourDay {
  const lower = conditionsLower(day.conditions);
  const humidity = day.avgHumidity ?? 50;
  const critical = detectCriticalFail(day, lower);
  const dayIndex = options.dayIndex ?? 0;

  const {
    baseScore,
    reasons,
    precautions,
    evaporationRateKgM2H,
    severeWeatherCapApplied,
  } = computeBaseScore(day, options.placementType);

  const evaporationRisk = getEvaporationRiskLevel(evaporationRateKgM2H);

  const {
    score,
    rating,
    appliedMitigations,
    mitigationCredit,
  } = resolveMitigationScore(
    day,
    baseScore,
    critical.critical,
    evaporationRateKgM2H,
    evaporationRisk,
    options.appliedMitigations ?? [],
  );
  const { finishability, issues } = deriveFinishability(
    score,
    evaporationRateKgM2H,
    day.maxTemp,
    day.maxWindSpeed,
    humidity,
  );

  const primaryRisks = buildPrimaryRisks(reasons, critical.conditions);
  const recommendedActions = buildRecommendedActions(
    precautions,
    evaporationRateKgM2H,
    day.maxTemp,
    day.maxWindSpeed,
    critical.critical,
  );

  if ((rating === 'excellent' || rating === 'good') && reasons.length === 0) {
    reasons.push('Temperature, humidity, wind, and rain within favorable ACI placement range');
  }

  return {
    ...day,
    rating,
    baseScore,
    score,
    reasons,
    precautions,
    primaryRisks,
    recommendedActions,
    criticalFail: critical.critical,
    criticalMessage: critical.message,
    severeWeatherCapApplied,
    evaporationRateKgM2H,
    evaporationRisk,
    finishability,
    finishabilityIssues: issues,
    forecastConfidence: getForecastConfidence(dayIndex),
    appliedMitigations,
    mitigationCredit,
  };
}

export function scoreForecastDays(
  days: (ForecastDay & { avgHumidity?: number })[],
  options?: { placementType?: PlacementType; mitigationsByDate?: Record<string, string[]> },
): ScoredPourDay[] {
  return days.map((day, index) =>
    scorePourDay(day, {
      dayIndex: index,
      placementType: options?.placementType,
      appliedMitigations: options?.mitigationsByDate?.[day.date],
    }),
  );
}

/** Drop mitigation selections that do not apply to the day's forecast. */
export function pruneMitigationSelections(
  day: ForecastDay & { avgHumidity?: number },
  ids: string[],
  placementType?: PlacementType,
): string[] {
  const scored = scorePourDay(day, { placementType, appliedMitigations: [] });
  const ctx = buildWeatherContext(day, {
    evaporationRateKgM2H: scored.evaporationRateKgM2H ?? 0,
    evaporationRisk: scored.evaporationRisk,
    criticalFail: scored.criticalFail,
  });
  return filterApplicableMitigationIds(ctx, ids);
}

interface WindowSpan {
  label: string;
  startHour: number;
  endHour: number;
}

const WINDOW_SPANS: WindowSpan[] = [
  { label: 'Early morning', startHour: 5, endHour: 9 },
  { label: 'Late morning', startHour: 9, endHour: 12 },
  { label: 'Midday', startHour: 12, endHour: 15 },
  { label: 'Afternoon', startHour: 15, endHour: 19 },
];

function hourInSpan(hour: number, startHour: number, endHour: number): boolean {
  if (startHour <= endHour) {
    return hour >= startHour && hour < endHour;
  }
  return hour >= startHour || hour < endHour;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function buildSyntheticDayForWindow(
  day: ForecastDay & { avgHumidity?: number },
  span: WindowSpan,
  hoursInWindow: ForecastHour[],
): ForecastDay & { avgHumidity?: number } {
  const tempRange = Math.max(1, day.maxTemp - day.minTemp);

  if (hoursInWindow.length > 0) {
    const temps = hoursInWindow.map((h) => h.temp);
    const winds = hoursInWindow.map((h) => h.windSpeed);
    const humidities = hoursInWindow.map((h) => h.humidity);
    const rainChances = hoursInWindow.map((h) => h.chanceOfRain);
    const airTemp = avg(temps);
    const dominantCondition =
      hoursInWindow.reduce(
        (best, h) => (h.chanceOfRain > best.chanceOfRain ? h : best),
        hoursInWindow[0],
      ).conditions || day.conditions;

    return {
      ...day,
      maxTemp: Math.max(...temps),
      minTemp: Math.min(...temps),
      avgTemp: airTemp,
      maxWindSpeed: Math.max(...winds),
      chanceOfRain: Math.max(...rainChances),
      avgHumidity: avg(humidities),
      conditions: dominantCondition,
    };
  }

  const progress =
    span.startHour <= 9
      ? 0.2
      : span.startHour <= 12
        ? 0.45
        : span.startHour <= 15
          ? 0.75
          : 0.9;
  const airTemp = day.minTemp + tempRange * progress;
  const windFactor =
    span.startHour <= 9 ? 0.55 : span.startHour <= 12 ? 0.75 : span.startHour <= 15 ? 1 : 0.8;
  const rainFactor =
    span.startHour <= 9 ? 0.65 : span.startHour <= 12 ? 0.85 : span.startHour <= 15 ? 1.15 : 1.05;
  const humidityFactor =
    span.startHour <= 9 ? 1.08 : span.startHour <= 15 ? 0.92 : 0.98;

  return {
    ...day,
    maxTemp: airTemp + tempRange * 0.08,
    minTemp: airTemp - tempRange * 0.12,
    avgTemp: airTemp,
    maxWindSpeed: day.maxWindSpeed * windFactor,
    chanceOfRain: Math.min(100, Math.round(day.chanceOfRain * rainFactor)),
    avgHumidity: Math.min(
      100,
      Math.round((day.avgHumidity ?? 50) * humidityFactor),
    ),
  };
}

/** Estimate placement score per time-of-day window from hourly or daily forecast data. */
export function estimateTimeOfDayWindows(
  day: ForecastDay & { avgHumidity?: number },
  placementType?: PlacementType,
): TimeOfDayWindow[] {
  const hourly = day.hourly ?? [];

  const windows: TimeOfDayWindow[] = WINDOW_SPANS.map((span) => {
    const hoursInWindow = hourly.filter((h) =>
      hourInSpan(h.hour, span.startHour, span.endHour),
    );

    const syntheticDay = buildSyntheticDayForWindow(day, span, hoursInWindow);
    const { baseScore } = computeBaseScore(syntheticDay, placementType);
    const estimatedScore = Math.max(0, Math.min(100, baseScore));

    const startHour =
      hoursInWindow.length > 0
        ? Math.min(...hoursInWindow.map((h) => h.hour))
        : span.startHour;
    const endHour =
      hoursInWindow.length > 0
        ? Math.max(...hoursInWindow.map((h) => h.hour)) + 1
        : span.endHour;

    return {
      label: span.label,
      startHour,
      endHour,
      estimatedScore,
      estimatedRating: scoreToRating(estimatedScore),
    };
  });

  return windows.sort((a, b) => {
    if (b.estimatedScore !== a.estimatedScore) {
      return b.estimatedScore - a.estimatedScore;
    }
    return a.startHour - b.startHour;
  });
}

export function formatTimeWindow(w: TimeOfDayWindow): string {
  const fmt = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:00 ${period}`;
  };
  return `${fmt(w.startHour)} – ${fmt(w.endHour)}`;
}

export function findBestTimeOfDayWindow(
  day: ForecastDay & { avgHumidity?: number },
  placementType?: PlacementType,
): TimeOfDayWindow | null {
  const windows = estimateTimeOfDayWindows(day, placementType);
  return windows[0] ?? null;
}

export function findBestPourWindow(days: ScoredPourDay[]): {
  start: string;
  end: string;
  days: ScoredPourDay[];
} | null {
  const pourable = days.filter(
    (d) => !d.criticalFail && (d.rating === 'excellent' || d.rating === 'good'),
  );
  if (pourable.length === 0) return null;

  let bestStart = 0;
  let bestLen = 0;
  let currentStart = -1;
  let currentLen = 0;

  for (let i = 0; i < days.length; i++) {
    const good =
      !days[i].criticalFail &&
      (days[i].rating === 'excellent' || days[i].rating === 'good');
    if (good) {
      if (currentLen === 0) currentStart = i;
      currentLen++;
    } else {
      if (currentLen > bestLen) {
        bestLen = currentLen;
        bestStart = currentStart;
      }
      currentLen = 0;
      currentStart = -1;
    }
  }
  if (currentLen > bestLen) {
    bestLen = currentLen;
    bestStart = currentStart;
  }

  if (bestLen === 0) {
    const candidates = days.filter((d) => !d.criticalFail);
    if (candidates.length === 0) return null;
    const best = candidates.reduce((a, b) => (a.score >= b.score ? a : b));
    return { start: best.date, end: best.date, days: [best] };
  }

  const windowDays = days.slice(bestStart, bestStart + bestLen);
  return {
    start: windowDays[0].date,
    end: windowDays[windowDays.length - 1].date,
    days: windowDays,
  };
}

export function compareByRating(a: ScoredPourDay, b: ScoredPourDay): number {
  return RATING_ORDER.indexOf(a.rating) - RATING_ORDER.indexOf(b.rating);
}
