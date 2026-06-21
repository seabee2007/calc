import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import {
  UNSUPPORTED_ROOF_FOOTPRINT_MESSAGE,
  analyzeRectangularFootprint,
  footprintBounds,
  resolveOuterRoofBeamBearingLoop,
} from '../domain/roofFootprintSupport';
import { resolveRoofSystem } from '../domain/roofSystemResolver';
import {
  GABLE_HEIGHT_TOLERANCE_METERS,
  roofClearanceElevationAtStation,
} from '../domain/roofGableSolver';
import { createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
} from '../geometry/designGeometry';
import { buildFrameInfillEstimatePreview } from '../quantity/designQuantityFormulas';
import type { RoofSystemSettings } from '../types';

function resolveRoofFromPreset(
  preset: ReturnType<typeof applyAutoFrameLayout>,
  roofSystem: RoofSystemSettings,
  wallFootprint: readonly { x: number; z: number }[],
) {
  const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
  const bearingLoop = resolveOuterRoofBeamBearingLoop({
    layout: preset.wallLayout,
    segmentFrames,
    roofBeams: preset.frameSystem.beams,
    fallbackExteriorFootprint: wallFootprint,
  });
  return resolveRoofSystem({
    layout: preset.wallLayout,
    wallExteriorFootprint: wallFootprint,
    structuralBearingPerimeter: bearingLoop.points,
    bearingSource: bearingLoop.source,
    bearingWarnings: bearingLoop.warnings,
    roofSystem,
    roofBeamTopElevationMeters: 2.8,
  });
}

function frameInfillGeometry(roofSystem: RoofSystemSettings, layout?: import('../types').DesignWallLayoutParameters) {
  const base = createFiveBySixCmuBuildingPreset();
  if (layout) {
    base.wallLayout = layout;
  }
  const preset = applyAutoFrameLayout(base);
  const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);
  return generateDesignGeometry(
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
      roofSystem,
    }),
  );
}

function gableRoofSystem(overrides: Partial<RoofSystemSettings> = {}): RoofSystemSettings {
  return {
    ...createDefaultRoofSystemSettings(),
    roofType: 'gable',
    gable: { ...createDefaultRoofSystemSettings().gable, enabled: true, rakedConcreteCapEnabled: true },
    ...overrides,
  };
}

describe('Roof system — hip, gable, raked cap', () => {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);

  it('defaults rake clearance to 0.1016 m (4 in)', () => {
    expect(createDefaultRoofSystemSettings().gable.rakeClearanceMeters).toBe(0.1016);
  });

  it('hip roof on a rectangle creates four roof faces and no gable-end CMU', () => {
    const roofSystem: RoofSystemSettings = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'hip',
    };
    const geometry = frameInfillGeometry(roofSystem);
    const roof = geometry.resolvedRoofSystem;
    expect(roof?.supported).toBe(true);
    expect(roof?.roofType).toBe('hip');
    expect(roof?.roofTopPlanes.length).toBe(4);
    expect(roof?.gableEndSegmentIds.length).toBe(0);
    expect(roof?.gableEnds.length).toBe(0);
    expect(geometry.rakedCapPlacements?.length ?? 0).toBe(0);
  });

  it('hip roof on a square creates a pyramid roof with one peak', () => {
    const squareLayout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 6,
      wallHeightMeters: preset.wallLayout.defaultWallHeightMeters,
      wallThicknessMeters: preset.wallLayout.defaultWallThicknessMeters,
    });
    const roofSystem: RoofSystemSettings = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'hip',
    };
    const geometry = frameInfillGeometry(roofSystem, squareLayout);
    const roof = geometry.resolvedRoofSystem;
    expect(roof?.supported).toBe(true);
    expect(roof?.peakPoint).toBeDefined();
    expect(roof?.ridgeStart).toBeUndefined();
    expect(roof?.ridgeEnd).toBeUndefined();
    expect(roof?.roofTopPlanes.length).toBe(4);
    expect(roof?.roofTopPlanes.every((plane) => plane.corners.length === 3)).toBe(true);
  });

  it('gable roof creates two roof planes and two gable ends', () => {
    const roofSystem: RoofSystemSettings = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'gable',
      ridgeDirection: 'along_shortest_axis',
      gable: { ...createDefaultRoofSystemSettings().gable, enabled: true, rakedConcreteCapEnabled: true },
    };
    const geometry = frameInfillGeometry(roofSystem);
    const roof = geometry.resolvedRoofSystem;
    expect(roof?.supported).toBe(true);
    expect(roof?.roofTopPlanes.length).toBe(2);
    expect(roof?.gableEndSegmentIds.length).toBe(2);
    expect(roof?.gableEnds.length).toBe(2);
    expect((geometry.gablePlacements?.length ?? 0) > 0).toBe(true);
  });

  it('ridge direction changes the correct gable-end segments', () => {
    const analysis = analyzeRectangularFootprint({
      layout: preset.wallLayout,
      exteriorFootprint: [{ x: -3, z: -2.5 }, { x: 3, z: -2.5 }, { x: 3, z: 2.5 }, { x: -3, z: 2.5 }],
    });
    const wallFootprint = [{ x: -3, z: -2.5 }, { x: 3, z: -2.5 }, { x: 3, z: 2.5 }, { x: -3, z: 2.5 }];
    const alongLongest = resolveRoofFromPreset(preset, {
      ...createDefaultRoofSystemSettings(),
      roofType: 'gable',
      ridgeDirection: 'along_longest_axis',
    }, wallFootprint);
    const alongShortest = resolveRoofFromPreset(preset, {
      ...createDefaultRoofSystemSettings(),
      roofType: 'gable',
      ridgeDirection: 'along_shortest_axis',
    }, wallFootprint);
    expect(alongLongest.gableEndSegmentIds).toEqual(analysis.axisZSegmentIds);
    expect(alongShortest.gableEndSegmentIds).toEqual(analysis.axisXSegmentIds);
    expect(alongLongest.gableEndSegmentIds).not.toEqual(alongShortest.gableEndSegmentIds);
  });

  it('structural bearing aligns with outer roof beam faces, not CMU exterior', () => {
    const geometry = frameInfillGeometry(createDefaultRoofSystemSettings());
    const roof = geometry.resolvedRoofSystem!;
    const cmuExterior = footprintBounds(geometry.exteriorFootprint ?? []);
    const bearing = footprintBounds(roof.structuralBearingPerimeter);
    expect(bearing.minZ).toBeLessThan(cmuExterior.minZ);
    expect(bearing.maxZ).toBeGreaterThan(cmuExterior.maxZ);
    expect(bearing.minX).toBeLessThan(cmuExterior.minX);
    expect(bearing.maxX).toBeGreaterThan(cmuExterior.maxX);
  });

  it('gable ridge spans bearing perimeter with eaves at cladding overhang', () => {
    const roofSystem: RoofSystemSettings = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'gable',
      ridgeDirection: 'along_longest_axis',
      eaveOverhangMeters: 0.5,
    };
    const geometry = frameInfillGeometry(roofSystem);
    const roof = geometry.resolvedRoofSystem!;
    const bearing = footprintBounds(roof.structuralBearingPerimeter);
    const cladding = footprintBounds(roof.claddingPerimeter);
    const ridgeMid = {
      x: (roof.ridgeStart!.x + roof.ridgeEnd!.x) / 2,
      z: (roof.ridgeStart!.z + roof.ridgeEnd!.z) / 2,
    };
    expect(ridgeMid.x).toBeCloseTo(bearing.centerX, 2);
    expect(ridgeMid.z).toBeCloseTo(bearing.centerZ, 2);
    const eavePlane = roof.roofTopPlanes.find((plane) => plane.corners.length === 4);
    expect(eavePlane).toBeDefined();
    const eavePoints = eavePlane!.corners.filter((corner) => Math.abs(corner.y - roof.roofBeamTopY) < 0.001);
    expect(eavePoints.length).toBeGreaterThan(0);
    expect(cladding.minZ).toBeLessThan(bearing.minZ);
    expect(bearing.maxX - bearing.minX).toBeGreaterThan(6);
  });

  it('eave overhang expands roof footprint without changing wall coordinates', () => {
    const geometry = frameInfillGeometry(createDefaultRoofSystemSettings());
    const baseFootprint = geometry.exteriorFootprint ?? [];
    expect(baseFootprint.length).toBeGreaterThanOrEqual(4);
    const noOverhang = resolveRoofFromPreset(
      preset,
      { ...createDefaultRoofSystemSettings(), eaveOverhangMeters: 0 },
      baseFootprint,
    );
    const withOverhang = resolveRoofFromPreset(
      preset,
      { ...createDefaultRoofSystemSettings(), eaveOverhangMeters: 0.5 },
      baseFootprint,
    );
    expect(withOverhang.rafterRunMeters).toBeGreaterThan(noOverhang.rafterRunMeters);
    expect(withOverhang.rafterRunMeters - noOverhang.rafterRunMeters).toBeCloseTo(0.5, 3);
    expect(preset.wallLayout.nodes[0]?.x).toBe(-3);
    expect(baseFootprint[0]?.x).toBe(preset.wallLayout.nodes[0]?.x);
  });

  it('peak height updates roof rise and member reference length', () => {
    const wallFootprint = [{ x: -3, z: -2.5 }, { x: 3, z: -2.5 }, { x: 3, z: 2.5 }, { x: -3, z: 2.5 }];
    const lowPeak = resolveRoofFromPreset(
      preset,
      { ...createDefaultRoofSystemSettings(), peakHeightAboveRoofBeamMeters: 1 },
      wallFootprint,
    );
    const highPeak = resolveRoofFromPreset(
      preset,
      { ...createDefaultRoofSystemSettings(), peakHeightAboveRoofBeamMeters: 2 },
      wallFootprint,
    );
    expect(highPeak.rafterRiseMeters).toBe(2);
    expect(lowPeak.rafterRiseMeters).toBe(1);
    expect(highPeak.rafterLengthMeters).toBeGreaterThan(lowPeak.rafterLengthMeters);
    expect(highPeak.rafterLengthMeters).toBeCloseTo(
      Math.hypot(highPeak.rafterRunMeters, highPeak.rafterRiseMeters),
      5,
    );
  });

  it('gable CMU remains below roof underside minus configured rake clearance', () => {
    const roofSystem = gableRoofSystem({
      peakHeightAboveRoofBeamMeters: 1.5,
      gable: { ...createDefaultRoofSystemSettings().gable, rakeClearanceMeters: 0.1016 },
    });
    const geometry = frameInfillGeometry(roofSystem);
    const roof = geometry.resolvedRoofSystem!;
    const segmentFrames = geometry.wallCmuLayout.segmentFrames ?? [];
    const frameById = new Map(segmentFrames.map((frame) => [frame.segmentId, frame]));
    for (const gableEnd of roof.gableEnds) {
      const frame = frameById.get(gableEnd.hostSegmentId);
      expect(frame).toBeDefined();
      for (const placement of gableEnd.cmuUnitPlacements) {
        const relX = placement.x - frame!.start.x - frame!.inwardNormal.x * (placement.depthMeters / 2);
        const relZ = placement.z - frame!.start.z - frame!.inwardNormal.z * (placement.depthMeters / 2);
        const centerStation = relX * frame!.tangent.x + relZ * frame!.tangent.z;
        const startStation = centerStation - placement.lengthMeters / 2;
        const endStation = centerStation + placement.lengthMeters / 2;
        const clearanceStart = roofClearanceElevationAtStation({
          resolvedRoof: roof,
          frame: frame!,
          stationMeters: startStation,
          panelStartStation: gableEnd.masonryCourses[0]?.startStationMeters ?? 0,
          panelEndStation: gableEnd.masonryCourses[0]?.endStationMeters ?? frame!.lengthMeters,
          rakeClearanceMeters: roofSystem.gable.rakeClearanceMeters,
        });
        const clearanceEnd = roofClearanceElevationAtStation({
          resolvedRoof: roof,
          frame: frame!,
          stationMeters: endStation,
          panelStartStation: gableEnd.masonryCourses[0]?.startStationMeters ?? 0,
          panelEndStation: gableEnd.masonryCourses[0]?.endStationMeters ?? frame!.lengthMeters,
          rakeClearanceMeters: roofSystem.gable.rakeClearanceMeters,
        });
        const allowedTop = Math.min(clearanceStart, clearanceEnd);
        const unitTop = placement.y + placement.heightMeters / 2;
        expect(unitTop).toBeLessThanOrEqual(allowedTop + GABLE_HEIGHT_TOLERANCE_METERS + 0.01);
      }
    }
  });

  it('gable masonry keeps individual CMU units with running-bond offsets', () => {
    const geometry = frameInfillGeometry(gableRoofSystem());
    const placements = geometry.resolvedRoofSystem?.gableEnds.flatMap((end) => end.cmuUnitPlacements) ?? [];
    expect(placements.length).toBeGreaterThan(2);
    const courseZero = placements.filter((placement) => placement.courseIndex === 0);
    const courseOne = placements.filter((placement) => placement.courseIndex === 1);
    expect(courseZero.length).toBeGreaterThan(0);
    expect(courseOne.length).toBeGreaterThan(0);
    expect(new Set(placements.map((placement) => placement.id)).size).toBe(placements.length);
  });

  it('gable courses use full units before half or cut units when possible', () => {
    const geometry = frameInfillGeometry(gableRoofSystem());
    const placements = geometry.resolvedRoofSystem?.gableEnds.flatMap((end) => end.cmuUnitPlacements) ?? [];
    const bottomCourse = placements.filter((placement) => placement.courseIndex === 0);
    expect(bottomCourse.some((placement) => placement.kind === 'stretcher')).toBe(true);
  });

  it('raked cap fills resolved stair-to-roof space and produces concrete volume', () => {
    const geometry = frameInfillGeometry(gableRoofSystem());
    const caps = geometry.rakedCapPlacements ?? [];
    expect(caps.length).toBeGreaterThan(0);
    expect(caps.every((cap) => cap.source === 'gable_raked_cap')).toBe(true);
    expect(caps.every((cap) => cap.concreteVolumeCubicMeters > 0)).toBe(true);
    expect(geometry.resolvedRoofSystem?.rakedCapVolumeCubicMeters ?? 0).toBeGreaterThan(0);
  });

  it('raked cap is separate from grout quantities', () => {
    const geometry = frameInfillGeometry(gableRoofSystem());
    const preview = buildFrameInfillEstimatePreview({
      designModelId: 'test-model',
      wallObjectId: 'wall',
      slabObjectId: 'slab',
      roofObjectId: 'roof',
      trussObjectId: 'truss',
      frameObjectId: 'frame',
      infillObjectId: 'infill',
      gableEndObjectId: 'gable',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      geometryResult: geometry,
    });
    const capLine = preview.find((line) => line.id === 'raked-concrete-cap');
    const groutLines = preview.filter((line) => line.description.toLowerCase().includes('grout'));
    expect(capLine).toBeDefined();
    expect(capLine?.quantityType).toBe('raked_concrete_cap_volume');
    expect(groutLines.every((line) => line.quantityType !== 'raked_concrete_cap_volume')).toBe(true);
  });

  it('roof and gable quantities are separate estimate lines', () => {
    const geometry = frameInfillGeometry(gableRoofSystem());
    const preview = buildFrameInfillEstimatePreview({
      designModelId: 'test-model',
      wallObjectId: 'wall',
      slabObjectId: 'slab',
      roofObjectId: 'roof',
      trussObjectId: 'truss',
      frameObjectId: 'frame',
      infillObjectId: 'infill',
      gableEndObjectId: 'gable',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      geometryResult: geometry,
    });
    expect(preview.some((line) => line.id === 'roof-surface-area')).toBe(true);
    expect(preview.some((line) => line.id === 'roof-framing-reference-length')).toBe(true);
    expect(preview.some((line) => line.id === 'gable-end-cmu')).toBe(true);
    expect(preview.some((line) => line.id === 'raked-concrete-cap')).toBe(true);
    expect(preview.some((line) => line.id === 'rc-roof-beams-volume')).toBe(true);
  });

  it('unsupported footprints show warning instead of invalid geometry', () => {
    const openLayout = {
      ...preset.wallLayout,
      isFootprintClosed: false,
    };
    const roof = resolveRoofSystem({
      layout: openLayout,
      wallExteriorFootprint: [],
      structuralBearingPerimeter: [],
      bearingSource: 'wall_exterior_fallback',
      roofSystem: createDefaultRoofSystemSettings(),
      roofBeamTopElevationMeters: 2.8,
    });
    expect(roof.supported).toBe(false);
    expect(roof.warnings.some((warning) => warning.message === UNSUPPORTED_ROOF_FOOTPRINT_MESSAGE)).toBe(true);
    expect(roof.roofTopPlanes.length).toBe(0);
  });
});
