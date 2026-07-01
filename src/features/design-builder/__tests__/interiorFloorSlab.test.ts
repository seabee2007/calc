import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRcFrameFoundationSettings, normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import { polygonAreaSquareMeters, resolveInteriorFloorSlab } from '../domain/interiorFloorSlab';
import { TOP_OF_PLINTH_BEAM_Y } from '../domain/foundationElevations';
import { buildFrameInfillEstimatePreview } from '../quantity/designQuantityFormulas';
import { buildDesignGeometryInputFromLayout, generateDesignGeometry } from '../geometry/designGeometry';

type Point2D = { x: number; z: number };

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

function distanceToSegmentMeters(point: Point2D, start: Point2D, end: Point2D): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 1e-12) return Math.hypot(point.x - start.x, point.z - start.z);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * t), point.z - (start.z + dz * t));
}

function distanceToPolygonEdgesMeters(point: Point2D, polygon: readonly Point2D[]): number {
  return polygon.reduce((best, vertex, index) => {
    const next = polygon[(index + 1) % polygon.length]!;
    return Math.min(best, distanceToSegmentMeters(point, vertex, next));
  }, Number.POSITIVE_INFINITY);
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
    expect(resolved.footprintPolygon).toEqual([
      { x: 0, z: 0 },
      { x: 5, z: 0 },
      { x: 5, z: 6 },
      { x: 0, z: 6 },
    ]);
  });

  it('keeps CMU infill base at plinth top while slab fills between beams', () => {
    const { geometry } = frameGeometry({
      interiorFloorSlab: { enabled: true, thicknessMeters: 0.15 },
    });
    const panel = geometry.infillSystem?.panels.find((entry) => entry.infillZone !== 'below_grade');
    expect(panel?.bottomElevationMeters).toBeCloseTo(0, 3);
    expect(panel?.bottomSupportType).toBe('plinth_beam');
    expect(geometry.interiorFloorSlab?.topElevationMeters).toBeCloseTo(0, 3);
    expect(geometry.interiorFloorSlab?.bottomElevationMeters).toBeCloseTo(-0.15, 3);
    expect(geometry.interiorFloorSlab?.volumeCubicMeters ?? 0).toBeGreaterThan(0);
  });

  it('resolves the slab footprint to the plinth beam contact edge', () => {
    const { geometry } = frameGeometry({
      interiorFloorSlab: { enabled: true, thicknessMeters: 0.15 },
    });
    const slab = geometry.interiorFloorSlab;
    expect(slab?.topElevationMeters).toBeCloseTo(TOP_OF_PLINTH_BEAM_Y, 6);
    expect(slab?.footprintPolygon.length).toBeGreaterThanOrEqual(3);

    const oldInteriorFaceArea = polygonAreaSquareMeters(geometry.resolvedFootprint!.interiorFacePolygon);
    const correctedArea = polygonAreaSquareMeters(slab!.footprintPolygon);
    expect(slab?.areaSquareMeters).toBeCloseTo(correctedArea, 6);
    expect(slab?.volumeCubicMeters).toBeCloseTo(correctedArea * 0.15, 6);
    expect(correctedArea).toBeGreaterThan(oldInteriorFaceArea);
    expect(geometry.floorTileLayout?.floorAreaSquareMeters).toBeCloseTo(correctedArea, 6);

    const framesBySegmentId = new Map(
      (geometry.wallCmuLayout.segmentFrames ?? []).map((frame) => [frame.segmentId, frame]),
    );
    const plinthBeams = geometry.frameSystem?.beams.filter((beam) => beam.kind === 'plinth_beam') ?? [];
    expect(plinthBeams.length).toBeGreaterThan(0);
    for (const beam of plinthBeams) {
      const frame = beam.hostSegmentId ? framesBySegmentId.get(beam.hostSegmentId) : undefined;
      expect(frame).toBeDefined();
      const contactPoint = {
        x: (beam.startPoint.x + beam.endPoint.x) / 2 + frame!.inwardNormal.x * beam.widthMeters / 2,
        z: (beam.startPoint.z + beam.endPoint.z) / 2 + frame!.inwardNormal.z * beam.widthMeters / 2,
      };
      expect(distanceToPolygonEdgesMeters(contactPoint, slab!.footprintPolygon)).toBeLessThan(1e-6);
    }
  });

  it('changes estimate volume when thickness changes', () => {
    const thin = frameGeometry({ interiorFloorSlab: { enabled: true, thicknessMeters: 0.1 } });
    const thick = frameGeometry({ interiorFloorSlab: { enabled: true, thicknessMeters: 0.2 } });
    const area = polygonAreaSquareMeters(thick.geometry.interiorFloorSlab!.footprintPolygon);
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
    const aboveGradePanel = geometry.infillSystem?.panels.find(
      (panel) => panel.infillZone !== 'below_grade',
    );
    expect(aboveGradePanel?.bottomElevationMeters).toBeCloseTo(0, 3);
  });
});
