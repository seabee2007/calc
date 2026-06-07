import { supabase } from '../../../../lib/supabase';
import type { CpmLogicLink } from '../cpmTypes';
import {
  appendSuggestedLogicLinks,
  wouldCreateCircularDependency,
} from './logicReviewUtils';
import type {
  AiLogicReviewInput,
  AiLogicReviewResult,
  AiLogicSuggestion,
  LogicReviewWarning,
} from './logicTypes';
import { buildWarningId } from './logicReviewUtils';

export const AI_LOGIC_REVIEW_ERROR_MESSAGE = 'Could not run AI logic review';

export class AiLogicReviewFailedError extends Error {
  constructor(message = AI_LOGIC_REVIEW_ERROR_MESSAGE) {
    super(message);
    this.name = 'AiLogicReviewFailedError';
  }
}

const CONFIDENCE_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function buildAiSuggestionId(suggestion: AiLogicSuggestion): string {
  return buildWarningId({
    category: 'missingLikelyPredecessor',
    activityCode: suggestion.successorActivityCode,
    predecessorActivityCode: suggestion.predecessorActivityCode,
    ruleId: `ai-${suggestion.id}`,
  });
}

export function validateAiLogicSuggestion(
  suggestion: AiLogicSuggestion,
  input: AiLogicReviewInput,
): boolean {
  const activityCodes = new Set(input.activities.map((activity) => activity.activityCode));
  if (!activityCodes.has(suggestion.predecessorActivityCode)) return false;
  if (!activityCodes.has(suggestion.successorActivityCode)) return false;
  if (suggestion.predecessorActivityCode === suggestion.successorActivityCode) return false;
  if (!['FS', 'SS', 'FF', 'SF'].includes(suggestion.relationshipType)) return false;
  if (!Number.isFinite(suggestion.lagDays)) return false;
  if (!['low', 'medium', 'high'].includes(suggestion.confidence)) return false;

  const duplicate = input.logicLinks.some(
    (link) =>
      link.predecessorActivityCode === suggestion.predecessorActivityCode &&
      link.successorActivityCode === suggestion.successorActivityCode,
  );
  if (duplicate) return false;

  if (
    wouldCreateCircularDependency(input.logicLinks, [
      {
        predecessorActivityCode: suggestion.predecessorActivityCode,
        successorActivityCode: suggestion.successorActivityCode,
        relationshipType: suggestion.relationshipType,
        lagDays: suggestion.lagDays,
        reason: suggestion.reason,
      },
    ])
  ) {
    return false;
  }

  return true;
}

export function sanitizeAiLogicReviewResult(
  raw: AiLogicReviewResult,
  input: AiLogicReviewInput,
  maxSuggestions = 20,
): AiLogicSuggestion[] {
  const valid = (raw.suggestions ?? [])
    .filter((suggestion) => validateAiLogicSuggestion(suggestion, input))
    .filter((suggestion) => suggestion.confidence === 'high')
    .sort((left, right) => CONFIDENCE_ORDER[left.confidence] - CONFIDENCE_ORDER[right.confidence]);

  return valid.slice(0, maxSuggestions);
}

export function aiSuggestionsToWarnings(suggestions: AiLogicSuggestion[]): LogicReviewWarning[] {
  return suggestions.map((suggestion) => ({
    id: buildAiSuggestionId(suggestion),
    severity:
      suggestion.confidence === 'high'
        ? 'warning'
        : suggestion.confidence === 'medium'
          ? 'warning'
          : 'info',
    category: 'missingLikelyPredecessor',
    activityCode: suggestion.successorActivityCode,
    activityTitle: suggestion.successorActivityCode,
    issue: suggestion.issue,
    reason: suggestion.reason,
    suggestedLinks: [
      {
        predecessorActivityCode: suggestion.predecessorActivityCode,
        successorActivityCode: suggestion.successorActivityCode,
        relationshipType: suggestion.relationshipType,
        lagDays: suggestion.lagDays,
        reason: suggestion.reason,
      },
    ],
    canAutoFix: true,
    source: 'ai' as const,
    aiConfidence: suggestion.confidence,
  }));
}

export async function requestAiLogicReview(input: AiLogicReviewInput): Promise<AiLogicSuggestion[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new AiLogicReviewFailedError('You must be signed in to use AI logic review.');
  }

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!baseUrl) {
    throw new AiLogicReviewFailedError('Supabase URL is not configured.');
  }

  console.log(
    `[AI Logic Review] Sending ${input.activities.length} activities and ${input.logicLinks.length} existing links`,
  );

  const response = await fetch(`${baseUrl}/functions/v1/ai-logic-review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => ({}))) as
    | AiLogicReviewResult
    | { error?: string };

  if (!response.ok) {
    const errorMessage =
      typeof payload === 'object' && payload && 'error' in payload && payload.error
        ? payload.error
        : AI_LOGIC_REVIEW_ERROR_MESSAGE;
    console.error('[AI Logic Review] Edge function error:', errorMessage, 'status:', response.status);
    throw new AiLogicReviewFailedError(errorMessage);
  }

  const rawSuggestions = (payload as AiLogicReviewResult).suggestions ?? [];
  console.log(`[AI Logic Review] Raw suggestions from AI: ${rawSuggestions.length}`);

  const valid = sanitizeAiLogicReviewResult(payload as AiLogicReviewResult, input);

  const rejectedCount = rawSuggestions.length - valid.length;
  if (rejectedCount > 0) {
    console.log(
      `[AI Logic Review] ${rejectedCount} suggestion(s) rejected (duplicate, invalid code, or circular dependency). Valid: ${valid.length}`,
    );
  } else {
    console.log(`[AI Logic Review] Valid suggestions after guardrails: ${valid.length}`);
  }

  return valid;
}

export function applyAiSuggestionsToLogicLinks(
  existingLinks: CpmLogicLink[],
  suggestions: AiLogicSuggestion[],
): CpmLogicLink[] {
  return appendSuggestedLogicLinks(
    existingLinks,
    suggestions.map((suggestion) => ({
      predecessorActivityCode: suggestion.predecessorActivityCode,
      successorActivityCode: suggestion.successorActivityCode,
      relationshipType: suggestion.relationshipType,
      lagDays: suggestion.lagDays,
      reason: suggestion.reason,
    })),
  );
}
