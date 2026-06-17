import type { ConceptualEstimatePayload } from '../domain/conceptualEstimateTypes';

export const DEFAULT_CONCEPTUAL_BUDGET_NAME = 'Initial Conceptual Budget';

const ESTIMATE_GUIDE_DISMISSED_PREFIX = 'arden:estimate-guide-dismissed:';

export function isConceptualEstimateGuideComplete(payload: ConceptualEstimatePayload): boolean {
  const hasTitle =
    Boolean(payload.revision.name?.trim()) &&
    payload.revision.name.trim() !== DEFAULT_CONCEPTUAL_BUDGET_NAME;

  const hasScope = Boolean(payload.revision.basisOfEstimate?.trim());

  const hasSupportingItem =
    payload.lineItems.length > 0 ||
    payload.assumptions.length > 0 ||
    payload.exclusions.length > 0 ||
    payload.allowanceNotes.length > 0;

  return hasTitle && hasScope && hasSupportingItem;
}

export function getEstimateGuideDismissedKey(estimateId: string): string {
  return `${ESTIMATE_GUIDE_DISMISSED_PREFIX}${estimateId}`;
}

export function hasDismissedEstimateGuide(estimateId: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(getEstimateGuideDismissedKey(estimateId)) === 'true';
  } catch {
    return false;
  }
}

export function markEstimateGuideDismissed(estimateId: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(getEstimateGuideDismissedKey(estimateId), 'true');
  } catch {
    // Ignore storage failures; badge may reappear on next visit.
  }
}

export function shouldShowConceptualEstimateGuideBadge(options: {
  isConceptualEstimate: boolean;
  hasEstimate: boolean;
  estimateId?: string | null;
  payload: ConceptualEstimatePayload | null;
  hasDismissedGuideForEstimate: boolean;
}): boolean {
  if (!options.isConceptualEstimate || !options.hasEstimate || !options.payload) {
    return false;
  }
  if (options.hasDismissedGuideForEstimate) {
    return false;
  }
  return !isConceptualEstimateGuideComplete(options.payload);
}
