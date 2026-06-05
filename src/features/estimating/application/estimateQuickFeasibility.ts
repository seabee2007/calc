import {
  clampPercent,
  roundToTwo,
  sanitizeFiniteNumber,
  sanitizeNonNegative,
} from '../domain/estimateMath';

export const QUICK_FEASIBILITY_PREVIEW_HINT =
  'Enter area and cost per square foot to preview a quick estimate.';

export type QuickFeasibilityQualityLevel = 'basic' | 'standard' | 'premium' | 'luxury';

export type QuickFeasibilityConfidenceLevel = 'low' | 'medium' | 'high';

export interface QuickFeasibilityInputs {
  projectType: string;
  location: string;
  areaSF: number;
  costPerSF: number;
  qualityLevel: QuickFeasibilityQualityLevel;
  locationFactor: number;
  complexityFactor: number;
  contingencyPercent: number;
}

export interface QuickFeasibilityResult {
  baseCost: number;
  likelyTotal: number;
  lowTotal: number;
  highTotal: number;
  effectiveCostPerSF: number;
  confidenceLevel: QuickFeasibilityConfidenceLevel;
  assumptions: string[];
  isValid: boolean;
  validationMessages: string[];
}

export const QUICK_FEASIBILITY_QUALITY_OPTIONS: ReadonlyArray<{
  value: QuickFeasibilityQualityLevel;
  label: string;
}> = [
  { value: 'basic', label: 'Basic' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
];

export const QUICK_FEASIBILITY_PROJECT_TYPE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: 'office', label: 'Office' },
  { value: 'retail', label: 'Retail' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'residential', label: 'Residential' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'other', label: 'Other' },
];

export const DEFAULT_QUICK_FEASIBILITY_INPUTS: QuickFeasibilityInputs = {
  projectType: 'office',
  location: '',
  areaSF: 0,
  costPerSF: 0,
  qualityLevel: 'standard',
  locationFactor: 1,
  complexityFactor: 1,
  contingencyPercent: 0,
};

const CONFIDENCE_SPREAD: Record<QuickFeasibilityConfidenceLevel, number> = {
  high: 0.1,
  medium: 0.18,
  low: 0.28,
};

function sanitizeFactor(value: number, fallback = 1): number {
  const safe = sanitizeNonNegative(sanitizeFiniteNumber(value, fallback));
  return safe > 0 ? safe : fallback;
}

function ensureFiniteOutput(value: number): number {
  const safe = sanitizeFiniteNumber(value, 0);
  return Number.isFinite(safe) ? roundToTwo(safe) : 0;
}

function formatQualityLabel(level: QuickFeasibilityQualityLevel): string {
  return QUICK_FEASIBILITY_QUALITY_OPTIONS.find((option) => option.value === level)?.label ?? level;
}

function formatProjectTypeLabel(projectType: string): string {
  const trimmed = projectType.trim();
  if (!trimmed) return 'Unspecified project type';
  return (
    QUICK_FEASIBILITY_PROJECT_TYPE_OPTIONS.find((option) => option.value === trimmed)?.label ??
    trimmed
  );
}

function assessConfidence(inputs: QuickFeasibilityInputs): QuickFeasibilityConfidenceLevel {
  const areaSF = sanitizeNonNegative(inputs.areaSF);
  const costPerSF = sanitizeNonNegative(inputs.costPerSF);
  const locationFactor = sanitizeFactor(inputs.locationFactor);
  const complexityFactor = sanitizeFactor(inputs.complexityFactor);

  if (areaSF <= 0 || costPerSF <= 0) return 'low';

  const hasContext = inputs.projectType.trim().length > 0 || inputs.location.trim().length > 0;
  const factorsInRange =
    locationFactor >= 0.75 &&
    locationFactor <= 1.5 &&
    complexityFactor >= 0.75 &&
    complexityFactor <= 1.5;

  if (hasContext && factorsInRange && areaSF >= 1000 && costPerSF >= 50) {
    return 'high';
  }

  if (hasContext || (areaSF >= 500 && costPerSF >= 25)) {
    return 'medium';
  }

  return 'low';
}

function buildAssumptions(inputs: QuickFeasibilityInputs): string[] {
  const assumptions: string[] = [
    'Local preview only — not saved to estimate versions.',
    `Project type: ${formatProjectTypeLabel(inputs.projectType)}.`,
    `Quality level: ${formatQualityLabel(inputs.qualityLevel)}.`,
  ];

  if (inputs.location.trim()) {
    assumptions.push(`Location: ${inputs.location.trim()}.`);
  } else {
    assumptions.push('Location not specified; location factor applied as entered.');
  }

  assumptions.push(
    `Base cost = area × cost/SF × location factor × complexity factor.`,
    `Likely total includes ${clampPercent(inputs.contingencyPercent)}% contingency.`,
    'Low/high range uses a conservative confidence spread for early feasibility only.',
  );

  return assumptions;
}

export function validateQuickFeasibilityInputs(inputs: QuickFeasibilityInputs): string[] {
  const areaSF = sanitizeNonNegative(sanitizeFiniteNumber(inputs.areaSF, 0));
  const costPerSF = sanitizeNonNegative(sanitizeFiniteNumber(inputs.costPerSF, 0));

  if (areaSF <= 0 || costPerSF <= 0) {
    return [QUICK_FEASIBILITY_PREVIEW_HINT];
  }

  return [];
}

export function computeQuickFeasibility(inputs: QuickFeasibilityInputs): QuickFeasibilityResult {
  const validationMessages = validateQuickFeasibilityInputs(inputs);
  const isValid = validationMessages.length === 0;

  const areaSF = sanitizeNonNegative(sanitizeFiniteNumber(inputs.areaSF, 0));
  const costPerSF = sanitizeNonNegative(sanitizeFiniteNumber(inputs.costPerSF, 0));
  const locationFactor = sanitizeFactor(inputs.locationFactor);
  const complexityFactor = sanitizeFactor(inputs.complexityFactor);
  const contingencyPercent = clampPercent(sanitizeFiniteNumber(inputs.contingencyPercent, 0));

  const baseCost = ensureFiniteOutput(
    areaSF * costPerSF * locationFactor * complexityFactor,
  );
  const contingencyMultiplier = 1 + contingencyPercent / 100;
  const likelyTotal = ensureFiniteOutput(baseCost * contingencyMultiplier);

  const confidenceLevel = assessConfidence(inputs);
  const spread = CONFIDENCE_SPREAD[confidenceLevel];
  const lowTotal = ensureFiniteOutput(likelyTotal * (1 - spread));
  const highTotal = ensureFiniteOutput(likelyTotal * (1 + spread));

  const effectiveCostPerSF =
    areaSF > 0 ? ensureFiniteOutput(likelyTotal / areaSF) : 0;

  return {
    baseCost,
    likelyTotal,
    lowTotal,
    highTotal,
    effectiveCostPerSF,
    confidenceLevel,
    assumptions: buildAssumptions(inputs),
    isValid,
    validationMessages,
  };
}
