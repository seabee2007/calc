import { resolveStateCode } from '../../../types/address';
import {
  clampPercent,
  roundToTwo,
  sanitizeFiniteNumber,
  sanitizeNonNegative,
} from '../domain/estimateMath';
import {
  SQUARE_FOOT_PRICING_NATIONAL_BASELINE,
  SQUARE_FOOT_PRICING_TERRITORY_CODES,
  squareFootPricingData,
  type SquareFootPricingLocation,
  type SquareFootPricingComplexityKey,
  type SquareFootPricingFinishKey,
  type SquareFootPricingProjectTypeKey,
  type SquareFootPricingSiteConditionKey,
} from '../data/squareFootPricingData';

export const QUICK_FEASIBILITY_PREVIEW_HINT =
  'Enter building area and select a location (or base price per SF) to preview a quick estimate.';

export const QUICK_FEASIBILITY_BUDGET_WARNING =
  'Square-foot pricing is for early budgeting only. Final proposals should be built from activities, labor, materials, equipment, overhead, profit, and schedule.';

export const QUICK_FEASIBILITY_WORK_BREAKDOWN_WARNING =
  'Always convert to a work breakdown/activity estimate before proposal issuance.';

export const QUICK_FEASIBILITY_LOW_CONFIDENCE_WARNING =
  'Low confidence market data. Verify with local bids before relying on this number.';

export const QUICK_FEASIBILITY_TERRITORY_WARNING =
  'Territory pricing can vary widely. Verify locally.';

export { SQUARE_FOOT_PRICING_NATIONAL_BASELINE };

export const QUICK_FEASIBILITY_DEMO_NOTE =
  'Demolition-only pricing will be expanded in a later phase.';

export type QuickFeasibilityProjectType = SquareFootPricingProjectTypeKey;
export type QuickFeasibilityFinishLevel = SquareFootPricingFinishKey;
export type QuickFeasibilityComplexityLevel = SquareFootPricingComplexityKey;
export type QuickFeasibilitySiteCondition = SquareFootPricingSiteConditionKey;
export type QuickFeasibilityMepIntensity = 'none' | 'light' | 'moderate' | 'full' | 'dense';

export interface QuickFeasibilityProjectContext {
  locationLabel?: string;
  jobsiteState?: string;
}

export interface QuickFeasibilityInputs {
  locationCode: string;
  basePricePerSf: number;
  basePricePerSfOverridden: boolean;
  areaSF: number;
  projectType: QuickFeasibilityProjectType;
  finishLevel: QuickFeasibilityFinishLevel;
  complexityLevel: QuickFeasibilityComplexityLevel;
  siteCondition: QuickFeasibilitySiteCondition;
  mepIntensity: QuickFeasibilityMepIntensity;
  contingencyPercent: number;
  manualLocationAdjustmentFactor: number;
}

export interface QuickFeasibilityResult {
  baseCost: number;
  adjustedCost: number;
  contingencyAmount: number;
  likelyTotal: number;
  lowTotal: number;
  highTotal: number;
  adjustedCostPerSF: number;
  resolvedBasePricePerSf: number;
  locationFactorVsNational195: number | null;
  planningLowPerSf: number | null;
  planningHighPerSf: number | null;
  locationConfidence: string | null;
  locationNotes: string;
  isTerritory: boolean;
  warnings: string[];
  assumptions: string[];
  isValid: boolean;
  validationMessages: string[];
  multipliers: {
    projectType: number;
    finish: number;
    complexity: number;
    siteCondition: number;
    mep: number;
    manualLocationAdjustment: number;
  };
}

export const QUICK_FEASIBILITY_PROJECT_TYPE_OPTIONS: ReadonlyArray<{
  value: QuickFeasibilityProjectType;
  label: string;
}> = [
  { value: 'newConstruction', label: 'New construction' },
  { value: 'additionBuildOut', label: 'Addition - build out' },
  { value: 'additionBuildUp', label: 'Addition - build up / second story' },
  { value: 'lightRemodel', label: 'Light remodel' },
  { value: 'moderateRemodel', label: 'Moderate remodel' },
  { value: 'gutRemodel', label: 'Gut remodel' },
  { value: 'demoAndRebuild', label: 'Demolition + rebuild' },
];

export const QUICK_FEASIBILITY_FINISH_OPTIONS: ReadonlyArray<{
  value: QuickFeasibilityFinishLevel;
  label: string;
}> = [
  { value: 'basic', label: 'Basic' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'custom', label: 'Custom' },
];

export const QUICK_FEASIBILITY_COMPLEXITY_OPTIONS: ReadonlyArray<{
  value: QuickFeasibilityComplexityLevel;
  label: string;
}> = [
  { value: 'simpleBox', label: 'Simple box' },
  { value: 'average', label: 'Average' },
  { value: 'complex', label: 'Complex' },
  { value: 'highCustom', label: 'High custom' },
];

export const QUICK_FEASIBILITY_SITE_CONDITION_OPTIONS: ReadonlyArray<{
  value: QuickFeasibilitySiteCondition;
  label: string;
}> = [
  { value: 'easyFlatAccess', label: 'Easy flat access' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'difficultSlopeLimitedAccess', label: 'Difficult slope / limited access' },
  { value: 'remoteIslandOrHardLogistics', label: 'Remote island / hard logistics' },
];

export const QUICK_FEASIBILITY_MEP_OPTIONS: ReadonlyArray<{
  value: QuickFeasibilityMepIntensity;
  label: string;
}> = [
  { value: 'none', label: 'None' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'full', label: 'Full' },
  { value: 'dense', label: 'Dense' },
];

export const QUICK_FEASIBILITY_MEP_MULTIPLIERS: Record<QuickFeasibilityMepIntensity, number> = {
  none: 1,
  light: 1.05,
  moderate: 1.1,
  full: 1.2,
  dense: 1.3,
};

export const QUICK_FEASIBILITY_CONTINGENCY_DEFAULTS: Record<QuickFeasibilityProjectType, number> = {
  newConstruction: 10,
  additionBuildOut: 18,
  additionBuildUp: 20,
  lightRemodel: 15,
  moderateRemodel: 20,
  gutRemodel: 25,
  demoAndRebuild: 20,
};

const NEW_CONSTRUCTION_RISK_SPREAD = { low: 0.9, high: 1.15 };
const REMODEL_RISK_SPREAD = { low: 0.85, high: 1.3 };

export const DEFAULT_QUICK_FEASIBILITY_INPUTS: QuickFeasibilityInputs = {
  locationCode: '',
  basePricePerSf: 0,
  basePricePerSfOverridden: false,
  areaSF: 0,
  projectType: 'newConstruction',
  finishLevel: 'standard',
  complexityLevel: 'average',
  siteCondition: 'easyFlatAccess',
  mepIntensity: 'moderate',
  contingencyPercent: QUICK_FEASIBILITY_CONTINGENCY_DEFAULTS.newConstruction,
  manualLocationAdjustmentFactor: 1,
};

function ensureFiniteOutput(value: number): number {
  const safe = sanitizeFiniteNumber(value, 0);
  return Number.isFinite(safe) ? roundToTwo(safe) : 0;
}

function sanitizeFactor(value: number, fallback = 1): number {
  const safe = sanitizeNonNegative(sanitizeFiniteNumber(value, fallback));
  return safe > 0 ? safe : fallback;
}

function normalizeLocationCode(code: string): string {
  return code.trim().toUpperCase();
}

function isTerritoryLocation(location: SquareFootPricingLocation | null): boolean {
  if (!location) return false;
  return (
    SQUARE_FOOT_PRICING_TERRITORY_CODES.has(location.code) ||
    location.region.toLowerCase().includes('territory')
  );
}

function getRiskSpread(projectType: QuickFeasibilityProjectType): { low: number; high: number } {
  return projectType === 'newConstruction' ? NEW_CONSTRUCTION_RISK_SPREAD : REMODEL_RISK_SPREAD;
}

export function getSquareFootPricingLocations(): readonly SquareFootPricingLocation[] {
  return squareFootPricingData.locations;
}

export function getSquareFootPricingLocationByCode(
  code: string,
): SquareFootPricingLocation | null {
  const normalized = normalizeLocationCode(code);
  if (!normalized) return null;
  return squareFootPricingData.locations.find((location) => location.code === normalized) ?? null;
}

export function getSquareFootPricingImportantLimitations(): readonly string[] {
  return squareFootPricingData.importantLimitations;
}

export function getDefaultLocationCodeFromProject(
  project?: QuickFeasibilityProjectContext | null,
): string {
  if (!project) return '';

  const fromState = resolveStateCode(project.jobsiteState ?? '');
  if (fromState && getSquareFootPricingLocationByCode(fromState)) {
    return fromState;
  }

  const label = project.locationLabel?.trim() ?? '';
  if (!label) return '';

  const commaParts = label.split(',').map((part) => part.trim());
  for (let index = commaParts.length - 1; index >= 0; index -= 1) {
    const token = commaParts[index];
    const twoLetter = token.match(/\b([A-Z]{2})\b/);
    if (twoLetter) {
      const code = getSquareFootPricingLocationByCode(twoLetter[1]);
      if (code) return code.code;
    }
    const resolved = resolveStateCode(token);
    if (resolved && getSquareFootPricingLocationByCode(resolved)) {
      return resolved;
    }
  }

  if (/\bguam\b/i.test(label)) return 'GU';
  if (/\bpuerto rico\b/i.test(label)) return 'PR';
  if (/\bvirgin islands\b/i.test(label)) return 'VI';

  return '';
}

export function getDefaultContingencyPercent(
  projectType: QuickFeasibilityProjectType,
): number {
  return QUICK_FEASIBILITY_CONTINGENCY_DEFAULTS[projectType] ?? 10;
}

export function resolveLocationBasePricePerSf(
  location: SquareFootPricingLocation | null,
): number {
  if (!location) return SQUARE_FOOT_PRICING_NATIONAL_BASELINE;

  const suggested = location.newConstruction.suggestedMidWithContractorOHProfit;
  if (Number.isFinite(suggested) && suggested > 0) {
    return suggested;
  }

  const hardCost = location.newConstruction.hardCostAvg;
  if (Number.isFinite(hardCost) && hardCost > 0) {
    return hardCost;
  }

  return SQUARE_FOOT_PRICING_NATIONAL_BASELINE;
}

export function resolveQuickFeasibilityBaseRate(
  inputs: Pick<QuickFeasibilityInputs, 'locationCode' | 'basePricePerSf' | 'basePricePerSfOverridden'>,
): number {
  if (inputs.basePricePerSfOverridden) {
    const override = sanitizeNonNegative(sanitizeFiniteNumber(inputs.basePricePerSf, 0));
    return override > 0 ? override : SQUARE_FOOT_PRICING_NATIONAL_BASELINE;
  }

  const location = getSquareFootPricingLocationByCode(inputs.locationCode);
  if (location) {
    return resolveLocationBasePricePerSf(location);
  }

  const manual = sanitizeNonNegative(sanitizeFiniteNumber(inputs.basePricePerSf, 0));
  if (manual > 0) return manual;

  return SQUARE_FOOT_PRICING_NATIONAL_BASELINE;
}

function resolveMultipliers(inputs: QuickFeasibilityInputs): QuickFeasibilityResult['multipliers'] {
  const projectTypeEntry = squareFootPricingData.projectTypeMultipliers[inputs.projectType];
  return {
    projectType: sanitizeFactor(projectTypeEntry?.factor ?? 1),
    finish: sanitizeFactor(squareFootPricingData.finishMultipliers[inputs.finishLevel] ?? 1),
    complexity: sanitizeFactor(
      squareFootPricingData.complexityMultipliers[inputs.complexityLevel] ?? 1,
    ),
    siteCondition: sanitizeFactor(
      squareFootPricingData.siteConditionMultipliers[inputs.siteCondition] ?? 1,
    ),
    mep: sanitizeFactor(QUICK_FEASIBILITY_MEP_MULTIPLIERS[inputs.mepIntensity] ?? 1),
    manualLocationAdjustment: sanitizeFactor(inputs.manualLocationAdjustmentFactor),
  };
}

function buildWarnings(
  location: SquareFootPricingLocation | null,
  inputs: QuickFeasibilityInputs,
): string[] {
  const warnings = [QUICK_FEASIBILITY_BUDGET_WARNING, QUICK_FEASIBILITY_WORK_BREAKDOWN_WARNING];

  if (location) {
    const confidence = location.confidence.toLowerCase();
    if (confidence === 'low' || confidence === 'very_low') {
      warnings.push(QUICK_FEASIBILITY_LOW_CONFIDENCE_WARNING);
    }
    if (isTerritoryLocation(location)) {
      warnings.push(QUICK_FEASIBILITY_TERRITORY_WARNING);
    }
  }

  if (inputs.projectType === 'demoAndRebuild') {
    warnings.push(QUICK_FEASIBILITY_DEMO_NOTE);
  }

  return warnings;
}

function buildAssumptions(
  inputs: QuickFeasibilityInputs,
  location: SquareFootPricingLocation | null,
  resolvedBasePricePerSf: number,
  multipliers: QuickFeasibilityResult['multipliers'],
): string[] {
  const projectTypeLabel =
    QUICK_FEASIBILITY_PROJECT_TYPE_OPTIONS.find((option) => option.value === inputs.projectType)
      ?.label ?? inputs.projectType;

  const assumptions: string[] = [
    'Local preview only — not saved to estimate versions.',
    `Project type: ${projectTypeLabel}.`,
    `Base price per SF: $${resolvedBasePricePerSf}.`,
    `Base cost = area × base price per SF.`,
    `Adjusted cost applies project type, finish, complexity, site condition, and MEP multipliers.`,
    `Likely budget includes ${clampPercent(inputs.contingencyPercent)}% contingency.`,
  ];

  if (location) {
    assumptions.push(`Location: ${location.code} - ${location.name}.`);
    assumptions.push(
      `Location factor vs national baseline (${SQUARE_FOOT_PRICING_NATIONAL_BASELINE}): ${location.locationFactorVsNational195} (display only; not applied again).`,
    );
  } else {
    assumptions.push(
      `No location selected; using national baseline $${SQUARE_FOOT_PRICING_NATIONAL_BASELINE}/SF.`,
    );
  }

  if (multipliers.manualLocationAdjustment !== 1) {
    assumptions.push(`Manual location adjustment factor: ${multipliers.manualLocationAdjustment}.`);
  }

  assumptions.push(`MEP intensity uses app-level multiplier (${inputs.mepIntensity}).`);

  return assumptions;
}

export function validateQuickFeasibilityInputs(inputs: QuickFeasibilityInputs): string[] {
  const areaSF = sanitizeNonNegative(sanitizeFiniteNumber(inputs.areaSF, 0));
  const resolvedBase = resolveQuickFeasibilityBaseRate(inputs);

  if (areaSF <= 0 || resolvedBase <= 0) {
    return [QUICK_FEASIBILITY_PREVIEW_HINT];
  }

  return [];
}

export function calculateQuickFeasibilityEstimate(
  inputs: QuickFeasibilityInputs,
): QuickFeasibilityResult {
  const validationMessages = validateQuickFeasibilityInputs(inputs);
  const isValid = validationMessages.length === 0;

  const areaSF = sanitizeNonNegative(sanitizeFiniteNumber(inputs.areaSF, 0));
  const location = getSquareFootPricingLocationByCode(inputs.locationCode);
  const resolvedBasePricePerSf = resolveQuickFeasibilityBaseRate(inputs);
  const multipliers = resolveMultipliers(inputs);
  const contingencyPercent = clampPercent(
    sanitizeFiniteNumber(inputs.contingencyPercent, getDefaultContingencyPercent(inputs.projectType)),
  );

  const baseCost = ensureFiniteOutput(areaSF * resolvedBasePricePerSf);
  const adjustedCost = ensureFiniteOutput(
    baseCost *
      multipliers.projectType *
      multipliers.finish *
      multipliers.complexity *
      multipliers.siteCondition *
      multipliers.mep *
      multipliers.manualLocationAdjustment,
  );

  const contingencyAmount = ensureFiniteOutput((adjustedCost * contingencyPercent) / 100);
  const likelyTotal = ensureFiniteOutput(adjustedCost + contingencyAmount);

  const spread = getRiskSpread(inputs.projectType);
  const lowTotal = ensureFiniteOutput(likelyTotal * spread.low);
  const highTotal = ensureFiniteOutput(likelyTotal * spread.high);

  const adjustedCostPerSF = areaSF > 0 ? ensureFiniteOutput(likelyTotal / areaSF) : 0;

  return {
    baseCost,
    adjustedCost,
    contingencyAmount,
    likelyTotal,
    lowTotal,
    highTotal,
    adjustedCostPerSF,
    resolvedBasePricePerSf,
    locationFactorVsNational195: location?.locationFactorVsNational195 ?? null,
    planningLowPerSf: location?.newConstruction.planningLow ?? null,
    planningHighPerSf: location?.newConstruction.planningHigh ?? null,
    locationConfidence: location?.confidence ?? null,
    locationNotes: location?.notes ?? '',
    isTerritory: isTerritoryLocation(location),
    warnings: buildWarnings(location, inputs),
    assumptions: buildAssumptions(inputs, location, resolvedBasePricePerSf, multipliers),
    isValid,
    validationMessages,
    multipliers,
  };
}

/** @deprecated Use calculateQuickFeasibilityEstimate */
export function computeQuickFeasibility(inputs: QuickFeasibilityInputs): QuickFeasibilityResult {
  return calculateQuickFeasibilityEstimate(inputs);
}

export function createQuickFeasibilityInputsForLocation(
  locationCode: string,
  patch: Partial<QuickFeasibilityInputs> = {},
): QuickFeasibilityInputs {
  const location = getSquareFootPricingLocationByCode(locationCode);
  const basePricePerSf = resolveLocationBasePricePerSf(location);
  const projectType = patch.projectType ?? DEFAULT_QUICK_FEASIBILITY_INPUTS.projectType;

  return {
    ...DEFAULT_QUICK_FEASIBILITY_INPUTS,
    ...patch,
    locationCode: normalizeLocationCode(locationCode),
    basePricePerSf,
    basePricePerSfOverridden: false,
    contingencyPercent: patch.contingencyPercent ?? getDefaultContingencyPercent(projectType),
  };
}

export function createInitialQuickFeasibilityInputs(
  project?: QuickFeasibilityProjectContext | null,
): QuickFeasibilityInputs {
  const locationCode = getDefaultLocationCodeFromProject(project);
  if (!locationCode) {
    return { ...DEFAULT_QUICK_FEASIBILITY_INPUTS };
  }
  return createQuickFeasibilityInputsForLocation(locationCode);
}

function parseSnapshotRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function snapshotNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

function snapshotBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isQuickProjectType(value: unknown): value is QuickFeasibilityProjectType {
  return QUICK_FEASIBILITY_PROJECT_TYPE_OPTIONS.some((option) => option.value === value);
}

function isQuickFinishLevel(value: unknown): value is QuickFeasibilityFinishLevel {
  return QUICK_FEASIBILITY_FINISH_OPTIONS.some((option) => option.value === value);
}

function isQuickComplexityLevel(value: unknown): value is QuickFeasibilityComplexityLevel {
  return QUICK_FEASIBILITY_COMPLEXITY_OPTIONS.some((option) => option.value === value);
}

function isQuickSiteCondition(value: unknown): value is QuickFeasibilitySiteCondition {
  return QUICK_FEASIBILITY_SITE_CONDITION_OPTIONS.some((option) => option.value === value);
}

function isQuickMepIntensity(value: unknown): value is QuickFeasibilityMepIntensity {
  return QUICK_FEASIBILITY_MEP_OPTIONS.some((option) => option.value === value);
}

export function quickFeasibilityInputsFromSnapshot(
  snapshot: unknown,
): QuickFeasibilityInputs | null {
  const snapshotObj = parseSnapshotRecord(snapshot);
  const quickFeasibility = parseSnapshotRecord(snapshotObj.quickFeasibility);
  const locationCode =
    typeof quickFeasibility.locationCode === 'string'
      ? normalizeLocationCode(quickFeasibility.locationCode)
      : '';

  if (!locationCode) return null;

  const projectType = isQuickProjectType(quickFeasibility.projectType)
    ? quickFeasibility.projectType
    : DEFAULT_QUICK_FEASIBILITY_INPUTS.projectType;

  return {
    locationCode,
    basePricePerSf: snapshotNumber(
      quickFeasibility.basePricePerSf,
      DEFAULT_QUICK_FEASIBILITY_INPUTS.basePricePerSf,
    ),
    basePricePerSfOverridden: snapshotBoolean(
      quickFeasibility.basePricePerSfOverridden,
      DEFAULT_QUICK_FEASIBILITY_INPUTS.basePricePerSfOverridden,
    ),
    areaSF: snapshotNumber(
      quickFeasibility.squareFeet ?? quickFeasibility.areaSF,
      DEFAULT_QUICK_FEASIBILITY_INPUTS.areaSF,
    ),
    projectType,
    finishLevel: isQuickFinishLevel(quickFeasibility.finishLevel)
      ? quickFeasibility.finishLevel
      : DEFAULT_QUICK_FEASIBILITY_INPUTS.finishLevel,
    complexityLevel: isQuickComplexityLevel(quickFeasibility.complexity)
      ? quickFeasibility.complexity
      : DEFAULT_QUICK_FEASIBILITY_INPUTS.complexityLevel,
    siteCondition: isQuickSiteCondition(quickFeasibility.siteCondition)
      ? quickFeasibility.siteCondition
      : DEFAULT_QUICK_FEASIBILITY_INPUTS.siteCondition,
    mepIntensity: isQuickMepIntensity(quickFeasibility.mepIntensity)
      ? quickFeasibility.mepIntensity
      : DEFAULT_QUICK_FEASIBILITY_INPUTS.mepIntensity,
    contingencyPercent: snapshotNumber(
      quickFeasibility.contingencyPercent,
      getDefaultContingencyPercent(projectType),
    ),
    manualLocationAdjustmentFactor: snapshotNumber(
      quickFeasibility.manualLocationAdjustmentFactor,
      DEFAULT_QUICK_FEASIBILITY_INPUTS.manualLocationAdjustmentFactor,
    ),
  };
}
