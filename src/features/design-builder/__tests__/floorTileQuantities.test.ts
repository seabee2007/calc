import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FLOOR_THINSET_THICKNESS_METERS,
  DEFAULT_FLOOR_TILE_WASTE_FACTOR,
} from '../domain/floorTileCatalog';
import {
  estimateGroutVolumeCubicMeters,
  resolveFloorTileQuantities,
} from '../domain/floorTileQuantities';

describe('resolveFloorTileQuantities', () => {
  it('computes thinset volume from floor area and 1/2 inch bed', () => {
    const result = resolveFloorTileQuantities({
      floorAreaSquareMeters: 20,
      installedAreaSquareMeters: 20,
      fullTileCount: 40,
      cutTileCount: 12,
      tileWidthMeters: 0.6,
      tileDepthMeters: 0.6,
      groutJointMeters: 0.003175,
      thinsetThicknessMeters: DEFAULT_FLOOR_THINSET_THICKNESS_METERS,
      wasteFactor: DEFAULT_FLOOR_TILE_WASTE_FACTOR,
    });
    expect(result.thinsetVolumeCubicMeters).toBeCloseTo(
      20 * DEFAULT_FLOOR_THINSET_THICKNESS_METERS * (1 + DEFAULT_FLOOR_TILE_WASTE_FACTOR),
      6,
    );
    expect(result.thinsetBags).toBeGreaterThan(0);
    expect(result.orderTileCount).toBe(Math.ceil(52 * (1 + DEFAULT_FLOOR_TILE_WASTE_FACTOR)));
  });

  it('returns zero grout volume when joint width is none', () => {
    expect(
      estimateGroutVolumeCubicMeters({
        installedAreaSquareMeters: 20,
        tileWidthMeters: 0.6,
        tileDepthMeters: 0.6,
        groutJointMeters: 0,
      }),
    ).toBe(0);
  });

  it('increases grout volume with wider joints', () => {
    const narrow = estimateGroutVolumeCubicMeters({
      installedAreaSquareMeters: 20,
      tileWidthMeters: 0.6,
      tileDepthMeters: 0.6,
      groutJointMeters: 0.003175,
    });
    const wide = estimateGroutVolumeCubicMeters({
      installedAreaSquareMeters: 20,
      tileWidthMeters: 0.6,
      tileDepthMeters: 0.6,
      groutJointMeters: 0.00635,
    });
    expect(wide).toBeGreaterThan(narrow);
  });
});
