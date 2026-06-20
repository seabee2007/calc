import { generateCmuLayout } from '../geometry/designGeometry';
import type {
  CmuWallSystemParameters,
  OpeningPlacementStatus,
  OpeningPlacementValidation,
  WallOpeningParameters,
} from '../types';
import { resolveCmuModuleConfig, snapOpeningToCmuModule } from './cmuModuleRules';
import { resolveCmuOpening } from './cmuOpeningRules';

import { segmentLength } from './wallLayoutRules';
import type { DesignWallLayoutParameters } from '../types';
import { openingToLegacyFaceOffset } from './layoutWallAdapter';

export type WallFace = NonNullable<WallOpeningParameters['wallFace']>;

export interface WallHitPoint {
  x: number;
  y: number;
  z: number;
}

export interface DefaultOpeningDimensions {
  widthMeters: number;
  heightMeters: number;
  sillHeightMeters?: number;
}

export const DEFAULT_DOOR_DIMENSIONS: DefaultOpeningDimensions = {
  widthMeters: 0.9,
  heightMeters: 2.1,
};

export const DEFAULT_WINDOW_DIMENSIONS: DefaultOpeningDimensions = {
  widthMeters: 1.2,
  heightMeters: 0.9,
  sillHeightMeters: 1,
};

export function resolveWallFaceFromHit(userData: { wallFace?: string } | undefined): WallFace | null {
  const face = userData?.wallFace;
  if (face === 'north' || face === 'south' || face === 'east' || face === 'west') return face;
  return null;
}

export function wallLengthForFace(wall: CmuWallSystemParameters, face: WallFace): number {
  if (!face) return wall.lengthMeters;
  return face === 'north' || face === 'south' ? wall.lengthMeters : wall.widthMeters;
}

export function projectHitToWallOffset(
  wallFace: WallFace,
  hit: WallHitPoint,
  wall: CmuWallSystemParameters,
): number {
  if (wallFace === 'north' || wallFace === 'south') {
    return hit.x + wall.lengthMeters / 2;
  }
  return hit.z + wall.widthMeters / 2;
}

export function clampOpeningToWall(
  opening: Pick<WallOpeningParameters, 'wallFace' | 'offsetMeters' | 'widthMeters'>,
  wall: CmuWallSystemParameters,
): number {
  const wallLength = wallLengthForFace(wall, opening.wallFace ?? 'south');
  const offset = opening.offsetMeters ?? 0;
  const maxOffset = Math.max(0, wallLength - opening.widthMeters);
  return Math.min(maxOffset, Math.max(0, offset));
}

export function segmentLengthForOpening(
  opening: Pick<WallOpeningParameters, 'wallSegmentId'>,
  layout: DesignWallLayoutParameters,
): number {
  if (!opening.wallSegmentId) return 0;
  const segment = layout.segments.find((item) => item.id === opening.wallSegmentId);
  if (!segment) return 0;
  return segmentLength(segment, layout.nodes);
}

export function clampOpeningToSegment(
  opening: Pick<WallOpeningParameters, 'wallSegmentId' | 'positionAlongSegment' | 'widthMeters'>,
  layout: DesignWallLayoutParameters,
): number {
  const wallLength = segmentLengthForOpening(opening, layout);
  const offset = opening.positionAlongSegment ?? 0;
  const maxOffset = Math.max(0, wallLength - opening.widthMeters);
  return Math.min(maxOffset, Math.max(0, offset));
}

export function createOpeningDraftForSegment(
  type: WallOpeningParameters['type'],
  wallSegmentId: string,
  positionAlongSegment: number,
  wall: CmuWallSystemParameters,
  layout: DesignWallLayoutParameters,
  id?: string,
): WallOpeningParameters {
  const defaults = type === 'door' ? DEFAULT_DOOR_DIMENSIONS : DEFAULT_WINDOW_DIMENSIONS;
  const draft: WallOpeningParameters = {
    id: id ?? `${type}-${wallSegmentId}-${Date.now()}`,
    type,
    wallSegmentId,
    positionAlongSegment,
    widthMeters: defaults.widthMeters,
    heightMeters: defaults.heightMeters,
    sillHeightMeters: defaults.sillHeightMeters,
    roughOpeningAllowanceMeters: 0.05,
    lintelType: wall.lintelType ?? 'bond_beam',
    lintelBearingMeters: wall.lintelBearingMeters ?? 0.2,
    lintelCourseCount: wall.lintelCourseCount ?? 1,
    jambGroutEnabled: true,
    jambRebarEnabled: false,
    groutCellsEachSide: wall.jambCellsEachSide ?? 1,
    openingFrameMaterial: type === 'door' ? 'hollow_metal' : 'vinyl',
  };
  const legacy = openingToLegacyFaceOffset(draft, layout);
  const snapped = wall.snapToModule ? snapOpeningToCmuModule(legacy, wall) : legacy;
  return {
    ...draft,
    wallFace: snapped.wallFace,
    offsetMeters: snapped.offsetMeters,
    positionAlongSegment: clampOpeningToSegment(
      { ...draft, positionAlongSegment: snapped.offsetMeters ?? positionAlongSegment },
      layout,
    ),
  };
}

export function applyOpeningSegmentPatch(
  opening: WallOpeningParameters,
  wall: CmuWallSystemParameters,
  layout: DesignWallLayoutParameters,
  patch: Partial<Pick<WallOpeningParameters, 'wallSegmentId' | 'positionAlongSegment' | 'wallFace' | 'offsetMeters'>>,
): WallOpeningParameters {
  const merged = { ...opening, ...patch };
  const legacy = openingToLegacyFaceOffset(merged, layout);
  const snapped = wall.snapToModule ? snapOpeningToCmuModule(legacy, wall) : legacy;
  return {
    ...merged,
    wallFace: snapped.wallFace,
    offsetMeters: snapped.offsetMeters,
    positionAlongSegment: clampOpeningToSegment(
      { ...merged, positionAlongSegment: snapped.offsetMeters ?? merged.positionAlongSegment ?? 0 },
      layout,
    ),
  };
}

export function createOpeningDraft(
  type: WallOpeningParameters['type'],
  wallFace: WallFace,
  offsetMeters: number,
  wall: CmuWallSystemParameters,
  id?: string,
): WallOpeningParameters {
  const defaults = type === 'door' ? DEFAULT_DOOR_DIMENSIONS : DEFAULT_WINDOW_DIMENSIONS;
  const draft: WallOpeningParameters = {
    id: id ?? `${type}-${wallFace}-${Date.now()}`,
    type,
    wallFace,
    offsetMeters,
    widthMeters: defaults.widthMeters,
    heightMeters: defaults.heightMeters,
    sillHeightMeters: defaults.sillHeightMeters,
    roughOpeningAllowanceMeters: 0.05,
    lintelType: wall.lintelType ?? 'bond_beam',
    lintelBearingMeters: wall.lintelBearingMeters ?? 0.2,
    lintelCourseCount: wall.lintelCourseCount ?? 1,
    jambGroutEnabled: true,
    jambRebarEnabled: false,
    groutCellsEachSide: wall.jambCellsEachSide ?? 1,
    openingFrameMaterial: type === 'door' ? 'hollow_metal' : 'vinyl',
  };
  const snapped = wall.snapToModule ? snapOpeningToCmuModule(draft, wall) : draft;
  return {
    ...snapped,
    offsetMeters: clampOpeningToWall(snapped, wall),
  };
}

export function validateOpeningPlacement(
  opening: WallOpeningParameters,
  wall: CmuWallSystemParameters,
  otherOpenings: readonly WallOpeningParameters[] = wall.openings,
  options?: { minimumEdgeDistanceMeters?: number },
): OpeningPlacementValidation {
  const warnings: string[] = [];
  const wallLength = wallLengthForFace(wall, opening.wallFace ?? 'south');
  const minEdge = options?.minimumEdgeDistanceMeters ?? 0;
  const resolved = resolveCmuOpening(wall, opening);
  const offset = opening.offsetMeters ?? opening.positionAlongSegment ?? 0;
  const faceLabel = opening.wallFace ?? opening.wallSegmentId ?? 'segment';

  if (offset < minEdge) {
    warnings.push(`Opening is too close to the ${faceLabel} wall start.`);
  }
  if (offset + opening.widthMeters > wallLength - minEdge) {
    warnings.push(`Opening is too close to the ${faceLabel} wall end.`);
  }
  if (resolved.roughEndAlongMeters > wallLength || resolved.roughStartAlongMeters < 0) {
    warnings.push('Rough opening extends beyond wall length.');
  }
  if (resolved.roughTopMeters > wall.heightMeters || resolved.roughBottomMeters < 0) {
    warnings.push('Rough opening does not fit within wall height.');
  }
  if (opening.lintelType === 'none' || (opening.lintelType ?? wall.lintelType) === 'none') {
    warnings.push('No lintel/bond beam is assigned above this opening.');
  }

  const peers = otherOpenings.filter(
    (item) =>
      item.id !== opening.id &&
      (opening.wallSegmentId
        ? item.wallSegmentId === opening.wallSegmentId
        : item.wallFace === opening.wallFace),
  );
  peers.forEach((peer) => {
    const peerResolved = resolveCmuOpening(wall, peer);
    if (
      resolved.roughStartAlongMeters < peerResolved.roughEndAlongMeters &&
      resolved.roughEndAlongMeters > peerResolved.roughStartAlongMeters
    ) {
      warnings.push(`Opening overlaps ${peer.type} ${peer.id} on the same wall segment.`);
    }
  });

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

export function summarizeOpeningPlacementStatus(
  opening: WallOpeningParameters,
  wall: CmuWallSystemParameters,
  otherOpenings: readonly WallOpeningParameters[] = wall.openings.filter((item) => item.id !== opening.id),
): OpeningPlacementStatus {
  const validation = validateOpeningPlacement(opening, wall, otherOpenings);
  const trialWall: CmuWallSystemParameters = {
    ...wall,
    openings: [...otherOpenings.filter((item) => item.id !== opening.id), opening],
  };
  const layout = generateCmuLayout(trialWall);
  const closures = layout.openingCourseClosures.filter((closure) => closure.openingId === opening.id);
  const cutCount = closures.filter((closure) => closure.closureType === 'cut_block').length;
  const halfCount = closures.filter((closure) => closure.closureType === 'half_block').length;

  if (!validation.isValid) {
    return {
      kind: 'invalid',
      label: 'Invalid placement',
      warnings: validation.warnings,
      isValid: false,
    };
  }
  if (cutCount > 0) {
    return {
      kind: 'cut_block',
      label: 'Cut-Block Condition',
      warnings: [
        ...validation.warnings,
        `Opening creates non-modular jamb cuts on ${cutCount} course${cutCount === 1 ? '' : 's'}.`,
      ],
      isValid: true,
    };
  }
  if (halfCount > 0) {
    return {
      kind: 'half_block',
      label: 'Half-block condition',
      warnings: validation.warnings,
      isValid: true,
    };
  }
  return {
    kind: 'clean',
    label: 'Clean jamb layout',
    warnings: validation.warnings,
    isValid: true,
  };
}

export function applyOpeningPlacementPatch(
  opening: WallOpeningParameters,
  wall: CmuWallSystemParameters,
  patch: Partial<Pick<WallOpeningParameters, 'wallFace' | 'offsetMeters'>>,
): WallOpeningParameters {
  const merged = {
    ...opening,
    ...patch,
  };
  const snapped = wall.snapToModule ? snapOpeningToCmuModule(merged, wall) : merged;
  return {
    ...snapped,
    offsetMeters: clampOpeningToWall(snapped, wall),
  };
}

export function snapOffsetToModule(
  offsetMeters: number,
  openingWidthMeters: number,
  wall: CmuWallSystemParameters,
  wallFace: WallFace,
): number {
  const module = resolveCmuModuleConfig(wall);
  const wallLength = wallLengthForFace(wall, wallFace);
  const snapped = Math.round(offsetMeters / module.moduleLengthMeters) * module.moduleLengthMeters;
  return clampOpeningToWall({ wallFace, offsetMeters: snapped, widthMeters: openingWidthMeters }, wall);
}
