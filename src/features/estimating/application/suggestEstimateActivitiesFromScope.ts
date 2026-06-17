import { supabase } from '../../../lib/supabase';
import { parseEdgeFunctionJson } from '../../../lib/usageMetering';
import { getCsiDivisionByCode, isKnownCsiDivision } from '../domain/csiDivisions';
import { normalizeSelectedDivisionCodes } from './estimateWorkBreakdown';
import type {
  ScopeDivisionSuggestion,
  SuggestDivisionsFromScopeRequest,
  SuggestDivisionsFromScopeResponse,
} from '../domain/aiActivitySuggestionTypes';

export const SUGGEST_DIVISIONS_ERROR_MESSAGE =
  'Could not suggest divisions from scope. You can still add divisions manually.';

const MIN_DIVISION_CONFIDENCE = 0.35;
const DEFAULT_DIVISION_CONFIDENCE = 0.75;

function createSuggestionId(): string {
  return `div_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function toFiniteConfidence(value: unknown, fallback: number): number {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'high') return 0.9;
    if (normalized === 'medium') return 0.7;
    if (normalized === 'low') return 0.45;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(1, Math.max(0, numeric));
}

function toConfidenceLabel(value: number): ScopeDivisionSuggestion['confidence'] {
  if (value >= 0.85) return 'high';
  if (value >= 0.65) return 'medium';
  return 'low';
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

function normalizeDivisionCodeFromRecord(record: Record<string, unknown>): string | null {
  const raw = record.divisionCode ?? record.code;
  if (raw === null || raw === undefined) return null;

  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  const code = digits.padStart(2, '0').slice(-2);
  return isKnownCsiDivision(code) ? code : null;
}

function parseDivisionRecord(
  record: Record<string, unknown>,
  scopeText: string,
): ScopeDivisionSuggestion | null {
  const normalizedCode = normalizeDivisionCodeFromRecord(record);
  if (!normalizedCode) return null;

  const division = getCsiDivisionByCode(normalizedCode);
  const divisionName =
    typeof record.divisionName === 'string' && record.divisionName.trim()
      ? record.divisionName.trim()
      : division?.name ?? normalizedCode;

  const numericConfidence = toFiniteConfidence(record.confidence, DEFAULT_DIVISION_CONFIDENCE);
  if (numericConfidence < MIN_DIVISION_CONFIDENCE) return null;

  const reason =
    typeof record.reason === 'string' && record.reason.trim()
      ? record.reason.trim()
      : `Scope references work covered by Division ${normalizedCode} — ${divisionName}.`;
  const sourceExcerpt =
    typeof record.sourceExcerpt === 'string' && record.sourceExcerpt.trim()
      ? record.sourceExcerpt.trim()
      : scopeText.trim().slice(0, 120) || null;

  return {
    id: createSuggestionId(),
    divisionCode: normalizedCode,
    divisionName,
    confidence: toConfidenceLabel(numericConfidence),
    reason,
    sourceExcerpt,
    suggestedWorkAreas: toStringArray(record.suggestedWorkAreas),
    estimatingNotes: toStringArray(record.estimatingNotes),
    status: 'suggested',
  };
}

export function normalizeSuggestDivisionsResponse(
  raw: unknown,
  scopeText = '',
): SuggestDivisionsFromScopeResponse {
  const parsed = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};

  const rawDivisions = Array.isArray(parsed.divisions) ? parsed.divisions : [];
  const notes = Array.isArray(parsed.notes)
    ? parsed.notes.filter((note): note is string => typeof note === 'string')
    : undefined;
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((warning): warning is string => typeof warning === 'string')
    : undefined;
  const fallbackUsed = parsed.fallbackUsed === true;

  const byCode = new Map<string, { division: ScopeDivisionSuggestion; score: number }>();

  for (const item of rawDivisions) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const normalizedCode = normalizeDivisionCodeFromRecord(record);
    if (!normalizedCode) continue;

    const numericConfidence = toFiniteConfidence(record.confidence, DEFAULT_DIVISION_CONFIDENCE);
    if (numericConfidence < MIN_DIVISION_CONFIDENCE) continue;

    const division = parseDivisionRecord(record, scopeText);
    if (!division) continue;

    const existing = byCode.get(division.divisionCode);
    if (!existing || numericConfidence > existing.score) {
      byCode.set(division.divisionCode, { division, score: numericConfidence });
    }
  }

  return {
    divisions: [...byCode.values()]
      .map((entry) => entry.division)
      .sort((a, b) => a.divisionCode.localeCompare(b.divisionCode)),
    notes: notes && notes.length > 0 ? notes : undefined,
    warnings: warnings && warnings.length > 0 ? warnings : undefined,
    fallbackUsed: fallbackUsed || undefined,
  };
}

export async function suggestDivisionsFromScope(
  request: SuggestDivisionsFromScopeRequest,
): Promise<SuggestDivisionsFromScopeResponse> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) {
    throw new Error(SUGGEST_DIVISIONS_ERROR_MESSAGE);
  }

  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) {
    throw new Error(SUGGEST_DIVISIONS_ERROR_MESSAGE);
  }

  if (import.meta.env.DEV) {
    console.debug(
      '[suggestDivisionsFromScope] scopeText length:',
      request.scopeText?.trim().length ?? 0,
    );
  }

  const payload = {
    scopeText: request.scopeText,
    projectName: request.projectName,
    estimateType: request.estimateType,
    projectId: request.projectId,
    acceptedDivisions: request.acceptedDivisions,
    filterMode: request.filterMode,
    location: request.location,
  };

  const res = await fetch(`${base}/functions/v1/suggest-divisions-from-scope`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await parseEdgeFunctionJson<Record<string, unknown>>(res);

  return normalizeSuggestDivisionsResponse(body, request.scopeText);
}

/** @deprecated Use suggestDivisionsFromScope */
export const suggestEstimateActivitiesFromScope = suggestDivisionsFromScope;
/** @deprecated Use normalizeSuggestDivisionsResponse */
export const normalizeSuggestActivitiesResponse = normalizeSuggestDivisionsResponse;
/** @deprecated Use SUGGEST_DIVISIONS_ERROR_MESSAGE */
export const SUGGEST_ACTIVITIES_ERROR_MESSAGE = SUGGEST_DIVISIONS_ERROR_MESSAGE;
