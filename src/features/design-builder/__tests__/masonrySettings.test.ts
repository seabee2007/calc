import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  applyProjectMasonryDefaultsToLayout,
  buildMasonryGeometryKey,
  syncWallBlockModuleFromScalars,
} from '../domain/masonrySettings';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import { generateCmuLayout } from '../geometry/designGeometry';
import { buildCmuBuildingEstimatePreview } from '../quantity/designQuantityFormulas';

describe('masonry settings', () => {
  it('syncs block module config from project masonry scalar fields', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const synced = syncWallBlockModuleFromScalars({
      ...preset.wall,
      blockLengthMeters: 0.5,
      blockHeightMeters: 0.25,
      blockDepthMeters: 0.29,
      wallThicknessMeters: 0.29,
    });
    const module = resolveCmuModuleConfig(synced);

    expect(module.moduleLengthMeters).toBeCloseTo(0.5, 6);
    expect(module.moduleHeightMeters).toBeCloseTo(0.25, 6);
    expect(module.nominalDepthMeters).toBeCloseTo(0.29, 6);
    expect(synced.blockModule?.moduleLengthMeters).toBeCloseTo(0.5, 6);
  });

  it('propagates project wall height and thickness to all layout segments', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const nextLayout = applyProjectMasonryDefaultsToLayout(preset.wallLayout, {
      heightMeters: 3.2,
      wallThicknessMeters: 0.29,
    });

    expect(nextLayout.defaultWallHeightMeters).toBeCloseTo(3.2, 6);
    expect(nextLayout.defaultWallThicknessMeters).toBeCloseTo(0.29, 6);
    expect(nextLayout.segments.every((segment) => segment.wallHeightMeters === 3.2)).toBe(true);
    expect(nextLayout.segments.every((segment) => segment.wallThicknessMeters === 0.29)).toBe(true);
  });

  it('excludes waste from masonry geometry key', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const lowWaste = buildMasonryGeometryKey({
      wallLayout: preset.wallLayout,
      wall: { ...preset.wall, wasteFactor: 0.05 },
      openings: preset.wall.openings,
      moduleFitMode: 'exact',
    });
    const highWaste = buildMasonryGeometryKey({
      wallLayout: preset.wallLayout,
      wall: { ...preset.wall, wasteFactor: 0.1 },
      openings: preset.wall.openings,
      moduleFitMode: 'exact',
    });

    expect(lowWaste).toBe(highWaste);
  });

  it('changes geometry key when bond pattern or block dimensions change', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const base = buildMasonryGeometryKey({
      wallLayout: preset.wallLayout,
      wall: preset.wall,
      openings: preset.wall.openings,
      moduleFitMode: 'exact',
    });
    const tallerBlocks = buildMasonryGeometryKey({
      wallLayout: preset.wallLayout,
      wall: { ...preset.wall, blockHeightMeters: 0.1 },
      openings: preset.wall.openings,
      moduleFitMode: 'exact',
    });
    const stackBond = buildMasonryGeometryKey({
      wallLayout: preset.wallLayout,
      wall: { ...preset.wall, bondPattern: 'stack_bond' },
      openings: preset.wall.openings,
      moduleFitMode: 'exact',
    });

    expect(tallerBlocks).not.toBe(base);
    expect(stackBond).not.toBe(base);
  });

  it('updates block count when wall height changes but not when only waste changes', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const baseLayout = generateCmuLayout(preset.wall);
    const tallerLayout = generateCmuLayout({ ...preset.wall, heightMeters: 4.2 });
    const highWastePreview = buildCmuBuildingEstimatePreview({
      designModelId: 'model',
      wallObjectId: 'wall',
      slabObjectId: 'slab',
      roofObjectId: 'roof',
      trussObjectId: 'truss',
      wall: { ...preset.wall, wasteFactor: 0.1 },
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
    });
    const lowWastePreview = buildCmuBuildingEstimatePreview({
      designModelId: 'model',
      wallObjectId: 'wall',
      slabObjectId: 'slab',
      roofObjectId: 'roof',
      trussObjectId: 'truss',
      wall: { ...preset.wall, wasteFactor: 0.05 },
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
    });

    expect(tallerLayout.courseCount).toBeGreaterThan(baseLayout.courseCount);
    expect(tallerLayout.totalBlocks).toBeGreaterThan(baseLayout.totalBlocks);
    expect(baseLayout.totalBlocks).toBe(
      generateCmuLayout({ ...preset.wall, wasteFactor: 0.1 }).totalBlocks,
    );
    const highWasteBlocks = highWastePreview.find((line) => line.quantityType === 'cmu_block_count')?.quantity ?? 0;
    const lowWasteBlocks = lowWastePreview.find((line) => line.quantityType === 'cmu_block_count')?.quantity ?? 0;
    expect(highWasteBlocks).toBeGreaterThan(lowWasteBlocks);
  });
});
