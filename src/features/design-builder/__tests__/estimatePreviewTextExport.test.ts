import { describe, expect, it } from 'vitest';
import type { DesignEstimatePreviewLine } from '../types';
import {
  buildEstimatePreviewText,
  estimatePreviewTextFilename,
} from '../ui/estimatePreviewTextExport';

function previewLine(): DesignEstimatePreviewLine {
  return {
    id: 'raked-concrete-cap',
    designModelId: 'model-1',
    designObjectId: 'gable-1',
    quantityType: 'raked_concrete_cap_volume',
    description: 'Raked Concrete Cap -- Concrete Volume',
    quantity: 3.18,
    unit: 'CY',
    formula: 'sum(resolved_raked_cap_segment_volumes)',
    parameterSnapshot: {
      rakedCapVolumeCubicMeters: 2.43,
      gableEndSegmentIds: ['segment-1', 'segment-2'],
    },
    source: 'parametric_design_builder',
    confidence: 'calculated_from_parameters',
    divisionCode: '03',
    divisionName: 'Concrete',
  };
}

describe('estimatePreviewTextExport', () => {
  it('builds a readable text export with preview line details', () => {
    const text = buildEstimatePreviewText({
      lines: [previewLine()],
      generatedAt: new Date('2026-06-30T12:34:56.000Z'),
    });

    expect(text).toContain('Design Builder Estimate Preview');
    expect(text).toContain('Generated: 2026-06-30T12:34:56.000Z');
    expect(text).toContain('Rows: 1');
    expect(text).toContain('1. Raked Concrete Cap -- Concrete Volume');
    expect(text).toContain('Quantity: 3.18 CY');
    expect(text).toContain('Division: 03 Concrete');
    expect(text).toContain('Source object: Raked Concrete Caps');
    expect(text).toContain('Formula: sum(resolved_raked_cap_segment_volumes)');
    expect(text).toContain('"rakedCapVolumeCubicMeters": 2.43');
  });

  it('creates a txt filename from the export timestamp', () => {
    expect(estimatePreviewTextFilename(new Date('2026-06-30T12:34:56.789Z'))).toBe(
      'design-builder-estimate-preview-2026-06-30_12-34-56-789Z.txt',
    );
  });
});
