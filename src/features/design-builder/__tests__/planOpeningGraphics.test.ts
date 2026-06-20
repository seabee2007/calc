import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  buildPlanOpeningGeometry,
  buildWallRunsExcludingRoughOpenings,
  openingColorState,
  pickOpeningAtPlanPoint,
  planPointOnWall,
} from '../domain/planOpeningGraphics';
import {
  buildPlanDoorSymbolGeometry,
  doorOpenLeafSideDot,
} from '../domain/planDoorSymbol';
import { buildPlanOpeningRenderItem } from '../domain/planOpeningSymbols';
import {
  openingDraftFromResolvedPlacement,
  resolveOpeningPlacementFromPlanPoint,
  resolveOpeningPlacementFromStoredOpening,
} from '../domain/openingPlacementResolver';
import {
  generateCmuLayoutFromWallLayout,
  getSegmentFramesForWallLayout,
  resolveWallLayoutGeometry,
} from '../geometry/designGeometry';

describe('planOpeningGraphics', () => {
  const preset = createFiveBySixCmuBuildingPreset();
  const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);

  function resolveDoorAt(frameIndex: number, stationRatio = 0.5) {
    const frame = frames[frameIndex]!;
    const station = frame.lengthMeters * stationRatio;
    return resolveOpeningPlacementFromPlanPoint({
      planX: frame.exteriorStart.x + frame.tangent.x * station,
      planZ: frame.exteriorStart.z + frame.tangent.z * station,
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition: {
        type: 'door',
        widthMeters: 0.9,
        heightMeters: 2.1,
        roughOpeningAllowanceMeters: 0.05,
      },
      snapMode: 'grid',
      gridSpacingMeters: 0.1,
      wall: { ...preset.wall, snapToModule: false },
    });
  }

  function resolveWindowAt(frameIndex: number, stationRatio = 0.5) {
    const frame = frames[frameIndex]!;
    const station = frame.lengthMeters * stationRatio;
    return resolveOpeningPlacementFromPlanPoint({
      planX: frame.exteriorStart.x + frame.tangent.x * station,
      planZ: frame.exteriorStart.z + frame.tangent.z * station,
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition: {
        type: 'window',
        widthMeters: 1.2,
        heightMeters: 0.9,
        sillHeightMeters: 1,
        roughOpeningAllowanceMeters: 0.05,
      },
      snapMode: 'grid',
      gridSpacingMeters: 0.1,
      wall: { ...preset.wall, snapToModule: false },
    });
  }

  it('renders door preview geometry on the hovered wall at the resolved station', () => {
    const frame = frames[0]!;
    const resolved = resolveDoorAt(0, 0.42);
    const geometry = buildPlanOpeningGeometry(resolved, frame);
    const center = planPointOnWall(frame, resolved.positionAlongSegmentMeters);

    expect(geometry.hostSegmentId).toBe(frame.segmentId);
    expect(geometry.center.x).toBeCloseTo(center.x, 6);
    expect(geometry.center.z).toBeCloseTo(center.z, 6);
    expect(distanceToWall(geometry.center, frame)).toBeLessThan(0.02);
  });

  it('renders window preview geometry on the hovered wall at the resolved station', () => {
    const frame = frames[2]!;
    const resolved = resolveWindowAt(2, 0.55);
    const geometry = buildPlanOpeningGeometry(resolved, frame);

    expect(geometry.hostSegmentId).toBe(frame.segmentId);
    expect(distanceToWall(geometry.center, frame)).toBeLessThan(0.02);
  });

  it('shows correct actual width and rough-opening span for door preview', () => {
    const frame = frames[1]!;
    const resolved = resolveDoorAt(1, 0.5);
    const geometry = buildPlanOpeningGeometry(resolved, frame);

    expect(geometry.actualWidthMeters).toBeCloseTo(0.9, 2);
    expect(geometry.roughWidthMeters).toBeCloseTo(1.0, 2);
    expect(geometry.roughStart).toEqual(planPointOnWall(frame, resolved.roughOpeningStartMeters));
    expect(geometry.roughEnd).toEqual(planPointOnWall(frame, resolved.roughOpeningEndMeters));
  });

  it('renders door swing on the interior side of the wall', () => {
    const frame = frames[0]!;
    const resolved = resolveDoorAt(0, 0.5);
    const geometry = buildPlanOpeningGeometry(resolved, frame);
    const door = buildPlanDoorSymbolGeometry({
      geometry,
      swingDirection: 'left',
      swingType: 'inswing',
    });

    expect(door.leafWidthMeters).toBeCloseTo(geometry.actualWidthMeters, 3);
    expect(doorOpenLeafSideDot(door, geometry.inwardNormal)).toBeGreaterThan(0);
  });

  it('does not include door swing metadata for window preview items', () => {
    const frame = frames[3]!;
    const resolved = resolveWindowAt(3, 0.45);
    const item = buildPlanOpeningRenderItem({
      key: 'window-preview',
      openingType: 'window',
      resolved,
      frame,
      isValid: true,
      placing: true,
      zoom: 36,
    });

    expect(item.openingType).toBe('window');
    expect(item.doorSymbol).toBeUndefined();
  });

  it('rotates preview geometry correctly on horizontal, vertical, and reversed wall segments', () => {
    const horizontal = frames.find((frame) => Math.abs(frame.tangent.x) > 0.9)!;
    const vertical = frames.find((frame) => Math.abs(frame.tangent.z) > 0.9)!;
    const reversed = frames.find((frame) => frame.tangent.x < -0.9 || frame.tangent.z < -0.9)!;

    [horizontal, vertical, reversed].forEach((frame) => {
      const resolved = resolveDoorAt(frames.indexOf(frame), 0.5);
      const geometry = buildPlanOpeningGeometry(resolved, frame);
      const spanVector = {
        x: geometry.actualEnd.x - geometry.actualStart.x,
        z: geometry.actualEnd.z - geometry.actualStart.z,
      };
      const spanLength = Math.hypot(spanVector.x, spanVector.z);
      expect(spanLength).toBeCloseTo(0.9, 2);
      expect(dot(normalize(spanVector), frame.tangent)).toBeCloseTo(1, 2);
      expect(distanceToWall(geometry.actualStart, frame)).toBeLessThan(0.02);
      expect(distanceToWall(geometry.actualEnd, frame)).toBeLessThan(0.02);
    });
  });

  it('maps valid, warning, and invalid preview colors from placement validation', () => {
    expect(openingColorState({ isValid: true, statusKind: 'clean' })).toBe('valid');
    expect(openingColorState({ isValid: true, statusKind: 'cut_block' })).toBe('warning');
    expect(openingColorState({ isValid: false, statusKind: 'invalid' })).toBe('invalid');
  });

  it('uses the same host segment and station for committed plan symbols and 3D geometry', () => {
    const frame = frames[0]!;
    const resolved = resolveDoorAt(0, 0.38);
    const draft = openingDraftFromResolvedPlacement(
      resolved,
      { type: 'door', widthMeters: 0.9, heightMeters: 2.1, roughOpeningAllowanceMeters: 0.05 },
      preset.wall,
      preset.wallLayout,
      'committed-door',
    );
    const stored = resolveOpeningPlacementFromStoredOpening({
      opening: draft,
      segmentFrame: frame,
      wall: { ...preset.wall, openings: [draft] },
    });
    const layout = generateCmuLayoutFromWallLayout(
      preset.wallLayout,
      { ...preset.wall, openings: [draft] },
      resolveWallLayoutGeometry(preset.wallLayout, preset.wall),
    );
    const rough = layout.roughOpenings.find((opening) => opening.id === 'committed-door');

    expect(stored.hostSegmentId).toBe(resolved.hostSegmentId);
    expect(stored.positionAlongSegmentMeters).toBeCloseTo(resolved.positionAlongSegmentMeters, 6);
    expect(rough).toBeTruthy();
    expect((rough!.actualStartAlongMeters + rough!.actualEndAlongMeters) / 2).toBeCloseTo(
      resolved.positionAlongSegmentMeters,
      2,
    );
    expect(rough!.actualStartAlongMeters).toBeCloseTo(resolved.actualOpeningStartMeters, 2);
    expect(rough!.actualEndAlongMeters).toBeCloseTo(resolved.actualOpeningEndMeters, 2);
  });

  it('creates wall breaks at rough-opening intervals', () => {
    const frame = frames[0]!;
    const resolved = resolveDoorAt(0, 0.5);
    const runs = buildWallRunsExcludingRoughOpenings({
      segmentLengthMeters: frame.lengthMeters,
      roughOpenings: [{
        roughOpeningStartMeters: resolved.roughOpeningStartMeters,
        roughOpeningEndMeters: resolved.roughOpeningEndMeters,
      }],
    });

    expect(runs.length).toBe(2);
    expect(runs[0]!.endAlongMeters).toBeCloseTo(resolved.roughOpeningStartMeters, 6);
    expect(runs[1]!.startAlongMeters).toBeCloseTo(resolved.roughOpeningEndMeters, 6);
  });

  it('selects the correct opening from a plan hit target', () => {
    const frame = frames[1]!;
    const resolved = resolveDoorAt(1, 0.5);
    const draft = openingDraftFromResolvedPlacement(
      resolved,
      { type: 'door', widthMeters: 0.9, heightMeters: 2.1, roughOpeningAllowanceMeters: 0.05 },
      preset.wall,
      preset.wallLayout,
      'pick-door',
    );
    const stored = resolveOpeningPlacementFromStoredOpening({
      opening: draft,
      segmentFrame: frame,
      wall: { ...preset.wall, openings: [draft] },
    });
    const hit = pickOpeningAtPlanPoint({
      planX: stored.positionAlongSegmentMeters * frame.tangent.x + frame.exteriorStart.x,
      planZ: stored.positionAlongSegmentMeters * frame.tangent.z + frame.exteriorStart.z,
      openings: [draft],
      resolvedByOpeningId: new Map([['pick-door', stored]]),
      framesBySegmentId: new Map([[frame.segmentId, frame]]),
    });

    expect(hit?.openingId).toBe('pick-door');
  });

  it('keeps move-opening preview and stored placement on the same resolved station', () => {
    const frame = frames[2]!;
    const initial = resolveWindowAt(2, 0.4);
    const draft = openingDraftFromResolvedPlacement(
      initial,
      {
        type: 'window',
        widthMeters: 1.2,
        heightMeters: 0.9,
        sillHeightMeters: 1,
        roughOpeningAllowanceMeters: 0.05,
      },
      preset.wall,
      preset.wallLayout,
      'move-window',
    );
    const movedStation = frame.lengthMeters * 0.65;
    const moved = resolveOpeningPlacementFromPlanPoint({
      planX: frame.exteriorStart.x + frame.tangent.x * movedStation,
      planZ: frame.exteriorStart.z + frame.tangent.z * movedStation,
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition: {
        type: 'window',
        widthMeters: draft.widthMeters,
        heightMeters: draft.heightMeters,
        sillHeightMeters: draft.sillHeightMeters,
        roughOpeningAllowanceMeters: draft.roughOpeningAllowanceMeters,
      },
      snapMode: 'grid',
      gridSpacingMeters: 0.1,
      wall: { ...preset.wall, snapToModule: false },
    });
    const movedDraft = openingDraftFromResolvedPlacement(
      moved,
      {
        type: 'window',
        widthMeters: draft.widthMeters,
        heightMeters: draft.heightMeters,
        sillHeightMeters: draft.sillHeightMeters,
        roughOpeningAllowanceMeters: draft.roughOpeningAllowanceMeters,
      },
      preset.wall,
      preset.wallLayout,
      draft.id,
    );
    const stored = resolveOpeningPlacementFromStoredOpening({
      opening: movedDraft,
      segmentFrame: frame,
      wall: { ...preset.wall, openings: [movedDraft] },
    });

    expect(movedDraft.wallSegmentId).toBe(moved.hostSegmentId);
    expect(movedDraft.positionAlongSegment).toBeCloseTo(moved.positionAlongSegmentMeters, 6);
    expect(stored.positionAlongSegmentMeters).toBeCloseTo(moved.positionAlongSegmentMeters, 6);
  });
});

function distanceToWall(
  point: { x: number; z: number },
  frame: {
    centerlineStart: { x: number; z: number };
    tangent: { x: number; z: number };
    lengthMeters: number;
  },
): number {
  const dx = frame.tangent.x;
  const dz = frame.tangent.z;
  const t = ((point.x - frame.centerlineStart.x) * dx + (point.z - frame.centerlineStart.z) * dz) / (dx * dx + dz * dz);
  const clamped = Math.max(0, Math.min(frame.lengthMeters, t));
  const proj = {
    x: frame.centerlineStart.x + dx * clamped,
    z: frame.centerlineStart.z + dz * clamped,
  };
  return Math.hypot(point.x - proj.x, point.z - proj.z);
}

function dot(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return a.x * b.x + a.z * b.z;
}

function normalize(vector: { x: number; z: number }): { x: number; z: number } {
  const length = Math.hypot(vector.x, vector.z) || 1;
  return { x: vector.x / length, z: vector.z / length };
}

function inwardOffset(
  point: { x: number; z: number },
  origin: { x: number; z: number },
): { x: number; z: number } {
  return { x: point.x - origin.x, z: point.z - origin.z };
}