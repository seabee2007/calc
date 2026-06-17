import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyConceptualEstimatePayload } from '../domain/conceptualEstimateTypes';
import {
  DEFAULT_CONCEPTUAL_BUDGET_NAME,
  getEstimateGuideDismissedKey,
  hasDismissedEstimateGuide,
  isConceptualEstimateGuideComplete,
  markEstimateGuideDismissed,
  shouldShowConceptualEstimateGuideBadge,
} from '../ui/conceptualEstimateGuide';

describe('conceptualEstimateGuide', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('treats the default title and empty scope as incomplete', () => {
    const payload = createEmptyConceptualEstimatePayload();
    expect(isConceptualEstimateGuideComplete(payload)).toBe(false);
  });

  it('requires a custom title, scope, and supporting item to be complete', () => {
    const payload = createEmptyConceptualEstimatePayload();
    payload.revision.name = 'Office TI Budget';
    payload.revision.basisOfEstimate = 'Core and shell with tenant improvements.';
    payload.assumptions.push({
      id: 'a1',
      title: 'Fixtures allowance',
      description: 'Includes one allowance for fixtures.',
      impact: 'cost',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(isConceptualEstimateGuideComplete(payload)).toBe(true);
  });

  it('does not treat the default title as complete even with scope and items', () => {
    const payload = createEmptyConceptualEstimatePayload();
    payload.revision.name = DEFAULT_CONCEPTUAL_BUDGET_NAME;
    payload.revision.basisOfEstimate = 'Defined scope';
    payload.lineItems.push({
      id: 'li1',
      type: 'lump_sum',
      title: 'Shell',
      amount: 1000,
      confidenceLevel: 'medium',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(isConceptualEstimateGuideComplete(payload)).toBe(false);
  });

  it('stores dismissal per estimate id', () => {
    expect(getEstimateGuideDismissedKey('est-1')).toBe('arden:estimate-guide-dismissed:est-1');
    expect(hasDismissedEstimateGuide('est-1')).toBe(false);
    markEstimateGuideDismissed('est-1');
    expect(hasDismissedEstimateGuide('est-1')).toBe(true);
    expect(hasDismissedEstimateGuide('est-2')).toBe(false);
  });

  it('shows the guided help badge only for incomplete conceptual estimates', () => {
    const payload = createEmptyConceptualEstimatePayload();

    expect(
      shouldShowConceptualEstimateGuideBadge({
        isConceptualEstimate: true,
        hasEstimate: true,
        estimateId: 'est-1',
        payload,
        hasDismissedGuideForEstimate: false,
      }),
    ).toBe(true);

    payload.revision.name = 'Custom Budget';
    payload.revision.basisOfEstimate = 'Defined scope';
    payload.exclusions.push({
      id: 'e1',
      title: 'Furniture',
      description: 'Owner-supplied furniture',
      reason: 'Out of scope',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(
      shouldShowConceptualEstimateGuideBadge({
        isConceptualEstimate: true,
        hasEstimate: true,
        estimateId: 'est-1',
        payload,
        hasDismissedGuideForEstimate: false,
      }),
    ).toBe(false);

    expect(
      shouldShowConceptualEstimateGuideBadge({
        isConceptualEstimate: true,
        hasEstimate: true,
        estimateId: 'est-1',
        payload: createEmptyConceptualEstimatePayload(),
        hasDismissedGuideForEstimate: true,
      }),
    ).toBe(false);
  });
});
