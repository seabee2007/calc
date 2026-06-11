import type { NormalizedProductionRateRecord } from './productionRateTypes';

const LEADING_VERBS = /^(install|installation of|place|construct|apply|erect|fabricate)\s+/i;

const UNIT_ALIASES: Record<string, string> = {
  sf: 'sf',
  'sf of contact': 'sf_contact',
  'sf of contact surface': 'sf_contact',
  'square foot': 'sf',
  'square feet': 'sf',
  sy: 'sy',
  'square yard': 'sy',
  lf: 'lf',
  'linear foot': 'lf',
  'linear feet': 'lf',
  cy: 'cyd',
  cyd: 'cyd',
  'cubic yard': 'cyd',
  'cubic yards': 'cyd',
  'loose cyd': 'loose_cyd',
  'bank cyd': 'bank_cyd',
  cf: 'cf',
  ea: 'each',
  each: 'each',
  opening: 'opening',
  pair: 'pair',
  kit: 'kit',
  square: 'square',
  'sf of wall surface': 'sf_wall',
  'sf of floor': 'sf_floor',
  'sf of shelf': 'sf_shelf',
  ton: 'ton',
  lb: 'lb',
  acre: 'acre',
  feet: 'feet',
  foot: 'feet',
  mbf: 'mbf',
};

const FABRICATE_ONLY = /\bfabricate only\b/i;
const FORMS_IN_PLACE = /\bforms in place\b/i;

const DIMENSION_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*(?:-| )?(?:inch|inches|in|foot|feet|ft|high|wide|deep|diameter|thick|width)\b/gi;

export function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return collapseWhitespace(
    value
      .toLowerCase()
      .replace(/[^\w\s.-]/g, ' ')
      .replace(/\s+/g, ' '),
  );
}

export function normalizeUnitKey(unit: string | null | undefined): string {
  const collapsed = collapseWhitespace(unit ?? '').toLowerCase();
  if (!collapsed) return 'unknown';
  return UNIT_ALIASES[collapsed] ?? collapsed.replace(/\s+/g, '_');
}

export function normalizeWorkElementNumber(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeCategory(record: NormalizedProductionRateRecord): string {
  return normalizeText(record.category ?? record.subcategory ?? record.activityName);
}

export function getRecordDescription(record: NormalizedProductionRateRecord): string {
  return collapseWhitespace(
    record.description?.trim() ||
      record.activityName?.trim() ||
      record.subcategory?.trim() ||
      '',
  );
}

/** Strip leading verbs for comparison only — not for display. */
export function normalizeForComparison(description: string): string {
  let text = normalizeText(description);
  text = text.replace(LEADING_VERBS, '');
  return collapseWhitespace(text);
}

export function extractDimensionTokens(description: string): string[] {
  const matches = description.match(DIMENSION_PATTERN) ?? [];
  return [...new Set(matches.map((token) => normalizeText(token)))].sort();
}

export function stripDimensionsForStem(description: string): string {
  return collapseWhitespace(
    description.replace(DIMENSION_PATTERN, ' ').replace(/\s+/g, ' ').trim(),
  );
}

export function hasFabricateOnly(description: string): boolean {
  return FABRICATE_ONLY.test(description);
}

export function hasFormsInPlace(description: string): boolean {
  return FORMS_IN_PLACE.test(description);
}

export function hasConflictingProductionConditions(a: string, b: string): boolean {
  const aFab = hasFabricateOnly(a);
  const bFab = hasFabricateOnly(b);
  const aForms = hasFormsInPlace(a);
  const bForms = hasFormsInPlace(b);
  return (aFab && bForms) || (bFab && aForms);
}

export function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

export function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function roundManHours(value: number | null | undefined, decimals = 3): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function manHoursWithinTolerance(
  a: number | null | undefined,
  b: number | null | undefined,
  tolerance: number,
): boolean {
  const ra = roundManHours(a);
  const rb = roundManHours(b);
  if (ra == null || rb == null) return ra === rb;
  return Math.abs(ra - rb) <= tolerance;
}

export function buildStrongMatchKey(record: NormalizedProductionRateRecord): string {
  const description = getRecordDescription(record);
  const mh = roundManHours(record.manHoursPerUnit) ?? 'null';
  return [
    record.division,
    normalizeCategory(record),
    normalizeWorkElementNumber(record.workElementNumber),
    normalizeUnitKey(record.unitOfMeasure),
    normalizeForComparison(description),
    String(mh),
  ].join('|');
}

export function buildVariantStemKey(record: NormalizedProductionRateRecord): string {
  const description = getRecordDescription(record);
  const stem = stripDimensionsForStem(normalizeForComparison(description));
  return [
    record.division,
    normalizeCategory(record),
    normalizeUnitKey(record.unitOfMeasure),
    stem,
  ].join('|');
}

export function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function buildCanonicalKey(parts: string[]): string {
  return parts.filter(Boolean).join('|');
}
