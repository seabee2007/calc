import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';

export interface QuantityWorkElementMatchInput {
  divisionCode: string;
  divisionName: string;
  description: string;
  quantity: number;
  unit: string;
  usageRole?: string;
  quantityType?: string;
  sourceObjectLabel?: string;
  formula?: string;
  parameterSnapshot?: Record<string, unknown>;
  keywords?: readonly string[];
}

export interface ProductionRateCandidate {
  productionRateId: string;
  divisionCode: string;
  divisionName: string;
  workElementName: string;
  category?: string | null;
  unit: string;
  manHoursPerUnit: number;
  confidence: number;
  matchReason: string;
  unitCompatible: boolean;
}

export type QuantityWorkElementAssignment =
  | {
      status: 'auto_matched';
      productionRateId: string;
      confidence: number;
      matchReason: string;
      unitCompatible: true;
      candidates: ProductionRateCandidate[];
    }
  | {
      status: 'review_required';
      candidates: ProductionRateCandidate[];
      issue: string;
    }
  | {
      status: 'excluded';
      reason: string;
    };

type UnitDimension = 'volume' | 'area' | 'length' | 'count' | 'bag' | 'other';

const MIN_MATCH_SCORE = 4;
const HIGH_CONFIDENCE_SCORE = 14;
const AUTO_MATCH_MIN_CONFIDENCE = 0.85;
const AUTO_MATCH_MIN_SCORE_GAP = 4;
const MAX_MATCHES = 10;

const M3_PER_CYD = 0.764554857984;
const M2_PER_SF = 0.09290304;
const M_PER_LF = 0.3048;

function normalizeUnit(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

export function getProductionRateUnitDimension(unit: string | null | undefined): UnitDimension {
  const normalized = normalizeUnit(unit);
  if (['CY', 'CYD', 'BANK CYD', 'LOOSE CYD', 'M3', 'CF'].includes(normalized)) return 'volume';
  if (['SF', 'SY', 'M2', 'SQUARE'].includes(normalized)) return 'area';
  if (['LF', 'M'].includes(normalized)) return 'length';
  if (['EA', 'EACH'].includes(normalized)) return 'count';
  if (normalized === 'BAG') return 'bag';
  return 'other';
}

export function areProductionRateUnitsCompatible(
  quantityUnit: string,
  rateUnit: string,
): boolean {
  const quantityNormalized = normalizeUnit(quantityUnit);
  const rateNormalized = normalizeUnit(rateUnit);
  if (!quantityNormalized || !rateNormalized) return false;
  if (quantityNormalized === rateNormalized) return true;

  const quantityDimension = getProductionRateUnitDimension(quantityNormalized);
  const rateDimension = getProductionRateUnitDimension(rateNormalized);
  if (quantityDimension !== rateDimension) return false;

  if (quantityDimension === 'count') return true;
  if (quantityDimension === 'bag') return quantityNormalized === rateNormalized;
  if (quantityDimension === 'other') return false;

  return true;
}

export function convertQuantityForProductionRateUnit(
  quantity: number,
  quantityUnit: string,
  rateUnit: string,
): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const from = normalizeUnit(quantityUnit);
  const to = normalizeUnit(rateUnit);
  if (from === to) return quantity;
  if (!areProductionRateUnitsCompatible(from, to)) return quantity;

  if (from === 'M3' && ['CY', 'CYD', 'BANK CYD', 'LOOSE CYD'].includes(to)) {
    return quantity / M3_PER_CYD;
  }
  if (['CY', 'CYD', 'BANK CYD', 'LOOSE CYD'].includes(from) && to === 'M3') {
    return quantity * M3_PER_CYD;
  }
  if (from === 'M2' && to === 'SF') return quantity / M2_PER_SF;
  if (from === 'SF' && to === 'M2') return quantity * M2_PER_SF;
  if (from === 'M' && to === 'LF') return quantity / M_PER_LF;
  if (from === 'LF' && to === 'M') return quantity * M_PER_LF;

  return quantity;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function searchableText(rate: ProductionRateLibraryEntry): string {
  return [
    rate.activityName,
    rate.description,
    rate.category,
    rate.subcategory,
    rate.canonicalTitle,
    rate.canonicalDescription,
    rate.figureTitle,
    ...(rate.keywords ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function hasAnyTerm(haystack: string, terms: readonly string[]): boolean {
  return terms.some((term) => {
    const normalized = term.toLowerCase();
    if (normalized.includes(' ')) return haystack.includes(normalized);
    return new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack);
  });
}

function categoryIs(rate: ProductionRateLibraryEntry, expected: string): boolean {
  return normalizeText(rate.category) === expected.toLowerCase();
}

const GENERIC_CONTEXT_STOP_TERMS = new Set([
  'area',
  'count',
  'length',
  'volume',
  'installed',
  'installation',
  'install',
  'labor',
  'driver',
  'primary',
  'secondary',
  'interior',
  'exterior',
  'infill',
  'finish',
  'base',
  'coat',
  'work',
  'system',
  'surface',
]);

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function genericContextTerms(input: {
  description?: string;
  quantityType?: string;
  keywords?: readonly string[];
}): string[] {
  const values = [
    ...(input.keywords ?? []),
    input.description,
    input.quantityType?.replace(/_/g, ' '),
  ].filter((value): value is string => Boolean(value?.trim()));

  const terms: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    const tokens = tokenize(normalized).filter((token) => !GENERIC_CONTEXT_STOP_TERMS.has(token));
    if (tokens.length === 0) continue;
    if (tokens.length <= 4) terms.push(normalized);
    terms.push(...tokens);
  }
  return uniqueValues(terms);
}

function hasKnownConcreteOperationCategory(rate: ProductionRateLibraryEntry): boolean {
  return [
    'concrete formwork',
    'concrete placement',
    'concrete reinforcement',
    'concrete finishing',
    'concrete joints, curing & accessories',
    'aggregate base courses',
  ].includes(normalizeText(rate.category));
}

function isRateOperationCompatibleForUsage(
  usageRole: string | null | undefined,
  rate: ProductionRateLibraryEntry,
  context?: {
    description?: string;
    quantityType?: string;
    keywords?: readonly string[];
  },
): boolean {
  if (!usageRole) return true;

  const haystack = searchableText(rate);
  const hasKnownCategory = hasKnownConcreteOperationCategory(rate);
  switch (usageRole) {
    case 'formwork_labor':
    case 'strip_forms_labor':
      if (hasKnownCategory) return categoryIs(rate, 'Concrete Formwork');
      return (
        hasAnyTerm(haystack, [
          'formwork',
          'forming',
          'forms',
          'form',
          'edge form',
          'edge forms',
          'bulkhead',
        ])
      );
    case 'place_concrete_labor':
      if (hasKnownCategory) return categoryIs(rate, 'Concrete Placement');
      return (
        hasAnyTerm(haystack, [
          'place concrete',
          'placing concrete',
          'pour concrete',
          'cast in place',
          'cast-in-place',
        ])
      );
    case 'reinforcement_labor':
      if (hasKnownCategory) return categoryIs(rate, 'Concrete Reinforcement');
      return (
        hasAnyTerm(haystack, [
          'reinforcement',
          'reinforcing',
          'rebar',
          'welded wire fabric',
          'wwf',
        ])
      );
    case 'concrete_finish_labor':
      if (hasKnownCategory) return categoryIs(rate, 'Concrete Finishing');
      return (
        hasAnyTerm(haystack, ['finish concrete', 'finishing', 'screed', 'float', 'trowel', 'broom finish'])
      );
    case 'joint_labor':
      if (hasKnownCategory && !categoryIs(rate, 'Concrete Joints, Curing & Accessories')) return false;
      return (
        (categoryIs(rate, 'Concrete Joints, Curing & Accessories') || !hasKnownCategory) &&
        hasAnyTerm(haystack, ['joint', 'saw cut', 'sawcut', 'water stop', 'waterstop', 'reglet', 'backer rod'])
      );
    case 'curing_labor':
      if (hasKnownCategory && !categoryIs(rate, 'Concrete Joints, Curing & Accessories')) return false;
      return (
        (categoryIs(rate, 'Concrete Joints, Curing & Accessories') || !hasKnownCategory) &&
        hasAnyTerm(haystack, ['curing', 'cure', 'cured'])
      );
    case 'aggregate_base_labor':
      if (hasKnownCategory) return categoryIs(rate, 'Aggregate Base Courses');
      return (
        hasAnyTerm(haystack, ['aggregate base', 'base course', 'gravel base', 'stone base'])
      );
    case 'primary_labor_driver':
    case 'secondary_labor_driver': {
      const terms = genericContextTerms(context ?? {});
      if (terms.length === 0) return true;
      return hasAnyTerm(haystack, terms);
    }
    default:
      return true;
  }
}

export function isProductionRateAllowedForDesignUsage(input: {
  divisionCode: string;
  unit: string;
  usageRole?: string | null;
  rate: ProductionRateLibraryEntry;
  description?: string;
  quantityType?: string;
  keywords?: readonly string[];
  requireCompatibleUnit?: boolean;
}): boolean {
  const requireCompatibleUnit = input.requireCompatibleUnit ?? true;
  if (input.rate.divisionCode !== input.divisionCode) return false;
  if ((input.rate.manHoursPerUnit ?? 0) <= 0) return false;
  if (requireCompatibleUnit && !areProductionRateUnitsCompatible(input.unit, input.rate.unitOfMeasure)) {
    return false;
  }
  return isRateOperationCompatibleForUsage(input.usageRole, input.rate, input);
}

function buildInputTokens(input: QuantityWorkElementMatchInput): string[] {
  return [
    input.description,
    input.quantityType,
    input.sourceObjectLabel,
    input.formula,
    ...(input.keywords ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap(tokenize);
}

function scoreProductionRateMatch(
  input: QuantityWorkElementMatchInput,
  rate: ProductionRateLibraryEntry,
): { score: number; reasons: string[] } {
  if (rate.divisionCode !== input.divisionCode) return { score: 0, reasons: [] };
  if (rate.manHoursPerUnit == null || rate.manHoursPerUnit <= 0) return { score: 0, reasons: [] };

  const haystack = searchableText(rate);
  const tokens = [...new Set(buildInputTokens(input))];
  const descriptionLower = input.description.toLowerCase();
  let score = 2;
  const reasons = [`Division ${input.divisionCode}`];

  for (const keyword of input.keywords ?? []) {
    const keywordLower = keyword.toLowerCase();
    if (keywordLower && haystack.includes(keywordLower)) {
      score += keywordLower.length >= 8 ? 5 : 4;
      reasons.push(`Rule keyword "${keyword}"`);
    }
  }

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += token.length >= 6 ? 3 : 2;
      reasons.push(`Keyword "${token}"`);
    }
  }

  if (/\b(concrete|rc|slab|footing|beam|column|cap)\b/i.test(descriptionLower) &&
      /\b(concrete|slab|footing|beam|column|form|place)\b/.test(haystack)) {
    score += 4;
    reasons.push('Concrete work');
  }
  if (/\b(cmu|masonry|block|grout|bond)\b/i.test(descriptionLower) &&
      /\b(cmu|masonry|block|grout|bond)\b/.test(haystack)) {
    score += 4;
    reasons.push('Masonry work');
  }
  if (/\b(roof|soffit|fascia|ridge|metal|panel)\b/i.test(descriptionLower) &&
      /\b(roof|soffit|fascia|ridge|metal|panel)\b/.test(haystack)) {
    score += 4;
    reasons.push('Roof work');
  }
  if (/\b(steel|truss|purlin|plate|anchor)\b/i.test(descriptionLower) &&
      /\b(steel|truss|purlin|plate|anchor|metal)\b/.test(haystack)) {
    score += 4;
    reasons.push('Metals work');
  }

  const rateTitle = (rate.canonicalTitle ?? rate.activityName).toLowerCase();
  if (rateTitle.includes(descriptionLower) || descriptionLower.includes(rateTitle)) {
    score += 6;
    reasons.push('Title similarity');
  }

  return { score, reasons: [...new Set(reasons)] };
}

function toConfidence(score: number, topScore: number): number {
  if (topScore <= 0) return 0;
  return Math.min(1, Math.max(0.35, score / Math.max(topScore, HIGH_CONFIDENCE_SCORE)));
}

function candidateFromRate(
  rate: ProductionRateLibraryEntry,
  score: number,
  topScore: number,
  reasons: readonly string[],
  unitCompatible: boolean,
): ProductionRateCandidate {
  return {
    productionRateId: rate.id,
    divisionCode: rate.divisionCode,
    divisionName: rate.divisionName,
    workElementName: rate.canonicalTitle ?? rate.activityName,
    category: rate.category ?? null,
    unit: rate.unitOfMeasure,
    manHoursPerUnit: rate.manHoursPerUnit ?? 0,
    confidence: toConfidence(score, topScore),
    matchReason: reasons.slice(0, 5).join('; '),
    unitCompatible,
  };
}

function buildCandidates(
  input: QuantityWorkElementMatchInput,
  rates: readonly ProductionRateLibraryEntry[],
  requireCompatibleUnits: boolean,
): Array<{ candidate: ProductionRateCandidate; score: number }> {
  const scored = rates
    .map((rate) => {
      if (!isRateOperationCompatibleForUsage(input.usageRole, rate, input)) return null;
      const unitCompatible = areProductionRateUnitsCompatible(input.unit, rate.unitOfMeasure);
      if (requireCompatibleUnits && !unitCompatible) return null;
      const { score, reasons } = scoreProductionRateMatch(input, rate);
      if (score < MIN_MATCH_SCORE) return null;
      return { rate, score, reasons, unitCompatible };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .sort((left, right) => right.score - left.score || left.rate.activityName.localeCompare(right.rate.activityName))
    .slice(0, MAX_MATCHES);

  const topScore = scored[0]?.score ?? 0;
  return scored.map(({ rate, score, reasons, unitCompatible }) => ({
    score,
    candidate: candidateFromRate(rate, score, topScore, reasons, unitCompatible),
  }));
}

export function matchQuantityToProductionRates(
  input: QuantityWorkElementMatchInput,
  library: readonly ProductionRateLibraryEntry[],
): QuantityWorkElementAssignment {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { status: 'excluded', reason: 'Zero quantity.' };
  }

  const eligibleRates = library.filter(
    (rate) =>
      rate.divisionCode === input.divisionCode &&
      rate.manHoursPerUnit != null &&
      rate.manHoursPerUnit > 0,
  );

  if (eligibleRates.length === 0) {
    return {
      status: 'review_required',
      candidates: [],
      issue: `No approved Division ${input.divisionCode} production rates with positive MH/unit were found.`,
    };
  }

  const compatibleCandidates = buildCandidates(input, eligibleRates, true);
  if (compatibleCandidates.length === 0) {
    const incompatibleCandidates = buildCandidates(input, eligibleRates, false)
      .filter((entry) => !entry.candidate.unitCompatible)
      .slice(0, 5)
      .map((entry) => entry.candidate);
    const issue = incompatibleCandidates[0]
      ? `Quantity unit ${input.unit} does not match candidate rate unit ${incompatibleCandidates[0].unit}.`
      : `No compatible ${input.unit} production-rate match was found in Division ${input.divisionCode}.`;
    return {
      status: 'review_required',
      candidates: incompatibleCandidates,
      issue,
    };
  }

  const candidates = compatibleCandidates.map((entry) => entry.candidate);
  const [top, second] = compatibleCandidates;
  const gap = second ? top.score - second.score : AUTO_MATCH_MIN_SCORE_GAP;
  const topCandidate = top.candidate;

  if (
    topCandidate.confidence >= AUTO_MATCH_MIN_CONFIDENCE &&
    gap >= AUTO_MATCH_MIN_SCORE_GAP &&
    topCandidate.unitCompatible
  ) {
    return {
      status: 'auto_matched',
      productionRateId: topCandidate.productionRateId,
      confidence: topCandidate.confidence,
      matchReason: topCandidate.matchReason,
      unitCompatible: true,
      candidates,
    };
  }

  return {
    status: 'review_required',
    candidates,
    issue: candidates.length > 1 ? 'Multiple compatible production-rate candidates need review.' : 'Review the suggested production-rate match.',
  };
}
