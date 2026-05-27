import { ForecastDay } from '../types';

type EvaporationRiskLevel = 'low' | 'moderate' | 'severe';

export type MitigationCategory =
  | 'temperature'
  | 'wind-evaporation'
  | 'rain-severe'
  | 'mix-design'
  | 'operational';

export interface MitigationOption {
  id: string;
  label: string;
  credit: number;
  description: string;
  category: MitigationCategory;
  appliesWhen: (ctx: PourWeatherContext) => boolean;
}

export interface PourWeatherContext {
  minTemp: number;
  maxTemp: number;
  maxWindSpeed: number;
  humidity: number;
  chanceOfRain: number;
  totalPrecipitation: number;
  conditionsLower: string;
  evaporationRateKgM2H: number;
  evaporationRisk: EvaporationRiskLevel;
  criticalFail: boolean;
  hasLightning: boolean;
  hasTropicalStorm: boolean;
  hasHeavyRainOrStorms: boolean;
  hasSnowOrIce: boolean;
}

export const MAX_MITIGATION_CREDIT_DEFAULT = 25;

export const MITIGATION_DISCLAIMER =
  'Mitigation credits represent estimated reduction in environmental placement risk only. Actual effectiveness depends on implementation quality, concrete mix design, workmanship, and compliance with project specifications and ACI guidance.';

function conditionsLower(conditions: string): string {
  return conditions.toLowerCase();
}

export function hasLightningInForecast(lower: string): boolean {
  return lower.includes('lightning') || lower.includes('thunder');
}

export function hasTropicalStormInForecast(lower: string): boolean {
  return (
    lower.includes('tropical') ||
    lower.includes('hurricane') ||
    lower.includes('typhoon')
  );
}

function hasHeavyRainOrStorms(lower: string): boolean {
  return (
    lower.includes('heavy rain') ||
    lower.includes('thunder') ||
    lower.includes('storm')
  );
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

const isHot = (ctx: PourWeatherContext) => ctx.maxTemp > 79;
const isVeryHot = (ctx: PourWeatherContext) => ctx.maxTemp > 90;
const isExtremeHeat = (ctx: PourWeatherContext) => ctx.maxTemp > 100;
const isCold = (ctx: PourWeatherContext) => ctx.minTemp <= 49;
const isFreezing = (ctx: PourWeatherContext) => ctx.minTemp <= 32;
const isExtremeCold = (ctx: PourWeatherContext) => ctx.minTemp <= 20;
const isWindy = (ctx: PourWeatherContext) => ctx.maxWindSpeed > 9;
const isHighWind = (ctx: PourWeatherContext) => ctx.maxWindSpeed > 15;
const isLowHumidity = (ctx: PourWeatherContext) => ctx.humidity < 50;
const isRainRisk = (ctx: PourWeatherContext) => ctx.chanceOfRain > 30;
const isHighRainChance = (ctx: PourWeatherContext) => ctx.chanceOfRain > 60;
const isElevatedEvap = (ctx: PourWeatherContext) => ctx.evaporationRateKgM2H >= 0.5;
const isExtremeEvap = (ctx: PourWeatherContext) => ctx.evaporationRateKgM2H >= 1.0;
const hasPlacementStress = (ctx: PourWeatherContext) =>
  isHot(ctx) ||
  isCold(ctx) ||
  isHighWind(ctx) ||
  isRainRisk(ctx) ||
  isElevatedEvap(ctx) ||
  ctx.hasHeavyRainOrStorms;

/** All mitigations; UI shows only those passing `appliesWhen` for the forecast day. */
export const MITIGATION_OPTIONS: MitigationOption[] = [
  // Temperature — hot
  {
    id: 'night-placement',
    label: 'Night placement',
    credit: 10,
    category: 'temperature',
    description: 'Lower air temps and reduced solar load (ACI 305R)',
    appliesWhen: (ctx) => isHot(ctx),
  },
  {
    id: 'early-morning',
    label: 'Early morning placement',
    credit: 8,
    category: 'temperature',
    description: 'Schedule placement dawn to mid-morning before peak heat',
    appliesWhen: (ctx) => isHot(ctx),
  },
  {
    id: 'chilled-mix',
    label: 'Chilled mix water',
    credit: 8,
    category: 'temperature',
    description: 'Lower delivery temperature in hot weather',
    appliesWhen: (ctx) => isHot(ctx),
  },
  {
    id: 'ice-in-mix',
    label: 'Ice added to mix',
    credit: 10,
    category: 'temperature',
    description: 'Extreme heat — control concrete temperature at delivery',
    appliesWhen: (ctx) => isVeryHot(ctx),
  },
  {
    id: 'cooling-aggregate',
    label: 'Cooling aggregate / shading materials',
    credit: 5,
    category: 'temperature',
    description: 'Reduce material temperature before batching',
    appliesWhen: (ctx) => ctx.maxTemp > 85,
  },
  // Temperature — cold
  {
    id: 'heated-enclosure',
    label: 'Heated enclosure',
    credit: 15,
    category: 'temperature',
    description: 'Maintain ambient temperature during cold placement (ACI 306R)',
    appliesWhen: (ctx) => ctx.minTemp <= 39,
  },
  {
    id: 'ground-thawing',
    label: 'Ground thawing / subgrade preheating',
    credit: 10,
    category: 'temperature',
    description: 'Frozen or cold subgrade preparation',
    appliesWhen: (ctx) => isFreezing(ctx) || (ctx.minTemp <= 39 && ctx.hasSnowOrIce),
  },
  {
    id: 'heated-mix-water',
    label: 'Heated mix water',
    credit: 8,
    category: 'temperature',
    description: 'Warm materials for cold-weather hydration (ACI 306R)',
    appliesWhen: (ctx) => isCold(ctx),
  },
  {
    id: 'accelerator',
    label: 'Non-chloride accelerator',
    credit: 5,
    category: 'temperature',
    description: 'Support hydration when air temps are below ~50°F',
    appliesWhen: (ctx) => isCold(ctx) && !isHot(ctx),
  },
  {
    id: 'insulated-blankets',
    label: 'Insulated blankets',
    credit: 10,
    category: 'temperature',
    description: 'Cold-weather curing and temperature retention',
    appliesWhen: (ctx) => isCold(ctx),
  },
  {
    id: 'heated-curing-blankets',
    label: 'Heated curing blankets',
    credit: 15,
    category: 'temperature',
    description: 'Freeze protection during early-age curing',
    appliesWhen: (ctx) => isFreezing(ctx),
  },
  {
    id: 'hydronic-heating',
    label: 'Hydronic heating system',
    credit: 20,
    category: 'temperature',
    description: 'Severe cold — active heat during protection period',
    appliesWhen: (ctx) => isExtremeCold(ctx),
  },
  {
    id: 'heated-tent',
    label: 'Wind-protected heated tent',
    credit: 20,
    category: 'temperature',
    description: 'Extreme cold with wind protection',
    appliesWhen: (ctx) => isFreezing(ctx) && isWindy(ctx),
  },
  // Wind / evaporation
  {
    id: 'windbreaks',
    label: 'Wind breaks',
    credit: 5,
    category: 'wind-evaporation',
    description: 'Reduce surface evaporation and plastic shrinkage',
    appliesWhen: (ctx) => isWindy(ctx),
  },
  {
    id: 'sun-shades',
    label: 'Sun shades',
    credit: 5,
    category: 'wind-evaporation',
    description: 'Reduce solar radiation on fresh concrete',
    appliesWhen: (ctx) => isHot(ctx),
  },
  {
    id: 'fogging',
    label: 'Fogging system',
    credit: 8,
    category: 'wind-evaporation',
    description: 'Maintain surface moisture in dry conditions',
    appliesWhen: (ctx) => isLowHumidity(ctx) || isElevatedEvap(ctx),
  },
  {
    id: 'evap-retarder',
    label: 'Evaporation retarder',
    credit: 10,
    category: 'wind-evaporation',
    description: 'Plastic shrinkage control after screeding (ACI 305R)',
    appliesWhen: (ctx) =>
      isElevatedEvap(ctx) || (isHot(ctx) && isLowHumidity(ctx)) || isHighWind(ctx),
  },
  {
    id: 'immediate-curing',
    label: 'Immediate curing application',
    credit: 10,
    category: 'wind-evaporation',
    description: 'Protect surface as soon as finishing permits',
    appliesWhen: (ctx) => isElevatedEvap(ctx) || isHot(ctx) || isHighWind(ctx),
  },
  {
    id: 'wet-burlap',
    label: 'Wet burlap curing',
    credit: 8,
    category: 'wind-evaporation',
    description: 'Surface moisture retention during high evaporation',
    appliesWhen: (ctx) => isElevatedEvap(ctx),
  },
  {
    id: 'cure-and-seal',
    label: 'Cure-and-seal compound',
    credit: 5,
    category: 'wind-evaporation',
    description: 'General curing protection when environmental stress is present',
    appliesWhen: (ctx) => hasPlacementStress(ctx),
  },
  {
    id: 'phased-pours',
    label: 'Reduced placement area / phased placements',
    credit: 5,
    category: 'wind-evaporation',
    description: 'Limit open surface during high evaporation',
    appliesWhen: (ctx) => isElevatedEvap(ctx),
  },
  {
    id: 'extra-finishing-crew',
    label: 'Increased finishing crew',
    credit: 3,
    category: 'wind-evaporation',
    description: 'Faster finishing when evaporation is rapid',
    appliesWhen: (ctx) => isElevatedEvap(ctx) || isVeryHot(ctx),
  },
  {
    id: 'laser-screed',
    label: 'Laser screed / prep optimization',
    credit: 2,
    category: 'wind-evaporation',
    description: 'Accelerate strike-off and screeding',
    appliesWhen: (ctx) => isElevatedEvap(ctx) || isVeryHot(ctx),
  },
  // Rain / severe
  {
    id: 'tarps-ready',
    label: 'Weather protection tarps ready',
    credit: 5,
    category: 'rain-severe',
    description: 'Rain threat — protect fresh concrete',
    appliesWhen: (ctx) => ctx.chanceOfRain > 20 || ctx.totalPrecipitation > 0.05,
  },
  {
    id: 'temp-enclosure',
    label: 'Temporary enclosure / tent',
    credit: 10,
    category: 'rain-severe',
    description: 'Shelter from rain or wind during placement',
    appliesWhen: (ctx) => isRainRisk(ctx) || isHighWind(ctx) || ctx.hasHeavyRainOrStorms,
  },
  {
    id: 'water-removal',
    label: 'Pumped water removal plan',
    credit: 3,
    category: 'rain-severe',
    description: 'Wet site — control standing water before placement',
    appliesWhen: (ctx) => ctx.totalPrecipitation > 0.1 || isHighRainChance(ctx),
  },
  {
    id: 'storm-delay-flex',
    label: 'Storm delay flexibility built in',
    credit: 5,
    category: 'rain-severe',
    description: 'Scheduling buffer for changing conditions',
    appliesWhen: (ctx) => isRainRisk(ctx) || ctx.hasHeavyRainOrStorms,
  },
  {
    id: 'covered-finishing',
    label: 'Covered finishing area',
    credit: 8,
    category: 'rain-severe',
    description: 'Slab/flatwork protection during rain threat',
    appliesWhen: (ctx) => isRainRisk(ctx) && !isExtremeHeat(ctx),
  },
  {
    id: 'backup-curing',
    label: 'Backup curing materials on-site',
    credit: 3,
    category: 'rain-severe',
    description: 'Weather uncertainty — redundant curing supplies',
    appliesWhen: (ctx) => isRainRisk(ctx) || ctx.chanceOfRain > 15,
  },
  {
    id: 'pump-shelter',
    label: 'Pump / placement shelter',
    credit: 5,
    category: 'rain-severe',
    description: 'Protection during placement in rain or wind',
    appliesWhen: (ctx) => isRainRisk(ctx) || isHighWind(ctx),
  },
  // Mix design
  {
    id: 'water-reducer',
    label: 'Mid-range water reducer',
    credit: 5,
    category: 'mix-design',
    description: 'Workability control under temperature stress',
    appliesWhen: (ctx) => isHot(ctx) || isCold(ctx),
  },
  {
    id: 'retarder',
    label: 'Retarder admixture',
    credit: 5,
    category: 'mix-design',
    description: 'Slow set in hot weather (ACI 305R)',
    appliesWhen: (ctx) => isHot(ctx),
  },
  {
    id: 'low-wc',
    label: 'Low water-cement ratio',
    credit: 3,
    category: 'mix-design',
    description: 'Durability under demanding conditions',
    appliesWhen: (ctx) => ctx.maxTemp > 85 || isElevatedEvap(ctx),
  },
  {
    id: 'fiber',
    label: 'Fiber reinforcement',
    credit: 3,
    category: 'mix-design',
    description: 'Crack reduction when shrinkage risk is elevated',
    appliesWhen: (ctx) => isElevatedEvap(ctx) || isHot(ctx),
  },
  {
    id: 'sra',
    label: 'Shrinkage-reducing admixture',
    credit: 5,
    category: 'mix-design',
    description: 'Slab shrinkage control in dry/windy conditions',
    appliesWhen: (ctx) => isElevatedEvap(ctx) || (isHot(ctx) && isLowHumidity(ctx)),
  },
  {
    id: 'optimized-gradation',
    label: 'Optimized aggregate gradation',
    credit: 2,
    category: 'mix-design',
    description: 'Reduced shrinkage potential',
    appliesWhen: (ctx) => isElevatedEvap(ctx),
  },
  {
    id: 'scm-thermal',
    label: 'SCMs (fly ash/slag) for thermal control',
    credit: 3,
    category: 'mix-design',
    description: 'Moderate heat of hydration / hot weather',
    appliesWhen: (ctx) => ctx.maxTemp > 85,
  },
  // Operational
  {
    id: 'experienced-crew',
    label: 'Experienced finishing crew',
    credit: 3,
    category: 'operational',
    description: 'Difficult placement conditions',
    appliesWhen: hasPlacementStress,
  },
  {
    id: 'extra-manpower',
    label: 'Extra manpower scheduled',
    credit: 2,
    category: 'operational',
    description: 'Large or fast-track placements',
    appliesWhen: (ctx) => hasPlacementStress(ctx) && (isElevatedEvap(ctx) || isVeryHot(ctx)),
  },
  {
    id: 'backup-equipment',
    label: 'Backup equipment available',
    credit: 2,
    category: 'operational',
    description: 'Reliability when weather windows are tight',
    appliesWhen: (ctx) => isRainRisk(ctx) || isVeryHot(ctx) || isExtremeCold(ctx),
  },
  {
    id: 'continuous-supply',
    label: 'Continuous concrete supply confirmed',
    credit: 3,
    category: 'operational',
    description: 'Prevent cold joints during limited weather windows',
    appliesWhen: hasPlacementStress,
  },
  {
    id: 'pre-pour-meeting',
    label: 'Pre-placement coordination meeting',
    credit: 2,
    category: 'operational',
    description: 'QC alignment before placement',
    appliesWhen: hasPlacementStress,
  },
  {
    id: 'qc-inspector',
    label: 'Dedicated QC inspector',
    credit: 3,
    category: 'operational',
    description: 'Risk reduction on demanding placements',
    appliesWhen: (ctx) => hasPlacementStress(ctx) && (isElevatedEvap(ctx) || isFreezing(ctx)),
  },
  {
    id: 'mockup-placement',
    label: 'Mock-up / test placement completed',
    credit: 5,
    category: 'operational',
    description: 'Complex placements or unfamiliar conditions',
    appliesWhen: (ctx) =>
      isExtremeEvap(ctx) || isExtremeCold(ctx) || isExtremeHeat(ctx),
  },
];

const MITIGATION_BY_ID = new Map(MITIGATION_OPTIONS.map((m) => [m.id, m]));

export function getMitigationOption(id: string): MitigationOption | undefined {
  return MITIGATION_BY_ID.get(id);
}

export function buildWeatherContext(
  day: ForecastDay & { avgHumidity?: number },
  extras: {
    evaporationRateKgM2H: number;
    evaporationRisk: EvaporationRiskLevel;
    criticalFail: boolean;
  },
): PourWeatherContext {
  const lower = conditionsLower(day.conditions);
  return {
    minTemp: day.minTemp,
    maxTemp: day.maxTemp,
    maxWindSpeed: day.maxWindSpeed,
    humidity: day.avgHumidity ?? 50,
    chanceOfRain: day.chanceOfRain,
    totalPrecipitation: day.totalPrecipitation,
    conditionsLower: lower,
    evaporationRateKgM2H: extras.evaporationRateKgM2H,
    evaporationRisk: extras.evaporationRisk,
    criticalFail: extras.criticalFail,
    hasLightning: hasLightningInForecast(lower),
    hasTropicalStorm: hasTropicalStormInForecast(lower),
    hasHeavyRainOrStorms: hasHeavyRainOrStorms(lower),
    hasSnowOrIce: hasSnowOrIce(lower),
  };
}

export function getApplicableMitigations(ctx: PourWeatherContext): MitigationOption[] {
  return MITIGATION_OPTIONS.filter((m) => m.appliesWhen(ctx));
}

/** Severe conditions limit how much mitigations can recover. */
export function getMaxMitigationRecovery(ctx: PourWeatherContext): number {
  if (ctx.hasLightning || ctx.hasTropicalStorm) return 0;
  if (isExtremeCold(ctx)) return 10;
  if (isExtremeEvap(ctx)) return 15;
  return MAX_MITIGATION_CREDIT_DEFAULT;
}

export function filterApplicableMitigationIds(
  ctx: PourWeatherContext,
  ids: string[],
): string[] {
  const applicable = new Set(getApplicableMitigations(ctx).map((m) => m.id));
  return ids.filter((id) => applicable.has(id));
}

export interface MitigationCreditResult {
  /** Raw sum of selected mitigation credits (before cap) */
  rawCredit: number;
  /** Credit applied to score after cap */
  credit: number;
  /** IDs that counted toward the score */
  appliedIds: string[];
  maxRecovery: number;
}

export function computeMitigationCredit(
  ctx: PourWeatherContext,
  ids: string[],
): MitigationCreditResult {
  const maxRecovery = getMaxMitigationRecovery(ctx);
  const validIds = filterApplicableMitigationIds(ctx, ids);

  if (maxRecovery === 0 || validIds.length === 0) {
    return { rawCredit: 0, credit: 0, appliedIds: [], maxRecovery };
  }

  const options = validIds
    .map((id) => MITIGATION_BY_ID.get(id))
    .filter((m): m is MitigationOption => m != null)
    .sort((a, b) => b.credit - a.credit);

  let rawCredit = 0;
  let credit = 0;
  const appliedIds: string[] = [];

  for (const opt of options) {
    if (credit >= maxRecovery) break;
    const remaining = maxRecovery - credit;
    const add = Math.min(opt.credit, remaining);
    if (add > 0) {
      credit += add;
      rawCredit += opt.credit;
      appliedIds.push(opt.id);
    }
  }

  return { rawCredit, credit, appliedIds, maxRecovery };
}

export const MITIGATION_CATEGORY_LABELS: Record<MitigationCategory, string> = {
  temperature: 'Temperature',
  'wind-evaporation': 'Wind & evaporation',
  'rain-severe': 'Rain & severe weather',
  'mix-design': 'Mix design',
  operational: 'Operational',
};
