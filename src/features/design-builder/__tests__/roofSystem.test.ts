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
import { syncPresetFromLayout } from '../domain/layoutWallAdapter';
import { createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import { buildDesignGeometryInputFromLayout, generateDesignGeometry, getSegmentFramesForWallLayout } from '../geometry/designGeometry';
import { projectPointToSegmentStation } from '../domain/openingPlacementResolver';
import { buildFrameInfillEstimatePreview, cubicMetersToCubicYards, metersToFeet, squareMetersToSquareFeet } from '../quantity/designQuantityFormulas';
import { ridgeLengthMeters } from '../domain/roofOverhangSupport';
import {
  PURLIN_PROFILE_DEPTH_METERS,
  PURLIN_PROFILE_WIDTH_METERS,
  PURLIN_TO_CHORD_CLEARANCE_METERS,
  PURLIN_TO_SHEET_CLEARANCE_METERS,
  ROOF_SHEET_EAVE_OVERHANG_METERS,
  TRUSS_CHORD_PROFILE_METERS,
} from '../domain/roofFramingResolver';
import { totalRoofFasciaLengthMeters } from '../domain/roofFasciaSolver';
import { totalRoofSoffitAreaSquareMeters } from '../domain/roofSoffitSolver';
import type { ResolvedRoofSystem, RoofPlane, RoofSystemSettings, RoofVec3 } from '../types';

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

function resolveRectangularRoof(
  lengthMeters: number,
  widthMeters: number,
  roofSystem: RoofSystemSettings,
): ResolvedRoofSystem {
  const layout = createOutsideFaceRectangleLayout({
    lengthMeters,
    widthMeters,
    wallHeightMeters: 2.8,
    wallThicknessMeters: 0.2,
  });
  const perimeter = [
    { x: -lengthMeters / 2, z: -widthMeters / 2 },
    { x: lengthMeters / 2, z: -widthMeters / 2 },
    { x: lengthMeters / 2, z: widthMeters / 2 },
    { x: -lengthMeters / 2, z: widthMeters / 2 },
  ];
  return resolveRoofSystem({
    layout,
    wallExteriorFootprint: perimeter,
    structuralBearingPerimeter: perimeter,
    bearingSource: 'wall_exterior_fallback',
    roofSystem,
    roofBeamTopElevationMeters: 2.8,
  });
}

function splitLongRectangleLayout(lengthMeters: number, widthMeters: number): import('../types').DesignWallLayoutParameters {
  const halfLength = lengthMeters / 2;
  const halfWidth = widthMeters / 2;
  return {
    kind: 'wall_layout',
    id: 'split-long-rectangle',
    label: 'Split long rectangle',
    dimensionBasis: 'outside_face',
    gridSpacingMeters: 0.1,
    defaultWallHeightMeters: 2.8,
    defaultWallThicknessMeters: 0.2,
    snapToGrid: false,
    snapToModule: false,
    orthogonalLock: true,
    cornerOverrides: [],
    activeNodeId: null,
    selectedSegmentId: null,
    isFootprintClosed: true,
    nodes: [
      { id: 'sw', x: -halfLength, z: -halfWidth },
      { id: 's-mid', x: 0, z: -halfWidth },
      { id: 'se', x: halfLength, z: -halfWidth },
      { id: 'ne', x: halfLength, z: halfWidth },
      { id: 'n-mid', x: 0, z: halfWidth },
      { id: 'nw', x: -halfLength, z: halfWidth },
    ],
    segments: [
      { id: 'south-a', startNodeId: 'sw', endNodeId: 's-mid', wallThicknessMeters: 0.2, wallHeightMeters: 2.8 },
      { id: 'south-b', startNodeId: 's-mid', endNodeId: 'se', wallThicknessMeters: 0.2, wallHeightMeters: 2.8 },
      { id: 'east', startNodeId: 'se', endNodeId: 'ne', wallThicknessMeters: 0.2, wallHeightMeters: 2.8 },
      { id: 'north-a', startNodeId: 'ne', endNodeId: 'n-mid', wallThicknessMeters: 0.2, wallHeightMeters: 2.8 },
      { id: 'north-b', startNodeId: 'n-mid', endNodeId: 'nw', wallThicknessMeters: 0.2, wallHeightMeters: 2.8 },
      { id: 'west', startNodeId: 'nw', endNodeId: 'sw', wallThicknessMeters: 0.2, wallHeightMeters: 2.8 },
    ],
  };
}

function roofPlaneArea(plane: RoofPlane): number {
  const [a, b, c, d] = plane.corners;
  const triangle = (p0: RoofVec3, p1: RoofVec3, p2: RoofVec3) => {
    const ab = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
    const ac = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };
    return Math.hypot(
      ab.y * ac.z - ab.z * ac.y,
      ab.z * ac.x - ab.x * ac.z,
      ab.x * ac.y - ab.y * ac.x,
    ) / 2;
  };
  return d ? triangle(a!, b!, c!) + triangle(a!, c!, d) : triangle(a!, b!, c!);
}

function pointMatches(a: RoofVec3, b: RoofVec3): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.001;
}

function expectPointClose(actual: RoofVec3, expected: RoofVec3, precision = 3) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

function distanceFromPlane(point: RoofVec3, plane: RoofPlane): number {
  const anchor = plane.corners[0]!;
  return Math.abs(
    plane.normal.x * (point.x - anchor.x) +
      plane.normal.y * (point.y - anchor.y) +
      plane.normal.z * (point.z - anchor.z),
  );
}

function pointInTrianglePlan(
  point: Pick<RoofVec3, 'x' | 'z'>,
  a: Pick<RoofVec3, 'x' | 'z'>,
  b: Pick<RoofVec3, 'x' | 'z'>,
  c: Pick<RoofVec3, 'x' | 'z'>,
): boolean {
  const sign = (p1: Pick<RoofVec3, 'x' | 'z'>, p2: Pick<RoofVec3, 'x' | 'z'>, p3: Pick<RoofVec3, 'x' | 'z'>) =>
    (p1.x - p3.x) * (p2.z - p3.z) - (p2.x - p3.x) * (p1.z - p3.z);
  const d1 = sign(point, a, b);
  const d2 = sign(point, b, c);
  const d3 = sign(point, c, a);
  const hasNegative = d1 < -0.001 || d2 < -0.001 || d3 < -0.001;
  const hasPositive = d1 > 0.001 || d2 > 0.001 || d3 > 0.001;
  return !(hasNegative && hasPositive);
}

function pointInPlanePlan(point: Pick<RoofVec3, 'x' | 'z'>, plane: RoofPlane): boolean {
  const [a, b, c, d] = plane.corners;
  if (d) {
    return pointInTrianglePlan(point, a!, b!, c!) || pointInTrianglePlan(point, a!, c!, d);
  }
  return pointInTrianglePlan(point, a!, b!, c!);
}

function planCentroid(plane: RoofPlane): Pick<RoofVec3, 'x' | 'z'> {
  return {
    x: plane.corners.reduce((sum, corner) => sum + corner.x, 0) / plane.corners.length,
    z: plane.corners.reduce((sum, corner) => sum + corner.z, 0) / plane.corners.length,
  };
}

describe('Roof system — hip, gable, raked cap', () => {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());

  it('defaults rake clearance to 0.1016 m (4 in)', () => {
    expect(createDefaultRoofSystemSettings().gable.rakeClearanceMeters).toBe(0.1016);
  });

  it('defaults fascia trim off with a one-inch frame drop', () => {
    const defaults = createDefaultRoofSystemSettings();
    expect(defaults.fascia.enabled).toBe(false);
    expect(defaults.soffit.enabled).toBe(true);
    expect(defaults.fascia.bottomExtensionBelowFrameMeters).toBeCloseTo(0.0254, 6);
    const normalized = normalizeRoofSystemSettings({
      fascia: {
        ...defaults.fascia,
        enabled: true,
        bottomExtensionBelowFrameMeters: -0.2,
      },
    });
    expect(normalized.fascia.enabled).toBe(true);
    expect(normalized.fascia.bottomExtensionBelowFrameMeters).toBe(0);
    expect(normalized.soffit.enabled).toBe(true);
  });

  it('resolves boxed soffit panels around gable overhangs by default', () => {
    const geometry = frameInfillGeometry(gableRoofSystem());
    const roof = geometry.resolvedRoofSystem!;
    expect(roof.soffitPlacements.length).toBeGreaterThanOrEqual(4);
    const sideEaves = roof.soffitPlacements.filter((placement) => placement.edgeRole === 'side_eave');
    const gableReturns = roof.soffitPlacements.filter((placement) => placement.edgeRole === 'gable_return');
    expect(sideEaves.length).toBeGreaterThan(0);
    expect(gableReturns.length).toBeGreaterThan(0);
    for (const placement of roof.soffitPlacements) {
      expect(placement.areaSquareMeters).toBeGreaterThan(0);
    }
    for (const placement of sideEaves) {
      expect(placement.innerStart.y).toBeCloseTo(placement.innerEnd.y, 3);
      expect(placement.outerStart.y).toBeCloseTo(placement.outerEnd.y, 3);
      expect(Math.abs(placement.innerStart.y - placement.outerStart.y)).toBeGreaterThan(0.02);
    }
    expect(
      gableReturns.some((placement) => {
        const elevations = [
          placement.innerStart.y,
          placement.innerEnd.y,
          placement.outerEnd.y,
          placement.outerStart.y,
        ];
        return Math.max(...elevations) - Math.min(...elevations) > 0.05;
      }),
    ).toBe(true);
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

  it('resolves boxed soffit panels around hip eaves', () => {
    const geometry = frameInfillGeometry({
      ...createDefaultRoofSystemSettings(),
      roofType: 'hip',
    });
    const roof = geometry.resolvedRoofSystem!;
    expect(roof.soffitPlacements.length).toBeGreaterThanOrEqual(4);
    expect(roof.soffitPlacements.every((placement) => placement.edgeRole === 'hip_eave')).toBe(true);
    expect(totalRoofSoffitAreaSquareMeters(roof.soffitPlacements)).toBeGreaterThan(0);
  });

  it('rectangular hip roof creates a centered long-axis ridge and four valid planes', () => {
    const roof = resolveRectangularRoof(10, 6, {
      ...createDefaultRoofSystemSettings(),
      roofType: 'hip',
      ridgeDirection: 'along_shortest_axis',
      eaveOverhangMeters: 0,
      peakHeightAboveRoofBeamMeters: 1.5,
    });

    expect(roof.supported).toBe(true);
    expect(roof.roofTopPlanes).toHaveLength(4);
    expect(roof.roofTopPlanes.filter((plane) => plane.corners.length === 4)).toHaveLength(2);
    expect(roof.roofTopPlanes.filter((plane) => plane.corners.length === 3)).toHaveLength(2);
    expect(roof.ridgeStart).toBeDefined();
    expect(roof.ridgeEnd).toBeDefined();
    expect(roof.ridgeStart!.z).toBeCloseTo(0, 3);
    expect(roof.ridgeEnd!.z).toBeCloseTo(0, 3);
    expect(Math.abs(roof.ridgeEnd!.x - roof.ridgeStart!.x)).toBeCloseTo(4, 3);
    expect(roof.claddingRidgeLengthMeters).toBeCloseTo(4, 3);
    expect(roof.ridgeLengthMeters).toBeCloseTo(4, 3);
    expect(roof.ridgeStart!.x).toBeCloseTo(-2, 3);
    expect(roof.ridgeEnd!.x).toBeCloseTo(2, 3);
    expect(roof.ridgeStart!.x - -5).toBeCloseTo(3, 3);
    expect(5 - roof.ridgeEnd!.x).toBeCloseTo(3, 3);
    expect(roof.structuralRidgeStart).toEqual(roof.claddingRidgeStart);
    expect(roof.structuralRidgeEnd).toEqual(roof.claddingRidgeEnd);
    expect(roof.roofSurfaceAreaSquareMeters).toBeCloseTo(10 * 6 * Math.sqrt(1 + 0.5 ** 2), 3);

    for (const plane of roof.roofTopPlanes) {
      expect(plane.normal.y).toBeGreaterThan(0);
      expect(roofPlaneArea(plane)).toBeGreaterThan(0.001);
      for (const corner of plane.corners) {
        expect(distanceFromPlane(corner, plane)).toBeLessThanOrEqual(0.001);
      }
    }

    for (const plane of roof.roofTopPlanes) {
      const centroid = planCentroid(plane);
      const containingPlanes = roof.roofTopPlanes.filter((candidate) => pointInPlanePlan(centroid, candidate));
      expect(containingPlanes.map((candidate) => candidate.id)).toEqual([plane.id]);
    }

    const ridgeEnds = [roof.ridgeStart!, roof.ridgeEnd!];
    for (const corner of roof.claddingPerimeter) {
      const eaveCorner = { ...corner, y: roof.roofBeamTopY };
      const eaveMembershipCount = roof.roofTopPlanes.filter((plane) =>
        plane.corners.some((planeCorner) => pointMatches(planeCorner, eaveCorner)),
      ).length;
      expect(eaveMembershipCount).toBe(2);
      const nearestRidgeEnd =
        Math.hypot(corner.x - ridgeEnds[0].x, corner.z - ridgeEnds[0].z) <
        Math.hypot(corner.x - ridgeEnds[1].x, corner.z - ridgeEnds[1].z)
          ? ridgeEnds[0]
          : ridgeEnds[1];
      expect(
        roof.roofTopPlanes.some(
          (plane) =>
            plane.corners.some((planeCorner) => pointMatches(planeCorner, eaveCorner)) &&
            plane.corners.some((planeCorner) => pointMatches(planeCorner, nearestRidgeEnd)),
        ),
      ).toBe(true);
    }
    for (const ridgeEnd of ridgeEnds) {
      const ridgeMembershipCount = roof.roofTopPlanes.filter((plane) =>
        plane.corners.some((planeCorner) => pointMatches(planeCorner, ridgeEnd)),
      ).length;
      expect(ridgeMembershipCount).toBe(3);
    }
  });

  it('supports long rectangular footprints split into collinear wall segments', () => {
    const layout = splitLongRectangleLayout(18, 6);
    const footprint = [
      { x: -9, z: -3 },
      { x: 0, z: -3 },
      { x: 9, z: -3 },
      { x: 9, z: 3 },
      { x: 0, z: 3 },
      { x: -9, z: 3 },
    ];
    const analysis = analyzeRectangularFootprint({ layout, exteriorFootprint: footprint });

    expect(analysis.supported).toBe(true);
    expect(analysis.bearingCorners).toHaveLength(4);
    expect(analysis.lengthMeters).toBeCloseTo(18, 6);
    expect(analysis.widthMeters).toBeCloseTo(6, 6);
    expect(analysis.localXSegmentIds).toEqual(['south-a', 'south-b', 'north-a', 'north-b']);
    expect(analysis.localZSegmentIds).toEqual(['east', 'west']);
  });

  it('resolves gable and hip roofs on split long rectangular footprints', () => {
    const layout = splitLongRectangleLayout(18, 6);
    const footprint = [
      { x: -9, z: -3 },
      { x: 0, z: -3 },
      { x: 9, z: -3 },
      { x: 9, z: 3 },
      { x: 0, z: 3 },
      { x: -9, z: 3 },
    ];
    const base = {
      layout,
      wallExteriorFootprint: footprint,
      structuralBearingPerimeter: footprint,
      bearingSource: 'wall_exterior_fallback' as const,
      roofBeamTopElevationMeters: 2.8,
    };

    const gable = resolveRoofSystem({
      ...base,
      roofSystem: { ...createDefaultRoofSystemSettings(), roofType: 'gable', eaveOverhangMeters: 0 },
    });
    const hip = resolveRoofSystem({
      ...base,
      roofSystem: { ...createDefaultRoofSystemSettings(), roofType: 'hip', eaveOverhangMeters: 0 },
    });

    expect(gable.supported).toBe(true);
    expect(gable.roofTopPlanes).toHaveLength(2);
    expect(gable.gableEndSegmentIds).toEqual(['east', 'west']);
    expect(hip.supported).toBe(true);
    expect(hip.roofTopPlanes).toHaveLength(4);
    expect(hip.claddingRidgeStart?.x).toBeCloseTo(-6, 6);
    expect(hip.claddingRidgeEnd?.x).toBeCloseTo(6, 6);
  });

  it('generates steel trusses across the full length of buildings longer than 10m', () => {
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 16,
      widthMeters: 5,
      wallHeightMeters: 2.8,
      wallThicknessMeters: 0.2,
    });
    const roof = frameInfillGeometry(gableRoofSystem(), layout).resolvedRoofSystem!;

    expect(roof.supported).toBe(true);
    expect(roof.structuralRidgeLengthMeters).toBeGreaterThan(15);
    expect(roof.trussPlacements.length).toBeGreaterThan(6);
    expect(roof.trussStations.at(-1)).toBeGreaterThan(15);
    expect(roof.trussPlacements.at(-1)?.stationMeters).toBeCloseTo(roof.trussStations.at(-1)!, 6);
  });

  it('reconciles existing auto-frame columns to resized wall nodes before resolving roof trusses', () => {
    const originalLayout = createOutsideFaceRectangleLayout({
      lengthMeters: 10,
      widthMeters: 5,
      wallHeightMeters: 2.8,
      wallThicknessMeters: 0.2,
    });
    const basePreset = syncPresetFromLayout(
      { ...createFiveBySixCmuBuildingPreset(), wallLayout: originalLayout },
      originalLayout,
    );
    const framedPreset = applyAutoFrameLayout(basePreset);
    const resizedLayout = createOutsideFaceRectangleLayout({
      lengthMeters: 16,
      widthMeters: 5,
      wallHeightMeters: 2.8,
      wallThicknessMeters: 0.2,
    });
    const resizedPreset = syncPresetFromLayout(
      { ...framedPreset, wallLayout: resizedLayout },
      resizedLayout,
    );

    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: resizedPreset.wallLayout,
        cmuSettings: resizedPreset.wall,
        slabSettings: resizedPreset.slab,
        roofSettings: resizedPreset.roof,
        trussSettings: resizedPreset.truss,
        buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
        frameSystem: resizedPreset.frameSystem,
        foundationSettings: resizedPreset.foundationSettings,
        infillSystem: resizedPreset.infillSystem,
        gableEndSystem: resizedPreset.gableEndSystem,
        roofSystem: gableRoofSystem(),
      }),
    );
    const roof = geometry.resolvedRoofSystem!;

    expect(roof.supported).toBe(true);
    expect(roof.roofBearingSource).toBe('roof_beam_outer_faces');
    expect(roof.structuralRidgeLengthMeters).toBeGreaterThan(15);
    expect(roof.trussStations.at(-1)).toBeGreaterThan(15);
  });

  it('keeps gable CMU closed after resizing a framed building beyond 10m', () => {
    const originalLayout = createOutsideFaceRectangleLayout({
      lengthMeters: 10,
      widthMeters: 5,
      wallHeightMeters: 2.8,
      wallThicknessMeters: 0.2,
    });
    const basePreset = syncPresetFromLayout(
      { ...createFiveBySixCmuBuildingPreset(), wallLayout: originalLayout },
      originalLayout,
    );
    const framedPreset = applyAutoFrameLayout(basePreset);
    const resizedLayout = createOutsideFaceRectangleLayout({
      lengthMeters: 16,
      widthMeters: 5,
      wallHeightMeters: 2.8,
      wallThicknessMeters: 0.2,
    });
    const resizedPreset = syncPresetFromLayout(
      { ...framedPreset, wallLayout: resizedLayout },
      resizedLayout,
    );

    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: resizedPreset.wallLayout,
        cmuSettings: resizedPreset.wall,
        slabSettings: resizedPreset.slab,
        roofSettings: resizedPreset.roof,
        trussSettings: resizedPreset.truss,
        buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
        frameSystem: resizedPreset.frameSystem,
        foundationSettings: resizedPreset.foundationSettings,
        infillSystem: resizedPreset.infillSystem,
        gableEndSystem: resizedPreset.gableEndSystem,
        roofSystem: gableRoofSystem(),
      }),
    );

    const roof = geometry.resolvedRoofSystem!;
    const gableBlocks = geometry.blockInstances.filter((block) => block.source === 'gable_end_solver');
    const firstGableBottom = Math.min(
      ...gableBlocks.map((block) => {
        const height = block.physicalHeightMeters ?? block.heightMeters ?? 0;
        return block.y - height / 2;
      }),
    );
    const firstGablePanel = geometry.infillSystem?.panels.find(
      (panel) =>
        panel.hostSegmentId === roof.gableEndSegmentIds[0] &&
        panel.infillZone === 'above_grade',
    );
    const firstRoofBeam = geometry.frameSystem?.beams.find(
      (beam) =>
        beam.kind === 'roof_beam' &&
        beam.hostSegmentId === roof.gableEndSegmentIds[0],
    );

    expect(roof.supported).toBe(true);
    expect(roof.roofBearingSource).toBe('roof_beam_outer_faces');
    expect(roof.trussStations.at(-1)).toBeGreaterThan(15);
    expect(roof.gableEndSegmentIds).toHaveLength(2);
    expect(roof.gableEnds).toHaveLength(2);
    expect(gableBlocks.length).toBeGreaterThan(0);
    expect(firstGablePanel).toBeDefined();
    expect(firstRoofBeam).toBeDefined();
    expect(firstGableBottom).toBeGreaterThanOrEqual(firstGablePanel!.topElevationMeters - 0.01);
    expect(firstGableBottom).toBeLessThan(firstGablePanel!.topElevationMeters + 0.05);
    expect(firstGableBottom).toBeLessThan(firstRoofBeam!.topElevationMeters);
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

  it('square hip roof creates four triangles and a centered apex with no ridge', () => {
    const roof = resolveRectangularRoof(6, 6, {
      ...createDefaultRoofSystemSettings(),
      roofType: 'hip',
      eaveOverhangMeters: 0,
      peakHeightAboveRoofBeamMeters: 1.5,
    });

    expect(roof.roofTopPlanes).toHaveLength(4);
    expect(roof.roofTopPlanes.every((plane) => plane.corners.length === 3)).toBe(true);
    expect(roof.peakPoint).toEqual(expect.objectContaining({ x: 0, z: 0 }));
    expect(roof.ridgeStart).toBeUndefined();
    expect(roof.ridgeEnd).toBeUndefined();
    expect(roof.ridgeLengthMeters).toBe(0);
    expect(roof.gableEndSegmentIds).toHaveLength(0);
    for (const corner of roof.claddingPerimeter) {
      const eaveCorner = { ...corner, y: roof.roofBeamTopY };
      expect(
        roof.roofTopPlanes.some(
          (plane) =>
            plane.corners.some((planeCorner) => pointMatches(planeCorner, eaveCorner)) &&
            plane.corners.some((planeCorner) => pointMatches(planeCorner, roof.peakPoint!)),
        ),
      ).toBe(true);
    }
  });

  it('hip eave overhang lowers cladding eaves without moving structural bearing or peak', () => {
    const noOverhang = resolveRectangularRoof(10, 6, {
      ...createDefaultRoofSystemSettings(),
      roofType: 'hip',
      eaveOverhangMeters: 0,
      peakHeightAboveRoofBeamMeters: 1.5,
    });
    const withOverhang = resolveRectangularRoof(10, 6, {
      ...createDefaultRoofSystemSettings(),
      roofType: 'hip',
      eaveOverhangMeters: 0.3,
      peakHeightAboveRoofBeamMeters: 1.5,
    });

    const noOverhangEaveY = Math.min(...noOverhang.roofTopPlanes.flatMap((plane) => plane.corners.map((corner) => corner.y)));
    const overhangEaveY = Math.min(...withOverhang.roofTopPlanes.flatMap((plane) => plane.corners.map((corner) => corner.y)));
    expect(overhangEaveY).toBeLessThan(noOverhangEaveY);
    expect(noOverhangEaveY - overhangEaveY).toBeCloseTo(0.5 * 0.3, 3);
    expect(withOverhang.roofBeamTopY).toBeCloseTo(noOverhang.roofBeamTopY, 6);
    expect(withOverhang.roofPeakY).toBeCloseTo(noOverhang.roofPeakY, 6);
    expect(withOverhang.structuralRidgeStart).toEqual(noOverhang.structuralRidgeStart);
    expect(withOverhang.structuralRidgeEnd).toEqual(noOverhang.structuralRidgeEnd);
    expectPointClose(withOverhang.claddingRidgeStart!, withOverhang.structuralRidgeStart!, 3);
    expectPointClose(withOverhang.claddingRidgeEnd!, withOverhang.structuralRidgeEnd!, 3);
    expect(withOverhang.ridgeLengthMeters).toBeCloseTo(4, 3);
    expect(withOverhang.roofTopPlanes).toHaveLength(4);
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

  it('adds fascia trim as a separate roof linear quantity when enabled', () => {
    const roofSystem = gableRoofSystem({
      fascia: { ...createDefaultRoofSystemSettings().fascia, enabled: true },
    });
    const geometry = frameInfillGeometry(roofSystem);
    const fasciaMeters = totalRoofFasciaLengthMeters(geometry.resolvedRoofSystem?.fasciaPlacements ?? []);
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
      roofSystem,
    });
    const fasciaLine = preview.find((line) => line.id === 'fascia-trim');
    expect(fasciaLine).toBeDefined();
    expect(fasciaLine?.quantityType).toBe('roof_fascia_trim_length');
    expect(fasciaLine?.unit).toBe('LF');
    expect(fasciaLine?.quantity).toBeCloseTo(metersToFeet(fasciaMeters), 2);
    expect(fasciaLine?.parameterSnapshot.fasciaLinearMeters).toBeCloseTo(fasciaMeters, 6);
  });

  it('adds soffit panels as a separate roof area quantity when enabled', () => {
    const roofSystem = gableRoofSystem();
    const geometry = frameInfillGeometry(roofSystem);
    const soffitSquareMeters = totalRoofSoffitAreaSquareMeters(geometry.resolvedRoofSystem?.soffitPlacements ?? []);
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
      roofSystem,
    });
    const soffitLine = preview.find((line) => line.id === 'roof-soffit-panels');
    expect(soffitLine).toBeDefined();
    expect(soffitLine?.quantityType).toBe('roof_soffit_panel_area');
    expect(soffitLine?.unit).toBe('SF');
    expect(soffitLine?.quantity).toBeCloseTo(squareMetersToSquareFeet(soffitSquareMeters), 2);
    expect(soffitLine?.parameterSnapshot.soffitAreaSquareMeters).toBeCloseTo(soffitSquareMeters, 6);
  });

  it('omits soffit panel quantity when soffit is disabled', () => {
    const roofSystem = gableRoofSystem({
      soffit: { ...createDefaultRoofSystemSettings().soffit, enabled: false },
    });
    const geometry = frameInfillGeometry(roofSystem);
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
      roofSystem,
    });
    expect(geometry.resolvedRoofSystem?.soffitPlacements).toHaveLength(0);
    expect(preview.some((line) => line.id === 'roof-soffit-panels')).toBe(false);
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

  it('gable side-eave fascia sits plumb on the outside face of the eave purlin', () => {
    const roofSystem = gableRoofSystem({
      ridgeDirection: 'along_longest_axis',
      eaveOverhangMeters: 0.3,
      gableEndOverhangMeters: 0.6,
      fascia: { ...createDefaultRoofSystemSettings().fascia, enabled: true },
    });
    const roof = resolveRoofFromPreset(preset, roofSystem, wallFootprint);
    const supportMaxX = Math.max(...roof.claddingPerimeter.map((point) => Math.abs(point.x)));
    const supportMaxZ = Math.max(...roof.claddingPerimeter.map((point) => Math.abs(point.z)));
    const sheetMaxX = Math.max(...roof.roofSheetPerimeter.map((point) => Math.abs(point.x)));
    const sheetMaxZ = Math.max(...roof.roofSheetPerimeter.map((point) => Math.abs(point.z)));
    const fasciaMaxX = Math.max(
      ...roof.fasciaPlacements.flatMap((placement) => [
        Math.abs(placement.topStart.x),
        Math.abs(placement.topEnd.x),
      ]),
    );
    const fasciaMaxZ = Math.max(
      ...roof.fasciaPlacements.flatMap((placement) => [
        Math.abs(placement.topStart.z),
        Math.abs(placement.topEnd.z),
      ]),
    );
    const sideEaves = roof.fasciaPlacements.filter((placement) => placement.edgeRole === 'side_eave');
    const gableRakes = roof.fasciaPlacements.filter((placement) => placement.edgeRole === 'gable_rake');

    expect(sheetMaxX - supportMaxX).toBeCloseTo(ROOF_SHEET_EAVE_OVERHANG_METERS, 3);
    expect(sheetMaxZ - supportMaxZ).toBeCloseTo(ROOF_SHEET_EAVE_OVERHANG_METERS, 3);
    expect(fasciaMaxX).toBeCloseTo(supportMaxX, 2);
    expect(sheetMaxX - fasciaMaxX).toBeCloseTo(ROOF_SHEET_EAVE_OVERHANG_METERS, 2);
    expect(fasciaMaxZ).toBeGreaterThan(supportMaxZ);
    expect(sheetMaxZ - supportMaxZ).toBeLessThan(fasciaMaxZ - supportMaxZ);

    for (const fascia of sideEaves) {
      const purlin = roof.purlinPlacements.find(
        (placement) => placement.slopePlaneId === fascia.sourcePlaneId && placement.rowIndex === 0,
      );
      expect(purlin).toBeDefined();
      const project = (point: { x: number; z: number }) =>
        point.x * fascia.faceOutwardNormal.x + point.z * fascia.faceOutwardNormal.z;
      const purlinFaceProjection =
        Math.max(project(purlin!.start), project(purlin!.end)) + PURLIN_PROFILE_WIDTH_METERS / 2;
      for (const point of [fascia.topStart, fascia.topEnd, fascia.bottomStart, fascia.bottomEnd]) {
        expect(project(point)).toBeCloseTo(purlinFaceProjection, 5);
      }
      for (const soffit of roof.soffitPlacements.filter((placement) => placement.edgeRole === 'side_eave')) {
        const soffitOuterProjection = Math.max(project(soffit.outerStart), project(soffit.outerEnd));
        expect(soffitOuterProjection).toBeLessThanOrEqual(purlinFaceProjection + 0.001);
      }
    }

    for (const fascia of gableRakes) {
      const eavePoints = [fascia.topStart, fascia.topEnd].filter(
        (point) => point.y < roof.roofBeamTopY + 0.2,
      );
      expect(eavePoints).toHaveLength(1);
      expect(Math.abs(eavePoints[0]!.z)).toBeCloseTo(fasciaMaxZ, 5);
    }
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

  it('fascia trim follows gable eaves and rakes below structural frame ends', () => {
    const roofSystem = gableRoofSystem({
      ridgeDirection: 'along_longest_axis',
      eaveOverhangMeters: 0.3,
      gableEndOverhangMeters: 0.6,
      fascia: { ...createDefaultRoofSystemSettings().fascia, enabled: true },
    });
    const roof = resolveRoofFromPreset(preset, roofSystem, wallFootprint);
    const sideEaves = roof.fasciaPlacements.filter((placement) => placement.edgeRole === 'side_eave');
    const gableRakes = roof.fasciaPlacements.filter((placement) => placement.edgeRole === 'gable_rake');
    expect(roof.fasciaPlacements).toHaveLength(6);
    expect(sideEaves).toHaveLength(2);
    expect(gableRakes).toHaveLength(4);
    for (const sideEave of sideEaves) {
      expect(sideEave.lengthMeters).toBeCloseTo(roof.claddingRidgeLengthMeters, 2);
    }

    const frameStackAlongRoofNormal =
      TRUSS_CHORD_PROFILE_METERS +
      PURLIN_TO_CHORD_CLEARANCE_METERS +
      PURLIN_PROFILE_DEPTH_METERS +
      PURLIN_TO_SHEET_CLEARANCE_METERS;
    const soffitFasciaLapMeters = 0.05;
    for (const placement of roof.fasciaPlacements) {
      const expectedFrameDepth = frameStackAlongRoofNormal * Math.max(0, placement.outwardNormal.y);
      expect(placement.faceDepthMeters).toBeCloseTo(
        expectedFrameDepth + roofSystem.fascia.bottomExtensionBelowFrameMeters + soffitFasciaLapMeters,
        6,
      );
      expect(placement.topStart.y - placement.bottomStart.y).toBeCloseTo(placement.faceDepthMeters, 6);
      expect(placement.topEnd.y - placement.bottomEnd.y).toBeCloseTo(placement.faceDepthMeters, 6);
      expect(placement.bottomStart.y).toBeLessThan(placement.topStart.y - expectedFrameDepth);
      expect(placement.bottomEnd.y).toBeLessThan(placement.topEnd.y - expectedFrameDepth);
    }
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
