import type { CmuBlockModuleConfig, CmuWallSystemParameters, WallOpeningParameters } from '../types';

const FIT_TOLERANCE_METERS = 0.005;

export type CmuModuleFitKind = 'full' | 'half' | 'cut';

export interface CmuModuleFitResult {
  lengthMeters: number;
  moduleLengthMeters: number;
  moduleCount: number;
  fit: CmuModuleFitKind;
  remainderModules: number;
  nearestFullLengthMeters: number;
  nearestHalfLengthMeters: number;
  suggestedLengthsMeters: number[];
  message: string;
}

export interface WallModuleFitSummary {
  north: CmuModuleFitResult;
  south: CmuModuleFitResult;
  east: CmuModuleFitResult;
  west: CmuModuleFitResult;
}

export const METRIC_CMU_400X200_MODULE: CmuBlockModuleConfig = {
  familyName: 'Metric CMU 400 x 200',
  nominalLengthMeters: 0.4,
  nominalHeightMeters: 0.2,
  nominalDepthMeters: 0.19,
  actualLengthMeters: 0.39,
  actualHeightMeters: 0.19,
  mortarJointMeters: 0.01,
  moduleLengthMeters: 0.4,
  moduleHeightMeters: 0.2,
  availableUnitTypes: ['full', 'half', 'end', 'corner', 'jamb', 'bond_beam_lintel', 'cut'],
};

export const IMPERIAL_CMU_16X8_MODULE: CmuBlockModuleConfig = {
  familyName: 'Imperial CMU 16 x 8',
  nominalLengthMeters: 0.4064,
  nominalHeightMeters: 0.2032,
  nominalDepthMeters: 0.2032,
  actualLengthMeters: 0.3905,
  actualHeightMeters: 0.1905,
  mortarJointMeters: 0.0095,
  moduleLengthMeters: 0.4064,
  moduleHeightMeters: 0.2032,
  availableUnitTypes: ['full', 'half', 'end', 'corner', 'jamb', 'bond_beam_lintel', 'cut'],
};

export function resolveCmuModuleConfig(params: CmuWallSystemParameters): CmuBlockModuleConfig {
  const base = params.blockModule ?? METRIC_CMU_400X200_MODULE;
  return {
    ...base,
    nominalLengthMeters: positiveOr(base.nominalLengthMeters, METRIC_CMU_400X200_MODULE.nominalLengthMeters),
    nominalHeightMeters: positiveOr(base.nominalHeightMeters, METRIC_CMU_400X200_MODULE.nominalHeightMeters),
    nominalDepthMeters: positiveOr(base.nominalDepthMeters, params.wallThicknessMeters || METRIC_CMU_400X200_MODULE.nominalDepthMeters),
    actualLengthMeters: positiveOr(base.actualLengthMeters, base.nominalLengthMeters),
    actualHeightMeters: positiveOr(base.actualHeightMeters, base.nominalHeightMeters),
    mortarJointMeters: Math.max(0, base.mortarJointMeters ?? params.mortarJointMeters ?? 0),
    moduleLengthMeters: positiveOr(base.moduleLengthMeters, base.nominalLengthMeters),
    moduleHeightMeters: positiveOr(base.moduleHeightMeters, base.nominalHeightMeters),
    availableUnitTypes: base.availableUnitTypes?.length ? base.availableUnitTypes : METRIC_CMU_400X200_MODULE.availableUnitTypes,
  };
}

export function analyzeCmuModuleFit(lengthMeters: number, moduleLengthMeters: number): CmuModuleFitResult {
  const safeLength = Math.max(0, lengthMeters);
  const safeModule = positiveOr(moduleLengthMeters, METRIC_CMU_400X200_MODULE.moduleLengthMeters);
  const moduleCount = safeLength / safeModule;
  const nearestHalfStep = Math.round(moduleCount * 2) / 2;
  const nearestFullStep = Math.round(moduleCount);
  const fullRemainder = Math.abs(moduleCount - nearestFullStep);
  const halfRemainder = Math.abs(moduleCount - nearestHalfStep);
  const toleranceModules = FIT_TOLERANCE_METERS / safeModule;
  const nearestFullLengthMeters = roundMeters(nearestFullStep * safeModule);
  const nearestHalfLengthMeters = roundMeters(nearestHalfStep * safeModule);

  if (fullRemainder <= toleranceModules) {
    return {
      lengthMeters: safeLength,
      moduleLengthMeters: safeModule,
      moduleCount,
      fit: 'full',
      remainderModules: 0,
      nearestFullLengthMeters,
      nearestHalfLengthMeters,
      suggestedLengthsMeters: uniqueSorted([nearestFullLengthMeters, nearestHalfLengthMeters]),
      message: 'Good: wall length lands on full block module',
    };
  }

  if (halfRemainder <= toleranceModules) {
    return {
      lengthMeters: safeLength,
      moduleLengthMeters: safeModule,
      moduleCount,
      fit: 'half',
      remainderModules: 0.5,
      nearestFullLengthMeters,
      nearestHalfLengthMeters,
      suggestedLengthsMeters: uniqueSorted([nearestHalfLengthMeters, nearestFullLengthMeters]),
      message: 'Good: wall length lands on half block module',
    };
  }

  const lowerHalf = Math.floor(moduleCount * 2) / 2;
  const upperHalf = Math.ceil(moduleCount * 2) / 2;
  return {
    lengthMeters: safeLength,
    moduleLengthMeters: safeModule,
    moduleCount,
    fit: 'cut',
    remainderModules: moduleCount - Math.floor(moduleCount),
    nearestFullLengthMeters,
    nearestHalfLengthMeters,
    suggestedLengthsMeters: uniqueSorted([lowerHalf * safeModule, upperHalf * safeModule, nearestFullLengthMeters].map(roundMeters)),
    message: 'Warning: wall length creates cut block condition',
  };
}

export function summarizeWallModuleFits(params: CmuWallSystemParameters): WallModuleFitSummary {
  const module = resolveCmuModuleConfig(params);
  return {
    north: analyzeCmuModuleFit(params.lengthMeters, module.moduleLengthMeters),
    south: analyzeCmuModuleFit(params.lengthMeters, module.moduleLengthMeters),
    east: analyzeCmuModuleFit(params.widthMeters, module.moduleLengthMeters),
    west: analyzeCmuModuleFit(params.widthMeters, module.moduleLengthMeters),
  };
}

export function snapLengthToCmuModule(lengthMeters: number, moduleLengthMeters: number): number {
  const fit = analyzeCmuModuleFit(lengthMeters, moduleLengthMeters);
  if (fit.fit !== 'cut') return roundMeters(lengthMeters);
  return fit.suggestedLengthsMeters.reduce((best, candidate) =>
    Math.abs(candidate - lengthMeters) < Math.abs(best - lengthMeters) ? candidate : best,
  );
}

export function snapOpeningToCmuModule(
  opening: WallOpeningParameters,
  params: CmuWallSystemParameters,
): WallOpeningParameters {
  if (!params.snapToModule) return opening;
  const module = resolveCmuModuleConfig(params);
  const wallLength = opening.wallFace === 'north' || opening.wallFace === 'south'
    ? params.lengthMeters
    : params.widthMeters;
  const offsetMeters = clamp(
    roundMeters(Math.round(opening.offsetMeters / module.moduleLengthMeters) * module.moduleLengthMeters),
    0,
    Math.max(0, wallLength - opening.widthMeters),
  );
  const widthMeters = Math.max(
    module.moduleLengthMeters / 2,
    roundMeters(Math.round(opening.widthMeters / (module.moduleLengthMeters / 2)) * (module.moduleLengthMeters / 2)),
  );
  const sillHeightMeters = opening.sillHeightMeters == null
    ? undefined
    : Math.max(0, roundMeters(Math.round(opening.sillHeightMeters / module.moduleHeightMeters) * module.moduleHeightMeters));
  const heightMeters = Math.max(
    module.moduleHeightMeters,
    roundMeters(Math.round(opening.heightMeters / module.moduleHeightMeters) * module.moduleHeightMeters),
  );
  return {
    ...opening,
    offsetMeters: clamp(offsetMeters, 0, Math.max(0, wallLength - widthMeters)),
    widthMeters,
    heightMeters,
    sillHeightMeters,
  };
}

export function validateCmuOpenings(params: CmuWallSystemParameters): string[] {
  const messages: string[] = [];
  const byFace = new Map<WallOpeningParameters['wallFace'], WallOpeningParameters[]>();
  params.openings.forEach((opening) => {
    const wallLength = opening.wallFace === 'north' || opening.wallFace === 'south'
      ? params.lengthMeters
      : params.widthMeters;
    const sill = opening.type === 'door' ? 0 : opening.sillHeightMeters ?? 0;
    if (opening.offsetMeters < 0 || opening.offsetMeters + opening.widthMeters > wallLength) {
      messages.push(`${opening.type} opening ${opening.id} does not fit within the ${opening.wallFace} wall length.`);
    }
    if (sill < 0 || sill + opening.heightMeters > params.heightMeters) {
      messages.push(`${opening.type} opening ${opening.id} does not fit within the wall height.`);
    }
    const openings = byFace.get(opening.wallFace) ?? [];
    openings.push(opening);
    byFace.set(opening.wallFace, openings);
  });

  byFace.forEach((openings, face) => {
    const sorted = [...openings].sort((a, b) => a.offsetMeters - b.offsetMeters);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (previous.offsetMeters + previous.widthMeters > current.offsetMeters) {
        messages.push(`Openings overlap on the ${face} wall.`);
      }
    }
  });

  return messages;
}

function positiveOr(value: number | undefined, fallback: number): number {
  return value != null && value > 0 ? value : fallback;
}

function roundMeters(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.filter((value) => value >= 0).map(roundMeters))].sort((a, b) => a - b);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
