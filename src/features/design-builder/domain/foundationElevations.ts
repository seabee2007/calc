import type {
  RcFrameFoundationSettings,
  StructuralBeam,
  StructuralColumn,
} from "../types";
import { normalizeRcFrameFoundationSettings } from "./rcFrameFoundationMigration";
import { resolveInteriorFloorSlabSettings } from "./interiorFloorSlab";

/** Canonical structural origin: top face of plinth beam (floor level). */
export const TOP_OF_PLINTH_BEAM_Y = 0;

/** @deprecated Use TOP_OF_PLINTH_BEAM_Y */
export const TOP_OF_GRADE_BEAM_Y = TOP_OF_PLINTH_BEAM_Y;

export type FoundationElevations = {
  topOfPlinthBeamY: number;
  bottomOfPlinthBeamY: number;
  topOfTieBeamY: number;
  bottomOfTieBeamY: number;
  topOfFootingY: number;
  bottomOfFootingY: number;
  wallBaseY: number;
  roofBeamBottomY: number;
  roofBeamTopY: number;
  cmuWallBaseY: number;
  interiorFloorSlabTopY: number;
  interiorFloorSlabThicknessMeters: number;
  cmuClearHeightMeters: number;
  columnBottomY: number;
  columnTopY: number;
  /** Column extent above plinth top (user-facing story height including roof beam depth). */
  columnHeightAbovePlinthMeters: number;
  /** Full column from footing top through roof beam top. */
  columnHeightMeters: number;
};

/** Small render epsilon to prevent z-fighting — not large enough to show daylight. */
export const FOUNDATION_CONTACT_EPSILON_METERS = 0.001;

export function resolveColumnHeightAbovePlinthMeters(params: {
  foundation:
    | RcFrameFoundationSettings
    | import("../types").StructuralFoundationSettings
    | undefined;
  wallHeightMeters: number;
}): number {
  const foundation = normalizeRcFrameFoundationSettings(params.foundation);
  const roofDepth = foundation.roofBeam.enabled
    ? Math.max(0, foundation.roofBeam.depthMeters)
    : 0;
  const configured = foundation.columns.heightAbovePlinthMeters;
  if (
    typeof configured === "number" &&
    Number.isFinite(configured) &&
    configured > 0
  ) {
    return configured;
  }
  return Math.max(0, params.wallHeightMeters) + roofDepth;
}

export function resolveEffectiveWallHeightMeters(params: {
  foundation:
    | RcFrameFoundationSettings
    | import("../types").StructuralFoundationSettings
    | undefined;
  wallHeightMeters: number;
}): number {
  const foundation = normalizeRcFrameFoundationSettings(params.foundation);
  const roofDepth = foundation.roofBeam.enabled
    ? Math.max(0, foundation.roofBeam.depthMeters)
    : 0;
  const heightAbovePlinth = resolveColumnHeightAbovePlinthMeters(params);
  return Math.max(0, heightAbovePlinth - roofDepth);
}

export function syncColumnHeightAbovePlinthForWallHeight(params: {
  foundation:
    | RcFrameFoundationSettings
    | import("../types").StructuralFoundationSettings
    | undefined;
  wallHeightMeters: number;
}): RcFrameFoundationSettings {
  const foundation = normalizeRcFrameFoundationSettings(params.foundation);
  const roofDepth = foundation.roofBeam.enabled
    ? Math.max(0, foundation.roofBeam.depthMeters)
    : 0;
  return {
    ...foundation,
    columns: {
      ...foundation.columns,
      heightAbovePlinthMeters: Math.max(0, params.wallHeightMeters) + roofDepth,
    },
  };
}

export function resolveStructuralWallHeightMeters(params: {
  foundation:
    | RcFrameFoundationSettings
    | import("../types").StructuralFoundationSettings
    | undefined;
  wallHeightMeters: number;
}): number {
  return resolveEffectiveWallHeightMeters(params);
}

export function resolveFoundationElevations(params: {
  foundation:
    | RcFrameFoundationSettings
    | import("../types").StructuralFoundationSettings
    | undefined;
  wallHeightMeters: number;
}): FoundationElevations {
  const foundation = normalizeRcFrameFoundationSettings(params.foundation);
  const topOfPlinthBeamY = TOP_OF_PLINTH_BEAM_Y;
  const plinthDepth = Math.max(0, foundation.plinthBeam.depthMeters);
  const bottomOfPlinthBeamY = topOfPlinthBeamY - plinthDepth;
  const footingDrop = Math.max(
    0,
    foundation.isolatedFootings.dropBelowPlinthBeamMeters,
  );
  const footingThickness = Math.max(
    0,
    foundation.isolatedFootings.thicknessMeters,
  );
  const topOfFootingY = bottomOfPlinthBeamY - footingDrop;
  const bottomOfTieBeamY = topOfFootingY;
  const tieDepth = Math.max(0, foundation.tieBeam.depthMeters);
  const topOfTieBeamY = bottomOfTieBeamY + tieDepth;
  const bottomOfFootingY = topOfFootingY - footingThickness;
  const wallBaseY = topOfPlinthBeamY;
  const interiorFloorSlab = resolveInteriorFloorSlabSettings(foundation);
  const interiorFloorSlabThicknessMeters =
    interiorFloorSlab.enabled && interiorFloorSlab.thicknessMeters > 0
      ? interiorFloorSlab.thicknessMeters
      : 0;
  const interiorFloorSlabTopY = topOfPlinthBeamY;
  const cmuWallBaseY = topOfPlinthBeamY;
  const roofDepth = foundation.roofBeam.enabled
    ? Math.max(0, foundation.roofBeam.depthMeters)
    : 0;
  const columnHeightAbovePlinthMeters = resolveColumnHeightAbovePlinthMeters({
    foundation,
    wallHeightMeters: params.wallHeightMeters,
  });
  const columnTopY = topOfPlinthBeamY + columnHeightAbovePlinthMeters;
  const roofBeamTopY = columnTopY;
  const roofBeamBottomY = roofBeamTopY - roofDepth;
  const columnBottomY = topOfFootingY;
  const columnHeightMeters = Math.max(0, columnTopY - columnBottomY);
  const cmuClearHeightMeters = Math.max(0, roofBeamBottomY - wallBaseY);

  return {
    topOfPlinthBeamY,
    bottomOfPlinthBeamY,
    topOfTieBeamY,
    bottomOfTieBeamY,
    topOfFootingY,
    bottomOfFootingY,
    wallBaseY,
    roofBeamBottomY,
    roofBeamTopY,
    cmuWallBaseY,
    interiorFloorSlabTopY,
    interiorFloorSlabThicknessMeters,
    cmuClearHeightMeters,
    columnBottomY,
    columnTopY,
    columnHeightAbovePlinthMeters,
    columnHeightMeters,
  };
}

export function resolveColumnGeometry(params: {
  column: Pick<StructuralColumn, "widthMeters" | "depthMeters">;
  elevations: FoundationElevations;
}): Pick<
  StructuralColumn,
  "baseElevationMeters" | "topElevationMeters" | "heightMeters"
> {
  return {
    baseElevationMeters: params.elevations.columnBottomY,
    topElevationMeters: params.elevations.columnTopY,
    heightMeters: params.elevations.columnHeightMeters,
  };
}

export function footingCenterElevationMeters(
  topOfFootingY: number,
  footingThicknessMeters: number,
): number {
  return topOfFootingY - footingThicknessMeters / 2;
}

export function structuralYToWorldY(
  structuralY: number,
  slabTopOffsetMeters: number,
): number {
  return slabTopOffsetMeters + structuralY;
}

export function beamElevationsFromDepth(params: {
  topElevationMeters: number;
  depthMeters: number;
}): { baseElevationMeters: number; topElevationMeters: number } {
  const depth = Math.max(0, params.depthMeters);
  return {
    topElevationMeters: params.topElevationMeters,
    baseElevationMeters: params.topElevationMeters - depth,
  };
}

export function plinthBeamElevations(foundation: RcFrameFoundationSettings): {
  baseElevationMeters: number;
  topElevationMeters: number;
} {
  return beamElevationsFromDepth({
    topElevationMeters: TOP_OF_PLINTH_BEAM_Y,
    depthMeters: foundation.plinthBeam.depthMeters,
  });
}

export function roofBeamElevations(
  wallHeightMeters: number,
  foundation: RcFrameFoundationSettings,
): {
  baseElevationMeters: number;
  topElevationMeters: number;
} {
  const elevations = resolveFoundationElevations({
    foundation,
    wallHeightMeters,
  });
  return beamElevationsFromDepth({
    topElevationMeters: elevations.roofBeamTopY,
    depthMeters: foundation.roofBeam.depthMeters,
  });
}

export function tieBeamElevations(
  foundation: RcFrameFoundationSettings,
  wallHeightMeters: number,
): {
  baseElevationMeters: number;
  topElevationMeters: number;
} {
  const elevations = resolveFoundationElevations({
    foundation,
    wallHeightMeters,
  });
  return {
    baseElevationMeters: elevations.bottomOfTieBeamY,
    topElevationMeters: elevations.topOfTieBeamY,
  };
}

export function beamVolumeForKind(
  beams: readonly StructuralBeam[],
  kind: StructuralBeam["kind"],
): number {
  return beams
    .filter((beam) => beam.kind === kind)
    .reduce(
      (sum, beam) =>
        sum + beamSpanLengthMeters(beam) * beam.widthMeters * beam.depthMeters,
      0,
    );
}

export function beamVolumeForKinds(
  beams: readonly StructuralBeam[],
  kinds: readonly StructuralBeam["kind"][],
): number {
  return kinds.reduce((sum, kind) => sum + beamVolumeForKind(beams, kind), 0);
}

export function beamSpanLengthMeters(beam: StructuralBeam): number {
  return Math.hypot(
    beam.endPoint.x - beam.startPoint.x,
    beam.endPoint.z - beam.startPoint.z,
  );
}

export function beamColumnIntersectionVolumeCubicMeters(
  column: StructuralColumn,
  beam: StructuralBeam,
): number {
  const overlapW = Math.min(column.widthMeters, beam.widthMeters);
  const overlapD = Math.min(column.depthMeters, beam.depthMeters);
  const overlapBottom = Math.max(
    column.baseElevationMeters,
    beam.baseElevationMeters,
  );
  const overlapTop = Math.min(
    column.topElevationMeters,
    beam.topElevationMeters,
  );
  const overlapH = Math.max(0, overlapTop - overlapBottom);
  return overlapW * overlapD * overlapH;
}

export function columnVolumeBelowPlinthCubicMeters(
  column: StructuralColumn,
  bottomOfPlinthBeamY: number,
): number {
  const overlapTop = Math.min(column.topElevationMeters, bottomOfPlinthBeamY);
  const height = Math.max(0, overlapTop - column.baseElevationMeters);
  return column.widthMeters * column.depthMeters * height;
}

export function columnVolumeAbovePlinthCubicMeters(
  column: StructuralColumn,
  topOfPlinthBeamY: number,
  roofBeamBottomY: number,
): number {
  const overlapBottom = Math.max(column.baseElevationMeters, topOfPlinthBeamY);
  const overlapTop = Math.min(column.topElevationMeters, roofBeamBottomY);
  const height = Math.max(0, overlapTop - overlapBottom);
  return column.widthMeters * column.depthMeters * height;
}

export function footingVolumeCubicMeters(params: {
  widthMeters: number;
  lengthMeters: number;
  thicknessMeters: number;
}): number {
  return (
    Math.max(0, params.widthMeters) *
    Math.max(0, params.lengthMeters) *
    Math.max(0, params.thicknessMeters)
  );
}

export function resolveStructuralConcreteVolumes(params: {
  columns: StructuralColumn[];
  beams: StructuralBeam[];
  footings: Array<{
    widthMeters: number;
    lengthMeters: number;
    thicknessMeters: number;
  }>;
  elevations: FoundationElevations;
}): {
  plinthBeamVolumeCubicMeters: number;
  roofBeamVolumeCubicMeters: number;
  tieBeamVolumeCubicMeters: number;
  columnBelowPlinthVolumeCubicMeters: number;
  columnAbovePlinthVolumeCubicMeters: number;
  footingVolumeCubicMeters: number;
  totalDeduplicatedVolumeCubicMeters: number;
} {
  const plinthBeamVolumeCubicMeters = beamVolumeForKinds(params.beams, [
    "plinth_beam",
    "grade_beam",
  ]);
  const roofBeamVolumeCubicMeters = beamVolumeForKinds(params.beams, [
    "roof_beam",
    "ring_beam",
  ]);
  const tieBeamVolumeCubicMeters = beamVolumeForKind(params.beams, "tie_beam");

  let columnBelowPlinthVolumeCubicMeters = 0;
  let columnAbovePlinthVolumeCubicMeters = 0;
  for (const column of params.columns) {
    columnBelowPlinthVolumeCubicMeters += columnVolumeBelowPlinthCubicMeters(
      column,
      params.elevations.bottomOfPlinthBeamY,
    );
    columnAbovePlinthVolumeCubicMeters += columnVolumeAbovePlinthCubicMeters(
      column,
      params.elevations.topOfPlinthBeamY,
      params.elevations.roofBeamBottomY,
    );
  }

  let beamDeduction = 0;
  for (const beam of params.beams.filter(
    (candidate) =>
      candidate.kind === "roof_beam" ||
      candidate.kind === "ring_beam" ||
      candidate.kind === "tie_beam" ||
      candidate.kind === "plinth_beam" ||
      candidate.kind === "grade_beam",
  )) {
    for (const column of params.columns) {
      if (column.id === beam.startColumnId || column.id === beam.endColumnId) {
        beamDeduction += beamColumnIntersectionVolumeCubicMeters(column, beam);
      }
    }
  }

  const footingVolume = params.footings.reduce(
    (sum, footing) => sum + footingVolumeCubicMeters(footing),
    0,
  );

  const totalDeduplicatedVolumeCubicMeters = Math.max(
    0,
    plinthBeamVolumeCubicMeters +
      roofBeamVolumeCubicMeters +
      tieBeamVolumeCubicMeters +
      columnBelowPlinthVolumeCubicMeters +
      columnAbovePlinthVolumeCubicMeters +
      footingVolume -
      beamDeduction,
  );

  return {
    plinthBeamVolumeCubicMeters,
    roofBeamVolumeCubicMeters,
    tieBeamVolumeCubicMeters,
    columnBelowPlinthVolumeCubicMeters,
    columnAbovePlinthVolumeCubicMeters,
    footingVolumeCubicMeters: footingVolume,
    totalDeduplicatedVolumeCubicMeters,
  };
}

export type RcFrameFoundationValidation = {
  valid: boolean;
  errors: string[];
};

export function validateRcFrameFoundationSettings(params: {
  foundation: RcFrameFoundationSettings;
  wallHeightMeters: number;
}): RcFrameFoundationValidation {
  const errors: string[] = [];
  const elevations = resolveFoundationElevations({
    foundation: params.foundation,
    wallHeightMeters: params.wallHeightMeters,
  });

  if (
    params.foundation.plinthBeam.enabled &&
    params.foundation.plinthBeam.depthMeters <= 0
  ) {
    errors.push("Plinth Beam depth must be greater than zero.");
  }
  if (
    params.foundation.interiorFloorSlab?.enabled &&
    params.foundation.interiorFloorSlab.thicknessMeters <= 0
  ) {
    errors.push(
      "Interior floor slab thickness must be greater than zero when enabled.",
    );
  }
  if (
    params.foundation.interiorFloorSlab?.enabled &&
    params.foundation.plinthBeam.enabled &&
    params.foundation.interiorFloorSlab.thicknessMeters >
      params.foundation.plinthBeam.depthMeters
  ) {
    errors.push(
      "Interior floor slab thickness cannot exceed plinth beam depth.",
    );
  }
  if (
    params.foundation.roofBeam.enabled &&
    params.foundation.roofBeam.depthMeters <= 0
  ) {
    errors.push("Roof Beam depth must be greater than zero.");
  }
  const heightAbovePlinth = resolveColumnHeightAbovePlinthMeters({
    foundation: params.foundation,
    wallHeightMeters: params.wallHeightMeters,
  });
  const effectiveWallHeight = resolveEffectiveWallHeightMeters({
    foundation: params.foundation,
    wallHeightMeters: params.wallHeightMeters,
  });
  if (params.foundation.columns.heightAbovePlinthMeters <= 0) {
    errors.push("Column height above plinth must be greater than zero.");
  }
  if (params.foundation.columns.intermediateSpacingMeters <= 0) {
    errors.push("Intermediate support spacing must be greater than zero.");
  }
  if (
    params.foundation.roofBeam.enabled &&
    heightAbovePlinth <= params.foundation.roofBeam.depthMeters
  ) {
    errors.push("Column height above plinth must exceed roof beam depth.");
  }
  if (
    params.foundation.roofBeam.enabled &&
    params.foundation.roofBeam.depthMeters >= effectiveWallHeight
  ) {
    errors.push("Roof Beam depth must not consume the full wall height.");
  }
  if (params.foundation.isolatedFootings.dropBelowPlinthBeamMeters < 0) {
    errors.push("Footing drop below Plinth Beam cannot be negative.");
  }
  if (params.foundation.isolatedFootings.thicknessMeters <= 0) {
    errors.push("Footing thickness must be greater than zero.");
  }
  if (
    params.foundation.tieBeam.enabled &&
    params.foundation.tieBeam.depthMeters <= 0
  ) {
    errors.push("Tie Beam depth must be greater than zero when enabled.");
  }
  if (
    params.foundation.tieBeam.enabled &&
    elevations.topOfTieBeamY >
      elevations.bottomOfPlinthBeamY + FOUNDATION_CONTACT_EPSILON_METERS
  ) {
    errors.push("Tie Beam top must not overlap the Plinth Beam zone.");
  }
  if (
    Math.abs(elevations.bottomOfTieBeamY - elevations.topOfFootingY) >
    FOUNDATION_CONTACT_EPSILON_METERS
  ) {
    errors.push("Tie Beam bottom must match the top of isolated footings.");
  }
  if (elevations.columnHeightMeters <= 0) {
    errors.push("Column height must be positive.");
  }
  if (elevations.cmuClearHeightMeters <= 0) {
    errors.push(
      "CMU clear height between Plinth Beam and Roof Beam must be positive.",
    );
  }

  return { valid: errors.length === 0, errors };
}

export {
  createDefaultRcFrameFoundationSettings,
  createDefaultFoundationSettings,
  normalizeRcFrameFoundationSettings,
} from "./rcFrameFoundationMigration";
