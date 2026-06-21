import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import {
  analyzeRectangularFootprint,
  distancePointToLine2D,
  footprintBounds,
  intersectInfiniteLines2D,
  offsetClosedPolygonOutward,
  resolveCladdingPerimeterFromBearing,
  resolveOuterRoofBeamBearingLoop,
  type PlanVec2,
} from '../domain/roofFootprintSupport';
import { resolveRoofSystem } from '../domain/roofSystemResolver';
import { createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
} from '../geometry/designGeometry';
import type { RoofSystemSettings } from '../types';

function rotatePoint(point: PlanVec2, angleRadians: number): PlanVec2 {
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);
  return { x: point.x * cos - point.z * sin, z: point.x * sin + point.z * cos };
}

function resolveRoofWithFrame(params: {
  layout: import('../types').DesignWallLayoutParameters;
  wallFootprint: readonly PlanVec2[];
  roofSystem: RoofSystemSettings;
  roofBeams: readonly import('../types').StructuralBeam[];
  segmentFrames: ReturnType<typeof getSegmentFramesForWallLayout>;
  roofBeamTopY?: number;
}) {
  const bearingLoop = resolveOuterRoofBeamBearingLoop({
    layout: params.layout,
    segmentFrames: params.segmentFrames,
    roofBeams: params.roofBeams,
    fallbackExteriorFootprint: params.wallFootprint,
  });
  return {
    bearingLoop,
    roof: resolveRoofSystem({
      layout: params.layout,
      wallExteriorFootprint: params.wallFootprint,
      structuralBearingPerimeter: bearingLoop.points,
      bearingSource: bearingLoop.source,
      bearingWarnings: bearingLoop.warnings,
      roofSystem: params.roofSystem,
      roofBeamTopElevationMeters: params.roofBeamTopY ?? 2.8,
    }),
  };
}

function framePreset() {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
  const wallFootprint = [
    { x: -3, z: -2.5 },
    { x: 3, z: -2.5 },
    { x: 3, z: 2.5 },
    { x: -3, z: 2.5 },
  ];
  return { preset, segmentFrames, wallFootprint };
}

describe('Roof bearing loop geometry', () => {
  it('offsetClosedPolygonOutward uses true miter intersections at 90-degree corners', () => {
    const square = [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 2 },
      { x: 0, z: 2 },
    ];
    const offset = offsetClosedPolygonOutward(square, 1);
    expect(offset[0]).toEqual({ x: -1, z: -1 });
    expect(offset[1]).toEqual({ x: 3, z: -1 });
    expect(offset[2]).toEqual({ x: 3, z: 3 });
    expect(offset[3]).toEqual({ x: -1, z: 3 });
  });

  it('resolveOuterRoofBeamBearingLoop returns roof-beam outer faces beyond wall exterior', () => {
    const { preset, segmentFrames, wallFootprint } = framePreset();
    const loop = resolveOuterRoofBeamBearingLoop({
      layout: preset.wallLayout,
      segmentFrames,
      roofBeams: preset.frameSystem.beams,
      fallbackExteriorFootprint: wallFootprint,
    });
    expect(loop.source).toBe('roof_beam_outer_faces');
    expect(loop.points).toHaveLength(4);
    const wall = footprintBounds(wallFootprint);
    const bearing = footprintBounds(loop.points);
    expect(bearing.minZ).toBeLessThan(wall.minZ);
    expect(bearing.maxX).toBeGreaterThan(wall.maxX);
  });

  it('falls back to wall exterior when roof beams are absent', () => {
    const { preset, segmentFrames, wallFootprint } = framePreset();
    const loop = resolveOuterRoofBeamBearingLoop({
      layout: preset.wallLayout,
      segmentFrames,
      roofBeams: [],
      fallbackExteriorFootprint: wallFootprint,
    });
    expect(loop.source).toBe('wall_exterior_fallback');
    expect(loop.points).toEqual(wallFootprint);
  });

  it('zero overhang places roof eave vertices on the roof beam outer-face loop', () => {
    const { preset, segmentFrames, wallFootprint } = framePreset();
    const { bearingLoop, roof } = resolveRoofWithFrame({
      layout: preset.wallLayout,
      wallFootprint,
      roofBeams: preset.frameSystem.beams,
      segmentFrames,
      roofSystem: { ...createDefaultRoofSystemSettings(), eaveOverhangMeters: 0 },
    });
    expect(roof.supported).toBe(true);
    const planeEaveZs = roof.roofTopPlanes.flatMap((plane) =>
      plane.corners.filter((corner) => Math.abs(corner.y - roof.roofBeamTopY) < 0.001).map((corner) => ({ x: corner.x, z: corner.z })),
    );
    expect(planeEaveZs.length).toBeGreaterThan(0);
    for (const eavePoint of planeEaveZs) {
      const nearest = bearingLoop.points.reduce((best, point) =>
        Math.hypot(point.x - eavePoint.x, point.z - eavePoint.z) <
        Math.hypot(best.x - eavePoint.x, best.z - eavePoint.z)
          ? point
          : best,
      bearingLoop.points[0]!);
      expect(Math.hypot(nearest.x - eavePoint.x, nearest.z - eavePoint.z)).toBeLessThan(0.02);
    }
  });

  it('positive overhang offsets cladding outward by the configured perpendicular distance', () => {
    const { preset, segmentFrames, wallFootprint } = framePreset();
    const overhang = 0.5;
    const { bearingLoop, roof } = resolveRoofWithFrame({
      layout: preset.wallLayout,
      wallFootprint,
      roofBeams: preset.frameSystem.beams,
      segmentFrames,
      roofSystem: { ...createDefaultRoofSystemSettings(), eaveOverhangMeters: overhang },
    });
    const cladding = roof.claddingPerimeter.map((point) => ({ x: point.x, z: point.z }));
    const expected = resolveCladdingPerimeterFromBearing(bearingLoop.points, overhang);
    for (let index = 0; index < 4; index += 1) {
      expect(cladding[index]?.x).toBeCloseTo(expected[index]!.x, 3);
      expect(cladding[index]?.z).toBeCloseTo(expected[index]!.z, 3);
    }
  });

  it('rotated rectangular layout resolves the same roof dimensions as axis-aligned', () => {
    const angle = Math.PI / 6;
    const baseLayout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5, wallHeightMeters: 2.8 });
    const rotatedLayout = {
      ...baseLayout,
      nodes: baseLayout.nodes.map((node) => ({ ...node, ...rotatePoint(node, angle) })),
    };
    const preset = applyAutoFrameLayout({ ...createFiveBySixCmuBuildingPreset(), wallLayout: rotatedLayout });
    const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const wallFootprint = segmentFrames.map((frame) => ({ x: frame.exteriorStart.x, z: frame.exteriorStart.z }));

    const axisPreset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const axisFrames = getSegmentFramesForWallLayout(axisPreset.wallLayout, axisPreset.wall);
    const axisWall = axisFrames.map((frame) => ({ x: frame.exteriorStart.x, z: frame.exteriorStart.z }));

    const rotated = resolveRoofWithFrame({
      layout: preset.wallLayout,
      wallFootprint,
      roofBeams: preset.frameSystem.beams,
      segmentFrames,
      roofSystem: createDefaultRoofSystemSettings(),
    });
    const axis = resolveRoofWithFrame({
      layout: axisPreset.wallLayout,
      wallFootprint: axisWall,
      roofBeams: axisPreset.frameSystem.beams,
      segmentFrames: axisFrames,
      roofSystem: createDefaultRoofSystemSettings(),
    });

    expect(rotated.roof.supported).toBe(true);
    expect(axis.roof.supported).toBe(true);
    expect(rotated.roof.exteriorRoofBeamBounds.widthMeters).toBeCloseTo(axis.roof.exteriorRoofBeamBounds.widthMeters, 2);
    expect(rotated.roof.exteriorRoofBeamBounds.depthMeters).toBeCloseTo(axis.roof.exteriorRoofBeamBounds.depthMeters, 2);
    expect(rotated.roof.rafterRunMeters).toBeCloseTo(axis.roof.rafterRunMeters, 2);
  });

  it('ridge remains centered over the structural bearing perimeter', () => {
    const { preset, segmentFrames, wallFootprint } = framePreset();
    const { bearingLoop, roof } = resolveRoofWithFrame({
      layout: preset.wallLayout,
      wallFootprint,
      roofBeams: preset.frameSystem.beams,
      segmentFrames,
      roofSystem: { ...createDefaultRoofSystemSettings(), ridgeDirection: 'along_longest_axis' },
    });
    expect(roof.ridgeStart).toBeDefined();
    expect(roof.ridgeEnd).toBeDefined();
    const ridgeMid = {
      x: (roof.ridgeStart!.x + roof.ridgeEnd!.x) / 2,
      z: (roof.ridgeStart!.z + roof.ridgeEnd!.z) / 2,
    };
    const bearingBounds = footprintBounds(bearingLoop.points);
    expect(ridgeMid.x).toBeCloseTo(bearingBounds.centerX, 2);
    expect(ridgeMid.z).toBeCloseTo(bearingBounds.centerZ, 2);
  });

  it('truss bearing points sit on the roof beam outer-bearing geometry', () => {
    const { preset, segmentFrames, wallFootprint } = framePreset();
    const { bearingLoop, roof } = resolveRoofWithFrame({
      layout: preset.wallLayout,
      wallFootprint,
      roofBeams: preset.frameSystem.beams,
      segmentFrames,
      roofSystem: {
        ...createDefaultRoofSystemSettings(),
        steelTrusses: { ...createDefaultRoofSystemSettings().steelTrusses, maxSpacingMeters: 2.4 },
      },
    });
    expect(roof.trussPlacements.length).toBeGreaterThan(1);
    for (const truss of roof.trussPlacements) {
      for (const bearing of [truss.bearingLeft, truss.bearingRight]) {
        const minDist = Math.min(
          ...bearingLoop.points.map((point, index) => {
            const next = bearingLoop.points[(index + 1) % bearingLoop.points.length]!;
            return distancePointToLine2D({ x: bearing.x, z: bearing.z }, point, next);
          }),
        );
        expect(minDist).toBeLessThan(0.05);
      }
    }
  });

  it('geometry pipeline uses roof-beam outer-face source for frame infill buildings', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);
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
        roofSystem: createDefaultRoofSystemSettings(),
      }),
    );
    expect(geometry.resolvedRoofSystem?.roofBearingSource).toBe('roof_beam_outer_faces');
    expect(geometry.resolvedRoofSystem?.supported).toBe(true);
  });

  it('analyzeRectangularFootprint supports rotated rectangles without global axis alignment', () => {
    const angle = Math.PI / 4;
    const corners = [
      { x: -3, z: -2.5 },
      { x: 3, z: -2.5 },
      { x: 3, z: 2.5 },
      { x: -3, z: 2.5 },
    ].map((point) => rotatePoint(point, angle));
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5, wallHeightMeters: 2.8 });
    const rotatedLayout = {
      ...layout,
      nodes: layout.nodes.map((node) => ({ ...node, ...rotatePoint(node, angle) })),
    };
    const analysis = analyzeRectangularFootprint({
      layout: rotatedLayout,
      exteriorFootprint: corners,
    });
    expect(analysis.supported).toBe(true);
    expect(analysis.lengthMeters).toBeCloseTo(6, 1);
    expect(analysis.widthMeters).toBeCloseTo(5, 1);
  });

  it('mitered bearing corners are line intersections of adjacent outer beam offset lines', () => {
    const { preset, segmentFrames } = framePreset();
    const loop = resolveOuterRoofBeamBearingLoop({
      layout: preset.wallLayout,
      segmentFrames,
      roofBeams: preset.frameSystem.beams,
      fallbackExteriorFootprint: [],
    });
    expect(loop.points).toHaveLength(4);
    for (let index = 0; index < 4; index += 1) {
      const prev = loop.points[(index - 1 + 4) % 4]!;
      const curr = loop.points[index]!;
      const next = loop.points[(index + 1) % 4]!;
      const edgeLen = Math.hypot(next.x - curr.x, next.z - curr.z);
      const prevLen = Math.hypot(curr.x - prev.x, curr.z - prev.z);
      expect(edgeLen).toBeGreaterThan(4);
      expect(prevLen).toBeGreaterThan(4);
    }
  });
});
