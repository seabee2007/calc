import { describe, expect, it } from 'vitest';
import { resolveDesignBuilderImportRule } from '../application/designBuilderImportRules';
import type { DesignEstimatePreviewLine } from '../types';

function line(overrides: Partial<DesignEstimatePreviewLine> = {}): DesignEstimatePreviewLine {
  return {
    id: overrides.quantityType ?? 'quantity-1',
    designModelId: 'model-1',
    designObjectId: 'object-1',
    quantityType: 'rc_structural_concrete_volume',
    description: 'Total structural concrete',
    quantity: 10,
    unit: 'M3',
    formula: 'sum(component_concrete)',
    parameterSnapshot: {},
    source: 'parametric_design_builder',
    confidence: 'calculated_from_parameters',
    divisionCode: '03',
    divisionName: 'Concrete',
    ...overrides,
  };
}

describe('designBuilderImportRules', () => {
  it('excludes structural concrete summary rows when component concrete rows are present', () => {
    const summary = line();
    const component = line({
      id: 'isolated-footings',
      quantityType: 'isolated_footings_volume',
      description: 'Isolated footing concrete',
      quantity: 4,
    });

    const result = resolveDesignBuilderImportRule(summary, [summary, component]);

    expect(result.policy).toBe('exclude');
    expect(result.reason).toContain('double count');
  });

  it('requires review when structural concrete summary is the only concrete quantity', () => {
    const summary = line();

    const result = resolveDesignBuilderImportRule(summary, [summary]);

    expect(result.policy).toBe('review_required');
    expect(result.reason).toContain('Summary rollup');
  });

  it('excludes zero-quantity rows', () => {
    const result = resolveDesignBuilderImportRule(
      line({
        quantityType: 'rc_isolated_footing_concrete_volume',
        quantity: 0,
      }),
      [],
    );

    expect(result.policy).toBe('exclude');
    expect(result.reason).toContain('Zero quantity');
  });

  it('excludes known placeholder rows', () => {
    const result = resolveDesignBuilderImportRule(
      line({
        quantityType: 'raked_concrete_cap_reinforcement_placeholder',
        description: 'Raked cap reinforcement placeholder',
        quantity: 1,
      }),
      [],
    );

    expect(result.policy).toBe('exclude');
    expect(result.reason?.toLowerCase()).toContain('placeholder');
  });
});
