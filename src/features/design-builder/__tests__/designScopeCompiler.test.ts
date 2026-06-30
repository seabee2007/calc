import { describe, expect, it } from 'vitest';
import type { DesignEstimatePreviewLine } from '../types';
import type { ProductionRateLibraryEntry } from '../../estimating/data/productionRates/productionRateTypes';
import { classifyDesignQuantityForScope } from '../application/designBuilderImportRules';
import {
  buildDesignScopeCompileResult,
  buildDesignScopePackages,
} from '../application/designScopeCompiler';

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

function productionRate(overrides: Partial<ProductionRateLibraryEntry> = {}): ProductionRateLibraryEntry {
  return {
    id: overrides.id ?? 'rate-1',
    divisionCode: overrides.divisionCode ?? '03',
    divisionName: overrides.divisionName ?? 'Concrete',
    figure: '03-11-13',
    figureTitle: 'Concrete formwork',
    sourcePage: '5-C-7',
    sourcePdfPage: 64,
    workElementNumber: '0010',
    workElementLineNumber: '0010',
    category: overrides.category ?? 'Concrete Formwork',
    subcategory: overrides.subcategory ?? 'Slab on grade forms',
    activityName: overrides.activityName ?? 'Slab on grade, edge forms, wood, 7 to 12 inches high, one use',
    description: overrides.description ?? 'Slab on grade, edge forms, wood, 7 to 12 inches high, one use',
    unitOfMeasure: overrides.unitOfMeasure ?? 'LF',
    manHoursPerUnit: overrides.manHoursPerUnit ?? 0.071,
    sourceDocumentFull: 'RSMeans Facilities Construction Cost Data' as ProductionRateLibraryEntry['sourceDocumentFull'],
    sourceEdition: '2026' as ProductionRateLibraryEntry['sourceEdition'],
    referenceNote: 'Figure 5-C-7',
    keywords: overrides.keywords ?? ['concrete', 'formwork', 'slab-on-grade', 'edge-forms'],
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

  it('fans out RC roof beam volume into place concrete, material, and formwork usages', () => {
    const roofBeams = line({
      id: 'rc-roof-beams-volume',
      quantityType: 'rc_roof_beams_volume',
      description: 'RC Roof Beams',
      quantity: 9.39,
      unit: 'CY',
      formula: 'sum(roof_beam span * width * depth)',
      divisionCode: '03',
      divisionName: 'Concrete',
      parameterSnapshot: {
        beams: [
          {
            id: 'beam-1',
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 10, y: 0, z: 0 },
            widthMeters: 0.3,
            depthMeters: 0.4,
          },
        ],
      },
    });

    const compiled = buildDesignScopeCompileResult({
      previewLines: [roofBeams],
      persistedQuantityItems: [],
      productionRates: [],
    });

    const place = compiled.activities.find((activity) => activity.key === 'concrete:rc-roof-beams:place');
    const formwork = compiled.activities.find((activity) => activity.key === 'concrete:rc-roof-beams:formwork');
    expect(place?.usages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'place_concrete_labor', destination: 'activity_line_item', quantity: 9.39, unit: 'CY' }),
      expect.objectContaining({ role: 'concrete_material', destination: 'material_resource', quantity: 9.39, unit: 'CY' }),
    ]));
    expect(formwork?.usages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'formwork_labor', destination: 'activity_line_item', derived: true }),
    ]));
    expect(formwork?.usages[0]?.quantity).toBeCloseTo(118.4, 1);
  });

  it('creates separate concrete activities for isolated footings, columns, plinth beams, tie beams, roof beams, slab, and raked cap', () => {
    const lines = [
      line({
        quantityType: 'isolated_footings_volume',
        description: 'Isolated Footings',
        divisionCode: '03',
        divisionName: 'Concrete',
        unit: 'CY',
        parameterSnapshot: { footings: [{ widthMeters: 1, lengthMeters: 1.2, thicknessMeters: 0.3 }] },
      }),
      line({
        quantityType: 'rc_columns_volume',
        description: 'RC Columns',
        divisionCode: '03',
        divisionName: 'Concrete',
        unit: 'CY',
        parameterSnapshot: { columns: [{ widthMeters: 0.3, depthMeters: 0.3, heightMeters: 3 }] },
      }),
      line({
        quantityType: 'rc_plinth_beams_volume',
        description: 'RC Plinth Beams',
        divisionCode: '03',
        divisionName: 'Concrete',
        unit: 'CY',
        parameterSnapshot: { beams: [{ startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 3, y: 0, z: 0 }, widthMeters: 0.25, depthMeters: 0.4 }] },
      }),
      line({
        quantityType: 'rc_tie_beams_volume',
        description: 'RC Tie Beams',
        divisionCode: '03',
        divisionName: 'Concrete',
        unit: 'CY',
        parameterSnapshot: { beams: [{ startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 3, y: 0, z: 0 }, widthMeters: 0.25, depthMeters: 0.4 }] },
      }),
      line({
        quantityType: 'rc_roof_beams_volume',
        description: 'RC Roof Beams',
        divisionCode: '03',
        divisionName: 'Concrete',
        unit: 'CY',
        parameterSnapshot: { beams: [{ startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 3, y: 0, z: 0 }, widthMeters: 0.25, depthMeters: 0.4 }] },
      }),
      line({
        quantityType: 'interior_floor_slab_volume',
        description: 'Interior Floor Slab',
        divisionCode: '03',
        divisionName: 'Concrete',
        unit: 'CY',
        parameterSnapshot: { interiorFloorSlab: { thicknessMeters: 0.125 }, interiorFloorSlabPerimeterMeters: 12 },
      }),
      line({
        quantityType: 'raked_concrete_cap_volume',
        description: 'Raked Concrete Cap',
        divisionCode: '03',
        divisionName: 'Concrete',
        unit: 'CY',
      }),
      line({
        quantityType: 'raked_concrete_cap_linear_length',
        description: 'Raked Concrete Cap Linear Length',
        divisionCode: '03',
        divisionName: 'Concrete',
        quantity: 17.3,
        unit: 'LF',
      }),
    ];

    const activityKeys = buildDesignScopeCompileResult({
      previewLines: lines,
      persistedQuantityItems: [],
      productionRates: [],
    }).activities.map((activity) => activity.key);

    expect(activityKeys).toEqual(expect.arrayContaining([
      'concrete:isolated-footings:place',
      'concrete:isolated-footings:formwork',
      'concrete:rc-columns:place',
      'concrete:rc-columns:formwork',
      'concrete:rc-plinth-beams:place',
      'concrete:rc-plinth-beams:formwork',
      'concrete:rc-tie-beams:place',
      'concrete:rc-tie-beams:formwork',
      'concrete:rc-roof-beams:place',
      'concrete:rc-roof-beams:formwork',
      'concrete:interior-floor-slab:place',
      'concrete:interior-floor-slab:edge-forms',
      'concrete:raked-concrete-cap:place',
      'concrete:raked-concrete-cap:formwork',
    ]));
  });

  it('does not create a broad structural concrete activity when component concrete quantities exist', () => {
    const rollup = line({
      quantityType: 'rc_structural_concrete_volume',
      description: 'RC structural concrete total',
      quantity: 20,
      unit: 'CY',
      divisionCode: '03',
      divisionName: 'Concrete',
    });
    const component = line({
      quantityType: 'rc_roof_beams_volume',
      description: 'RC Roof Beams',
      quantity: 4,
      unit: 'CY',
      divisionCode: '03',
      divisionName: 'Concrete',
      parameterSnapshot: { beams: [{ startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 1, y: 0, z: 0 }, widthMeters: 0.3, depthMeters: 0.4 }] },
    });

    const compiled = buildDesignScopeCompileResult({
      previewLines: [rollup, component],
      persistedQuantityItems: [],
      productionRates: [],
    });

    expect(compiled.activities.some((activity) => /Structural Concrete Components/.test(activity.title))).toBe(false);
    expect(compiled.rollupUsages).toEqual([
      expect.objectContaining({
        sourceQuantityType: 'rc_structural_concrete_volume',
        destination: 'rollup',
        enabled: false,
        locked: true,
      }),
    ]);
  });

  it('derives footing, column, beam, slab, and raked cap formwork without guessing', () => {
    const compiled = buildDesignScopeCompileResult({
      previewLines: [
        line({
          quantityType: 'isolated_footings_volume',
          description: 'Isolated Footings',
          divisionCode: '03',
          divisionName: 'Concrete',
          unit: 'CY',
          parameterSnapshot: { footings: [{ widthMeters: 1, lengthMeters: 2, thicknessMeters: 0.5 }] },
        }),
        line({
          quantityType: 'rc_columns_volume',
          description: 'RC Columns',
          divisionCode: '03',
          divisionName: 'Concrete',
          unit: 'CY',
          parameterSnapshot: { columns: [{ widthMeters: 0.4, depthMeters: 0.5, heightMeters: 3 }] },
        }),
        line({
          quantityType: 'rc_roof_beams_volume',
          description: 'RC Roof Beams',
          divisionCode: '03',
          divisionName: 'Concrete',
          unit: 'CY',
          parameterSnapshot: { beams: [{ startPoint: { x: 0, y: 0, z: 0 }, endPoint: { x: 10, y: 0, z: 0 }, widthMeters: 0.3, depthMeters: 0.4 }] },
        }),
        line({
          quantityType: 'interior_floor_slab_volume',
          description: 'Interior Floor Slab',
          divisionCode: '03',
          divisionName: 'Concrete',
          unit: 'CY',
          parameterSnapshot: { interiorFloorSlab: { thicknessMeters: 0.125 }, interiorFloorSlabPerimeterMeters: 20 },
        }),
        line({
          quantityType: 'raked_concrete_cap_linear_length',
          description: 'Raked Concrete Cap Linear Length',
          divisionCode: '03',
          divisionName: 'Concrete',
          quantity: 17.3,
          unit: 'LF',
        }),
      ],
      persistedQuantityItems: [],
      productionRates: [],
    });

    const usageByKey = new Map(compiled.activities.map((activity) => [activity.key, activity.usages[0]!]));
    expect(usageByKey.get('concrete:isolated-footings:formwork')?.quantity).toBeCloseTo(32.29, 1);
    expect(usageByKey.get('concrete:rc-columns:formwork')?.quantity).toBeCloseTo(58.13, 1);
    expect(usageByKey.get('concrete:rc-roof-beams:formwork')?.quantity).toBeCloseTo(118.4, 1);
    expect(usageByKey.get('concrete:interior-floor-slab:edge-forms')?.quantity).toBeCloseTo(65.62, 1);
    expect(usageByKey.get('concrete:raked-concrete-cap:formwork')?.quantity).toBe(17.3);
  });

  it('filters interior floor slab edge-form candidates to formwork operations', () => {
    const compiled = buildDesignScopeCompileResult({
      previewLines: [
        line({
          quantityType: 'interior_floor_slab_volume',
          description: 'Interior Floor Slab',
          divisionCode: '03',
          divisionName: 'Concrete',
          unit: 'CY',
          parameterSnapshot: {
            interiorFloorSlab: { thicknessMeters: 0.125 },
            interiorFloorSlabPerimeterMeters: 114.052,
          },
        }),
      ],
      persistedQuantityItems: [],
      productionRates: [
        productionRate({
          id: 'sog-bulkhead-keyway',
          activityName: 'Slab on grade, bulkhead forms with keyway, wood, 6 inches high, one use',
          description: 'Slab on grade, bulkhead forms with keyway, wood, 6 inches high, one use',
          manHoursPerUnit: 0.084,
          keywords: ['concrete', 'formwork', 'slab-on-grade', 'bulkhead-forms'],
        }),
        productionRate({
          id: 'sog-edge-forms-7-12',
          activityName: 'Slab on grade, edge forms, wood, 7 to 12 inches high, one use',
          description: 'Slab on grade, edge forms, wood, 7 to 12 inches high, one use',
          manHoursPerUnit: 0.071,
          keywords: ['concrete', 'formwork', 'slab-on-grade', 'edge-forms'],
        }),
        productionRate({
          id: 'poured-expansion-joint',
          figureTitle: 'Concrete joints and accessories',
          category: 'Concrete Joints, Curing & Accessories',
          subcategory: 'Expansion joints',
          activityName: 'Poured expansion joint, 1/2 inch wide',
          description: 'Poured expansion joint, 1/2 inch wide',
          manHoursPerUnit: 0.05,
          keywords: ['concrete', 'joint', 'expansion'],
        }),
        productionRate({
          id: 'reglets',
          figureTitle: 'Concrete joints and accessories',
          category: 'Concrete Joints, Curing & Accessories',
          subcategory: 'Reglets',
          activityName: 'Reglets, concrete construction',
          description: 'Reglets, concrete construction',
          manHoursPerUnit: 0.03,
          keywords: ['concrete', 'reglets'],
        }),
        productionRate({
          id: 'water-stops',
          figureTitle: 'Concrete joints and accessories',
          category: 'Concrete Joints, Curing & Accessories',
          subcategory: 'Water stops',
          activityName: 'Water stops, PVC',
          description: 'Water stops, PVC',
          manHoursPerUnit: 0.04,
          keywords: ['concrete', 'waterstop'],
        }),
        productionRate({
          id: 'saw-cut-control-joint',
          figureTitle: 'Concrete joints and accessories',
          category: 'Concrete Joints, Curing & Accessories',
          subcategory: 'Saw cut control joints',
          activityName: 'Saw cut in green concrete',
          description: 'Saw cut in green concrete control joints',
          manHoursPerUnit: 0.02,
          keywords: ['concrete', 'joint', 'sawcut'],
        }),
        productionRate({
          id: 'control-joint-cleanup',
          figureTitle: 'Concrete joints and accessories',
          category: 'Concrete Joints, Curing & Accessories',
          subcategory: 'Control joint cleanup',
          activityName: 'Clean out control joint debris',
          description: 'Clean out control joint debris',
          manHoursPerUnit: 0.01,
          keywords: ['concrete', 'joint', 'cleanup'],
        }),
        productionRate({
          id: 'backer-rod',
          figureTitle: 'Concrete joints and accessories',
          category: 'Concrete Joints, Curing & Accessories',
          subcategory: 'Polyethylene, backer rod',
          activityName: 'Polyethylene, backer rod, 3/8- to 1-inch diameter',
          description: 'Polyethylene, backer rod, 3/8- to 1-inch diameter',
          manHoursPerUnit: 0.01,
          keywords: ['concrete', 'joint', 'backer rod'],
        }),
      ],
    });

    const edgeForms = compiled.activities.find((activity) => activity.key === 'concrete:interior-floor-slab:edge-forms');
    const usage = edgeForms?.usages[0];
    expect(usage).toMatchObject({
      role: 'formwork_labor',
      quantity: 374.19,
      unit: 'LF',
    });

    const candidateIds = usage?.candidates?.map((candidate) => candidate.productionRateId) ?? [];
    expect(candidateIds).toEqual(expect.arrayContaining(['sog-bulkhead-keyway', 'sog-edge-forms-7-12']));
    expect(candidateIds).not.toEqual(expect.arrayContaining([
      'poured-expansion-joint',
      'reglets',
      'water-stops',
      'saw-cut-control-joint',
      'control-joint-cleanup',
      'backer-rod',
    ]));
  });

  it('creates review-required disabled formwork usage when required geometry is missing', () => {
    const compiled = buildDesignScopeCompileResult({
      previewLines: [
        line({
          quantityType: 'rc_roof_beams_volume',
          description: 'RC Roof Beams',
          quantity: 4,
          unit: 'CY',
          divisionCode: '03',
          divisionName: 'Concrete',
          parameterSnapshot: {},
        }),
      ],
      persistedQuantityItems: [],
      productionRates: [],
    });

    const formwork = compiled.activities.find((activity) => activity.key === 'concrete:rc-roof-beams:formwork');
    expect(formwork?.usages[0]).toMatchObject({
      quantity: 0,
      enabled: false,
      reviewStatus: 'needs_review',
      reviewReason: 'Beam formwork requires beam geometry in the quantity snapshot.',
    });
  });
});
