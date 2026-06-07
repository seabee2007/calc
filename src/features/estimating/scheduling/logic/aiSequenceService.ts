/**
 * Hybrid AI logic sequencing — TypeScript owns graph math; AI owns semantics only.
 *
 * 1. buildDeterministicLogicSequence → rule-based first-pass links (TypeScript)
 * 2. fetchAiSequenceSuggestions → AI classifies titles, flags compound cards, fills gaps
 * 3. validateAiSequenceSuggestions → cycle/duplicate checks (TypeScript)
 * 4. CPM + RCS run separately in LogicNetworkWorkspace (TypeScript)
 *
 * AI must NOT calculate dates, float, critical path, or resource leveling.
 */

import { supabase } from '../../../../lib/supabase';
import type { CpmLogicLink } from '../cpmTypes';
import { wouldCreateCircularDependency } from './logicCycleUtils';
import type { AiLogicReviewInput, AiLogicSuggestion } from './logicTypes';
import {
  buildDeterministicLogicSequence,
  type DeterministicSuggestion,
  type LogicActivity,
} from './deterministicSequenceBuilder';

export const AI_SEQUENCE_ERROR_MESSAGE = 'Could not run AI logic sequencing';

export class AiSequenceFailedError extends Error {
  constructor(message = AI_SEQUENCE_ERROR_MESSAGE) {
    super(message);
    this.name = 'AiSequenceFailedError';
  }
}

export interface AiLogicSequenceInput extends AiLogicReviewInput {
  projectType?: string;
  projectLocation?: string;
  availableCrewSize?: number;
  templateContext: true;
}

export interface AiCompoundCardAlert {
  activityCode: string;
  issue: string;
}

export type AiSequenceRejectionReason =
  | 'self-link'
  | 'circular'
  | 'missing-activity'
  | 'duplicate'
  | 'invalid-type'
  | 'negative-lag';

export interface AiSequenceRejectedSuggestion {
  suggestion: DeterministicSuggestion;
  reason: AiSequenceRejectionReason;
  detail: string;
}

export interface AiSequenceMissingActivity {
  activityName: string;
  phase: string;
  reason: string;
  suggestedInsertionPoint: string;
}

export interface AiSequenceValidationResult {
  valid: DeterministicSuggestion[];
  rejected: AiSequenceRejectedSuggestion[];
  missingActivities: AiSequenceMissingActivity[];
  compoundCardAlerts: AiCompoundCardAlert[];
  concreteCureLagCount: number;
  deterministicCount: number;
  aiAddedCount: number;
  matchedActivityCount: number;
  unmatchedActivityCount: number;
  unmatchedActivities: { activityCode: string; title: string; reason: string }[];
  deterministicWarnings: string[];
  isForcedChainWarning: boolean;
  longestChainLength: number;
}

const VALID_RELATIONSHIP_TYPES = new Set(['FS', 'SS', 'FF', 'SF']);

export function validateAiSequenceSuggestions(
  suggestions: DeterministicSuggestion[],
  activityCodes: Set<string>,
  existingLinks: CpmLogicLink[],
): Pick<AiSequenceValidationResult, 'valid' | 'rejected'> {
  const valid: DeterministicSuggestion[] = [];
  const rejected: AiSequenceRejectedSuggestion[] = [];
  const seen = new Set<string>();
  // Grows as each suggestion is accepted — later checks include already-approved links
  // in the same batch, preventing chained AI suggestions from forming a cycle.
  const workingLinks = [...existingLinks];

  for (const suggestion of suggestions) {
    const { predecessorActivityCode, successorActivityCode, relationshipType, lagDays } = suggestion;

    if (predecessorActivityCode === successorActivityCode) {
      rejected.push({ suggestion, reason: 'self-link', detail: `Activity ${predecessorActivityCode} cannot be its own predecessor.` });
      continue;
    }
    if (!activityCodes.has(predecessorActivityCode)) {
      rejected.push({ suggestion, reason: 'missing-activity', detail: `Predecessor "${predecessorActivityCode}" not found.` });
      continue;
    }
    if (!activityCodes.has(successorActivityCode)) {
      rejected.push({ suggestion, reason: 'missing-activity', detail: `Successor "${successorActivityCode}" not found.` });
      continue;
    }
    if (!VALID_RELATIONSHIP_TYPES.has(relationshipType)) {
      rejected.push({ suggestion, reason: 'invalid-type', detail: `Relationship type "${relationshipType}" is invalid.` });
      continue;
    }
    if (typeof lagDays === 'number' && lagDays < 0) {
      rejected.push({ suggestion, reason: 'negative-lag', detail: `Lag days (${lagDays}) cannot be negative.` });
      continue;
    }

    const dupKey = `${predecessorActivityCode}→${successorActivityCode}`;
    const existingDuplicate = workingLinks.some(
      (l) =>
        l.predecessorActivityCode === predecessorActivityCode &&
        l.successorActivityCode === successorActivityCode,
    );
    if (existingDuplicate || seen.has(dupKey)) {
      rejected.push({ suggestion, reason: 'duplicate', detail: `Link ${predecessorActivityCode} → ${successorActivityCode} already exists.` });
      continue;
    }

    if (
      wouldCreateCircularDependency(workingLinks, [
        { predecessorActivityCode, successorActivityCode, relationshipType, lagDays: lagDays ?? 0, reason: suggestion.reason },
      ])
    ) {
      rejected.push({ suggestion, reason: 'circular', detail: `Adding ${predecessorActivityCode} → ${successorActivityCode} would create a circular dependency.` });
      continue;
    }

    seen.add(dupKey);
    valid.push(suggestion);
    // Extend the working set so subsequent suggestions are validated against the
    // growing approved graph, not just the original pre-existing links.
    workingLinks.push({ predecessorActivityCode, successorActivityCode, relationshipType, lagDays: lagDays ?? 0 });
  }

  return { valid, rejected };
}

export function filterSuggestionsByConfidence(
  suggestions: DeterministicSuggestion[],
  threshold: 'all-valid' | 'high-only',
): DeterministicSuggestion[] {
  if (threshold === 'high-only') {
    return suggestions.filter((s) => s.source === 'deterministic' || s.confidence === 'high');
  }
  return suggestions.filter(
    (s) => s.source === 'deterministic' || s.confidence === 'medium' || s.confidence === 'high',
  );
}

function normalizeAiSuggestion(raw: unknown, index: number): DeterministicSuggestion | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;

  const predecessorActivityCode =
    typeof src.predecessorActivityCode === 'string' ? src.predecessorActivityCode.trim() : '';
  const successorActivityCode =
    typeof src.successorActivityCode === 'string' ? src.successorActivityCode.trim() : '';
  if (!predecessorActivityCode || !successorActivityCode) return null;

  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (typeof src.confidence === 'string' && ['low', 'medium', 'high'].includes(src.confidence)) {
    confidence = src.confidence as 'low' | 'medium' | 'high';
  } else if (typeof src.confidence === 'number' && Number.isFinite(src.confidence)) {
    confidence = src.confidence >= 0.75 ? 'high' : src.confidence >= 0.5 ? 'medium' : 'low';
  }
  if (confidence === 'low') return null;

  const relationshipType =
    src.relationshipType === 'SS' || src.relationshipType === 'FF' || src.relationshipType === 'SF'
      ? (src.relationshipType as 'SS' | 'FF' | 'SF')
      : 'FS';

  const lagDays =
    typeof src.lagDays === 'number' && Number.isFinite(src.lagDays) ? Math.max(0, src.lagDays) : 0;

  const reason = typeof src.reason === 'string' ? src.reason.trim() : '';
  const issue =
    typeof src.issue === 'string' && src.issue.trim()
      ? src.issue.trim()
      : `AI-suggested: ${predecessorActivityCode} before ${successorActivityCode}`;

  return {
    id: `ai-${predecessorActivityCode}-${successorActivityCode}-${index}`,
    confidence,
    issue,
    predecessorActivityCode,
    successorActivityCode,
    relationshipType,
    lagDays,
    reason,
    source: 'ai-added',
  };
}

async function fetchAiSequenceSuggestions(
  input: AiLogicSequenceInput,
  deterministicLinks: DeterministicSuggestion[],
): Promise<{ suggestions: DeterministicSuggestion[]; compoundCardAlerts: AiCompoundCardAlert[] }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new AiSequenceFailedError('You must be signed in to use AI logic sequencing.');

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!baseUrl) throw new AiSequenceFailedError('Supabase URL is not configured.');

  const response = await fetch(`${baseUrl}/functions/v1/ai-logic-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      activities: input.activities,
      logicLinks: input.logicLinks,
      projectType: input.projectType,
      projectLocation: input.projectLocation,
      templateContext: true,
      availableCrewSize: input.availableCrewSize,
      draftSequenceContext: deterministicLinks.map((l) => ({
        predecessorActivityCode: l.predecessorActivityCode,
        successorActivityCode: l.successorActivityCode,
        relationshipType: l.relationshipType,
        lagDays: l.lagDays,
        reason: l.reason,
      })),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as
    | { suggestions?: unknown[]; suggestedGapsFilled?: unknown[]; compoundCardAlerts?: unknown[] }
    | { error?: string };

  if (!response.ok) {
    const errorMessage =
      typeof payload === 'object' && payload && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Edge function failed with status ${response.status}`;
    throw new AiSequenceFailedError(errorMessage);
  }

  const rawGapLinks = Array.isArray((payload as { suggestedGapsFilled?: unknown[] }).suggestedGapsFilled)
    ? (payload as { suggestedGapsFilled: unknown[] }).suggestedGapsFilled
    : Array.isArray((payload as { suggestions?: unknown[] }).suggestions)
      ? (payload as { suggestions: unknown[] }).suggestions
      : [];

  const suggestions = rawGapLinks
    .map((raw, index) => normalizeAiSuggestion(raw, index))
    .filter((s): s is DeterministicSuggestion => s !== null);

  const compoundCardAlerts = normalizeCompoundCardAlerts(
    (payload as { compoundCardAlerts?: unknown[] }).compoundCardAlerts,
  );

  return { suggestions, compoundCardAlerts };
}

function normalizeCompoundCardAlerts(raw: unknown[] | undefined): AiCompoundCardAlert[] {
  if (!Array.isArray(raw)) return [];
  const alerts: AiCompoundCardAlert[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const src = item as Record<string, unknown>;
    const activityCode = typeof src.activityCode === 'string' ? src.activityCode.trim() : '';
    const issue = typeof src.issue === 'string' ? src.issue.trim() : '';
    if (!activityCode || !issue) continue;
    alerts.push({ activityCode, issue });
  }
  return alerts;
}

function deduplicateSuggestions(suggestions: DeterministicSuggestion[]): DeterministicSuggestion[] {
  const seen = new Map<string, DeterministicSuggestion>();
  for (const suggestion of suggestions) {
    const key = `${suggestion.predecessorActivityCode}→${suggestion.successorActivityCode}`;
    const existing = seen.get(key);
    if (!existing || existing.source === 'ai-added') seen.set(key, suggestion);
  }
  return [...seen.values()];
}

export async function runAiLogicSequence(
  input: AiLogicSequenceInput,
): Promise<AiSequenceValidationResult> {
  const logicActivities: LogicActivity[] = input.activities.map((a) => ({
    activityCode: a.activityCode,
    title: a.title,
    divisionCode: a.divisionCode,
    divisionName: a.divisionName,
    workPackageName: a.workPackageName,
  }));

  const deterministicResult = buildDeterministicLogicSequence({
    activities: logicActivities,
    existingLinks: input.logicLinks,
    projectType: input.projectType,
    projectLocation: input.projectLocation,
  });

  let aiSuggestions: DeterministicSuggestion[] = [];
  let compoundCardAlerts: AiCompoundCardAlert[] = [];
  try {
    const aiResult = await fetchAiSequenceSuggestions(input, deterministicResult.suggestedLinks);
    aiSuggestions = aiResult.suggestions;
    compoundCardAlerts = aiResult.compoundCardAlerts;
  } catch (error) {
    console.warn('[AI Sequence] AI step failed, using deterministic only:', error);
  }

  const merged = deduplicateSuggestions([...deterministicResult.suggestedLinks, ...aiSuggestions]);

  const activityCodes = new Set(input.activities.map((a) => a.activityCode));
  const { valid, rejected } = validateAiSequenceSuggestions(merged, activityCodes, input.logicLinks);

  // Count unique activities covered by validated links (more accurate than the
  // deterministic match list, which may include links that were later rejected).
  const coveredActivityCodes = new Set<string>();
  for (const s of valid) {
    coveredActivityCodes.add(s.predecessorActivityCode);
    coveredActivityCodes.add(s.successorActivityCode);
  }

  return {
    valid,
    rejected,
    missingActivities: [],
    compoundCardAlerts,
    // Cure-lag count: lags of 7+ days represent concrete cure windows
    concreteCureLagCount: valid.filter((s) => (s.lagDays ?? 0) >= 7).length,
    deterministicCount: valid.filter((s) => s.source === 'deterministic').length,
    aiAddedCount: valid.filter((s) => s.source === 'ai-added').length,
    matchedActivityCount: coveredActivityCodes.size,
    unmatchedActivityCount: input.activities.length - coveredActivityCodes.size,
    unmatchedActivities: deterministicResult.unmatchedActivities,
    deterministicWarnings: deterministicResult.warnings,
    isForcedChainWarning: deterministicResult.isForcedChainWarning,
    longestChainLength: deterministicResult.longestChainLength,
  };
}

// Re-export the DeterministicSuggestion type for consumers
export type { DeterministicSuggestion, AiLogicSuggestion };
