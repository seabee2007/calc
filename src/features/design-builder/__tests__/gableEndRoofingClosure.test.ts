import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import {
  createDefaultRoofSystemSettings,
  normalizeRoofSystemSettings,
} from '../domain/roofSystemDefaults';
import {
  resolveOuterRoofBeamBearingLoop,
} from '../domain/roofFootprintSupport';
import { resolveRoofSystem } from '../domain/roofSystemResolver';
import {
  elevationOnRoofPlaneAtPoint,
  DEFAULT_RIDGE_CAP_THICKNESS_METERS,
  normalizeOutwardRoofNormal,
  offsetPointAlongRoofNormal,
  ROOF_RIDGE_CAP_CLEARANCE_METERS,
  PURLIN_PROFILE_DEPTH_METERS,
  TRUSS_CHORD_PROFILE_METERS,
  CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
} from '../domain/roofFramingResolver';
import {
  resolveGableEndRoofingClosures,
  totalGableEndRoofingClosureAreaSquareMeters,
} from '../domain/gableEndRoofingClosureSolver';
import { createVerticalCladdingGeometry } from '../rendering/materials/designRenderingUv';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
} from '../geometry/designGeometry';
import { buildFrameInfillEstimatePreview } from '../quantity/designQuantityFormulas';
import type { RoofSystemSettings } from '../types';

const ROOF_BEAM_TOP_Y = 2.8;
const PEAK_HEIGHT = 1.25;
const WALL_FOOTPRINT = [
  { x: -3, z: -2.5 },
  { x: 3, z: -2.5 },
  { x: 3, z: 2.5 },
  { x: -3, z: 2.5 },
];

function framePreset() {
  return applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
}

function gableRoofSystem(overrides: Partial<RoofSystemSettings> = {}): RoofSystemSettings {
  return normalizeRoofSystemSettings({
    ...createDefaultRoofSystemSettings(),
    roofType: 'gable',
    peakHeightAboveRoofBeamMeters: PEAK_HEIGHT,
    gable: {
      ...createDefaultRoofSystemSettings().gable,
      enabled: true,
      rakedConcreteCapEnabled: true,
      closeInWithRoofingEnabled: false,
    },
    ...overrides,
  });
}

function resolveRoofFromPreset(
  preset: ReturnType<typeof framePreset>,
  roofSystem: RoofSystemSettings,
) {
  const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
  const bearingLoop = resolveOuterRoofBeamBearingLoop({
    layout: preset.wallLayout,
    segmentFrames,
    roofBeams: preset.frameSystem.beams,
    fallbackExteriorFootprint: WALL_FOOTPRINT,
  });
  return resolveRoofSystem({
    layout: preset.wallLayout,
    wallExteriorFootprint: WALL_FOOTPRINT,
    structuralBearingPerimeter: bearingLoop.points,
    bearingSource: bearingLoop.source,
    bearingWarnings: bearingLoop.warnings,
    roofSystem,
    roofBeamTopElevationMeters: ROOF_BEAM_TOP_Y,
    segmentFrames,
  });
}

function endTrussForClosure(
  roof: ReturnType<typeof resolveRoofFromPreset>,
  frame: ReturnType<typeof getSegmentFramesForWallLayout>[number],
) {
  const wallCenter = {
    x: (frame.exteriorStart.x + frame.exteriorEnd.x) / 2,
    z: (frame.exteriorStart.z + frame.exteriorEnd.z) / 2,
  };
  const ridgeStart = roof.claddingRidgeStart!;
  const ridgeEnd = roof.claddingRidgeEnd!;
  const distStart = Math.hypot(wallCenter.x - ridgeStart.x, wallCenter.z - ridgeStart.z);
  const distEnd = Math.hypot(wallCenter.x - ridgeEnd.x, wallCenter.z - ridgeEnd.z);
  return distStart <= distEnd
    ? roof.trussPlacements[0]!
    : roof.trussPlacements[roof.trussPlacements.length - 1]!;
}

function closureSpan(
  closure: ReturnType<typeof resolveRoofFromPreset>['gableEndRoofingClosures'][number],
  point: { x: number; z: number },
): number {
  return closure.profileSpanAxis === 'x' ? point.x : point.z;
}

function claddingDisplayUndersideYAt(
  roof: ReturnType<typeof resolveRoofFromPreset>,
  point: { x: number; z: number },
): number {
  let bestY = -Infinity;
  for (const plane of roof.claddingDisplayPlanes) {
    const topY = elevationOnRoofPlaneAtPoint(plane, point.x, point.z);
    if (topY == null) continue;
    const underside = offsetPointAlongRoofNormal(
      { x: point.x, y: topY, z: point.z },
      normalizeOutwardRoofNormal(plane.normal),
      -CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
    ).y;
    bestY = Math.max(bestY, underside);
  }
  return bestY;
}

function purlinNotchBottomSegments(
  closure: ReturnType<typeof resolveRoofFromPreset>['gableEndRoofingClosures'][number],
  roofBeamTopY: number,
): { midpointSpan: number; y: number }[] {
  const segments: { midpointSpan: number; y: number }[] = [];
  for (let index = 0; index < closure.corners.length - 1; index += 1) {
    const start = closure.corners[index]!;
    const end = closure.corners[index + 1]!;
    const startSpan = closureSpan(closure, start);
    const endSpan = closureSpan(closure, end);
    if (
      Math.abs(start.y - end.y) <= 0.006 &&
      Math.abs(startSpan - endSpan) > 0.012 &&
      start.y > roofBeamTopY + PURLIN_PROFILE_DEPTH_METERS
    ) {
      segments.push({
        midpointSpan: (startSpan + endSpan) / 2,
        y: (start.y + end.y) / 2,
      });
    }
  }
  return segments;
}

function frameInfillGeometry(roofSystem: RoofSystemSettings) {
  const preset = framePreset();
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

describe('gable end roofing closure solver', () => {
  it('returns two closures for a rectangular gable roof when enabled', () => {
    const preset = framePreset();
    const roof = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          closeInWithRoofingEnabled: true,
        },
      }),
    );

    expect(roof.gableEndRoofingClosures).toHaveLength(2);
    expect(totalGableEndRoofingClosureAreaSquareMeters(roof.gableEndRoofingClosures)).toBeGreaterThan(0);
  });

  it('triangulates closure meshes for rendering', () => {
    const preset = framePreset();
    const roof = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          closeInWithRoofingEnabled: true,
        },
      }),
    );

    for (const closure of roof.gableEndRoofingClosures) {
      const geometry = createVerticalCladdingGeometry({
        corners: closure.corners,
        slabTopMeters: 0.15,
      });
      expect(geometry.getIndex()?.count ?? 0).toBeGreaterThanOrEqual(3);
    }
  });

  it('returns no closures when the toggle is off', () => {
    const preset = framePreset();
    const roof = resolveRoofFromPreset(preset, gableRoofSystem());

    expect(roof.gableEndRoofingClosures).toHaveLength(0);
  });

  it('places base at roof beam top and apex below peak for ridge cap clearance', () => {
    const preset = framePreset();
    const roof = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          closeInWithRoofingEnabled: true,
        },
      }),
    );
    const closure = roof.gableEndRoofingClosures[0]!;
    const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const frame = segmentFrames.find((candidate) => candidate.segmentId === closure.hostWallSegmentId)!;
    const endTruss = endTrussForClosure(roof, frame);
    const minY = Math.min(...closure.corners.map((corner) => corner.y));
    const maxY = Math.max(...closure.corners.map((corner) => corner.y));
    const baseCorners = closure.corners.filter(
      (corner) => Math.abs(corner.y - ROOF_BEAM_TOP_Y) < 0.02,
    );

    expect(baseCorners.length).toBeGreaterThanOrEqual(2);
    expect(minY).toBeCloseTo(ROOF_BEAM_TOP_Y, 2);
    const ridgeCapMaxY =
      ROOF_BEAM_TOP_Y + PEAK_HEIGHT - DEFAULT_RIDGE_CAP_THICKNESS_METERS - ROOF_RIDGE_CAP_CLEARANCE_METERS;
    expect(maxY).toBeGreaterThan(ridgeCapMaxY - 0.02);
    expect(maxY).toBeGreaterThan(ROOF_BEAM_TOP_Y + PEAK_HEIGHT * 0.5);
    expect(closure.corners.length).toBeGreaterThan(3);
  });

  it('offsets cladding to the outside face of the end truss', () => {
    const preset = framePreset();
    const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const roof = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          closeInWithRoofingEnabled: true,
        },
      }),
    );
    const closure = roof.gableEndRoofingClosures[0]!;
    const frame = segmentFrames.find((candidate) => candidate.segmentId === closure.hostWallSegmentId)!;
    const endTruss = endTrussForClosure(roof, frame);
    const expectedOffset = TRUSS_CHORD_PROFILE_METERS / 2 + CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS;
    const dotOutward = (point: { x: number; z: number }, anchor: { x: number; z: number }) =>
      (point.x - anchor.x) * closure.outwardNormal.x + (point.z - anchor.z) * closure.outwardNormal.z;

    const nearestCorner = (anchor: { x: number; y: number; z: number }) =>
      closure.corners.reduce((best, corner) => {
        const dist = Math.hypot(corner.x - anchor.x, corner.y - anchor.y, corner.z - anchor.z);
        const bestDist = Math.hypot(best.x - anchor.x, best.y - anchor.y, best.z - anchor.z);
        return dist < bestDist ? corner : best;
      });

    expect(dotOutward(nearestCorner(endTruss.bearingLeft), endTruss.bearingLeft)).toBeCloseTo(
      expectedOffset,
      3,
    );
    expect(dotOutward(nearestCorner(endTruss.bearingRight), endTruss.bearingRight)).toBeCloseTo(
      expectedOffset,
      3,
    );
    expect(dotOutward(nearestCorner(endTruss.apex), endTruss.apex)).toBeCloseTo(expectedOffset, 3);
  });

  it('keeps closure corners on the gable wall plane for ridge along X and Z', () => {
    const preset = framePreset();
    const ridgeX = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        ridgeDirection: 'along_longest_axis',
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          closeInWithRoofingEnabled: true,
        },
      }),
    );
    for (const closure of ridgeX.gableEndRoofingClosures) {
      expect(closure.profileSpanAxis).toBe('z');
      const xs = closure.corners.map((corner) => corner.x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.03);
    }

    const ridgeZ = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        ridgeDirection: 'along_shortest_axis',
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          closeInWithRoofingEnabled: true,
        },
      }),
    );
    for (const closure of ridgeZ.gableEndRoofingClosures) {
      expect(closure.profileSpanAxis).toBe('x');
      const zs = closure.corners.map((corner) => corner.z);
      expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(0.03);
    }
  });

  it('extends the closure profile above purlin bottoms toward the roof cladding underside', () => {
    const preset = framePreset();
    const roof = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          closeInWithRoofingEnabled: true,
        },
      }),
    );
    for (const closure of roof.gableEndRoofingClosures) {
      const maxY = Math.max(...closure.corners.map((corner) => corner.y));
      const minY = Math.min(...closure.corners.map((corner) => corner.y));
      expect(maxY).toBeGreaterThan(ROOF_BEAM_TOP_Y + PEAK_HEIGHT * 0.75);
      expect(maxY - minY).toBeGreaterThan(PEAK_HEIGHT * 0.45);
    }
  });

  it('cuts around purlin rows on both gable roof slopes', () => {
    const preset = framePreset();
    const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const roof = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          closeInWithRoofingEnabled: true,
        },
      }),
    );

    for (const closure of roof.gableEndRoofingClosures) {
      const frame = segmentFrames.find((candidate) => candidate.segmentId === closure.hostWallSegmentId)!;
      const endTruss = endTrussForClosure(roof, frame);
      const ridgeSpan = closureSpan(closure, endTruss.apex);
      const notchBottoms = purlinNotchBottomSegments(closure, ROOF_BEAM_TOP_Y);
      const leftSlopeNotches = notchBottoms.filter((segment) => segment.midpointSpan < ridgeSpan - 0.05);
      const rightSlopeNotches = notchBottoms.filter((segment) => segment.midpointSpan > ridgeSpan + 0.05);

      expect(leftSlopeNotches.length).toBeGreaterThan(0);
      expect(rightSlopeNotches.length).toBeGreaterThan(0);
    }
  });

  it('seats the closure ridge under the elevated cladding underside when purlins lift the sheet', () => {
    const preset = framePreset();
    const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const roof = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          closeInWithRoofingEnabled: true,
        },
      }),
    );

    for (const closure of roof.gableEndRoofingClosures) {
      const frame = segmentFrames.find((candidate) => candidate.segmentId === closure.hostWallSegmentId)!;
      const endTruss = endTrussForClosure(roof, frame);
      const expectedUndersideY = claddingDisplayUndersideYAt(roof, endTruss.apex);
      const maxY = Math.max(...closure.corners.map((corner) => corner.y));
      const oldStructuralTrimY =
        ROOF_BEAM_TOP_Y + PEAK_HEIGHT - DEFAULT_RIDGE_CAP_THICKNESS_METERS - ROOF_RIDGE_CAP_CLEARANCE_METERS;

      expect(expectedUndersideY).toBeGreaterThan(oldStructuralTrimY + PURLIN_PROFILE_DEPTH_METERS);
      expect(maxY).toBeGreaterThanOrEqual(expectedUndersideY - 0.02);
      expect(maxY).toBeLessThanOrEqual(expectedUndersideY + 0.02);
    }
  });

  it('increases closure area when peak height increases', () => {
    const preset = framePreset();
    const low = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        peakHeightAboveRoofBeamMeters: 1,
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          closeInWithRoofingEnabled: true,
        },
      }),
    );
    const high = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        peakHeightAboveRoofBeamMeters: 2,
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          closeInWithRoofingEnabled: true,
        },
      }),
    );

    expect(totalGableEndRoofingClosureAreaSquareMeters(high.gableEndRoofingClosures)).toBeGreaterThan(
      totalGableEndRoofingClosureAreaSquareMeters(low.gableEndRoofingClosures),
    );
  });

  it('still gates gableEndSegmentIds on gable.enabled for CMU masonry', () => {
    const preset = framePreset();
    const masonryOff = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          enabled: false,
          closeInWithRoofingEnabled: true,
        },
      }),
    );
    const masonryOn = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          enabled: true,
          closeInWithRoofingEnabled: true,
        },
      }),
    );

    expect(masonryOff.gableEndSegmentIds).toHaveLength(0);
    expect(masonryOn.gableEndSegmentIds.length).toBeGreaterThan(0);
    expect(masonryOff.gableEndRoofingClosures.length).toBeGreaterThan(0);
  });

  it('includes closure area in corrugated metal roofing quantities', () => {
    const preset = framePreset();
    const roofSystem = gableRoofSystem({
      gable: {
        ...createDefaultRoofSystemSettings().gable,
        closeInWithRoofingEnabled: true,
      },
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
    const corrugatedLine = preview.find((line) => line.id === 'corrugated-metal-roofing');
    expect(corrugatedLine).toBeDefined();
    expect(corrugatedLine?.parameterSnapshot?.gableEndRoofingClosureAreaSquareMeters).toBeGreaterThan(0);
  });
});

describe('resolveGableEndRoofingClosures guardrails', () => {
  it('returns empty when corrugated metal is disabled', () => {
    const preset = framePreset();
    const roof = resolveRoofFromPreset(
      preset,
      gableRoofSystem({
        corrugatedMetal: {
          ...createDefaultRoofSystemSettings().corrugatedMetal,
          enabled: false,
        },
        gable: {
          ...createDefaultRoofSystemSettings().gable,
          closeInWithRoofingEnabled: true,
        },
      }),
    );

    expect(
      resolveGableEndRoofingClosures({
        roofSystem: gableRoofSystem({
          corrugatedMetal: {
            ...createDefaultRoofSystemSettings().corrugatedMetal,
            enabled: false,
          },
          gable: {
            ...createDefaultRoofSystemSettings().gable,
            closeInWithRoofingEnabled: true,
          },
        }),
        analysis: { supported: true } as import('../domain/roofFootprintSupport').RectangularFootprintAnalysis,
        ridgeAxis: 'localX',
        segmentFrames: getSegmentFramesForWallLayout(preset.wallLayout, preset.wall),
        trussPlacements: roof.trussPlacements,
        resolvedRoof: roof,
      }),
    ).toHaveLength(0);
    expect(roof.gableEndRoofingClosures).toHaveLength(0);
  });
});
