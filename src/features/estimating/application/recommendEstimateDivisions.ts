import { supabase } from '../../../lib/supabase';
import { getCsiDivisionByCode, isKnownCsiDivision } from '../domain/csiDivisions';
import { normalizeSelectedDivisionCodes } from './estimateWorkBreakdown';

export interface RecommendedDivision {
  code: string;
  name: string;
  confidence: number;
  reason: string;
}

export interface RecommendEstimateDivisionsRequest {
  projectId: string;
  projectName?: string;
  projectType?: string;
  projectScope?: string;
  projectDescription?: string;
  location?: string;
}

export interface RecommendEstimateDivisionsResponse {
  recommendedDivisionCodes: string[];
  recommendations: RecommendedDivision[];
  warnings?: string[];
}

export const RECOMMEND_DIVISIONS_ERROR_MESSAGE =
  'Could not recommend divisions. You can still select divisions manually.';

const DIRECT_MATCHES: Record<string, string[]> = {
  '03': ['concrete', 'slab', 'footing', 'foundation', 'sidewalk', 'driveway', 'curb', 'pad'],
  '04': ['masonry', 'cmu', 'block', 'brick'],
  '05': ['metal', 'steel', 'metal roof', 'structural steel'],
  '06': ['wood', 'framing', 'carpentry', 'studs', 'sheathing'],
  '07': ['roof', 'insulation', 'waterproofing', 'moisture', 'flashing'],
  '08': ['doors', 'door', 'windows', 'window', 'openings', 'glazing'],
  '09': ['paint', 'drywall', 'flooring', 'ceiling', 'finishes', 'finish'],
  '22': ['plumbing', 'water line', 'sewer', 'toilet', 'sink'],
  '23': ['hvac', 'air conditioning', 'duct', 'ventilation'],
  '26': ['electrical', 'power', 'lighting', 'panel'],
  '31': ['grading', 'excavation', 'earthwork', 'backfill', 'trenching'],
  '32': ['paving', 'sidewalk', 'curb', 'fence', 'landscaping', 'parking'],
  '33': ['utility', 'utilities', 'storm', 'water service', 'sewer service'],
};

const BUILDING_SCOPE_PATTERN = /\b(building|office|house|facility|structure|single-story|new build)\b/i;
const EXISTING_SCOPE_PATTERN = /\b(remodel|renovation|addition|demolition|demo|repair|replacement|existing)\b/i;

function findDirectMatch(code: string, scopeText: string): string | null {
  const scope = scopeText.toLowerCase();
  return DIRECT_MATCHES[code]?.find((term) => scope.includes(term)) ?? null;
}

export function scoreDivisionConfidence(code: string, scopeText = ''): number {
  if (code === '01') return scopeText.trim() ? 0.9 : 0.5;

  if (findDirectMatch(code, scopeText)) return 0.95;

  if (code === '02' && EXISTING_SCOPE_PATTERN.test(scopeText)) return 0.9;

  if (['07', '08', '09', '22', '23', '26'].includes(code) && BUILDING_SCOPE_PATTERN.test(scopeText)) {
    return 0.78;
  }

  return 0.65;
}

export function buildDivisionReason(code: string, scopeText = ''): string {
  const term = findDirectMatch(code, scopeText);
  const division = getCsiDivisionByCode(code);

  if (code === '01') {
    return 'The scope describes a construction project, so general requirements like supervision, safety, layout, and temporary controls are needed.';
  }

  if (term) {
    const directReasons: Record<string, string> = {
      '03': `The scope mentions ${term}, so concrete work is directly required.`,
      '04': `The scope mentions ${term}, so masonry work is directly required.`,
      '05': `The scope mentions ${term}, so metals work should be included.`,
      '06': `The scope mentions ${term}, so wood, plastics, and composites work should be included.`,
      '07': `The scope mentions ${term}, so thermal and moisture protection should be included.`,
      '08': `The scope mentions ${term}, so openings should be included.`,
      '09': `The scope mentions ${term}, so finishes should be included.`,
      '22': `The scope mentions ${term}, so plumbing should be included.`,
      '23': `The scope mentions ${term}, so HVAC should be included.`,
      '26': `The scope mentions ${term}, so electrical work should be included.`,
      '31': `The scope mentions ${term}, so earthwork should be included.`,
      '32': `The scope mentions ${term}, so exterior improvements should be included.`,
      '33': `The scope mentions ${term}, so utilities should be included.`,
    };
    return directReasons[code] ?? `The scope mentions ${term}, which points to ${division?.name ?? code}.`;
  }

  if (code === '02' && EXISTING_SCOPE_PATTERN.test(scopeText)) {
    return 'The scope references work around an existing condition, so existing conditions should be included.';
  }

  if (['07', '08', '09', '22', '23', '26'].includes(code) && BUILDING_SCOPE_PATTERN.test(scopeText)) {
    return `The scope describes a building or occupied structure, so ${division?.name ?? code} is likely part of the work even if not named directly.`;
  }

  return `The project scope suggests ${division?.name ?? code} may be needed, but the support is indirect.`;
}

function hasGenericReason(reason: string): boolean {
  const lower = reason.toLowerCase();
  return (
    lower.includes('recommended based on project scope') ||
    lower.includes('recommended for this project scope') ||
    lower.includes('likely needed based on the project scope')
  );
}

function toFiniteConfidence(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(1, Math.max(0, numeric));
}

export function normalizeRecommendEstimateDivisionsResponse(
  raw: unknown,
  scopeText = '',
): RecommendEstimateDivisionsResponse {
  const parsed = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};

  const rawCodes = Array.isArray(parsed.recommendedDivisionCodes)
    ? parsed.recommendedDivisionCodes
    : [];
  const rawRecommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((warning): warning is string => typeof warning === 'string')
    : undefined;

  const recommendationByCode = new Map<string, RecommendedDivision>();

  for (const item of rawRecommendations) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const normalized = normalizeSelectedDivisionCodes([String(record.code ?? '')])[0];
    if (!normalized || !isKnownCsiDivision(normalized)) continue;

    const division = getCsiDivisionByCode(normalized);
    const fallbackConfidence = scoreDivisionConfidence(normalized, scopeText);
    const reason =
      typeof record.reason === 'string' && record.reason.trim()
        ? record.reason.trim()
        : '';
    recommendationByCode.set(normalized, {
      code: normalized,
      name: division?.name ?? (typeof record.name === 'string' ? record.name : normalized),
      confidence: toFiniteConfidence(record.confidence, fallbackConfidence),
      reason:
        reason && !hasGenericReason(reason)
          ? reason
          : buildDivisionReason(normalized, scopeText),
    });
  }

  const recommendedDivisionCodes = normalizeSelectedDivisionCodes([
    ...rawCodes.map((code) => String(code)),
    ...recommendationByCode.keys(),
  ]).filter(isKnownCsiDivision);

  const recommendations = recommendedDivisionCodes.map((code) => {
    const existing = recommendationByCode.get(code);
    if (existing) return existing;

    const division = getCsiDivisionByCode(code);
    return {
      code,
      name: division?.name ?? code,
      confidence: scoreDivisionConfidence(code, scopeText),
      reason: buildDivisionReason(code, scopeText),
    };
  });

  const uniqueConfidences = new Set(recommendations.map((item) => item.confidence));
  if (scopeText.trim() && recommendations.length > 1 && uniqueConfidences.size === 1) {
    recommendations.forEach((item) => {
      item.confidence = scoreDivisionConfidence(item.code, scopeText);
      if (hasGenericReason(item.reason)) {
        item.reason = buildDivisionReason(item.code, scopeText);
      }
    });
  }

  const filteredRecommendations = recommendations.filter(
    (item) => item.confidence >= 0.65 || (!scopeText.trim() && item.code === '01'),
  );
  const filteredCodes = recommendedDivisionCodes.filter((code) =>
    filteredRecommendations.some((item) => item.code === code),
  );

  return {
    recommendedDivisionCodes: filteredCodes,
    recommendations: filteredRecommendations,
    warnings: warnings && warnings.length > 0 ? warnings : undefined,
  };
}

export function mergeRecommendedDivisionCodes(
  existing: readonly string[],
  recommended: readonly string[],
): string[] {
  return normalizeSelectedDivisionCodes([...existing, ...recommended]);
}

export async function recommendEstimateDivisions(
  request: RecommendEstimateDivisionsRequest,
): Promise<RecommendEstimateDivisionsResponse> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) {
    throw new Error(RECOMMEND_DIVISIONS_ERROR_MESSAGE);
  }

  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) {
    throw new Error(RECOMMEND_DIVISIONS_ERROR_MESSAGE);
  }

  const res = await fetch(`${base}/functions/v1/recommend-estimate-divisions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const message = typeof body.error === 'string' ? body.error : RECOMMEND_DIVISIONS_ERROR_MESSAGE;
    throw new Error(message);
  }

  return normalizeRecommendEstimateDivisionsResponse(
    body,
    request.projectScope ?? request.projectDescription ?? '',
  );
}
