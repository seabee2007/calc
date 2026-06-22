import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRoofSystemSettings, normalizeRoofSystemSettings } from '../domain/roofSystemDefaults';
import {
  UNSUPPORTED_ROOF_FOOTPRINT_MESSAGE,
  analyzeRectangularFootprint,
  footprintBounds,
  resolveOuterRoofBeamBearingLoop,
} from '../domain/roofFootprintSupport';
import { resolveRoofSystem } from '../domain/roofSystemResolver';
import {
  GABLE_HEIGHT_TOLERANCE_METERS,
  capTopYAtStation,
  roofClearanceElevationAtStation,
} from '../domain/roofGableSolver';
import { minimumRakedCapDepthMeters, totalRakedCapVolumeCubicMeters } from '../domain/rakedCapSolver';
import { serializePersistedDesignBuilderState, presetFromStoredDesign } from '../domain/designBuilderPersistence';
import { createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import { buildDesignGeometryInputFromLayout, generateDesignGeometry, getSegmentFramesForWallLayout } from '../geometry/designGeometry';
import { projectPointToSegmentStation } from '../domain/openingPlacementResolver';
import { buildFrameInfillEstimatePreview, cubicMetersToCubicYards } from '../quantity/designQuantityFormulas';
import { resolveEaveRunExtensionMeters, ridgeLengthMeters } from '../domain/roofOverhangSupport';

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
    const gableBlocks = geometry.blockInstances.filter((block) => block.source === 'gable_end_solver');
    expect(gableBlocks.length).toBeGreaterThan(0);
    expect(geometry.gablePlacements?.length ?? 0).toBe(0);
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
    const eaveY = Math.min(...eavePlane!.corners.map((corner) => corner.y));
    expect(eaveY).toBeLessThan(roof.roofBeamTopY);
    const eaveCorners = eavePlane!.corners.filter((corner) => Math.abs(corner.y - eaveY) < 0.001);
    expect(eaveCorners.length).toBeGreaterThanOrEqual(2);
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
    expect(withOverhang.rafterRunMeters).toBe(noOverhang.rafterRunMeters);
    expect(withOverhang.claddingRafterRunMeters - noOverhang.claddingRafterRunMeters).toBeCloseTo(0.5, 3);
    expect(withOverhang.roofPeakY).toBeCloseTo(noOverhang.roofPeakY, 6);
    expect(
      Math.atan2(withOverhang.rafterRiseMeters, withOverhang.structuralRafterRunMeters),
    ).toBeCloseTo(Math.atan2(noOverhang.rafterRiseMeters, noOverhang.structuralRafterRunMeters), 6);
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
      for (const block of gableEnd.cmuUnitPlacements) {
        const startStation = block.startAlongMeters ?? block.stationMeters ?? 0;
        const endStation = block.endAlongMeters ?? startStation + block.lengthMeters;
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
        const blockHeight = block.physicalHeightMeters ?? block.heightMeters ?? 0;
        const unitTop = block.y + blockHeight / 2;
        expect(unitTop).toBeLessThanOrEqual(allowedTop + GABLE_HEIGHT_TOLERANCE_METERS + 0.01);
      }
    }
  });

  it('gable masonry keeps individual CMU units with running-bond offsets', () => {
    const geometry = frameInfillGeometry(gableRoofSystem());
    const blocks = geometry.resolvedRoofSystem?.gableEnds.flatMap((end) => end.cmuUnitPlacements) ?? [];
    expect(blocks.length).toBeGreaterThan(2);
    const courseIndices = [...new Set(blocks.map((block) => block.courseIndex ?? 0))].sort((a, b) => a - b);
    const firstCourse = blocks.filter((block) => block.courseIndex === courseIndices[0]);
    const secondCourse = blocks.filter((block) => block.courseIndex === courseIndices[1]);
    expect(firstCourse.length).toBeGreaterThan(0);
    expect(secondCourse.length).toBeGreaterThan(0);
    expect(new Set(blocks.map((block) => block.id)).size).toBe(blocks.length);
  });

  it('gable courses use full units before half or cut units when possible', () => {
    const geometry = frameInfillGeometry(gableRoofSystem());
    const blocks = geometry.resolvedRoofSystem?.gableEnds.flatMap((end) => end.cmuUnitPlacements) ?? [];
    const lowestCourseIndex = Math.min(...blocks.map((block) => block.courseIndex ?? 0));
    const bottomCourse = blocks.filter((block) => block.courseIndex === lowestCourseIndex);
    expect(bottomCourse.some((block) => block.blockType === 'full')).toBe(true);
  });

  it('raked cap fills resolved stair-to-roof space and produces concrete volume', () => {
    const geometry = frameInfillGeometry(gableRoofSystem());
    const caps = geometry.rakedCapPlacements ?? [];
    expect(caps.length).toBeGreaterThan(0);
    expect(caps.every((cap) => cap.source === 'gable_raked_concrete_cap')).toBe(true);
    expect(caps.every((cap) => cap.concreteVolumeCubicMeters > 0)).toBe(true);
    expect(caps.some((cap) => cap.slope === 'left')).toBe(true);
    expect(caps.some((cap) => cap.slope === 'right')).toBe(true);
    expect(geometry.resolvedRoofSystem?.rakedCapVolumeCubicMeters ?? 0).toBeGreaterThan(0);
  });

  it('raked cap segments maintain minimum configured depth and positive volume', () => {
    const roofSystem = gableRoofSystem();
    const geometry = frameInfillGeometry(roofSystem);
    const caps = geometry.rakedCapPlacements ?? [];
    const minDepth = roofSystem.gable.rakeClearanceMeters;
    for (const cap of caps) {
      expect(cap.startTopY).toBeGreaterThan(cap.startBottomY);
      expect(cap.endTopY).toBeGreaterThan(cap.endBottomY);
      expect(cap.startTopY - cap.startBottomY).toBeGreaterThanOrEqual(minDepth - GABLE_HEIGHT_TOLERANCE_METERS);
      expect(cap.endTopY - cap.endBottomY).toBeGreaterThanOrEqual(minDepth - GABLE_HEIGHT_TOLERANCE_METERS);
    }
    expect(minimumRakedCapDepthMeters(caps)).toBeGreaterThanOrEqual(minDepth - GABLE_HEIGHT_TOLERANCE_METERS);
  });

  it('raked cap fills course voids below purlin bottom and above CMU tops', () => {
    const roofSystem = gableRoofSystem();
    const geometry = frameInfillGeometry(roofSystem);
    const roof = geometry.resolvedRoofSystem!;
    const frameById = new Map(
      (geometry.wallCmuLayout.segmentFrames ?? []).map((frame) => [frame.segmentId, frame]),
    );
    for (const cap of geometry.rakedCapPlacements ?? []) {
      const frame = frameById.get(cap.gableEndSegmentId)!;
      const hostPanel = geometry.infillSystem?.panels.find(
        (panel) => panel.hostSegmentId === cap.gableEndSegmentId,
      );
      expect(hostPanel).toBeDefined();
      const panelStart = hostPanel!.startStationMeters;
      const panelEnd = hostPanel!.endStationMeters;
      const expectedStartTop = capTopYAtStation({
        resolvedRoof: roof,
        roofSystem,
        frame,
        stationMeters: cap.startStationMeters,
        panelStartStation: panelStart,
        panelEndStation: panelEnd,
      });
      const expectedEndTop = capTopYAtStation({
        resolvedRoof: roof,
        roofSystem,
        frame,
        stationMeters: cap.endStationMeters,
        panelStartStation: panelStart,
        panelEndStation: panelEnd,
      });
      expect(cap.startTopY).toBeCloseTo(expectedStartTop, 3);
      expect(cap.endTopY).toBeCloseTo(expectedEndTop, 3);
      expect(cap.startBottomY).toBeLessThanOrEqual(cap.startTopY);
      expect(cap.endBottomY).toBeLessThanOrEqual(cap.endTopY);
      expect(cap.startTopY - cap.startBottomY).toBeGreaterThan(0);
    }
  });

  it('changing peak height recalculates gable CMU and cap geometry', () => {
    const low = frameInfillGeometry(
      gableRoofSystem({ peakHeightAboveRoofBeamMeters: 1.0 }),
    );
    const high = frameInfillGeometry(
      gableRoofSystem({ peakHeightAboveRoofBeamMeters: 2.0 }),
    );
    expect((high.rakedCapPlacements ?? []).length).toBeGreaterThan(0);
    expect(high.resolvedRoofSystem?.rakedCapVolumeCubicMeters ?? 0).toBeGreaterThan(
      low.resolvedRoofSystem?.rakedCapVolumeCubicMeters ?? 0,
    );
    expect(
      (high.resolvedRoofSystem?.gableEnds.flatMap((end) => end.cmuUnitPlacements) ?? []).length,
    ).toBeGreaterThan(
      (low.resolvedRoofSystem?.gableEnds.flatMap((end) => end.cmuUnitPlacements) ?? []).length,
    );
  });

  it('changing rake clearance recalculates masonry cutoff and cap volume', () => {
    const tight = frameInfillGeometry(
      gableRoofSystem({
        gable: { ...createDefaultRoofSystemSettings().gable, enabled: true, rakeClearanceMeters: 0.08, rakedConcreteCapEnabled: true },
      }),
    );
    const loose = frameInfillGeometry(
      gableRoofSystem({
        gable: { ...createDefaultRoofSystemSettings().gable, enabled: true, rakeClearanceMeters: 0.2, rakedConcreteCapEnabled: true },
      }),
    );
    expect(loose.resolvedRoofSystem?.rakedCapVolumeCubicMeters ?? 0).toBeGreaterThan(
      tight.resolvedRoofSystem?.rakedCapVolumeCubicMeters ?? 0,
    );
  });

  it('saving and reloading preserves gable cap settings', () => {
    const updated = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    updated.roofSystem = gableRoofSystem({ peakHeightAboveRoofBeamMeters: 1.6 });
    const serialized = serializePersistedDesignBuilderState(updated);
    const restored = presetFromStoredDesign({ objects: [], persistedState: serialized });
    expect(restored.roofSystem.gable.rakedConcreteCapEnabled).toBe(true);
    expect(restored.roofSystem.peakHeightAboveRoofBeamMeters).toBe(1.6);
    const geometry = frameInfillGeometry(restored.roofSystem);
    expect(geometry.rakedCapPlacements?.length ?? 0).toBeGreaterThan(0);
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

  it('raked cap estimate volume matches resolved segment geometry', () => {
    const geometry = frameInfillGeometry(gableRoofSystem());
    const segmentVolume = totalRakedCapVolumeCubicMeters(geometry.rakedCapPlacements ?? []);
    expect(geometry.resolvedRoofSystem?.rakedCapVolumeCubicMeters ?? 0).toBeCloseTo(segmentVolume, 6);
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
    expect(capLine).toBeDefined();
    expect(capLine?.designObjectId).toBe('gable');
    expect(capLine?.unit).toBe('CY');
    expect(capLine?.parameterSnapshot.rakedCapVolumeCubicMeters).toBeCloseTo(segmentVolume, 6);
    expect(capLine?.quantity).toBeCloseTo(cubicMetersToCubicYards(segmentVolume), 2);
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
    expect(preview.some((line) => line.id === 'cmu-blocks')).toBe(true);
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

describe('Gable-end / rake overhang', () => {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  const wallFootprint = [
    { x: -3, z: -2.5 },
    { x: 3, z: -2.5 },
    { x: 3, z: 2.5 },
    { x: -3, z: 2.5 },
  ];

  function gableRoofWithOverhang(gableEndOverhangMeters: number) {
    return resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        ridgeDirection: 'along_longest_axis',
        eaveOverhangMeters: 0.3,
        gableEndOverhangMeters,
      }),
      wallFootprint,
    );
  }

  function purlinPlanLength(purlin: { start: { x: number; z: number }; end: { x: number; z: number } }): number {
    return Math.hypot(purlin.end.x - purlin.start.x, purlin.end.z - purlin.start.z);
  }

  function ridgeRowPurlinLength(roof: ReturnType<typeof gableRoofWithOverhang>) {
    const ridgeRow = roof.purlinRowsPerSlope - 1;
    const purlin = roof.purlinPlacements.find((entry) => entry.rowIndex === ridgeRow);
    expect(purlin).toBeDefined();
    return purlinPlanLength(purlin!);
  }

  it('zero gable-end overhang ends purlins at structural gable faces', () => {
    const roof = gableRoofWithOverhang(0);
    expect(roof.structuralRidgeLengthMeters).toBeCloseTo(roof.claddingRidgeLengthMeters, 3);
    expect(ridgeRowPurlinLength(roof)).toBeCloseTo(roof.structuralRidgeLengthMeters, 2);
  });

  it('positive gable-end overhang extends cladding ridge equally beyond both structural gable ends', () => {
    const overhang = 0.6;
    const roof = gableRoofWithOverhang(overhang);
    const tailStart = Math.hypot(
      roof.claddingRidgeStart!.x - roof.structuralRidgeStart!.x,
      roof.claddingRidgeStart!.z - roof.structuralRidgeStart!.z,
    );
    const tailEnd = Math.hypot(
      roof.claddingRidgeEnd!.x - roof.structuralRidgeEnd!.x,
      roof.claddingRidgeEnd!.z - roof.structuralRidgeEnd!.z,
    );
    expect(tailStart).toBeCloseTo(overhang, 3);
    expect(tailEnd).toBeCloseTo(overhang, 3);
    expect(roof.claddingRidgeLengthMeters).toBeCloseTo(roof.structuralRidgeLengthMeters + overhang * 2, 3);
  });

  it('purlins span the complete cladding length', () => {
    const roof = gableRoofWithOverhang(0.6);
    const ridgeRow = roof.purlinRowsPerSlope - 1;
    for (const purlin of roof.purlinPlacements.filter((entry) => entry.rowIndex === ridgeRow)) {
      expect(purlinPlanLength(purlin)).toBeCloseTo(roof.claddingRidgeLengthMeters, 2);
    }
  });

  it('roof sheets span the complete cladding length', () => {
    const roof = gableRoofWithOverhang(0.6);
    const peakY = roof.roofPeakY;
    const ridgeCorners = roof.roofTopPlanes.flatMap((plane) =>
      plane.corners.filter((corner) => Math.abs(corner.y - peakY) < 0.001),
    );
    expect(ridgeCorners.length).toBeGreaterThan(0);
    for (const corner of ridgeCorners) {
      const nearCladdingStart =
        Math.hypot(corner.x - roof.claddingRidgeStart!.x, corner.z - roof.claddingRidgeStart!.z) < 0.01;
      const nearCladdingEnd =
        Math.hypot(corner.x - roof.claddingRidgeEnd!.x, corner.z - roof.claddingRidgeEnd!.z) < 0.01;
      expect(nearCladdingStart || nearCladdingEnd).toBe(true);
    }
    expect(ridgeLengthMeters(ridgeCorners[0]!, ridgeCorners[1] ?? ridgeCorners[0]!)).toBeGreaterThan(0);
  });

  it('gable CMU stops at structural gable faces', () => {
    const geometry = frameInfillGeometry(
      gableRoofSystem({ gableEndOverhangMeters: 0.6, ridgeDirection: 'along_longest_axis' }),
    );
    const roof = geometry.resolvedRoofSystem!;
    const segmentFrames = geometry.wallCmuLayout.segmentFrames ?? [];
    for (const block of geometry.blockInstances.filter((entry) => entry.source === 'gable_end_solver')) {
      const panel = geometry.infillSystem?.panels.find((entry) => entry.hostSegmentId === block.segmentId);
      const frame = segmentFrames.find((entry) => entry.segmentId === panel?.hostSegmentId);
      if (!panel || !frame) continue;
      const station = projectPointToSegmentStation({ x: block.x, z: block.z }, frame);
      expect(station).toBeGreaterThanOrEqual(panel.startStationMeters - 0.01);
      expect(station).toBeLessThanOrEqual(panel.endStationMeters + 0.01);
    }
    expect(roof.gableEndOverhangMeters).toBe(0.6);
  });

  it('raked concrete cap stops at structural gable faces', () => {
    const geometry = frameInfillGeometry(
      gableRoofSystem({ gableEndOverhangMeters: 0.6, ridgeDirection: 'along_longest_axis' }),
    );
    for (const cap of geometry.rakedCapPlacements ?? []) {
      const hostPanel = preset.infillSystem.panels.find((entry) => entry.hostSegmentId === cap.gableEndSegmentId);
      if (!hostPanel) continue;
      expect(cap.startStationMeters).toBeGreaterThanOrEqual(hostPanel.startStationMeters - 0.01);
      expect(cap.endStationMeters).toBeLessThanOrEqual(hostPanel.endStationMeters + 0.01);
    }
  });

  it('ridge cap remains a thin folded cover above roof sheets', () => {
    const roof = gableRoofWithOverhang(0.45);
    expect(roof.ridgeCapPlacement).toBeDefined();
    expect(roof.ridgeCapPlacement!.start.y).toBeCloseTo(roof.ridgeCapPlacement!.end.y, 3);
    expect(roof.ridgeCapPlacement!.thicknessMeters).toBeLessThan(0.05);
  });

  it('does not add truss stations in gable-end overhang zones', () => {
    const roof = gableRoofWithOverhang(0.6);
    const structuralLength = roof.structuralRidgeLengthMeters;
    for (const truss of roof.trussPlacements) {
      expect(truss.stationMeters).toBeGreaterThanOrEqual(-0.01);
      expect(truss.stationMeters).toBeLessThanOrEqual(structuralLength + 0.01);
    }
    const verticalWebs = roof.trussPlacements.flatMap((truss) =>
      truss.members.filter((member) => member.memberKind === 'vertical_web'),
    );
    expect(verticalWebs.length).toBeGreaterThan(0);
    for (const member of verticalWebs) {
      expect(Math.abs(member.start.x - member.end.x)).toBeLessThan(0.05);
      expect(Math.abs(member.start.z - member.end.z)).toBeLessThan(0.05);
    }
  });

  it('rotated ridge direction resolves the same overhang behavior', () => {
    const alongLongest = gableRoofWithOverhang(0.5);
    const alongShortest = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        ridgeDirection: 'along_shortest_axis',
        gableEndOverhangMeters: 0.5,
      }),
      wallFootprint,
    );
    expect(alongShortest.claddingRidgeLengthMeters - alongShortest.structuralRidgeLengthMeters).toBeCloseTo(1, 3);
    expect(alongLongest.claddingRidgeLengthMeters - alongLongest.structuralRidgeLengthMeters).toBeCloseTo(1, 3);
    expect(alongShortest.purlinPlacements[0]).toBeDefined();
    expect(ridgeRowPurlinLength(alongShortest)).toBeCloseTo(alongShortest.claddingRidgeLengthMeters, 2);
  });

  it('saving and reloading preserves gable-end overhang settings', () => {
    const updated = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    updated.roofSystem = gableRoofSystem({
      gableEndOverhangMeters: 0.55,
    });
    const serialized = serializePersistedDesignBuilderState(updated);
    const restored = presetFromStoredDesign({ objects: [], persistedState: serialized });
    expect(restored.roofSystem.gableEndOverhangMeters).toBe(0.55);
  });

  it('migrates missing gable-end overhang from eave overhang', () => {
    const legacy = normalizeRoofSystemSettings({
      eaveOverhangMeters: 0.42,
    });
    expect(legacy.gableEndOverhangMeters).toBe(0.42);
  });
});
