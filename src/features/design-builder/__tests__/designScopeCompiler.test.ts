import { describe, expect, it } from 'vitest';
import type { DesignEstimatePreviewLine } from '../types';
import { classifyDesignQuantityForScope } from '../application/designBuilderImportRules';
import { buildDesignScopePackages } from '../application/designScopeCompiler';

function line(overrides: Partial<DesignEstimatePreviewLine> = {}): DesignEstimatePreviewLine {
  return {
    id: overrides.id ?? overrides.quantityType ?? 'quantity-1',
    designModelId: 'model-1',
    designObjectId: 'object-1',
    quantityType: 'cmu_wall_net_area',
    description: 'CMU wall net area',
    quantity: 100,
    unit: 'SF',
    formula: 'formula',
    parameterSnapshot: {},
    source: 'parametric_design_builder',
    confidence: 'calculated_from_parameters',
    divisionCode: '04',
    divisionName: 'Masonry',
    ...overrides,
  };
}

describe('design scope compiler', () => {
  it('classifies known concrete rollups without double-counting component concrete', () => {
    const rollup = line({
      quantityType: 'rc_structural_concrete_volume',
      description: 'Structural concrete total',
      quantity: 10,
      unit: 'CY',
      divisionCode: '03',
      divisionName: 'Concrete',
    });
    const component = line({
      quantityType: 'rc_columns_volume',
      description: 'RC columns',
      quantity: 3,
      unit: 'CY',
      divisionCode: '03',
      divisionName: 'Concrete',
    });

    expect(classifyDesignQuantityForScope(rollup, [rollup, component])).toMatchObject({
      destination: 'rollup',
      role: 'rollup',
      includeByDefault: false,
      locked: true,
    });
    expect(classifyDesignQuantityForScope(rollup, [rollup])).toMatchObject({
      destination: 'quality_check',
      locked: false,
    });
  });

  it('routes masonry labor, materials, references, and grout rollups into packages', () => {
    const lines = [
      line({ quantityType: 'cmu_wall_net_area', description: 'CMU wall net area', unit: 'SF' }),
      line({ quantityType: 'cmu_block_count', description: 'CMU blocks', quantity: 770, unit: 'EA' }),
      line({ quantityType: 'mortar_allowance', description: 'Mortar allowance', quantity: 21, unit: 'BAG' }),
      line({ quantityType: 'cmu_core_fill_grout', description: 'Core fill grout', quantity: 31.5, unit: 'CY' }),
      line({ quantityType: 'opening_rough_area', description: 'Opening rough area', quantity: 34, unit: 'SF' }),
      line({ quantityType: 'cmu_total_grout', description: 'Total grout', quantity: 36, unit: 'CY' }),
    ];

    expect(classifyDesignQuantityForScope(lines[0], lines).destination).toBe('activity_line_item');
    expect(classifyDesignQuantityForScope(lines[1], lines).destination).toBe('material_resource');
    expect(classifyDesignQuantityForScope(lines[2], lines).destination).toBe('material_resource');
    expect(classifyDesignQuantityForScope(lines[3], lines).destination).toBe('material_resource');
    expect(classifyDesignQuantityForScope(lines[4], lines).destination).toBe('reference_only');
    expect(classifyDesignQuantityForScope(lines[5], lines).destination).toBe('rollup');

    const packages = buildDesignScopePackages({
      previewLines: lines,
      persistedQuantityItems: [],
      productionRates: [],
    });
    expect(packages.find((entry) => entry.key === '04-masonry-cmu-wall-system')).toBeDefined();
    expect(packages.find((entry) => entry.key === '04-masonry-grout-reinforcement-support')).toBeDefined();
  });

  it('uses unit count for openings and keeps area as reference', () => {
    const units = line({
      quantityType: 'door_window_units',
      description: 'Door and window units',
      quantity: 3,
      unit: 'EA',
      divisionCode: '08',
      divisionName: 'Openings',
    });
    const area = line({
      quantityType: 'opening_actual_area',
      description: 'Opening actual area',
      quantity: 33.9,
      unit: 'SF',
      divisionCode: '08',
      divisionName: 'Openings',
    });

    expect(classifyDesignQuantityForScope(units, [units, area]).destination).toBe('activity_line_item');
    expect(classifyDesignQuantityForScope(area, [units, area]).destination).toBe('reference_only');
  });

  it('routes roof and metal takeoffs into labor and material rows', () => {
    const trusses = line({
      quantityType: 'steel_roof_truss_count',
      description: 'Steel roof trusses',
      quantity: 32,
      unit: 'EA',
      divisionCode: '05',
      divisionName: 'Metals',
    });
    const anchors = line({
      quantityType: 'truss_anchor_bolt_count',
      description: 'Anchor bolts',
      quantity: 128,
      unit: 'EA',
      divisionCode: '05',
      divisionName: 'Metals',
    });
    const roofing = line({
      quantityType: 'corrugated_metal_roofing_area',
      description: 'Corrugated metal roofing',
      quantity: 2200,
      unit: 'SF',
      divisionCode: '07',
      divisionName: 'Thermal & Moisture Protection',
    });
    const roofArea = line({
      quantityType: 'roof_area',
      description: 'Roof area',
      quantity: 2200,
      unit: 'SF',
      divisionCode: '07',
      divisionName: 'Thermal & Moisture Protection',
    });

    expect(classifyDesignQuantityForScope(trusses, [trusses]).destination).toBe('activity_line_item');
    expect(classifyDesignQuantityForScope(anchors, [anchors]).destination).toBe('material_resource');
    expect(classifyDesignQuantityForScope(roofing, [roofing, roofArea]).destination).toBe('activity_line_item');
    expect(classifyDesignQuantityForScope(roofArea, [roofing, roofArea]).destination).toBe('reference_only');
  });

  it('keeps exterior and interior plaster packages separate', () => {
    const exterior = line({
      id: 'exterior-plaster',
      quantityType: 'infill_plaster_finish_coat_area',
      description: 'Exterior plaster finish coat',
      quantity: 1000,
      unit: 'SF',
      divisionCode: '09',
      divisionName: 'Finishes',
      parameterSnapshot: { plasterSide: 'exterior' },
    });
    const interior = line({
      id: 'interior-plaster',
      quantityType: 'infill_plaster_finish_coat_area',
      description: 'Interior plaster finish coat',
      quantity: 900,
      unit: 'SF',
      divisionCode: '09',
      divisionName: 'Finishes',
      parameterSnapshot: { plasterSide: 'interior' },
    });

    const packages = buildDesignScopePackages({
      previewLines: [exterior, interior],
      persistedQuantityItems: [],
      productionRates: [],
    });

    expect(packages.map((entry) => entry.key).sort()).toEqual([
      '09-finishes-plaster-exterior-plaster',
      '09-finishes-plaster-interior-plaster',
    ]);
  });

  it('keeps unknown quantity types as reference instead of creating silent activity rows', () => {
    const unknown = line({
      quantityType: 'future_quantity_type',
      description: 'Future quantity',
    });

    expect(classifyDesignQuantityForScope(unknown, [unknown])).toMatchObject({
      destination: 'reference_only',
      packageKind: 'reference',
    });
  });
});
