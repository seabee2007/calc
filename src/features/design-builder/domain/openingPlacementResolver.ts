import { resolveCmuModuleConfig } from './cmuModuleRules';
import { segmentIdForWallFace, wallFaceForSegment } from './layoutWallAdapter';
import { getSegmentFramesForWallLayout } from '../geometry/designGeometry';
import type { SegmentFrame } from '../geometry/designGeometry';
import type { CmuWallSystemParameters, DesignBuilderSnapMode, DesignWallLayoutParameters, WallOpeningParameters } from '../types';

export const WALL_FACE_EPSILON_METERS = 0.001;

export type PlacementHitPoint = {
  x: number;
  y?: number;
  z: number;
};

export type OpeningPlacementDefinition = {
  type: WallOpeningParameters['type'];
  widthMeters: number;
  heightMeters: number;
  sillHeightMeters?: number;
  roughOpeningAllowanceMeters?: number;
};

export type ResolvedOpeningPlacement = {
  hostSegmentId: string;
  positionAlongSegmentMeters: number;
  roughOpeningStartMeters: number;
  roughOpeningEndMeters: number;
  actualOpeningStartMeters: number;
  actualOpeningEndMeters: number;
  wallCenterLineStart: { x: number; z: number };
  wallCenterLineEnd: { x: number; z: number };
  interiorSideSign: 1 | -1;
  wallRotationY: number;
  frameOrigin: { x: number; y: number; z: number };
  isValid: boolean;
  validationMessages: string[];
};

function enrichResolvedOpeningPlacement(
  placement: Omit<
    ResolvedOpeningPlacement,
    'wallCenterLineStart' | 'wallCenterLineEnd' | 'interiorSideSign'
  >,
  frame: SegmentFrame,
): ResolvedOpeningPlacement {
  return {
    ...placement,
    wallCenterLineStart: { x: frame.centerlineStart.x, z: frame.centerlineStart.z },
    wallCenterLineEnd: { x: frame.centerlineEnd.x, z: frame.centerlineEnd.z },
    interiorSideSign: 1,
  };
}

export function projectPointToSegmentStation(
  point: Pick<PlacementHitPoint, 'x' | 'z'>,
  frame: SegmentFrame,
): number {
  const toHitX = point.x - frame.centerlineStart.x;
  const toHitZ = point.z - frame.centerlineStart.z;
  return toHitX * frame.tangent.x + toHitZ * frame.tangent.z;
}

export function pointOnExteriorFace(
  frame: SegmentFrame,
  alongMeters: number,
  slabTopMeters = 0,
  verticalMeters = 0,
): { x: number; y: number; z: number } {
  return {
    x: frame.centerlineStart.x + frame.tangent.x * alongMeters,
    y: slabTopMeters + verticalMeters,
    z: frame.centerlineStart.z + frame.tangent.z * alongMeters,
  };
}

export function openingCenterStationFromStored(opening: WallOpeningParameters): number {
  if (opening.placementUsesCenterStation) {
    return opening.positionAlongSegment ?? 0;
  }
  const start = opening.positionAlongSegment ?? opening.offsetMeters ?? 0;
  return start + opening.widthMeters / 2;
}

export function openingStartStationFromCenter(centerStation: number, widthMeters: number): number {
  return centerStation - widthMeters / 2;
}

function roundMeters(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapStationMeters(
  stationMeters: number,
  snapMode: DesignBuilderSnapMode,
  moduleLengthMeters: number,
  gridSpacingMeters: number,
): number {
  if (snapMode === 'cmu_module' && moduleLengthMeters > 0) {
    return roundMeters(Math.round(stationMeters / moduleLengthMeters) * moduleLengthMeters);
  }
  if (snapMode === 'grid' && gridSpacingMeters > 0) {
    return roundMeters(Math.round(stationMeters / gridSpacingMeters) * gridSpacingMeters);
  }
  return roundMeters(stationMeters);
}

export function resolveRoughAndActualSpans(
  centerStationMeters: number,
  openingDefinition: OpeningPlacementDefinition,
): {
  actualOpeningStartMeters: number;
  actualOpeningEndMeters: number;
  roughOpeningStartMeters: number;
  roughOpeningEndMeters: number;
} {
  const actualWidthMeters = Math.max(0, openingDefinition.widthMeters);
  const allowance = Math.max(0, openingDefinition.roughOpeningAllowanceMeters ?? 0.05);
  const roughOpeningWidthMeters = Math.max(
    actualWidthMeters,
    openingDefinition.widthMeters + allowance * 2,
  );
  const actualOpeningStartMeters = roundMeters(centerStationMeters - actualWidthMeters / 2);
  const actualOpeningEndMeters = roundMeters(actualOpeningStartMeters + actualWidthMeters);
  const roughOpeningStartMeters = roundMeters(centerStationMeters - roughOpeningWidthMeters / 2);
  const roughOpeningEndMeters = roundMeters(roughOpeningStartMeters + roughOpeningWidthMeters);
  return {
    actualOpeningStartMeters,
    actualOpeningEndMeters,
    roughOpeningStartMeters,
    roughOpeningEndMeters,
  };
}

function validatePlacement(params: {
  frame: SegmentFrame;
  centerStationMeters: number;
  openingDefinition: OpeningPlacementDefinition;
  minimumEdgeDistanceMeters: number;
  wallHeightMeters: number;
}): { isValid: boolean; validationMessages: string[] } {
  const messages: string[] = [];
  const spans = resolveRoughAndActualSpans(params.centerStationMeters, params.openingDefinition);
  const minCenter = params.minimumEdgeDistanceMeters + params.openingDefinition.widthMeters / 2;
  const maxCenter =
    params.frame.lengthMeters - params.minimumEdgeDistanceMeters - params.openingDefinition.widthMeters / 2;

  if (params.centerStationMeters < minCenter - 1e-6) {
    messages.push('Opening is too close to the wall start.');
  }
  if (params.centerStationMeters > maxCenter + 1e-6) {
    messages.push('Opening is too close to the wall end.');
  }
  if (spans.roughOpeningStartMeters < 0 || spans.roughOpeningEndMeters > params.frame.lengthMeters) {
    messages.push('Rough opening extends beyond wall length.');
  }

  const sill = params.openingDefinition.type === 'door' ? 0 : params.openingDefinition.sillHeightMeters ?? 0;
  const allowance = Math.max(0, params.openingDefinition.roughOpeningAllowanceMeters ?? 0.05);
  const roughTop = sill + params.openingDefinition.heightMeters + allowance;
  if (roughTop > params.wallHeightMeters || sill < 0) {
    messages.push('Rough opening does not fit within wall height.');
  }

  return { isValid: messages.length === 0, validationMessages: messages };
}

export function clampOpeningCenterToSegment(
  centerStationMeters: number,
  widthMeters: number,
  segmentLengthMeters: number,
  minimumEdgeDistanceMeters = 0,
): number {
  const half = widthMeters / 2;
  const minCenter = minimumEdgeDistanceMeters + half;
  const maxCenter = segmentLengthMeters - minimumEdgeDistanceMeters - half;
  if (maxCenter < minCenter) return segmentLengthMeters / 2;
  return clamp(centerStationMeters, minCenter, maxCenter);
}

export function resolveOpeningPlacementFromWallHit(params: {
  hitPoint: PlacementHitPoint;
  hostSegmentId: string;
  segmentFrame: SegmentFrame;
  openingDefinition: OpeningPlacementDefinition;
  snapMode: DesignBuilderSnapMode;
  gridSpacingMeters?: number;
  wall: CmuWallSystemParameters;
  slabTopMeters?: number;
  minimumEdgeDistanceMeters?: number;
}): ResolvedOpeningPlacement {
  const module = resolveCmuModuleConfig(params.wall);
  const minimumEdgeDistanceMeters = params.minimumEdgeDistanceMeters ?? 0;
  const rawStationMeters = projectPointToSegmentStation(params.hitPoint, params.segmentFrame);
  const snappedCenter = snapStationMeters(
    rawStationMeters,
    params.snapMode,
    module.moduleLengthMeters,
    params.gridSpacingMeters ?? params.wall.blockLengthMeters ?? 0.4,
  );
  const openingCenterStationMeters = clampOpeningCenterToSegment(
    snappedCenter,
    params.openingDefinition.widthMeters,
    params.segmentFrame.lengthMeters,
    minimumEdgeDistanceMeters,
  );
  const spans = resolveRoughAndActualSpans(openingCenterStationMeters, params.openingDefinition);
  const validation = validatePlacement({
    frame: params.segmentFrame,
    centerStationMeters: openingCenterStationMeters,
    openingDefinition: params.openingDefinition,
    minimumEdgeDistanceMeters,
    wallHeightMeters: params.segmentFrame.wallHeightMeters,
  });
  const verticalMeters =
    params.openingDefinition.type === 'door'
      ? params.openingDefinition.heightMeters / 2
      : (params.openingDefinition.sillHeightMeters ?? 0) + params.openingDefinition.heightMeters / 2;

  return enrichResolvedOpeningPlacement(
    {
      hostSegmentId: params.hostSegmentId,
      positionAlongSegmentMeters: openingCenterStationMeters,
      roughOpeningStartMeters: spans.roughOpeningStartMeters,
      roughOpeningEndMeters: spans.roughOpeningEndMeters,
      actualOpeningStartMeters: spans.actualOpeningStartMeters,
      actualOpeningEndMeters: spans.actualOpeningEndMeters,
      wallRotationY: params.segmentFrame.rotationY,
      frameOrigin: pointOnExteriorFace(
        params.segmentFrame,
        openingCenterStationMeters,
        params.slabTopMeters ?? 0,
        verticalMeters,
      ),
      isValid: validation.isValid,
      validationMessages: validation.validationMessages,
    },
    params.segmentFrame,
  );
}

export function resolveOpeningPlacementFromLegacyFaceOffset(params: {
  wallFace: NonNullable<WallOpeningParameters['wallFace']>;
  offsetMeters: number;
  openingDefinition: OpeningPlacementDefinition;
  wall: CmuWallSystemParameters;
  layout: DesignWallLayoutParameters;
  snapMode?: DesignBuilderSnapMode;
  slabTopMeters?: number;
  minimumEdgeDistanceMeters?: number;
}): ResolvedOpeningPlacement | null {
  const segmentId = segmentIdForWallFace(params.layout, params.wallFace);
  if (!segmentId) return null;
  const frames = getSegmentFramesForWallLayout(params.layout, params.wall);
  const frame = segmentFrameById(frames, segmentId);
  if (!frame) return null;
  const centerStationMeters = params.offsetMeters + params.openingDefinition.widthMeters / 2;
  const hitPoint = {
    x: frame.exteriorStart.x + frame.tangent.x * centerStationMeters,
    z: frame.exteriorStart.z + frame.tangent.z * centerStationMeters,
  };
  return resolveOpeningPlacementFromWallHit({
    hitPoint,
    hostSegmentId: segmentId,
    segmentFrame: frame,
    openingDefinition: params.openingDefinition,
    snapMode: params.snapMode ?? 'off',
    gridSpacingMeters: params.layout.gridSpacingMeters,
    wall: params.wall,
    slabTopMeters: params.slabTopMeters,
    minimumEdgeDistanceMeters: params.minimumEdgeDistanceMeters,
  });
}

export function resolveOpeningPlacementFromPlanPoint(params: {
  planX: number;
  planZ: number;
  hostSegmentId: string;
  segmentFrame: SegmentFrame;
  openingDefinition: OpeningPlacementDefinition;
  snapMode: DesignBuilderSnapMode;
  gridSpacingMeters?: number;
  wall: CmuWallSystemParameters;
  slabTopMeters?: number;
  minimumEdgeDistanceMeters?: number;
}): ResolvedOpeningPlacement {
  return resolveOpeningPlacementFromWallHit({
    hitPoint: { x: params.planX, z: params.planZ },
    hostSegmentId: params.hostSegmentId,
    segmentFrame: params.segmentFrame,
    openingDefinition: params.openingDefinition,
    snapMode: params.snapMode,
    gridSpacingMeters: params.gridSpacingMeters,
    wall: params.wall,
    slabTopMeters: params.slabTopMeters,
    minimumEdgeDistanceMeters: params.minimumEdgeDistanceMeters,
  });
}

export function openingDraftFromResolvedPlacement(
  resolved: ResolvedOpeningPlacement,
  openingDefinition: OpeningPlacementDefinition,
  wall: CmuWallSystemParameters,
  layout: DesignWallLayoutParameters,
  id?: string,
): WallOpeningParameters {
  const wallFace = wallFaceForSegment(layout, resolved.hostSegmentId) ?? undefined;
  return {
    id: id ?? `${openingDefinition.type}-${resolved.hostSegmentId}-${Date.now()}`,
    type: openingDefinition.type,
    wallSegmentId: resolved.hostSegmentId,
    positionAlongSegment: resolved.positionAlongSegmentMeters,
    placementUsesCenterStation: true,
    wallFace,
    widthMeters: openingDefinition.widthMeters,
    heightMeters: openingDefinition.heightMeters,
    sillHeightMeters: openingDefinition.sillHeightMeters,
    roughOpeningAllowanceMeters: openingDefinition.roughOpeningAllowanceMeters ?? 0.05,
    lintelType: wall.lintelType ?? 'bond_beam',
    lintelBearingMeters: wall.lintelBearingMeters ?? 0.2,
    lintelCourseCount: wall.lintelCourseCount ?? 1,
    jambGroutEnabled: true,
    jambRebarEnabled: false,
    groutCellsEachSide: wall.jambCellsEachSide ?? 1,
    openingFrameMaterial: openingDefinition.type === 'door' ? 'hollow_metal' : 'vinyl',
    offsetMeters: resolved.actualOpeningStartMeters,
    ...(openingDefinition.type === 'door'
      ? {
          swingDirection: 'left' as const,
          swingType: 'inswing' as const,
        }
      : {}),
  };
}

export function resolveOpeningPlacementFromStoredOpening(params: {
  opening: WallOpeningParameters;
  segmentFrame: SegmentFrame;
  wall: CmuWallSystemParameters;
  slabTopMeters?: number;
}): ResolvedOpeningPlacement {
  const openingDefinition: OpeningPlacementDefinition = {
    type: params.opening.type,
    widthMeters: params.opening.widthMeters,
    heightMeters: params.opening.heightMeters,
    sillHeightMeters: params.opening.sillHeightMeters,
    roughOpeningAllowanceMeters: params.opening.roughOpeningAllowanceMeters,
  };
  const centerStationMeters = openingCenterStationFromStored(params.opening);
  const spans = resolveRoughAndActualSpans(centerStationMeters, openingDefinition);
  const validation = validatePlacement({
    frame: params.segmentFrame,
    centerStationMeters,
    openingDefinition,
    minimumEdgeDistanceMeters: 0,
    wallHeightMeters: params.segmentFrame.wallHeightMeters,
  });
  const verticalMeters =
    params.opening.type === 'door'
      ? params.opening.heightMeters / 2
      : (params.opening.sillHeightMeters ?? 0) + params.opening.heightMeters / 2;
  return enrichResolvedOpeningPlacement(
    {
      hostSegmentId: params.segmentFrame.segmentId,
      positionAlongSegmentMeters: centerStationMeters,
      roughOpeningStartMeters: spans.roughOpeningStartMeters,
      roughOpeningEndMeters: spans.roughOpeningEndMeters,
      actualOpeningStartMeters: spans.actualOpeningStartMeters,
      actualOpeningEndMeters: spans.actualOpeningEndMeters,
      wallRotationY: params.segmentFrame.rotationY,
      frameOrigin: pointOnExteriorFace(
        params.segmentFrame,
        centerStationMeters,
        params.slabTopMeters ?? 0,
        verticalMeters,
      ),
      isValid: validation.isValid,
      validationMessages: validation.validationMessages,
    },
    params.segmentFrame,
  );
}

export function segmentFrameById(
  frames: readonly SegmentFrame[],
  segmentId: string,
): SegmentFrame | null {
  return frames.find((frame) => frame.segmentId === segmentId) ?? null;
}

export function buildSegmentFrameMap(frames: readonly SegmentFrame[]): Map<string, SegmentFrame> {
  return new Map(frames.map((frame) => [frame.segmentId, frame]));
}
