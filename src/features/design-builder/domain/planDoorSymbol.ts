import type { SegmentFrame } from '../geometry/designGeometry';
import type { PlanOpeningGeometry } from './planOpeningGraphics';

export type DoorSwingDirection = 'left' | 'right';
export type DoorSwingType = 'inswing' | 'outswing';

/** @alias swingType — inswing/outswing relative to wall interior. */
export type DoorSwingDirectionSetting = DoorSwingType;
/** @alias swingDirection — hinge side along increasing wall-station direction. */
export type DoorHingeSide = DoorSwingDirection;

export const DEFAULT_DOOR_SWING_DIRECTION: DoorSwingDirection = 'left';
export const DEFAULT_DOOR_SWING_TYPE: DoorSwingType = 'inswing';

export function resolveDoorSwingType(
  opening: { swingType?: DoorSwingType } | null | undefined,
): DoorSwingType {
  return opening?.swingType ?? DEFAULT_DOOR_SWING_TYPE;
}

export function resolveDoorSwingDirection(
  opening: { swingDirection?: DoorSwingDirection } | null | undefined,
): DoorSwingDirection {
  return opening?.swingDirection ?? DEFAULT_DOOR_SWING_DIRECTION;
}

export type WallPlanOrientation = {
  tangent: { x: number; z: number };
  interiorNormal: { x: number; z: number };
  exteriorNormal: { x: number; z: number };
  interiorSideSign: 1 | -1;
  wallCenterLineStart: { x: number; z: number };
  wallCenterLineEnd: { x: number; z: number };
};

export type PlanDoorSymbolGeometry = {
  hinge: { x: number; z: number };
  closedLeafEnd: { x: number; z: number };
  openLeafEnd: { x: number; z: number };
  leafWidthMeters: number;
  swingDirection: DoorSwingDirection;
  swingType: DoorSwingType;
  swingSideNormal: { x: number; z: number };
};

export function deriveWallPlanOrientation(frame: SegmentFrame): WallPlanOrientation {
  return {
    tangent: { ...frame.tangent },
    interiorNormal: { ...frame.inwardNormal },
    exteriorNormal: { ...frame.outwardNormal },
    interiorSideSign: 1,
    wallCenterLineStart: { x: frame.centerlineStart.x, z: frame.centerlineStart.z },
    wallCenterLineEnd: { x: frame.centerlineEnd.x, z: frame.centerlineEnd.z },
  };
}

export function normalizePlanVector(vector: { x: number; z: number }): { x: number; z: number } {
  const length = Math.hypot(vector.x, vector.z) || 1;
  return { x: vector.x / length, z: vector.z / length };
}

export function rotatePlanVectorTowardNormal(
  vector: { x: number; z: number },
  targetNormal: { x: number; z: number },
): { x: number; z: number } {
  const ccw = { x: -vector.z, z: vector.x };
  const cw = { x: vector.z, z: -vector.x };
  const ccwDot = ccw.x * targetNormal.x + ccw.z * targetNormal.z;
  const cwDot = cw.x * targetNormal.x + cw.z * targetNormal.z;
  const rotated = ccwDot >= cwDot ? ccw : cw;
  const length = Math.hypot(vector.x, vector.z);
  const rotatedLength = Math.hypot(rotated.x, rotated.z) || 1;
  return {
    x: (rotated.x / rotatedLength) * length,
    z: (rotated.z / rotatedLength) * length,
  };
}

export function buildPlanDoorSymbolGeometry(params: {
  geometry: PlanOpeningGeometry;
  swingDirection: DoorSwingDirection;
  swingType: DoorSwingType;
}): PlanDoorSymbolGeometry {
  const leafWidthMeters = params.geometry.actualWidthMeters;
  const roughHinge =
    params.swingDirection === 'left' ? params.geometry.actualStart : params.geometry.actualEnd;
  const roughClosedLeafEnd =
    params.swingDirection === 'left' ? params.geometry.actualEnd : params.geometry.actualStart;
  const swingSideNormal =
    params.swingType === 'inswing'
      ? normalizePlanVector(params.geometry.inwardNormal)
      : normalizePlanVector({
          x: -params.geometry.inwardNormal.x,
          z: -params.geometry.inwardNormal.z,
        });
  const hinge = { ...roughHinge };
  const closedLeafEnd = { ...roughClosedLeafEnd };
  const closedLeafVector = {
    x: closedLeafEnd.x - hinge.x,
    z: closedLeafEnd.z - hinge.z,
  };
  const openLeafVector = rotatePlanVectorTowardNormal(closedLeafVector, swingSideNormal);
  const openLeafEnd = {
    x: hinge.x + openLeafVector.x,
    z: hinge.z + openLeafVector.z,
  };

  return {
    hinge,
    closedLeafEnd,
    openLeafEnd,
    leafWidthMeters,
    swingDirection: params.swingDirection,
    swingType: params.swingType,
    swingSideNormal,
  };
}

export function formatDoorSwingLabel(
  swingType: DoorSwingType,
  swingDirection: DoorSwingDirection,
): string {
  const typeLabel = swingType === 'inswing' ? 'Inswing' : 'Outswing';
  const directionLabel = swingDirection === 'left' ? 'Left' : 'Right';
  return `${typeLabel} ${directionLabel}`;
}

type ScreenPoint = { sx: number; sy: number };

export function buildDoorSwingArcScreenPath(params: {
  hinge: ScreenPoint;
  closedLeafEnd: ScreenPoint;
  openLeafEnd: ScreenPoint;
}): string {
  const radius = Math.hypot(
    params.closedLeafEnd.sx - params.hinge.sx,
    params.closedLeafEnd.sy - params.hinge.sy,
  );
  if (radius <= 0.001) return '';
  const sweep =
    (params.closedLeafEnd.sx - params.hinge.sx) * (params.openLeafEnd.sy - params.hinge.sy) -
      (params.closedLeafEnd.sy - params.hinge.sy) * (params.openLeafEnd.sx - params.hinge.sx) <
    0
      ? 0
      : 1;
  return `M ${params.closedLeafEnd.sx} ${params.closedLeafEnd.sy} A ${radius} ${radius} 0 0 ${sweep} ${params.openLeafEnd.sx} ${params.openLeafEnd.sy}`;
}

export function doorArcRadiusMeters(door: PlanDoorSymbolGeometry): number {
  return Math.hypot(
    door.closedLeafEnd.x - door.hinge.x,
    door.closedLeafEnd.z - door.hinge.z,
  );
}

export function doorOpenLeafSideDot(
  door: PlanDoorSymbolGeometry,
  sideNormal: { x: number; z: number },
): number {
  const openVector = {
    x: door.openLeafEnd.x - door.hinge.x,
    z: door.openLeafEnd.z - door.hinge.z,
  };
  return openVector.x * sideNormal.x + openVector.z * sideNormal.z;
}
