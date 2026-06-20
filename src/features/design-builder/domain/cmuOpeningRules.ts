import type { CmuCoreGeometry, CmuWallSystemParameters, WallOpeningParameters } from '../types';
import { resolveCmuModuleConfig } from './cmuModuleRules';
import type { GroutFillPlacement } from './openingAssemblySolver';

export const OPENING_GROUT_CONCEPTUAL_WARNING =
  'Grout quantity is conceptual; verify block core geometry and reinforcement requirements before pricing.';

export const OPENING_GROUT_CORE_WARNING =
  'Opening grout/reinforcement quantities are derived from generated cell fill volumes.';

export interface ResolvedCmuOpening {
  id: string;
  type: WallOpeningParameters['type'];
  wallFace: WallOpeningParameters['wallFace'];
  actualWidthMeters: number;
  actualHeightMeters: number;
  actualAreaSquareMeters: number;
  roughOpeningWidthMeters: number;
  roughOpeningHeightMeters: number;
  roughOpeningAreaSquareMeters: number;
  roughStartAlongMeters: number;
  roughEndAlongMeters: number;
  roughBottomMeters: number;
  roughTopMeters: number;
  actualStartAlongMeters: number;
  actualEndAlongMeters: number;
  actualBottomMeters: number;
  actualTopMeters: number;
  lintelType: NonNullable<WallOpeningParameters['lintelType']>;
  lintelBearingMeters: number;
  lintelCourseCount: number;
  lintelLengthMeters: number;
  lintelHeightMeters: number;
  jambGroutEnabled: boolean;
  jambRebarEnabled: boolean;
  groutCellsEachSide: number;
  jambGroutCellCount: number;
  groutCellsAboveOpening: number;
  groutCellsBelowWindow: number;
  openingFrameMaterial: WallOpeningParameters['openingFrameMaterial'];
}

export interface CmuOpeningGroutSummary {
  resolvedOpenings: ResolvedCmuOpening[];
  actualOpeningAreaSquareMeters: number;
  roughOpeningAreaSquareMeters: number;
  jambGroutCellCount: number;
  lintelGroutedCellCount?: number;
  lintelCount: number;
  lintelLengthMeters: number;
  jambGroutVolumeCubicMeters: number;
  closureGroutVolumeCubicMeters: number;
  lintelGroutVolumeCubicMeters: number;
  openingGroutVolumeCubicMeters?: number;
  sillGroutVolumeCubicMeters?: number;
  bondBeamGroutVolumeCubicMeters: number;
  overlapDeduplicationCubicMeters?: number;
  groutFillPlacements?: readonly GroutFillPlacement[];
  groutFillPlacementIds?: readonly string[];
  coreGeometry?: CmuCoreGeometry;
  totalGroutVolumeCubicMeters: number;
  courseClosureCutBlockCount: number;
  lintelBearingSupportBlockCount?: number;
  lintelBearingHalfBlockCount?: number;
  lintelBearingCutBlockCount?: number;
  coreFillFactor: number;
  groutWastePercent: number;
  warnings: string[];
}

export function resolveCmuOpening(
  params: CmuWallSystemParameters,
  opening: WallOpeningParameters,
): ResolvedCmuOpening {
  const moduleConfig = resolveCmuModuleConfig(params);
  const allowance = Math.max(0, opening.roughOpeningAllowanceMeters ?? 0.05);
  const actualWidthMeters = Math.max(0, opening.widthMeters);
  const actualHeightMeters = Math.max(0, opening.heightMeters);
  let roughOpeningWidthMeters = Math.max(
    actualWidthMeters,
    opening.roughOpeningWidthMeters ?? actualWidthMeters + allowance * 2,
  );
  let roughOpeningHeightMeters = Math.max(
    actualHeightMeters,
    opening.roughOpeningHeightMeters ?? actualHeightMeters + allowance * 2,
  );
  const wallLength = opening.wallFace === 'north' || opening.wallFace === 'south'
    ? params.lengthMeters
    : params.widthMeters;
  let rawRoughStart = opening.offsetMeters - (roughOpeningWidthMeters - actualWidthMeters) / 2;
  let roughStartAlongMeters = clamp(roundMeters(rawRoughStart), 0, Math.max(0, wallLength - roughOpeningWidthMeters));
  let roughEndAlongMeters = roughStartAlongMeters + roughOpeningWidthMeters;
  let actualStartAlongMeters = opening.offsetMeters;
  let actualEndAlongMeters = roundMeters(opening.offsetMeters + actualWidthMeters);
  if (params.snapToModule && moduleConfig.moduleLengthMeters > 0) {
    const actualCenterStation = opening.offsetMeters + actualWidthMeters / 2;
    rawRoughStart = Math.floor((actualCenterStation - roughOpeningWidthMeters / 2) / moduleConfig.moduleLengthMeters) * moduleConfig.moduleLengthMeters;
    roughStartAlongMeters = clamp(roundMeters(rawRoughStart), 0, wallLength);
    roughEndAlongMeters = clamp(
      roundMeters(Math.ceil((actualCenterStation + roughOpeningWidthMeters / 2) / moduleConfig.moduleLengthMeters) * moduleConfig.moduleLengthMeters),
      roughStartAlongMeters,
      wallLength,
    );
    if (roughEndAlongMeters - roughStartAlongMeters < actualWidthMeters) {
      roughStartAlongMeters = clamp(roundMeters(actualCenterStation - actualWidthMeters / 2), 0, Math.max(0, wallLength - actualWidthMeters));
      roughEndAlongMeters = roundMeters(Math.min(wallLength, roughStartAlongMeters + actualWidthMeters));
    }
    roughOpeningWidthMeters = Math.max(actualWidthMeters, roughEndAlongMeters - roughStartAlongMeters);
  }
  if (params.snapToModule && moduleConfig.moduleHeightMeters > 0) {
    roughOpeningHeightMeters = Math.max(actualHeightMeters, Math.ceil(roughOpeningHeightMeters / moduleConfig.moduleHeightMeters) * moduleConfig.moduleHeightMeters);
  }
  const roughBottomMeters = opening.type === 'door'
    ? 0
    : Math.max(0, (opening.sillHeightMeters ?? 0) - (roughOpeningHeightMeters - actualHeightMeters) / 2);
  const lintelType = opening.lintelType ?? params.lintelType ?? 'bond_beam';
  const lintelBearingMeters = Math.max(moduleConfig.moduleLengthMeters / 2, opening.lintelBearingMeters ?? params.lintelBearingMeters ?? 0.2);
  const lintelCourseCount = Math.max(1, opening.lintelCourseCount ?? params.lintelCourseCount ?? 1);
  const lintelLengthMeters = lintelType === 'none'
    ? 0
    : Math.min(wallLength, actualWidthMeters + lintelBearingMeters * 2);

  return {
    id: opening.id,
    type: opening.type,
    wallFace: opening.wallFace,
    actualWidthMeters,
    actualHeightMeters,
    actualAreaSquareMeters: actualWidthMeters * actualHeightMeters,
    roughOpeningWidthMeters,
    roughOpeningHeightMeters,
    roughOpeningAreaSquareMeters: roughOpeningWidthMeters * roughOpeningHeightMeters,
    roughStartAlongMeters,
    roughEndAlongMeters: roundMeters(roughEndAlongMeters),
    roughBottomMeters: roundMeters(roughBottomMeters),
    roughTopMeters: roundMeters(roughBottomMeters + roughOpeningHeightMeters),
    actualStartAlongMeters,
    actualEndAlongMeters,
    actualBottomMeters: opening.type === 'door' ? 0 : opening.sillHeightMeters ?? 0,
    actualTopMeters: (opening.type === 'door' ? 0 : opening.sillHeightMeters ?? 0) + actualHeightMeters,
    lintelType,
    lintelBearingMeters,
    lintelCourseCount,
    lintelLengthMeters,
    lintelHeightMeters: moduleConfig.moduleHeightMeters * lintelCourseCount,
    jambGroutEnabled: opening.jambGroutEnabled ?? true,
    jambRebarEnabled: opening.jambRebarEnabled ?? false,
    groutCellsEachSide: Math.max(0, opening.groutCellsEachSide ?? params.jambCellsEachSide ?? 1),
    jambGroutCellCount: (opening.jambGroutEnabled ?? true)
      ? Math.max(0, opening.groutCellsEachSide ?? params.jambCellsEachSide ?? 1) * 2
      : 0,
    groutCellsAboveOpening: Math.max(0, opening.groutCellsAboveOpening ?? 0),
    groutCellsBelowWindow: opening.type === 'window' ? Math.max(0, opening.groutCellsBelowWindow ?? 0) : 0,
    openingFrameMaterial: opening.openingFrameMaterial ?? 'none',
  };
}

export function resolveCmuOpenings(params: CmuWallSystemParameters): ResolvedCmuOpening[] {
  return params.openings.map((opening) => resolveCmuOpening(params, opening));
}

export function calculateCmuOpeningGroutSummary(params: CmuWallSystemParameters): CmuOpeningGroutSummary {
  const moduleConfig = resolveCmuModuleConfig(params);
  const resolvedOpenings = resolveCmuOpenings(params);
  const coreFillFactor = clamp(params.coreFillFactor ?? 0.5, 0, 1);
  const groutWastePercent = Math.max(0, params.groutWastePercent ?? 0.1);
  const wasteMultiplier = 1 + groutWastePercent;
  const wallThickness = Math.max(0, params.wallThicknessMeters);
  const cellCoreArea = moduleConfig.moduleLengthMeters * wallThickness * coreFillFactor;

  const jambGroutVolumeCubicMeters = resolvedOpenings.reduce((sum, opening) => {
    if (!opening.jambGroutEnabled) return sum;
    const groutedHeight = Math.min(
      params.heightMeters,
      opening.roughOpeningHeightMeters + opening.lintelHeightMeters,
    );
    return sum + opening.jambGroutCellCount * cellCoreArea * groutedHeight * wasteMultiplier;
  }, 0);

  const lintelGroutVolumeCubicMeters = resolvedOpenings.reduce((sum, opening) => {
    if (opening.lintelType === 'none' || !params.lintelBondBeamEnabled) return sum;
    return sum + opening.lintelLengthMeters * wallThickness * opening.lintelHeightMeters * coreFillFactor * wasteMultiplier;
  }, 0);

  const bondBeamLength = params.bondBeamEnabled ? 2 * (params.lengthMeters + params.widthMeters) : 0;
  const bondBeamGroutVolumeCubicMeters =
    bondBeamLength * wallThickness * moduleConfig.moduleHeightMeters * coreFillFactor * wasteMultiplier;

  const warnings = [
    OPENING_GROUT_CONCEPTUAL_WARNING,
    ...validateResolvedOpenings(params, resolvedOpenings),
  ];

  return {
    resolvedOpenings,
    actualOpeningAreaSquareMeters: resolvedOpenings.reduce((sum, opening) => sum + opening.actualAreaSquareMeters, 0),
    roughOpeningAreaSquareMeters: resolvedOpenings.reduce((sum, opening) => sum + opening.roughOpeningAreaSquareMeters, 0),
    jambGroutCellCount: resolvedOpenings.reduce((sum, opening) => sum + opening.jambGroutCellCount, 0),
    lintelCount: resolvedOpenings.filter((opening) => opening.lintelType !== 'none').length,
    lintelLengthMeters: resolvedOpenings.reduce((sum, opening) => sum + opening.lintelLengthMeters, 0),
    jambGroutVolumeCubicMeters,
    closureGroutVolumeCubicMeters: 0,
    lintelGroutVolumeCubicMeters,
    bondBeamGroutVolumeCubicMeters,
    totalGroutVolumeCubicMeters:
      jambGroutVolumeCubicMeters + lintelGroutVolumeCubicMeters + bondBeamGroutVolumeCubicMeters,
    courseClosureCutBlockCount: 0,
    coreFillFactor,
    groutWastePercent,
    warnings: [...new Set(warnings)],
  };
}

export function validateResolvedOpenings(
  params: CmuWallSystemParameters,
  openings = resolveCmuOpenings(params),
): string[] {
  const warnings: string[] = [];
  const byFace = new Map<WallOpeningParameters['wallFace'], ResolvedCmuOpening[]>();
  openings.forEach((opening) => {
    const wallLength = opening.wallFace === 'north' || opening.wallFace === 'south'
      ? params.lengthMeters
      : params.widthMeters;
    if (opening.roughEndAlongMeters > wallLength || opening.roughStartAlongMeters < 0) {
      warnings.push(`${opening.type} rough opening ${opening.id} does not fit within the ${opening.wallFace} wall.`);
    }
    if (opening.roughTopMeters > params.heightMeters || opening.roughBottomMeters < 0) {
      warnings.push(`${opening.type} rough opening ${opening.id} does not fit within wall height.`);
    }
    if (opening.lintelType === 'none') {
      warnings.push(`No lintel/bond beam is assigned above opening ${opening.id}. Verify opening support before pricing.`);
    }
    if (!opening.jambGroutEnabled) {
      warnings.push('Jamb grout disabled. Verify opening reinforcement requirements.');
    }
    const faceOpenings = byFace.get(opening.wallFace) ?? [];
    faceOpenings.push(opening);
    byFace.set(opening.wallFace, faceOpenings);
  });

  byFace.forEach((faceOpenings, face) => {
    const sorted = [...faceOpenings].sort((a, b) => a.roughStartAlongMeters - b.roughStartAlongMeters);
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index - 1].roughEndAlongMeters > sorted[index].roughStartAlongMeters) {
        warnings.push(`Rough openings overlap on the ${face} wall.`);
      }
    }
  });

  return warnings;
}

function roundMeters(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
