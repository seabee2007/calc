import { describe, expect, it } from 'vitest';
import {
  formatEstimateMethodLabel,
  formatEstimateMethodSummary,
  isProposalGenerationRecommended,
  isSchedulePreviewRecommended,
  safeEstimateMethodLabel,
  safeEstimateMethodNote,
  shouldShowRoughSchedulePreviewNote,
} from '../ui/estimateMethodDisplay';

describe('estimateMethodDisplay', () => {
  it('formats method labels correctly', () => {
    expect(formatEstimateMethodLabel('quick_feasibility')).toBe('Quick Feasibility');
    expect(formatEstimateMethodLabel('budget')).toBe('Budget Estimate');
    expect(formatEstimateMethodLabel('detailed')).toBe('Detailed Estimate');
    expect(formatEstimateMethodLabel('bid')).toBe('Bid Estimate');
  });

  it('reports schedule recommendation logic correctly', () => {
    expect(isSchedulePreviewRecommended('quick_feasibility')).toBe(false);
    expect(isSchedulePreviewRecommended('budget')).toBe(false);
    expect(isSchedulePreviewRecommended('detailed')).toBe(true);
    expect(isSchedulePreviewRecommended('bid')).toBe(true);

    expect(shouldShowRoughSchedulePreviewNote('quick_feasibility')).toBe(true);
    expect(shouldShowRoughSchedulePreviewNote('budget')).toBe(true);
    expect(shouldShowRoughSchedulePreviewNote('detailed')).toBe(false);
    expect(shouldShowRoughSchedulePreviewNote('bid')).toBe(false);
  });

  it('reports proposal readiness logic correctly', () => {
    expect(isProposalGenerationRecommended('quick_feasibility')).toBe(false);
    expect(isProposalGenerationRecommended('budget')).toBe(false);
    expect(isProposalGenerationRecommended('detailed')).toBe(false);
    expect(isProposalGenerationRecommended('bid')).toBe(true);
  });

  it('falls back safely for unknown methods', () => {
    expect(safeEstimateMethodLabel('not_a_method')).toBe('Detailed Estimate');
    expect(safeEstimateMethodNote('not_a_method')).toBe(
      'Activity-based estimating with schedule support.',
    );
    expect(formatEstimateMethodLabel(null)).toBe('Detailed Estimate');
    expect(formatEstimateMethodSummary(undefined)).toContain('Detailed Estimate');
  });
});
