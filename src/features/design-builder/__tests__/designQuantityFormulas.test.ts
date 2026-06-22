import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  buildCmuBuildingEstimatePreview,
  calculateCmuBlockCount,
  calculateCmuFullCoreFillVolumeCubicMeters,
  calculateFloorArea,
  calculateGableRoofArea,
  calculateThickenedEdgeSlabVolume,
  calculateTrussCount,
  calculateWallGrossArea,
  calculateWallNetArea,
  calculateWallOpeningArea,
  calculateWallRoughOpeningArea,
  resolveCmuOrderBlockQuantity,
} from '../quantity/designQuantityFormulas';

describe('Design Builder quantity formulas', () => {
  it('calculates floor area from normalized meter dimensions', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    expect(calculateFloorArea(preset.footprint.lengthMeters, preset.footprint.widthMeters)).toBe(30);
  });

  it('calculates CMU wall gross area, opening subtraction, and net area', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    expect(calculateWallGrossArea(preset.wall)).toBeCloseTo(61.6, 6);
    expect(calculateWallOpeningArea(preset.wall.openings)).toBeCloseTo(2.97, 6);
    expect(calculateWallRoughOpeningArea(preset.wall)).toBeCloseTo(3.5, 6);
    expect(calculateWallNetArea(preset.wall)).toBeCloseTo(58.1, 6);
  });

  it('calculates CMU block count from net wall area and waste', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    expect(calculateCmuBlockCount(preset.wall)).toBe(824);
  });

  it('separates slab field volume, thickened edge volume, and total volume when edge adds below slab', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const result = calculateThickenedEdgeSlabVolume(preset.slab);
    expect(result.footprintAreaSquareMeters).toBeCloseTo(30, 6);
    expect(result.edgeBandAreaSquareMeters).toBeCloseTo(9.09, 6);
    expect(result.slabFieldVolumeCubicMeters).toBeCloseTo(3.75, 6);
    expect(result.thickenedEdgeVolumeCubicMeters).toBeCloseTo(2.04525, 6);
    expect(result.totalConcreteVolumeCubicMeters).toBeCloseTo(5.79525, 6);
  });

  it('avoids double-counting when thickened edge replaces slab thickness at the perimeter', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const result = calculateThickenedEdgeSlabVolume({
      ...preset.slab,
      edgeMode: 'replaces_slab_at_perimeter',
    });
    expect(result.slabFieldVolumeCubicMeters).toBeCloseTo(2.61375, 6);
    expect(result.thickenedEdgeVolumeCubicMeters).toBeCloseTo(3.1815, 6);
    expect(result.totalConcreteVolumeCubicMeters).toBeCloseTo(5.79525, 6);
  });

  it('calculates roof area by pitch and truss count by spacing', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    expect(calculateGableRoofArea(preset.roof)).toBeCloseTo(38.0975, 4);
    expect(calculateTrussCount(preset.truss)).toBe(11);
  });

  it('orders CMU blocks as full units with waste applied to generated count', () => {
    expect(resolveCmuOrderBlockQuantity({ totalGeneratedBlocks: 100, wasteFactor: 0.05 })).toBe(105);
    expect(resolveCmuOrderBlockQuantity({ totalGeneratedBlocks: 0, wasteFactor: 0.05 })).toBe(0);
  });

  it('generates construction-aware CMU estimate preview lines with parameter metadata', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const preview = buildCmuBuildingEstimatePreview({
      designModelId: 'model-1',
      wallObjectId: 'wall-1',
      slabObjectId: 'slab-1',
      roofObjectId: 'roof-1',
      trussObjectId: 'truss-1',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
    });

    expect(preview.map((line) => line.id)).toEqual(
      expect.arrayContaining([
        'cmu-blocks',
        'mortar-allowance',
        'cmu-lintels',
        'opening-rough-area',
        'opening-actual-area',
        'door-window-units',
        'cmu-jamb-grout',
        'cmu-lintel-grout',
        'cmu-bond-beam-grout',
        'cmu-total-grout',
        'cmu-core-fill-grout',
        'cmu-bond-beam',
        'grouted-cells-columns',
      ]),
    );
    expect(preview.map((line) => line.id)).not.toContain('cmu-standard-blocks');
    expect(preview.map((line) => line.id)).not.toContain('cmu-special-blocks');
    expect(preview.find((line) => line.id === 'cmu-blocks')?.quantity).toBeGreaterThan(0);
    expect(preview.find((line) => line.id === 'cmu-lintels')).toEqual(
      expect.objectContaining({
        source: 'parametric_design_builder',
        confidence: 'calculated_from_parameters',
        parameterSnapshot: expect.objectContaining({ lintels: expect.any(Array) }),
      }),
    );
    expect(preview.find((line) => line.id === 'cmu-blocks')?.parameterSnapshot).toEqual(
      expect.objectContaining({
        result: expect.objectContaining({
          blockBreakdown: expect.objectContaining({ full: expect.any(Number), jamb: expect.any(Number) }),
          openingGrout: expect.objectContaining({
            jambGroutCellCount: expect.any(Number),
            totalGroutVolumeCubicMeters: expect.any(Number),
          }),
          moduleFits: expect.objectContaining({
            north: expect.objectContaining({ fit: 'full' }),
            east: expect.objectContaining({ fit: 'half' }),
          }),
        }),
      }),
    );
  });

  it('retains terminal cut metadata on the consolidated CMU block line', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const preview = buildCmuBuildingEstimatePreview({
      designModelId: 'model-1',
      wallObjectId: 'wall-1',
      slabObjectId: 'slab-1',
      roofObjectId: 'roof-1',
      trussObjectId: 'truss-1',
      wall: { ...preset.wall, lengthMeters: 10.3, widthMeters: 4.3, openings: [] },
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
    });
    const cmuBlocks = preview.find((line) => line.id === 'cmu-blocks');

    expect(cmuBlocks?.description).toContain('full units');
    expect(cmuBlocks?.parameterSnapshot).toEqual(
      expect.objectContaining({
        result: expect.objectContaining({
          terminalClosures: expect.any(Array),
          orderingPolicy: 'site_cut_from_full_units',
        }),
      }),
    );
    expect(preview.some((line) => line.id === 'cmu-terminal-cut-blocks')).toBe(false);
  });

  it('generates separate top bond beam quantity only when enabled', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const buildPreview = (bondBeamEnabled: boolean) =>
      buildCmuBuildingEstimatePreview({
        designModelId: 'model-1',
        wallObjectId: 'wall-1',
        slabObjectId: 'slab-1',
        roofObjectId: 'roof-1',
        trussObjectId: 'truss-1',
        wall: { ...preset.wall, bondBeamEnabled },
        slab: preset.slab,
        roof: preset.roof,
        truss: preset.truss,
      });

    expect(buildPreview(true).find((line) => line.id === 'cmu-bond-beam')?.quantity).toBeCloseTo(22, 6);
    expect(buildPreview(false).find((line) => line.id === 'cmu-bond-beam')?.quantity).toBe(0);
  });

  it('calculates CMU core fill grout from every block core void plus waste', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const preview = buildCmuBuildingEstimatePreview({
      designModelId: 'model-1',
      wallObjectId: 'wall-1',
      slabObjectId: 'slab-1',
      roofObjectId: 'roof-1',
      trussObjectId: 'truss-1',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
    });
    const coreFillLine = preview.find((line) => line.id === 'cmu-core-fill-grout');
    const cmuBlocksLine = preview.find((line) => line.id === 'cmu-blocks');
    const totalGeneratedBlocks =
      (cmuBlocksLine?.parameterSnapshot as { result?: { totalGeneratedBlocks?: number } })?.result
        ?.totalGeneratedBlocks ?? 0;

    expect(totalGeneratedBlocks).toBeGreaterThan(0);
    expect(calculateCmuFullCoreFillVolumeCubicMeters(totalGeneratedBlocks, preset.wall)).toBeGreaterThan(0);
    expect(coreFillLine?.quantity).toBeGreaterThan(0);
    expect(coreFillLine?.quantityType).toBe('cmu_core_fill_grout');
  });
});
