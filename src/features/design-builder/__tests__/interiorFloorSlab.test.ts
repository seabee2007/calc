import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRcFrameFoundationSettings, normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import { polygonAreaSquareMeters, resolveInteriorFloorSlab } from '../domain/interiorFloorSlab';
import { TOP_OF_PLINTH_BEAM_Y } from '../domain/foundationElevations';
import { buildFrameInfillEstimatePreview } from '../quantity/designQuantityFormulas';
import { buildDesignGeometryInputFromLayout, generateDesignGeometry } from '../geometry/designGeometry';

function frameGeometry(foundationPatch: Partial<ReturnType<typeof createDefaultRcFrameFoundationSettings>> = {}) {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  const foundation = normalizeRcFrameFoundationSettings({
    ...createDefaultRcFrameFoundationSettings(),
    ...foundationPatch,
    interiorFloorSlab: {
      ...createDefaultRcFrameFoundationSettings().interiorFloorSlab,
      ...foundationPatch.interiorFloorSlab,
    },
  });
  return {
    preset,
    foundation,
    geometry: generateDesignGeometry(
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
    ),
  };
}

describe('Interior floor slab', () => {
  it('defaults to 125 mm slab flush with plinth top', () => {
    const foundation = createDefaultRcFrameFoundationSettings();
    expect(foundation.interiorFloorSlab.enabled).toBe(true);
    expect(foundation.interiorFloorSlab.thicknessMeters).toBeCloseTo(0.125, 3);
    const resolved = resolveInteriorFloorSlab({
      foundation,
      interiorFacePolygon: [{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 5, z: 6 }, { x: 0, z: 6 }],
    });
    expect(resolved.topElevationMeters).toBeCloseTo(TOP_OF_PLINTH_BEAM_Y, 6);
    expect(resolved.bottomElevationMeters).toBeCloseTo(-0.125, 3);
  });

  it('keeps CMU infill base at plinth top while slab fills between beams', () => {
    const { geometry } = frameGeometry({
      interiorFloorSlab: { enabled: true, thicknessMeters: 0.15 },
    });
    const panel = geometry.infillSystem?.panels[0];
    expect(panel?.bottomElevationMeters).toBeCloseTo(0, 3);
    expect(panel?.bottomSupportType).toBe('plinth_beam');
    expect(geometry.interiorFloorSlab?.topElevationMeters).toBeCloseTo(0, 3);
    expect(geometry.interiorFloorSlab?.bottomElevationMeters).toBeCloseTo(-0.15, 3);
    expect(geometry.interiorFloorSlab?.volumeCubicMeters ?? 0).toBeGreaterThan(0);
  });

  it('changes estimate volume when thickness changes', () => {
    const thin = frameGeometry({ interiorFloorSlab: { enabled: true, thicknessMeters: 0.1 } });
    const thick = frameGeometry({ interiorFloorSlab: { enabled: true, thicknessMeters: 0.2 } });
    const area = polygonAreaSquareMeters(thick.geometry.resolvedFootprint!.interiorFacePolygon);
    expect(thick.geometry.interiorFloorSlab?.areaSquareMeters).toBeCloseTo(area, 3);
    expect(thick.geometry.interiorFloorSlab?.volumeCubicMeters ?? 0).toBeCloseTo(area * 0.2, 3);
    expect(thick.geometry.interiorFloorSlab?.volumeCubicMeters ?? 0).toBeGreaterThan(
      thin.geometry.interiorFloorSlab?.volumeCubicMeters ?? 0,
    );

    const preview = buildFrameInfillEstimatePreview({
      designModelId: 'test',
      wallObjectId: 'wall',
      slabObjectId: 'slab',
      roofObjectId: 'roof',
      trussObjectId: 'truss',
      frameObjectId: 'frame',
      infillObjectId: 'infill',
      gableEndObjectId: 'gable',
      wall: thick.preset.wall,
      slab: thick.preset.slab,
      roof: thick.preset.roof,
      truss: thick.preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: thick.preset.frameSystem,
      infillSystem: thick.preset.infillSystem,
      gableEndSystem: thick.preset.gableEndSystem,
      geometryResult: thick.geometry,
    });
    const line = preview.find((entry) => entry.id === 'interior-floor-slab-volume');
    expect(line).toBeDefined();
    expect(line?.quantityType).toBe('interior_floor_slab_volume');
  });

  it('omits slab volume when disabled', () => {
    const { geometry } = frameGeometry({
      interiorFloorSlab: { enabled: false, thicknessMeters: 0.125 },
    });
    expect(geometry.interiorFloorSlab?.volumeCubicMeters ?? 0).toBe(0);
    expect(geometry.infillSystem?.panels[0]?.bottomElevationMeters).toBeCloseTo(0, 3);
  });
});
