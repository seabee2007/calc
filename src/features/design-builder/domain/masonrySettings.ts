import type {
  CmuWallSystemParameters,
  DesignWallLayoutParameters,
  MasonryCourseRun,
  WallOpeningParameters,
} from '../types';
import { resolveCmuModuleConfig } from './cmuModuleRules';

export type DesignMasonrySettings = {
  wallHeightMeters: number;
  wallThicknessMeters: number;
  actualBlockLengthMeters: number;
  actualBlockHeightMeters: number;
  actualBlockDepthMeters: number;
  nominalModuleLengthMeters: number;
  nominalModuleHeightMeters: number;
  wastePercent: number;
  bondPattern: NonNullable<CmuWallSystemParameters['bondPattern']>;
  lintelType: NonNullable<CmuWallSystemParameters['lintelType']>;
  lintelBearingMeters: number;
};

function positiveOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function syncWallBlockModuleFromScalars(wall: CmuWallSystemParameters): CmuWallSystemParameters {
  const current = resolveCmuModuleConfig(wall);
  const moduleLengthMeters = positiveOr(wall.blockLengthMeters, current.moduleLengthMeters);
  const moduleHeightMeters = positiveOr(wall.blockHeightMeters, current.moduleHeightMeters);
  const nominalDepthMeters = positiveOr(wall.blockDepthMeters, positiveOr(wall.wallThicknessMeters, current.nominalDepthMeters));
  const mortarJointMeters = Math.max(0, wall.mortarJointMeters ?? current.mortarJointMeters ?? 0);
  const actualLengthMeters = Math.max(0.01, moduleLengthMeters - mortarJointMeters);
  const actualHeightMeters = Math.max(0.01, moduleHeightMeters - mortarJointMeters);

  return {
    ...wall,
    blockLengthMeters: moduleLengthMeters,
    blockHeightMeters: moduleHeightMeters,
    blockDepthMeters: nominalDepthMeters,
    mortarJointMeters,
    wallThicknessMeters: positiveOr(wall.wallThicknessMeters, nominalDepthMeters),
    blockModule: {
      ...current,
      moduleLengthMeters,
      moduleHeightMeters,
      nominalLengthMeters: moduleLengthMeters,
      nominalHeightMeters: moduleHeightMeters,
      nominalDepthMeters,
      actualLengthMeters,
      actualHeightMeters,
      mortarJointMeters,
    },
  };
}

export function applyProjectMasonryDefaultsToLayout(
  layout: DesignWallLayoutParameters,
  patch: { heightMeters?: number; wallThicknessMeters?: number },
  options?: { propagateToAllSegments?: boolean },
): DesignWallLayoutParameters {
  const propagate = options?.propagateToAllSegments ?? true;
  let next = layout;
  if (typeof patch.heightMeters === 'number') {
    next = {
      ...next,
      defaultWallHeightMeters: patch.heightMeters,
      segments: propagate
        ? next.segments.map((segment) => ({ ...segment, wallHeightMeters: patch.heightMeters! }))
        : next.segments,
    };
  }
  if (typeof patch.wallThicknessMeters === 'number') {
    next = {
      ...next,
      defaultWallThicknessMeters: patch.wallThicknessMeters,
      segments: propagate
        ? next.segments.map((segment) => ({ ...segment, wallThicknessMeters: patch.wallThicknessMeters! }))
        : next.segments,
    };
  }
  return next;
}

export function buildMasonryGeometryKey(params: {
  wallLayout: DesignWallLayoutParameters;
  wall: CmuWallSystemParameters;
  openings: readonly WallOpeningParameters[];
  moduleFitMode: string;
  manualMasonryRuns?: readonly MasonryCourseRun[];
}): string {
  const module = resolveCmuModuleConfig(syncWallBlockModuleFromScalars(params.wall));
  const openingSignature = params.openings
    .map((opening) =>
      [
        opening.id,
        opening.type,
        opening.wallSegmentId ?? opening.wallFace ?? '',
        opening.offsetMeters ?? opening.positionAlongSegment ?? 0,
        opening.widthMeters,
        opening.heightMeters,
        opening.lintelType ?? '',
        opening.lintelBearingMeters ?? '',
      ].join(':'),
    )
    .join('|');
  const segmentSignature = params.wallLayout.segments
    .map((segment) =>
      [segment.id, segment.wallHeightMeters, segment.wallThicknessMeters, segment.startNodeId, segment.endNodeId].join(':'),
    )
    .join('|');
  const manualSignature = (params.manualMasonryRuns ?? [])
    .map((run) => [run.id, run.wallSegmentId, run.courseIndex, run.count].join(':'))
    .join('|');

  return [
    params.wallLayout.segments.length,
    params.wallLayout.defaultWallHeightMeters,
    params.wallLayout.defaultWallThicknessMeters,
    segmentSignature,
    params.wall.heightMeters,
    params.wall.wallThicknessMeters,
    module.moduleLengthMeters,
    module.moduleHeightMeters,
    module.nominalDepthMeters,
    module.mortarJointMeters,
    params.wall.bondPattern ?? 'running_bond',
    params.wall.lintelType ?? 'bond_beam',
    params.wall.lintelBearingMeters ?? 0.2,
    params.wall.lintelCourseCount ?? 1,
    params.wall.lintelBondBeamEnabled ?? true,
    params.wall.showIndividualBlocks ?? false,
    params.wall.cornerCondition ?? 'interlocked',
    params.wall.endCondition ?? 'return_corner',
    params.moduleFitMode,
    openingSignature,
    manualSignature,
  ].join('::');
}

export function resolveDesignMasonrySettings(wall: CmuWallSystemParameters): DesignMasonrySettings {
  const synced = syncWallBlockModuleFromScalars(wall);
  const module = resolveCmuModuleConfig(synced);
  return {
    wallHeightMeters: synced.heightMeters,
    wallThicknessMeters: synced.wallThicknessMeters,
    actualBlockLengthMeters: module.actualLengthMeters ?? module.moduleLengthMeters,
    actualBlockHeightMeters: module.actualHeightMeters ?? module.moduleHeightMeters,
    actualBlockDepthMeters: module.nominalDepthMeters,
    nominalModuleLengthMeters: module.moduleLengthMeters,
    nominalModuleHeightMeters: module.moduleHeightMeters,
    wastePercent: Math.max(0, synced.wasteFactor ?? 0) * 100,
    bondPattern: synced.bondPattern ?? 'running_bond',
    lintelType: synced.lintelType ?? 'bond_beam',
    lintelBearingMeters: synced.lintelBearingMeters ?? 0.2,
  };
}

export function logMasonrySettingsCommit(params: {
  changedSetting: string;
  previousValue: unknown;
  nextValue: unknown;
  geometryKey: string;
  wall: CmuWallSystemParameters;
  generatedBlockCount: number;
  generatedCourseCount: number;
}) {
  if (!import.meta.env.DEV) return;
  const settings = resolveDesignMasonrySettings(params.wall);
  console.table({
    changedSetting: params.changedSetting,
    previousValue: params.previousValue,
    nextValue: params.nextValue,
    geometryKey: params.geometryKey,
    wallHeightMeters: settings.wallHeightMeters,
    wallThicknessMeters: settings.wallThicknessMeters,
    blockLengthMeters: settings.nominalModuleLengthMeters,
    blockHeightMeters: settings.nominalModuleHeightMeters,
    blockDepthMeters: settings.actualBlockDepthMeters,
    bondPattern: settings.bondPattern,
    lintelType: settings.lintelType,
    lintelBearingMeters: settings.lintelBearingMeters,
    generatedBlockCount: params.generatedBlockCount,
    generatedCourseCount: params.generatedCourseCount,
  });
}
