import { resolveCmuModuleConfig } from './cmuModuleRules';
import type { ResolvedCmuOpening } from './cmuOpeningRules';
import type { GroutFillPlacement } from './openingAssemblySolver';
import { resolveLintelCourseIndex } from './openingAssemblySolver';
import type { SegmentFrame } from '../geometry/designGeometry';
import type { CmuWallSystemParameters, DesignWallLayoutParameters, WallOpeningParameters } from '../types';
import { wallFaceForSegment } from './layoutWallAdapter';

export const WALL_FACE_RENDER_EPSILON_METERS = 0.001;
export const OPENING_ALIGNMENT_TOLERANCE = 0.002;

export type Vec3 = { x: number; y: number; z: number };

export type OpeningAnchor = {
  openingId: string;
  hostSegmentId: string;
  centerStationMeters: number;
  sillHeightMeters: number;
  actualWidthMeters: number;
  actualHeightMeters: number;
  roughWidthMeters: number;
  roughHeightMeters: number;
};

export type OpeningAssemblySettings = Pick<
  WallOpeningParameters,
  | 'type'
  | 'roughOpeningAllowanceMeters'
  | 'roughOpeningWidthMeters'
  | 'roughOpeningHeightMeters'
  | 'lintelType'
  | 'lintelBearingMeters'
  | 'lintelCourseCount'
  | 'jambGroutEnabled'
  | 'jambRebarEnabled'
  | 'groutCellsEachSide'
  | 'groutCellsAboveOpening'
  | 'groutCellsBelowWindow'
  | 'openingFrameMaterial'
  | 'wallFace'
>;

export type ResolvedOpeningAssembly = {
  anchor: OpeningAnchor;

  segmentFrame: {
    segmentId: string;
    outsideFaceStart: Vec3;
    outsideFaceEnd: Vec3;
    tangent: Vec3;
    outwardNormal: Vec3;
    inwardNormal: Vec3;
    rotationY: number;
    wallThicknessMeters: number;
    lengthMeters: number;
  };

  actualOpening: {
    centerStationMeters: number;
    startStationMeters: number;
    endStationMeters: number;
    centerWorld: Vec3;
  };

  roughOpening: {
    centerStationMeters: number;
    startStationMeters: number;
    endStationMeters: number;
    centerWorld: Vec3;
  };

  framePlacement: {
    centerWorld: Vec3;
    rotationY: number;
  };

  lintelPlacement: {
    centerWorld: Vec3;
    rotationY: number;
  };

  jambCells: GroutFillPlacement[];
  lintelCells: GroutFillPlacement[];
};

function roundMeters(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function openingCenterStationFromStored(opening: WallOpeningParameters): number {
  if (opening.placementUsesCenterStation) {
    return opening.positionAlongSegment ?? 0;
  }
  const start = opening.positionAlongSegment ?? opening.offsetMeters ?? 0;
  return start + opening.widthMeters / 2;
}

function openingStartStationFromCenter(centerStation: number, widthMeters: number): number {
  return centerStation - widthMeters / 2;
}

export function resolveOpeningSpansFromAnchor(anchor: Pick<OpeningAnchor, 'centerStationMeters' | 'actualWidthMeters' | 'roughWidthMeters'>): {
  actualStartStationMeters: number;
  actualEndStationMeters: number;
  roughStartStationMeters: number;
  roughEndStationMeters: number;
} {
  const actualStartStationMeters = roundMeters(anchor.centerStationMeters - anchor.actualWidthMeters / 2);
  const actualEndStationMeters = roundMeters(actualStartStationMeters + anchor.actualWidthMeters);
  const roughStartStationMeters = roundMeters(anchor.centerStationMeters - anchor.roughWidthMeters / 2);
  const roughEndStationMeters = roundMeters(roughStartStationMeters + anchor.roughWidthMeters);
  return {
    actualStartStationMeters,
    actualEndStationMeters,
    roughStartStationMeters,
    roughEndStationMeters,
  };
}

export function stationToWorldOnExteriorFace(
  frame: SegmentFrame,
  centerStationMeters: number,
  sillHeightMeters: number,
  verticalMeters = 0,
): Vec3 {
  return {
    x:
      frame.exteriorStart.x +
      frame.tangent.x * centerStationMeters +
      frame.outwardNormal.x * WALL_FACE_RENDER_EPSILON_METERS,
    y: sillHeightMeters + verticalMeters,
    z:
      frame.exteriorStart.z +
      frame.tangent.z * centerStationMeters +
      frame.outwardNormal.z * WALL_FACE_RENDER_EPSILON_METERS,
  };
}

export function stationToWorldOnMidPlane(
  frame: SegmentFrame,
  centerStationMeters: number,
  yMeters: number,
): Vec3 {
  const inwardOffset = frame.wallThicknessMeters / 2;
  return {
    x: frame.exteriorStart.x + frame.tangent.x * centerStationMeters + frame.inwardNormal.x * inwardOffset,
    y: yMeters,
    z: frame.exteriorStart.z + frame.tangent.z * centerStationMeters + frame.inwardNormal.z * inwardOffset,
  };
}

export function openingAnchorFromStored(
  opening: WallOpeningParameters,
  hostSegmentId?: string,
): OpeningAnchor | null {
  const segmentId = hostSegmentId ?? opening.wallSegmentId;
  if (!segmentId) return null;
  const allowance = Math.max(0, opening.roughOpeningAllowanceMeters ?? 0.05);
  const actualWidthMeters = Math.max(0, opening.widthMeters);
  const actualHeightMeters = Math.max(0, opening.heightMeters);
  const roughWidthMeters = Math.max(
    actualWidthMeters,
    opening.roughOpeningWidthMeters ?? actualWidthMeters + allowance * 2,
  );
  const roughHeightMeters = Math.max(
    actualHeightMeters,
    opening.roughOpeningHeightMeters ?? actualHeightMeters + allowance * 2,
  );
  return {
    openingId: opening.id,
    hostSegmentId: segmentId,
    centerStationMeters: openingCenterStationFromStored(opening),
    sillHeightMeters: opening.type === 'door' ? 0 : opening.sillHeightMeters ?? 0,
    actualWidthMeters,
    actualHeightMeters,
    roughWidthMeters,
    roughHeightMeters,
  };
}

export function openingAnchorFromResolvedPlacement(
  resolved: {
    hostSegmentId: string;
    positionAlongSegmentMeters: number;
    roughOpeningStartMeters: number;
    roughOpeningEndMeters: number;
    actualOpeningStartMeters: number;
    actualOpeningEndMeters: number;
  },
  openingDefinition: {
    type: WallOpeningParameters['type'];
    widthMeters: number;
    heightMeters: number;
    sillHeightMeters?: number;
    roughOpeningAllowanceMeters?: number;
  },
  openingId: string,
): OpeningAnchor {
  const allowance = Math.max(0, openingDefinition.roughOpeningAllowanceMeters ?? 0.05);
  const actualWidthMeters = Math.max(0, openingDefinition.widthMeters);
  const actualHeightMeters = Math.max(0, openingDefinition.heightMeters);
  const roughWidthMeters = Math.max(
    actualWidthMeters,
    actualWidthMeters + allowance * 2,
    resolved.roughOpeningEndMeters - resolved.roughOpeningStartMeters,
  );
  const roughHeightMeters = Math.max(
    actualHeightMeters,
    actualHeightMeters + allowance * 2,
  );
  return {
    openingId,
    hostSegmentId: resolved.hostSegmentId,
    centerStationMeters: resolved.positionAlongSegmentMeters,
    sillHeightMeters: openingDefinition.type === 'door' ? 0 : openingDefinition.sillHeightMeters ?? 0,
    actualWidthMeters,
    actualHeightMeters,
    roughWidthMeters,
    roughHeightMeters,
  };
}

export function resolveOpeningAssembly(params: {
  anchor: OpeningAnchor;
  hostSegment: SegmentFrame;
  masonrySettings: CmuWallSystemParameters;
  openingSettings: OpeningAssemblySettings;
  slabTopMeters?: number;
}): ResolvedOpeningAssembly {
  const frame = params.hostSegment;
  const spans = resolveOpeningSpansFromAnchor(params.anchor);
  const segmentLength = frame.lengthMeters;
  const clampedRoughStart = clamp(
    spans.roughStartStationMeters,
    0,
    Math.max(0, segmentLength - params.anchor.roughWidthMeters),
  );
  const clampedRoughEnd = roundMeters(clampedRoughStart + params.anchor.roughWidthMeters);
  const roughCenterStation = roundMeters(clampedRoughStart + params.anchor.roughWidthMeters / 2);
  const actualStart = clamp(
    spans.actualStartStationMeters,
    0,
    Math.max(0, segmentLength - params.anchor.actualWidthMeters),
  );
  const actualEnd = roundMeters(actualStart + params.anchor.actualWidthMeters);
  const actualCenterStation = roundMeters(actualStart + params.anchor.actualWidthMeters / 2);

  const sill = params.anchor.sillHeightMeters;
  const slabTop = params.slabTopMeters ?? 0;
  const frameVertical =
    params.openingSettings.type === 'door'
      ? params.anchor.actualHeightMeters / 2
      : sill + params.anchor.actualHeightMeters / 2;
  const roughBottom = params.openingSettings.type === 'door'
    ? 0
    : Math.max(0, sill - (params.anchor.roughHeightMeters - params.anchor.actualHeightMeters) / 2);
  const roughTop = roughBottom + params.anchor.roughHeightMeters;

  const actualCenterWorld = stationToWorldOnExteriorFace(frame, actualCenterStation, slabTop, frameVertical);
  const roughCenterWorld = stationToWorldOnMidPlane(frame, roughCenterStation, slabTop + roughBottom + params.anchor.roughHeightMeters / 2);

  const moduleConfig = resolveCmuModuleConfig(params.masonrySettings);
  const moduleHeight = moduleConfig.moduleHeightMeters;
  const lintelCourseIndex = resolveLintelCourseIndex(roughTop, moduleHeight);
  const lintelCenterY = slabTop + lintelCourseIndex * moduleHeight + (moduleConfig.actualHeightMeters ?? moduleHeight) / 2;
  const lintelCenterWorld = stationToWorldOnMidPlane(frame, roughCenterStation, lintelCenterY);

  const assembly: ResolvedOpeningAssembly = {
    anchor: params.anchor,
    segmentFrame: {
      segmentId: frame.segmentId,
      outsideFaceStart: { x: frame.exteriorStart.x, y: 0, z: frame.exteriorStart.z },
      outsideFaceEnd: { x: frame.exteriorEnd.x, y: 0, z: frame.exteriorEnd.z },
      tangent: { x: frame.tangent.x, y: 0, z: frame.tangent.z },
      outwardNormal: { x: frame.outwardNormal.x, y: 0, z: frame.outwardNormal.z },
      inwardNormal: { x: frame.inwardNormal.x, y: 0, z: frame.inwardNormal.z },
      rotationY: frame.rotationY,
      wallThicknessMeters: frame.wallThicknessMeters,
      lengthMeters: frame.lengthMeters,
    },
    actualOpening: {
      centerStationMeters: actualCenterStation,
      startStationMeters: actualStart,
      endStationMeters: actualEnd,
      centerWorld: actualCenterWorld,
    },
    roughOpening: {
      centerStationMeters: roughCenterStation,
      startStationMeters: clampedRoughStart,
      endStationMeters: clampedRoughEnd,
      centerWorld: roughCenterWorld,
    },
    framePlacement: {
      centerWorld: actualCenterWorld,
      rotationY: frame.rotationY,
    },
    lintelPlacement: {
      centerWorld: lintelCenterWorld,
      rotationY: frame.rotationY,
    },
    jambCells: [],
    lintelCells: [],
  };

  assertOpeningHorizontalAlignment(assembly);
  return assembly;
}

export function layoutResolvedOpeningFromAssembly(
  assembly: ResolvedOpeningAssembly,
  masonrySettings: CmuWallSystemParameters,
  openingSettings: OpeningAssemblySettings,
): ResolvedCmuOpening & {
  wallSegmentId: string;
  worldX: number;
  worldZ: number;
  rotationY: number;
  wallThicknessMeters: number;
} {
  const moduleConfig = resolveCmuModuleConfig(masonrySettings);
  const lintelType = openingSettings.lintelType ?? masonrySettings.lintelType ?? 'bond_beam';
  const lintelBearingMeters = Math.max(0, openingSettings.lintelBearingMeters ?? masonrySettings.lintelBearingMeters ?? 0.2);
  const lintelCourseCount = Math.max(1, openingSettings.lintelCourseCount ?? masonrySettings.lintelCourseCount ?? 1);
  const lintelLengthMeters =
    lintelType === 'none'
      ? 0
      : Math.min(
          assembly.segmentFrame.lengthMeters,
          assembly.anchor.roughWidthMeters + lintelBearingMeters * 2,
        );
  const roughBottomMeters = openingSettings.type === 'door'
    ? 0
    : Math.max(
        0,
        assembly.anchor.sillHeightMeters -
          (assembly.anchor.roughHeightMeters - assembly.anchor.actualHeightMeters) / 2,
      );

  return {
    id: assembly.anchor.openingId,
    type: openingSettings.type,
    wallFace: openingSettings.wallFace ?? 'south',
    wallSegmentId: assembly.anchor.hostSegmentId,
    actualWidthMeters: assembly.anchor.actualWidthMeters,
    actualHeightMeters: assembly.anchor.actualHeightMeters,
    actualAreaSquareMeters: assembly.anchor.actualWidthMeters * assembly.anchor.actualHeightMeters,
    roughOpeningWidthMeters: assembly.anchor.roughWidthMeters,
    roughOpeningHeightMeters: assembly.anchor.roughHeightMeters,
    roughOpeningAreaSquareMeters: assembly.anchor.roughWidthMeters * assembly.anchor.roughHeightMeters,
    roughStartAlongMeters: assembly.roughOpening.startStationMeters,
    roughEndAlongMeters: assembly.roughOpening.endStationMeters,
    roughBottomMeters: roundMeters(roughBottomMeters),
    roughTopMeters: roundMeters(roughBottomMeters + assembly.anchor.roughHeightMeters),
    actualStartAlongMeters: assembly.actualOpening.startStationMeters,
    actualEndAlongMeters: assembly.actualOpening.endStationMeters,
    actualBottomMeters: assembly.anchor.sillHeightMeters,
    actualTopMeters: assembly.anchor.sillHeightMeters + assembly.anchor.actualHeightMeters,
    lintelType,
    lintelBearingMeters,
    lintelCourseCount,
    lintelLengthMeters,
    lintelHeightMeters:
      moduleConfig.actualHeightMeters ?? Math.max(0.01, moduleConfig.moduleHeightMeters - moduleConfig.mortarJointMeters),
    jambGroutEnabled: openingSettings.jambGroutEnabled ?? true,
    jambRebarEnabled: openingSettings.jambRebarEnabled ?? false,
    groutCellsEachSide: Math.max(0, openingSettings.groutCellsEachSide ?? masonrySettings.jambCellsEachSide ?? 1),
    jambGroutCellCount: (openingSettings.jambGroutEnabled ?? true)
      ? Math.max(0, openingSettings.groutCellsEachSide ?? masonrySettings.jambCellsEachSide ?? 1) * 2
      : 0,
    groutCellsAboveOpening: Math.max(0, openingSettings.groutCellsAboveOpening ?? 0),
    groutCellsBelowWindow: openingSettings.type === 'window' ? Math.max(0, openingSettings.groutCellsBelowWindow ?? 0) : 0,
    openingFrameMaterial: openingSettings.openingFrameMaterial ?? 'none',
    worldX: assembly.roughOpening.centerWorld.x,
    worldZ: assembly.roughOpening.centerWorld.z,
    rotationY: assembly.framePlacement.rotationY,
    wallThicknessMeters: assembly.segmentFrame.wallThicknessMeters,
  };
}

export function openingDraftFromAnchor(
  anchor: OpeningAnchor,
  openingSettings: OpeningAssemblySettings & { id?: string },
  wall: CmuWallSystemParameters,
  layout: DesignWallLayoutParameters,
): WallOpeningParameters {
  const startStation = openingStartStationFromCenter(anchor.centerStationMeters, anchor.actualWidthMeters);
  const wallFace = wallFaceForSegment(layout, anchor.hostSegmentId) ?? openingSettings.wallFace;
  return {
    id: openingSettings.id ?? anchor.openingId,
    type: openingSettings.type,
    wallSegmentId: anchor.hostSegmentId,
    positionAlongSegment: anchor.centerStationMeters,
    placementUsesCenterStation: true,
    wallFace,
    widthMeters: anchor.actualWidthMeters,
    heightMeters: anchor.actualHeightMeters,
    sillHeightMeters: anchor.sillHeightMeters,
    roughOpeningWidthMeters: anchor.roughWidthMeters,
    roughOpeningHeightMeters: anchor.roughHeightMeters,
    roughOpeningAllowanceMeters: Math.max(0, (anchor.roughWidthMeters - anchor.actualWidthMeters) / 2),
    lintelType: openingSettings.lintelType ?? wall.lintelType ?? 'bond_beam',
    lintelBearingMeters: openingSettings.lintelBearingMeters ?? wall.lintelBearingMeters ?? 0.2,
    lintelCourseCount: openingSettings.lintelCourseCount ?? wall.lintelCourseCount ?? 1,
    jambGroutEnabled: openingSettings.jambGroutEnabled ?? true,
    jambRebarEnabled: openingSettings.jambRebarEnabled ?? false,
    groutCellsEachSide: openingSettings.groutCellsEachSide ?? wall.jambCellsEachSide ?? 1,
    openingFrameMaterial: openingSettings.openingFrameMaterial ?? (openingSettings.type === 'door' ? 'hollow_metal' : 'vinyl'),
    offsetMeters: startStation,
  };
}

export function stationAlongSegmentAxis(
  frame: Pick<SegmentFrame, 'exteriorStart' | 'tangent'>,
  world: Pick<Vec3, 'x' | 'z'>,
): number {
  const dx = world.x - frame.exteriorStart.x;
  const dz = world.z - frame.exteriorStart.z;
  return dx * frame.tangent.x + dz * frame.tangent.z;
}

export function assertNear(actual: number, expected: number, tolerance: number, label: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

export function assertOpeningHorizontalAlignment(assembly: ResolvedOpeningAssembly): void {
  if (!import.meta.env.DEV) return;
  const frame = assembly.segmentFrame;
  const frameStation = stationAlongSegmentAxis(
    { exteriorStart: frame.outsideFaceStart, tangent: frame.tangent },
    assembly.framePlacement.centerWorld,
  );
  const roughStation = stationAlongSegmentAxis(
    { exteriorStart: frame.outsideFaceStart, tangent: frame.tangent },
    assembly.roughOpening.centerWorld,
  );
  const delta = Math.abs(frameStation - roughStation);
  if (delta > OPENING_ALIGNMENT_TOLERANCE) {
    console.warn('[opening-assembly] frame and rough-opening centers diverge along segment axis', {
      openingId: assembly.anchor.openingId,
      hostSegmentId: assembly.anchor.hostSegmentId,
      frameStation,
      roughStation,
      delta,
      anchorCenterStation: assembly.anchor.centerStationMeters,
      roughCenterStation: assembly.roughOpening.centerStationMeters,
      frameCenterWorld: assembly.framePlacement.centerWorld,
      roughOpeningCenterWorld: assembly.roughOpening.centerWorld,
    });
  }
}

export function logOpeningPlacementDiagnostics(params: {
  action: 'opening-preview-or-commit';
  openingId: string;
  hostSegmentId: string;
  segmentLengthMeters: number;
  rawHitStationMeters?: number;
  assembly: ResolvedOpeningAssembly;
}): void {
  if (!import.meta.env.DEV) return;
  const { assembly } = params;
  console.table({
    action: params.action,
    openingId: params.openingId,
    hostSegmentId: params.hostSegmentId,
    segmentLengthMeters: params.segmentLengthMeters,
    rawHitStationMeters: params.rawHitStationMeters,
    snappedCenterStationMeters: assembly.anchor.centerStationMeters,
    actualStartStationMeters: assembly.actualOpening.startStationMeters,
    actualEndStationMeters: assembly.actualOpening.endStationMeters,
    roughStartStationMeters: assembly.roughOpening.startStationMeters,
    roughEndStationMeters: assembly.roughOpening.endStationMeters,
    frameCenterWorld: `${assembly.framePlacement.centerWorld.x.toFixed(3)},${assembly.framePlacement.centerWorld.y.toFixed(3)},${assembly.framePlacement.centerWorld.z.toFixed(3)}`,
    roughOpeningCenterWorld: `${assembly.roughOpening.centerWorld.x.toFixed(3)},${assembly.roughOpening.centerWorld.y.toFixed(3)},${assembly.roughOpening.centerWorld.z.toFixed(3)}`,
    lintelCenterWorld: `${assembly.lintelPlacement.centerWorld.x.toFixed(3)},${assembly.lintelPlacement.centerWorld.y.toFixed(3)},${assembly.lintelPlacement.centerWorld.z.toFixed(3)}`,
  });
}
