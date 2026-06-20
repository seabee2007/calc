import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { buildPlanOpeningGeometry, planPointOnWall } from '../domain/planOpeningGraphics';
import {
  buildPlanDoorSymbolGeometry,
  DEFAULT_DOOR_SWING_DIRECTION,
  DEFAULT_DOOR_SWING_TYPE,
  doorArcRadiusMeters,
  doorOpenLeafSideDot,
  deriveWallPlanOrientation,
} from '../domain/planDoorSymbol';
import { buildPlanOpeningRenderItem } from '../domain/planOpeningSymbols';
import {
  openingDraftFromResolvedPlacement,
  resolveOpeningPlacementFromPlanPoint,
  resolveOpeningPlacementFromStoredOpening,
} from '../domain/openingPlacementResolver';
import { getSegmentFramesForWallLayout } from '../geometry/designGeometry';

describe('planDoorSymbol', () => {
  const preset = createFiveBySixCmuBuildingPreset();
  const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);

  function doorGeometry(frameIndex: number, stationRatio = 0.5) {
    const frame = frames[frameIndex]!;
    const station = frame.lengthMeters * stationRatio;
    const resolved = resolveOpeningPlacementFromPlanPoint({
      planX: frame.centerlineStart.x + frame.tangent.x * station,
      planZ: frame.centerlineStart.z + frame.tangent.z * station,
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
    return { frame, resolved, geometry: buildPlanOpeningGeometry(resolved, frame) };
  }

  it('uses door leaf width equal to actual opening width', () => {
    const { geometry } = doorGeometry(0);
    const door = buildPlanDoorSymbolGeometry({
      geometry,
      swingDirection: 'left',
      swingType: 'inswing',
    });
    expect(door.leafWidthMeters).toBeCloseTo(0.9, 6);
    expect(doorArcRadiusMeters(door)).toBeCloseTo(0.9, 6);
  });

  it('renders rough opening span from resolved placement stations', () => {
    const { geometry, resolved, frame } = doorGeometry(1);
    expect(geometry.roughWidthMeters).toBeCloseTo(1.0, 6);
    expect(geometry.roughStart).toEqual(planPointOnWall(frame, resolved.roughOpeningStartMeters));
    expect(geometry.roughEnd).toEqual(planPointOnWall(frame, resolved.roughOpeningEndMeters));
  });

  it('uses arc radius equal to door leaf width', () => {
    const { geometry } = doorGeometry(2);
    const door = buildPlanDoorSymbolGeometry({
      geometry,
      swingDirection: 'right',
      swingType: 'inswing',
    });
    expect(doorArcRadiusMeters(door)).toBeCloseTo(geometry.actualWidthMeters, 6);
  });

  it('renders inswing arc toward the interior side of the wall', () => {
    const { geometry, frame } = doorGeometry(0);
    const orientation = deriveWallPlanOrientation(frame);
    const door = buildPlanDoorSymbolGeometry({
      geometry,
      swingDirection: 'left',
      swingType: 'inswing',
    });
    expect(doorOpenLeafSideDot(door, orientation.interiorNormal)).toBeGreaterThan(0);
  });

  it('renders outswing arc toward the exterior side of the wall', () => {
    const { geometry, frame } = doorGeometry(0);
    const orientation = deriveWallPlanOrientation(frame);
    const door = buildPlanDoorSymbolGeometry({
      geometry,
      swingDirection: 'left',
      swingType: 'outswing',
    });
    expect(doorOpenLeafSideDot(door, orientation.exteriorNormal)).toBeGreaterThan(0);
  });

  it('places left-hand hinge on the lower station end', () => {
    const { geometry } = doorGeometry(3);
    const door = buildPlanDoorSymbolGeometry({
      geometry,
      swingDirection: 'left',
      swingType: DEFAULT_DOOR_SWING_TYPE,
    });
    expect(door.hinge).toEqual(geometry.actualStart);
    expect(door.closedLeafEnd).toEqual(geometry.actualEnd);
  });

  it('places right-hand hinge on the higher station end', () => {
    const { geometry } = doorGeometry(3);
    const door = buildPlanDoorSymbolGeometry({
      geometry,
      swingDirection: 'right',
      swingType: DEFAULT_DOOR_SWING_TYPE,
    });
    expect(door.hinge).toEqual(geometry.actualEnd);
    expect(door.closedLeafEnd).toEqual(geometry.actualStart);
  });

  it('renders correctly on horizontal and vertical wall segments', () => {
    const horizontal = frames.find((frame) => Math.abs(frame.tangent.x) > 0.9)!;
    const vertical = frames.find((frame) => Math.abs(frame.tangent.z) > 0.9)!;
    [horizontal, vertical].forEach((frame) => {
      const { geometry } = doorGeometry(frames.indexOf(frame));
      const door = buildPlanDoorSymbolGeometry({
        geometry,
        swingDirection: DEFAULT_DOOR_SWING_DIRECTION,
        swingType: DEFAULT_DOOR_SWING_TYPE,
      });
      expect(doorArcRadiusMeters(door)).toBeCloseTo(0.9, 6);
      expect(doorOpenLeafSideDot(door, geometry.inwardNormal)).toBeGreaterThan(0);
    });
  });

  it('preserves predictable handedness on reversed wall direction', () => {
    const reversed = frames.find((frame) => frame.tangent.x < -0.9 || frame.tangent.z < -0.9)!;
    const { geometry } = doorGeometry(frames.indexOf(reversed));
    const leftDoor = buildPlanDoorSymbolGeometry({
      geometry,
      swingDirection: 'left',
      swingType: 'inswing',
    });
    const rightDoor = buildPlanDoorSymbolGeometry({
      geometry,
      swingDirection: 'right',
      swingType: 'inswing',
    });
    expect(leftDoor.hinge).toEqual(geometry.actualStart);
    expect(rightDoor.hinge).toEqual(geometry.actualEnd);
  });

  it('matches preview and committed render symbols for the same settings', () => {
    const { frame, resolved, geometry } = doorGeometry(1);
    const preview = buildPlanOpeningRenderItem({
      key: 'preview',
      openingType: 'door',
      resolved,
      frame,
      isValid: true,
      placing: true,
      zoom: 36,
      swingDirection: 'right',
      swingType: 'outswing',
    });
    const committed = buildPlanOpeningRenderItem({
      key: 'committed',
      openingType: 'door',
      resolved,
      frame,
      isValid: true,
      placing: false,
      zoom: 36,
      swingDirection: 'right',
      swingType: 'outswing',
    });
    expect(preview.doorSymbol).toEqual(committed.doorSymbol);
    expect(preview.geometry.actualWidthMeters).toBeCloseTo(geometry.actualWidthMeters, 6);
  });

  it('restores swing settings from stored committed openings', () => {
    const { frame, resolved } = doorGeometry(2);
    const draft = openingDraftFromResolvedPlacement(
      resolved,
      { type: 'door', widthMeters: 0.9, heightMeters: 2.1, roughOpeningAllowanceMeters: 0.05 },
      preset.wall,
      preset.wallLayout,
      'door-swing-test',
    );
    const storedOpening = {
      ...draft,
      swingDirection: 'right' as const,
      swingType: 'outswing' as const,
    };
    const stored = resolveOpeningPlacementFromStoredOpening({
      opening: storedOpening,
      segmentFrame: frame,
      wall: { ...preset.wall, openings: [storedOpening] },
    });
    const item = buildPlanOpeningRenderItem({
      key: storedOpening.id,
      openingType: 'door',
      resolved: stored,
      frame,
      isValid: true,
      swingDirection: storedOpening.swingDirection,
      swingType: storedOpening.swingType,
      zoom: 36,
    });
    expect(item.doorSymbol?.swingDirection).toBe('right');
    expect(item.doorSymbol?.swingType).toBe('outswing');
  });
});
