import { describe, expect, it } from 'vitest';
import {
  applyMeasurementSystemToPreviewLine,
  areaFromSquareMeters,
  volumeFromCubicMeters,
} from '../quantity/designQuantityUnits';
import type { DesignEstimatePreviewLine } from '../types';

describe('designQuantityUnits', () => {
  it('converts imperial preview units to metric', () => {
    const line: DesignEstimatePreviewLine = {
      id: 'slab-concrete',
      designModelId: 'model',
      designObjectId: 'slab',
      quantityType: 'slab_concrete',
      description: 'Slab',
      quantity: 6.33,
      unit: 'CY',
      formula: 'test',
      parameterSnapshot: {},
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '03',
      divisionName: 'Concrete',
    };

    const converted = applyMeasurementSystemToPreviewLine(line, 'metric');
    expect(converted.unit).toBe('M3');
    expect(converted.quantity).toBeCloseTo(4.84, 1);
  });

  it('formats area and volume from metric source values', () => {
    expect(volumeFromCubicMeters(1, 'metric')).toEqual({ quantity: 1, unit: 'M3' });
    expect(volumeFromCubicMeters(1, 'imperial').unit).toBe('CY');
    expect(areaFromSquareMeters(10, 'metric')).toEqual({ quantity: 10, unit: 'M2' });
    expect(areaFromSquareMeters(10, 'imperial').unit).toBe('SF');
  });
});
