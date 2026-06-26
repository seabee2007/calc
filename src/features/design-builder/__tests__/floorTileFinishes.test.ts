import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRcFrameFoundationSettings, normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import { buildDesignGeometryInputFromLayout, generateDesignGeometry } from '../geometry/designGeometry';
import { buildFrameInfillEstimatePreview } from '../quantity/designQuantityFormulas';

function frameGeometryWithFloorTile(enabled: boolean) {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  const foundation = normalizeRcFrameFoundationSettings({
    ...createDefaultRcFrameFoundationSettings(),
    floorTileFinish: {
      ...createDefaultRcFrameFoundationSettings().floorTileFinish,
      enabled,
      tileSizeKey: '600x600',
      groutJointWidth: '1/8',
    },
  });
  const geometry = generateDesignGeometry(
    buildDesignGeometryInputFromLayout({
      wallLayout: preset.wallLayout,
      cmuSettings: preset.wall,
      slabSettings: preset.slab,
      roofSettings: preset.roof,
      trussSettings: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      foundationSettings: foundation,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      roofSystem: preset.roofSystem,
    }),
  );
  return { preset, foundation, geometry };
}

describe('floor tile estimate preview', () => {
  it('emits Division 09 tiling lines when floor tile finish is enabled', () => {
    const { preset, geometry } = frameGeometryWithFloorTile(true);
    expect(geometry.floorTileLayout?.enabled).toBe(true);

    const lines = buildFrameInfillEstimatePreview({
      designModelId: 'test-model',
      wallObjectId: 'wall-1',
      slabObjectId: 'slab-1',
      roofObjectId: 'roof-1',
      trussObjectId: 'truss-1',
      frameObjectId: 'frame-1',
      infillObjectId: 'infill-1',
      gableEndObjectId: 'gable-1',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      geometryResult: geometry,
      roofSystem: preset.roofSystem,
    });

    const tileLineIds = [
      'interior-floor-tile-full',
      'interior-floor-tile-cut',
      'interior-floor-tile-area',
      'interior-floor-thinset',
      'interior-floor-thinset-bags',
      'interior-floor-grout',
      'interior-floor-grout-bags',
    ];
    const tileLines = lines.filter((line) => tileLineIds.includes(line.id));
    expect(tileLines).toHaveLength(tileLineIds.length);
    expect(tileLines.every((line) => line.divisionCode === '09')).toBe(true);
    expect(tileLines.every((line) => line.parameterSnapshot.csiSection === '09 30 00')).toBe(true);
  });

  it('omits floor tile lines when finish is disabled', () => {
    const { preset, geometry } = frameGeometryWithFloorTile(false);
    expect(geometry.floorTileLayout?.enabled).toBe(false);

    const lines = buildFrameInfillEstimatePreview({
      designModelId: 'test-model',
      wallObjectId: 'wall-1',
      slabObjectId: 'slab-1',
      roofObjectId: 'roof-1',
      trussObjectId: 'truss-1',
      frameObjectId: 'frame-1',
      infillObjectId: 'infill-1',
      gableEndObjectId: 'gable-1',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      geometryResult: geometry,
      roofSystem: preset.roofSystem,
    });

    expect(lines.some((line) => line.id === 'interior-floor-tile-full')).toBe(false);
  });
});
