import { generateCmuLayout } from '../geometry/designGeometry';
import type {
  CmuWallSystemParameters,
  DesignBuilderSnapMode,
  OpeningPlacementStatus,
  OpeningPlacementValidation,
  WallOpeningParameters,
} from '../types';
import { resolveCmuModuleConfig, snapOpeningToCmuModule } from './cmuModuleRules';
import { resolveCmuOpening } from './cmuOpeningRules';

import {
  clampOpeningCenterToSegment,
  openingCenterStationFromStored,
  openingDraftFromResolvedPlacement,
  resolveOpeningPlacementFromLegacyFaceOffset,
  resolveOpeningPlacementFromWallHit,
  type OpeningPlacementDefinition,
  type ResolvedOpeningPlacement,
  segmentFrameById,
} from './openingPlacementResolver';
import { getSegmentFramesForWallLayout } from '../geometry/designGeometry';
import { openingToLegacyFaceOffset, wallFaceForSegment } from './layoutWallAdapter';
import { segmentLength } from './wallLayoutRules';
import type { DesignWallLayoutParameters } from '../types';
import {
  DEFAULT_DOOR_DIMENSIONS,
  DEFAULT_WINDOW_DIMENSIONS,
  resolveHeadAlignedWindowSillHeight,
} from './openingDefaults';
export type { DefaultOpeningDimensions } from './openingDefaults';
export {
  DEFAULT_DOOR_DIMENSIONS,
  DEFAULT_WINDOW_DIMENSIONS,
  resolveHeadAlignedWindowSillHeight,
};

export type WallFace = NonNullable<WallOpeningParameters['wallFace']>;

export interface WallHitPoint {
  x: number;
  y: number;
  z: number;
}

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
  opening: Pick<WallOpeningParameters, 'wallSegmentId' | 'positionAlongSegment' | 'widthMeters' | 'placementUsesCenterStation'>,
  layout: DesignWallLayoutParameters,
): number {
  const wallLength = segmentLengthForOpening(opening, layout);
  const center = opening.placementUsesCenterStation
    ? (opening.positionAlongSegment ?? 0)
    : (opening.positionAlongSegment ?? 0) + opening.widthMeters / 2;
  return clampOpeningCenterToSegment(center, opening.widthMeters, wallLength);
}

export function createOpeningDraftForSegment(
  type: WallOpeningParameters['type'],
  wallSegmentId: string,
  positionAlongSegment: number,
  wall: CmuWallSystemParameters,
  layout: DesignWallLayoutParameters,
  id?: string,
  options?: { placementUsesCenterStation?: boolean },
): WallOpeningParameters {
  const defaults = type === 'door' ? DEFAULT_DOOR_DIMENSIONS : DEFAULT_WINDOW_DIMENSIONS;
  const usesCenter = options?.placementUsesCenterStation ?? true;
  const centerStation = usesCenter
    ? positionAlongSegment
    : positionAlongSegment + defaults.widthMeters / 2;
  const frames = getSegmentFramesForWallLayout(layout, wall);
  const frame = segmentFrameById(frames, wallSegmentId);
  if (!frame) {
    const draft: WallOpeningParameters = {
      id: id ?? `${type}-${wallSegmentId}-${Date.now()}`,
      type,
      wallSegmentId,
      positionAlongSegment: centerStation,
      placementUsesCenterStation: true,
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
    return draft;
  }
  const resolved = resolveOpeningPlacementFromWallHit({
    hitPoint: {
      x: frame.exteriorStart.x + frame.tangent.x * centerStation,
      z: frame.exteriorStart.z + frame.tangent.z * centerStation,
    },
    hostSegmentId: wallSegmentId,
    segmentFrame: frame,
    openingDefinition: {
      type,
      widthMeters: defaults.widthMeters,
      heightMeters: defaults.heightMeters,
      sillHeightMeters: defaults.sillHeightMeters,
      roughOpeningAllowanceMeters: 0.05,
    },
    snapMode: wall.snapToModule ? 'cmu_module' : 'grid',
    gridSpacingMeters: layout.gridSpacingMeters,
    wall,
  });
  const draft = openingDraftFromResolvedPlacement(resolved, {
    type,
    widthMeters: defaults.widthMeters,
    heightMeters: defaults.heightMeters,
    sillHeightMeters: defaults.sillHeightMeters,
    roughOpeningAllowanceMeters: 0.05,
  }, wall, layout, id);
  const wallFace = wallFaceForSegment(layout, wallSegmentId);
  return {
    ...draft,
    wallFace: wallFace ?? draft.wallFace,
    offsetMeters: resolved.actualOpeningStartMeters,
  };
}

export function resolveOpeningPlacementForHit(params: {
  hitPoint: { x: number; z: number; y?: number };
  wallSegmentId: string;
  openingDefinition: OpeningPlacementDefinition;
  wall: CmuWallSystemParameters;
  layout: DesignWallLayoutParameters;
  snapMode: DesignBuilderSnapMode;
  slabTopMeters?: number;
}): ResolvedOpeningPlacement | null {
  const frames = getSegmentFramesForWallLayout(params.layout, params.wall);
  const frame = segmentFrameById(frames, params.wallSegmentId);
  if (!frame) return null;
  return resolveOpeningPlacementFromWallHit({
    hitPoint: params.hitPoint,
    hostSegmentId: params.wallSegmentId,
    segmentFrame: frame,
    openingDefinition: params.openingDefinition,
    snapMode: params.snapMode,
    gridSpacingMeters: params.layout.gridSpacingMeters,
    wall: params.wall,
    slabTopMeters: params.slabTopMeters,
  });
}

export function resolveOpeningPlacementForLegacyFaceOffset(params: {
  wallFace: WallFace;
  offsetMeters: number;
  openingDefinition: OpeningPlacementDefinition;
  wall: CmuWallSystemParameters;
  layout: DesignWallLayoutParameters;
  snapMode?: DesignBuilderSnapMode;
  slabTopMeters?: number;
}): ResolvedOpeningPlacement | null {
  return resolveOpeningPlacementFromLegacyFaceOffset({
    wallFace: params.wallFace,
    offsetMeters: params.offsetMeters,
    openingDefinition: params.openingDefinition,
    wall: params.wall,
    layout: params.layout,
    snapMode: params.snapMode ?? 'off',
    slabTopMeters: params.slabTopMeters,
  });
}

export function openingDraftFromPlacementResolution(
  resolved: ResolvedOpeningPlacement,
  openingDefinition: OpeningPlacementDefinition,
  wall: CmuWallSystemParameters,
  layout: DesignWallLayoutParameters,
  id?: string,
): WallOpeningParameters {
  const draft = openingDraftFromResolvedPlacement(resolved, openingDefinition, wall, layout, id);
  const wallFace = wallFaceForSegment(layout, resolved.hostSegmentId);
  return {
    ...draft,
    wallFace: wallFace ?? draft.wallFace,
    offsetMeters: resolved.actualOpeningStartMeters,
  };
}

export function applyOpeningSegmentPatch(
  opening: WallOpeningParameters,
  wall: CmuWallSystemParameters,
  layout: DesignWallLayoutParameters,
  patch: Partial<Pick<WallOpeningParameters, 'wallSegmentId' | 'positionAlongSegment' | 'wallFace' | 'offsetMeters' | 'placementUsesCenterStation'>>,
  options?: { hitPoint?: { x: number; z: number }; snapMode?: DesignBuilderSnapMode },
): WallOpeningParameters {
  const merged = { ...opening, ...patch, placementUsesCenterStation: true };
  const segmentId = merged.wallSegmentId;
  if (!segmentId) return merged;
  const frames = getSegmentFramesForWallLayout(layout, wall);
  const frame = segmentFrameById(frames, segmentId);
  if (!frame) return merged;

  const centerStation =
    merged.positionAlongSegment ??
    openingCenterStationFromStored({ ...opening, ...patch });
  const hitPoint = options?.hitPoint ?? {
    x: frame.exteriorStart.x + frame.tangent.x * centerStation,
    z: frame.exteriorStart.z + frame.tangent.z * centerStation,
  };
  const resolved = resolveOpeningPlacementFromWallHit({
    hitPoint,
    hostSegmentId: segmentId,
    segmentFrame: frame,
    openingDefinition: {
      type: merged.type,
      widthMeters: merged.widthMeters,
      heightMeters: merged.heightMeters,
      sillHeightMeters: merged.sillHeightMeters,
      roughOpeningAllowanceMeters: merged.roughOpeningAllowanceMeters,
    },
    snapMode: options?.snapMode ?? (wall.snapToModule ? 'cmu_module' : 'grid'),
    gridSpacingMeters: layout.gridSpacingMeters,
    wall,
  });
  const draft = openingDraftFromResolvedPlacement(
    resolved,
    {
      type: merged.type,
      widthMeters: merged.widthMeters,
      heightMeters: merged.heightMeters,
      sillHeightMeters: merged.sillHeightMeters,
      roughOpeningAllowanceMeters: merged.roughOpeningAllowanceMeters,
    },
    wall,
    layout,
    merged.id,
  );
  const wallFace = wallFaceForSegment(layout, segmentId);
  return {
    ...merged,
    ...draft,
    wallFace: wallFace ?? draft.wallFace,
    offsetMeters: resolved.actualOpeningStartMeters,
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
  options?: { minimumEdgeDistanceMeters?: number; layout?: DesignWallLayoutParameters },
): OpeningPlacementValidation {
  const warnings: string[] = [];
  const wallLength =
    opening.wallSegmentId && options?.layout
      ? segmentLengthForOpening(opening, options.layout)
      : wallLengthForFace(wall, opening.wallFace ?? 'south');
  const minEdge = options?.minimumEdgeDistanceMeters ?? 0;
  const resolved = resolveCmuOpening(wall, opening);
  const center = openingCenterStationFromStored(opening);
  const faceLabel = opening.wallFace ?? opening.wallSegmentId ?? 'segment';
  const startStation = center - opening.widthMeters / 2;
  const endStation = center + opening.widthMeters / 2;

  if (startStation < minEdge) {
    warnings.push(`Opening is too close to the ${faceLabel} wall start.`);
  }
  if (endStation > wallLength - minEdge) {
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
