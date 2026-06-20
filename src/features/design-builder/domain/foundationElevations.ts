import type {
  GradeBeamSettings,
  IsolatedFootingSettings,
  StructuralBeam,
  StructuralColumn,
  StructuralFoundationSettings,
} from '../types';

/** Canonical structural origin: top face of grade beam. */
export const TOP_OF_GRADE_BEAM_Y = 0;

export type FoundationElevations = {
  topOfGradeBeamY: number;
  bottomOfGradeBeamY: number;
  topOfFootingY: number;
  bottomOfFootingY: number;
  wallBaseY: number;
  wallTopY: number;
};

export function resolveFoundationElevations(params: {
  foundation: StructuralFoundationSettings;
  wallHeightMeters: number;
}): FoundationElevations {
  const topOfGradeBeamY = TOP_OF_GRADE_BEAM_Y;
  const gradeDepth = Math.max(0, params.foundation.gradeBeam.depthMeters);
  const bottomOfGradeBeamY = topOfGradeBeamY - gradeDepth;
  const dropBelowGradeBeam = Math.max(0, params.foundation.isolatedFootings.dropBelowGradeBeamMeters);
  const footingThickness = Math.max(0, params.foundation.isolatedFootings.footingThicknessMeters);
  const topOfFootingY = bottomOfGradeBeamY - dropBelowGradeBeam;
  const bottomOfFootingY = topOfFootingY - footingThickness;
  return {
    topOfGradeBeamY,
    bottomOfGradeBeamY,
    topOfFootingY,
    bottomOfFootingY,
    wallBaseY: topOfGradeBeamY,
    wallTopY: topOfGradeBeamY + Math.max(0, params.wallHeightMeters),
  };
}

export function resolveColumnTopElevationMeters(params: {
  wallHeightMeters: number;
  ringBeam?: StructuralBeam;
}): number {
  if (params.ringBeam) {
    return params.ringBeam.topElevationMeters;
  }
  return TOP_OF_GRADE_BEAM_Y + Math.max(0, params.wallHeightMeters);
}

export function resolveColumnGeometry(params: {
  column: Pick<StructuralColumn, 'widthMeters' | 'depthMeters'>;
  elevations: FoundationElevations;
  columnTopY: number;
}): Pick<StructuralColumn, 'baseElevationMeters' | 'topElevationMeters' | 'heightMeters'> {
  const columnBottomY = params.elevations.topOfFootingY;
  const columnTopY = params.columnTopY;
  const columnHeightMeters = Math.max(0, columnTopY - columnBottomY);
  return {
    baseElevationMeters: columnBottomY,
    topElevationMeters: columnTopY,
    heightMeters: columnHeightMeters,
  };
}

export function footingCenterElevationMeters(topOfFootingY: number, footingThicknessMeters: number): number {
  return topOfFootingY - footingThicknessMeters / 2;
}

export function structuralYToWorldY(structuralY: number, slabTopOffsetMeters: number): number {
  return slabTopOffsetMeters + structuralY;
}

export function gradeBeamElevationsFromSettings(gradeBeam: GradeBeamSettings): {
  baseElevationMeters: number;
  topElevationMeters: number;
} {
  const depth = Math.max(0, gradeBeam.depthMeters);
  return {
    baseElevationMeters: TOP_OF_GRADE_BEAM_Y - depth,
    topElevationMeters: TOP_OF_GRADE_BEAM_Y,
  };
}

export function ringBeamElevationsForWallHeight(params: {
  wallHeightMeters: number;
  ringBeamDepthMeters: number;
}): { baseElevationMeters: number; topElevationMeters: number } {
  const top = TOP_OF_GRADE_BEAM_Y + Math.max(0, params.wallHeightMeters);
  const depth = Math.max(0, params.ringBeamDepthMeters);
  return {
    topElevationMeters: top,
    baseElevationMeters: top - depth,
  };
}

export function columnVolumeBelowGradeBeamCubicMeters(
  column: StructuralColumn,
  bottomOfGradeBeamY: number,
): number {
  const overlapTop = Math.min(column.topElevationMeters, bottomOfGradeBeamY);
  const height = Math.max(0, overlapTop - column.baseElevationMeters);
  return column.widthMeters * column.depthMeters * height;
}

export function columnVolumeAboveGradeBeamCubicMeters(
  column: StructuralColumn,
  topOfGradeBeamY: number,
): number {
  const overlapBottom = Math.max(column.baseElevationMeters, topOfGradeBeamY);
  const height = Math.max(0, column.topElevationMeters - overlapBottom);
  return column.widthMeters * column.depthMeters * height;
}

export function footingVolumeCubicMeters(params: {
  widthMeters: number;
  lengthMeters: number;
  thicknessMeters: number;
}): number {
  return Math.max(0, params.widthMeters) * Math.max(0, params.lengthMeters) * Math.max(0, params.thicknessMeters);
}

export function gradeBeamVolumeForBeams(beams: readonly StructuralBeam[]): number {
  return beams
    .filter((beam) => beam.kind === 'grade_beam')
    .reduce((sum, beam) => sum + beamSpanLengthMeters(beam) * beam.widthMeters * beam.depthMeters, 0);
}

export function ringBeamVolumeForBeams(beams: readonly StructuralBeam[]): number {
  return beams
    .filter((beam) => beam.kind === 'ring_beam')
    .reduce((sum, beam) => sum + beamSpanLengthMeters(beam) * beam.widthMeters * beam.depthMeters, 0);
}

export function beamSpanLengthMeters(beam: StructuralBeam): number {
  return Math.hypot(beam.endPoint.x - beam.startPoint.x, beam.endPoint.z - beam.startPoint.z);
}

export function ringBeamColumnIntersectionVolumeCubicMeters(
  column: StructuralColumn,
  beam: StructuralBeam,
): number {
  const overlapW = Math.min(column.widthMeters, beam.widthMeters);
  const overlapD = Math.min(column.depthMeters, beam.depthMeters);
  const overlapBottom = Math.max(column.baseElevationMeters, beam.baseElevationMeters);
  const overlapTop = Math.min(column.topElevationMeters, beam.topElevationMeters);
  const overlapH = Math.max(0, overlapTop - overlapBottom);
  return overlapW * overlapD * overlapH;
}

export function resolveStructuralConcreteVolumes(params: {
  columns: StructuralColumn[];
  beams: StructuralBeam[];
  footings: Array<{ widthMeters: number; lengthMeters: number; thicknessMeters: number }>;
  bottomOfGradeBeamY: number;
  topOfGradeBeamY: number;
}): {
  gradeBeamVolumeCubicMeters: number;
  ringBeamVolumeCubicMeters: number;
  columnBelowGradeVolumeCubicMeters: number;
  columnAboveGradeVolumeCubicMeters: number;
  footingVolumeCubicMeters: number;
  totalDeduplicatedVolumeCubicMeters: number;
} {
  const gradeBeamVolumeCubicMeters = gradeBeamVolumeForBeams(params.beams);
  const ringBeamVolumeCubicMeters = ringBeamVolumeForBeams(params.beams);
  let columnBelowGradeVolumeCubicMeters = 0;
  let columnAboveGradeVolumeCubicMeters = 0;
  for (const column of params.columns) {
    columnBelowGradeVolumeCubicMeters += columnVolumeBelowGradeBeamCubicMeters(
      column,
      params.bottomOfGradeBeamY,
    );
    columnAboveGradeVolumeCubicMeters += columnVolumeAboveGradeBeamCubicMeters(
      column,
      params.topOfGradeBeamY,
    );
  }

  let ringBeamDeduction = 0;
  for (const beam of params.beams.filter((candidate) => candidate.kind === 'ring_beam')) {
    for (const column of params.columns) {
      if (column.id === beam.startColumnId || column.id === beam.endColumnId) {
        ringBeamDeduction += ringBeamColumnIntersectionVolumeCubicMeters(column, beam);
      }
    }
  }

  const footingVolume = params.footings.reduce(
    (sum, footing) => sum + footingVolumeCubicMeters(footing),
    0,
  );

  const totalDeduplicatedVolumeCubicMeters = Math.max(
    0,
    gradeBeamVolumeCubicMeters +
      ringBeamVolumeCubicMeters +
      columnBelowGradeVolumeCubicMeters +
      columnAboveGradeVolumeCubicMeters +
      footingVolume -
      ringBeamDeduction,
  );

  return {
    gradeBeamVolumeCubicMeters,
    ringBeamVolumeCubicMeters,
    columnBelowGradeVolumeCubicMeters,
    columnAboveGradeVolumeCubicMeters,
    footingVolumeCubicMeters: footingVolume,
    totalDeduplicatedVolumeCubicMeters,
  };
}

export function createDefaultFoundationSettings(): StructuralFoundationSettings {
  return {
    gradeBeam: {
      enabled: true,
      widthMeters: 0.3,
      depthMeters: 0.45,
      followsExteriorSegments: true,
      followsInteriorSegments: false,
    },
    isolatedFootings: {
      enabled: true,
      placementMode: 'at_columns',
      footingWidthMeters: 1.2,
      footingLengthMeters: 1.2,
      footingThicknessMeters: 0.45,
      dropBelowGradeBeamMeters: 0.6,
      autoCreateAtStructuralColumns: true,
    },
  };
}
