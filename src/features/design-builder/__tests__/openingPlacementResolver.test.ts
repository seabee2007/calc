import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  openingDraftFromResolvedPlacement,
  projectPointToSegmentStation,
  resolveOpeningPlacementFromPlanPoint,
  resolveOpeningPlacementFromWallHit,
} from '../domain/openingPlacementResolver';
import { generateCmuLayoutFromWallLayout, getSegmentFramesForWallLayout, resolveWallLayoutGeometry } from '../geometry/designGeometry';

describe('openingPlacementResolver', () => {
  const preset = createFiveBySixCmuBuildingPreset();
  const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);

  it('places opening center at clicked midpoint on each rectangle wall', () => {
    frames.forEach((frame) => {
      const centerStation = frame.lengthMeters / 2;
      const hitPoint = {
        x: frame.centerlineStart.x + frame.tangent.x * centerStation,
        z: frame.centerlineStart.z + frame.tangent.z * centerStation,
      };
      const resolved = resolveOpeningPlacementFromWallHit({
        hitPoint,
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

      expect(resolved.positionAlongSegmentMeters).toBeCloseTo(centerStation, 2);
      expect(resolved.actualOpeningStartMeters).toBeCloseTo(centerStation - 0.45, 2);
      expect(resolved.actualOpeningEndMeters).toBeCloseTo(centerStation + 0.45, 2);
      expect(resolved.isValid).toBe(true);
    });
  });

  it('keeps preview and committed opening on the same host segment and station', () => {
    const frame = frames[0]!;
    const station = frame.lengthMeters * 0.35;
    const hitPoint = {
      x: frame.exteriorStart.x + frame.tangent.x * station,
      z: frame.exteriorStart.z + frame.tangent.z * station,
    };
    const openingDefinition = {
      type: 'window' as const,
      widthMeters: 1.2,
      heightMeters: 0.9,
      sillHeightMeters: 1,
      roughOpeningAllowanceMeters: 0.05,
    };
    const resolved = resolveOpeningPlacementFromWallHit({
      hitPoint,
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition,
      snapMode: 'grid',
      gridSpacingMeters: 0.1,
      wall: { ...preset.wall, snapToModule: false },
    });
    const draft = openingDraftFromResolvedPlacement(resolved, openingDefinition, preset.wall, preset.wallLayout, 'preview-window');

    expect(draft.wallSegmentId).toBe(frame.segmentId);
    expect(draft.positionAlongSegment).toBeCloseTo(resolved.positionAlongSegmentMeters, 6);
    expect(draft.placementUsesCenterStation).toBe(true);
  });

  it('uses segment frame projection rather than global axes for east-west walls', () => {
    const eastFrame = frames.find((frame) => frame.lengthMeters === preset.footprint.widthMeters)!;
    const station = eastFrame.lengthMeters * 0.6;
    const hitPoint = {
      x: eastFrame.centerlineStart.x + eastFrame.tangent.x * station,
      z: eastFrame.centerlineStart.z + eastFrame.tangent.z * station,
    };
    const projected = projectPointToSegmentStation(hitPoint, eastFrame);
    expect(projected).toBeCloseTo(station, 3);
  });

  it('derives rough opening, lintel host, and grout from the same segment placement', () => {
    const frame = frames[1]!;
    const station = 2.5;
    const resolved = resolveOpeningPlacementFromPlanPoint({
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
    const draft = openingDraftFromResolvedPlacement(resolved, {
      type: 'door',
      widthMeters: 0.9,
      heightMeters: 2.1,
      roughOpeningAllowanceMeters: 0.05,
    }, preset.wall, preset.wallLayout, 'door-test');
    const layout = generateCmuLayoutFromWallLayout(
      preset.wallLayout,
      { ...preset.wall, openings: [draft] },
      resolveWallLayoutGeometry(preset.wallLayout, preset.wall),
    );
    const rough = layout.roughOpenings.find((opening) => opening.id === 'door-test');
    const lintel = layout.lintels.find((item) => item.openingId === 'door-test');
    const grout = layout.jambGroutCells.filter((cell) => cell.openingId === 'door-test');

    expect(rough).toBeTruthy();
    expect(lintel).toBeTruthy();
    expect(grout.length).toBeGreaterThan(0);
  });

  it('clamps near-corner clicks to the minimum allowed center station', () => {
    const frame = frames[0]!;
    const resolved = resolveOpeningPlacementFromWallHit({
      hitPoint: {
        x: frame.exteriorStart.x + frame.tangent.x * 0.05,
        z: frame.exteriorStart.z + frame.tangent.z * 0.05,
      },
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition: {
        type: 'door',
        widthMeters: 0.9,
        heightMeters: 2.1,
        roughOpeningAllowanceMeters: 0.05,
      },
      snapMode: 'off',
      wall: { ...preset.wall, snapToModule: false },
      minimumEdgeDistanceMeters: 0.2,
    });

    expect(resolved.positionAlongSegmentMeters).toBeGreaterThanOrEqual(0.65);
  });
});
