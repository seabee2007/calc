import type { ProductionRateLibraryEntry } from '../data/productionRates/productionRateTypes';

export interface ScopeSuggestionMatchInput {
  divisionCode: string;
  activityTitle: string;
  sourceExcerpt?: string | null;
}

export interface ScopeProductionRateMatch {
  productionRateId: string;
  divisionCode: string;
  divisionName: string;
  workElementName: string;
  category?: string | null;
  unit: string;
  manHoursPerUnit: number;
  confidence: number;
  matchReason: string;
}

export type ScopeProductionRateMatchStatus = 'matched' | 'multiple' | 'none';

const MIN_MATCH_SCORE = 3;
const HIGH_CONFIDENCE_SCORE = 10;
const MAX_MATCHES = 10;

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
    ...(rate.keywords ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function scoreProductionRateMatch(
  input: ScopeSuggestionMatchInput,
  rate: ProductionRateLibraryEntry,
): { score: number; reasons: string[] } {
  if (rate.manHoursPerUnit == null || rate.manHoursPerUnit <= 0) {
    return { score: 0, reasons: [] };
  }

  const titleTokens = tokenize(input.activityTitle);
  const excerptTokens = input.sourceExcerpt ? tokenize(input.sourceExcerpt) : [];
  const tokens = [...new Set([...titleTokens, ...excerptTokens])];
  const haystack = searchableText(rate);

  let score = 0;
  const reasons: string[] = [];

  if (rate.divisionCode === input.divisionCode) {
    score += 2;
    reasons.push(`Division ${input.divisionCode}`);
  } else {
    return { score: 0, reasons: [] };
  }

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += token.length >= 6 ? 3 : 2;
      reasons.push(`Keyword "${token}"`);
    }
  }

  const titleLower = input.activityTitle.toLowerCase();
  if (/\bexcavat/i.test(titleLower) && /\bexcavat/i.test(haystack)) {
    score += 5;
    reasons.push('Excavation activity');
  }
  if (/\b(concrete|rebar|formwork|slab)\b/i.test(titleLower) && /\b(concrete|rebar|formwork|slab)\b/.test(haystack)) {
    score += 4;
    reasons.push('Concrete activity');
  }
  if (/\b(fram|sheath|stud)\b/i.test(titleLower) && /\b(fram|sheath|stud|wood)\b/.test(haystack)) {
    score += 4;
    reasons.push('Framing activity');
  }
  if (/\b(drywall|paint|finish)\b/i.test(titleLower) && /\b(drywall|paint|finish)\b/.test(haystack)) {
    score += 4;
    reasons.push('Finish activity');
  }

  const activityLower = rate.activityName.toLowerCase();
  if (activityLower.includes(titleLower) || titleLower.includes(activityLower)) {
    score += 6;
    reasons.push('Title similarity');
  }

  return { score, reasons: [...new Set(reasons)] };
}

function toConfidence(score: number, topScore: number): number {
  if (topScore <= 0) return 0;
  return Math.min(1, Math.max(0.35, score / Math.max(topScore, HIGH_CONFIDENCE_SCORE)));
}

/** Search approved production-rate library entries for deterministic matches. */
export function matchScopeSuggestionToProductionRates(
  input: ScopeSuggestionMatchInput,
  library: readonly ProductionRateLibraryEntry[],
): ScopeProductionRateMatch[] {
  const scored = library
    .map((rate) => {
      const { score, reasons } = scoreProductionRateMatch(input, rate);
      return { rate, score, reasons };
    })
    .filter((entry) => entry.score >= MIN_MATCH_SCORE)
    .sort((a, b) => b.score - a.score || a.rate.activityName.localeCompare(b.rate.activityName))
    .slice(0, MAX_MATCHES);

  const topScore = scored[0]?.score ?? 0;

  return scored.map(({ rate, score, reasons }) => ({
    productionRateId: rate.id,
    divisionCode: rate.divisionCode,
    divisionName: rate.divisionName,
    workElementName: rate.activityName,
    category: rate.category ?? null,
    unit: rate.unitOfMeasure,
    manHoursPerUnit: rate.manHoursPerUnit ?? 0,
    confidence: toConfidence(score, topScore),
    matchReason: reasons.slice(0, 4).join('; '),
  }));
}

/** Preselect a single high-confidence match when appropriate. */
export function pickDefaultScopeProductionRateMatch(
  matches: readonly ScopeProductionRateMatch[],
): string | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0].productionRateId;

  const [top, second] = matches;
  const topScoreProxy = top.confidence;
  if (topScoreProxy >= 0.85 && top.confidence - second.confidence >= 0.2) {
    return top.productionRateId;
  }
  if (top.matchReason.includes('Title similarity') && top.confidence >= 0.75) {
    return top.productionRateId;
  }
  return null;
}

export function getScopeProductionRateMatchStatus(
  matches: readonly ScopeProductionRateMatch[],
  selectedProductionRateId: string | null | undefined,
): ScopeProductionRateMatchStatus {
  if (matches.length === 0) return 'none';
  if (selectedProductionRateId) return 'matched';
  if (matches.length === 1) return 'matched';
  return 'multiple';
}

export function findScopeProductionRateMatchById(
  matches: readonly ScopeProductionRateMatch[],
  productionRateId: string | null | undefined,
): ScopeProductionRateMatch | null {
  if (!productionRateId) return null;
  return matches.find((match) => match.productionRateId === productionRateId) ?? null;
}
