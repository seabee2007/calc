import { describe, expect, it } from 'vitest';
import {
  formatEstimateMethodLabel,
  isSchedulePreviewRecommended,
  shouldShowRoughSchedulePreviewNote,
} from '../ui/estimateMethodDisplay';

describe('estimateMethodDisplay', () => {
  it('formats canonical and legacy estimate type labels', () => {
    expect(formatEstimateMethodLabel('quick')).toBe('Quick Estimate');
    expect(formatEstimateMethodLabel('quick_feasibility')).toBe('Quick Estimate');
    expect(formatEstimateMethodLabel('conceptual')).toBe('Conceptual Estimate');
    expect(formatEstimateMethodLabel('budget')).toBe('Conceptual Estimate');
    expect(formatEstimateMethodLabel('detailed')).toBe('Detailed Estimate');
    expect(formatEstimateMethodLabel('bid')).toBe('Bid Estimate');
  });

  it('marks schedule recommendations correctly', () => {
    expect(isSchedulePreviewRecommended('quick')).toBe(false);
    expect(isSchedulePreviewRecommended('conceptual')).toBe(false);
    expect(isSchedulePreviewRecommended('detailed')).toBe(true);
    expect(isSchedulePreviewRecommended('bid')).toBe(true);

    expect(shouldShowRoughSchedulePreviewNote('quick')).toBe(true);
    expect(shouldShowRoughSchedulePreviewNote('conceptual')).toBe(true);
    expect(shouldShowRoughSchedulePreviewNote('detailed')).toBe(false);
  });
});
