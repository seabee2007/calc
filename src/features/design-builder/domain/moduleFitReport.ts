import type { CmuUnitPlacement, CmuCoursePlan, CmuSegmentCoursePlan } from '../geometry/designGeometry';
import type {
  CmuWallSystemParameters,
  DesignWallDimensionBasis,
  DesignWallLayoutParameters,
  ModuleFitStatus,
} from '../types';
import { wallFaceForSegment } from './layoutWallAdapter';
import { resolveCmuModuleDefinition, type CmuModuleDefinition } from './cmuModuleRules';

export type CmuUnitFamily = {
  name: string;
  actualBlockLengthMeters: number;
  actualBlockHeightMeters: number;
  actualBlockDepthMeters: number;
  headJointMeters: number;
  bedJointMeters: number;
  nominalModuleLengthMeters: number;
  nominalModuleHeightMeters: number;
};

export type SegmentCourseReconciliation = {
  segmentId: string;
  courseIndex: number;
  availableRunMeters: number;
  occupiedRunMeters: number;
  toleranceMeters: number;
  fullUnitCount: number;
  halfEndUnitCount: number;
  cutUnitCount: number;
  isReconciled: boolean;
};

export type ModuleFitFirstCut = {
  segmentId: string;
  segmentLabel: string;
  courseIndex: number;
};

export type ModuleFitReport = {
  status: ModuleFitStatus;
  requested: { lengthMeters: number; widthMeters: number };
  resolved: { lengthMeters: number; widthMeters: number };
  fullUnitCount: number;
  halfEndUnitCount: number;
  cutUnitCount: number;
  firstCut?: ModuleFitFirstCut;
  reconciliations: SegmentCourseReconciliation[];
  summaryLines: string[];
  summary: string;
};

const RECONCILIATION_TOLERANCE_METERS = 0.002;

export function cmuUnitFamilyFromDefinition(definition: CmuModuleDefinition, familyName: string): CmuUnitFamily {
  return {
    name: familyName,
    actualBlockLengthMeters: definition.actualFullBlockLengthMeters,
    actualBlockHeightMeters: definition.actualBlockHeightMeters,
    actualBlockDepthMeters: definition.blockDepthMeters,
    headJointMeters: definition.headJointMeters,
    bedJointMeters: definition.bedJointMeters,
    nominalModuleLengthMeters: definition.nominalModuleLengthMeters,
    nominalModuleHeightMeters: definition.nominalModuleHeightMeters,
  };
}

export function isFullCornerPlacement(placement: CmuUnitPlacement): boolean {
  return placement.kind === 'stretcher' || placement.kind === 'corner_block';
}

export function isHalfEndPlacement(placement: CmuUnitPlacement): boolean {
  return placement.kind === 'half_block' || placement.kind === 'end_block';
}

export function isCutPlacement(placement: CmuUnitPlacement): boolean {
  return placement.kind === 'cut_block' || placement.unitType === 'cut';
}

export function classifyPlacementCounts(placements: readonly CmuUnitPlacement[]): {
  fullUnits: CmuUnitPlacement[];
  halfEndUnits: CmuUnitPlacement[];
  cutUnits: CmuUnitPlacement[];
} {
  const fullUnits = placements.filter(isFullCornerPlacement);
  const halfEndUnits = placements.filter(isHalfEndPlacement);
  const cutUnits = placements.filter(isCutPlacement);
  return { fullUnits, halfEndUnits, cutUnits };
}

function perimeterCutSources(): Set<NonNullable<CmuUnitPlacement['source']>> {
  return new Set([
    'wall_run',
    'terminal_closure',
    'closed_perimeter_solver',
    'corner_assembly',
    'auto_layout',
  ]);
}

function openingCutSources(): Set<NonNullable<CmuUnitPlacement['source']>> {
  return new Set(['opening_assembly_solver', 'opening_closure']);
}

function resolveModuleFitStatus(params: {
  cutUnits: readonly CmuUnitPlacement[];
  halfEndUnitCount: number;
  hasLayoutError: boolean;
}): ModuleFitStatus {
  if (params.hasLayoutError) return 'unresolved';
  if (params.cutUnits.length === 0) {
    return params.halfEndUnitCount > 0 ? 'bond_modular' : 'fully_modular';
  }
  const perimeterSources = perimeterCutSources();
  const openingSources = openingCutSources();
  const hasPerimeterCut = params.cutUnits.some(
    (placement) => perimeterSources.has(placement.source) || placement.terminalClosure != null,
  );
  if (hasPerimeterCut) return 'cut_required';
  const hasOpeningCut = params.cutUnits.some((placement) => openingSources.has(placement.source));
  if (hasOpeningCut) return 'opening_conflict';
  return 'cut_required';
}

export function formatSegmentLabel(
  segmentId: string,
  layout?: DesignWallLayoutParameters | null,
): string {
  if (layout) {
    const face = wallFaceForSegment(layout, segmentId);
    if (face) {
      return `${face.charAt(0).toUpperCase()}${face.slice(1)} Wall`;
    }
  }
  return segmentId;
}

function formatFitStatusLabel(status: ModuleFitStatus): string {
  switch (status) {
    case 'fully_modular':
      return 'Fully modular';
    case 'bond_modular':
      return 'Bond modular';
    case 'cut_required':
      return 'Cut required';
    case 'opening_conflict':
      return 'Opening conflict';
    default:
      return 'Unresolved';
  }
}

export function formatModuleFitSummaryLines(report: ModuleFitReport): string[] {
  const lines = [
    `Requested: ${report.requested.lengthMeters.toFixed(2)} m × ${report.requested.widthMeters.toFixed(2)} m`,
    `Resolved: ${report.resolved.lengthMeters.toFixed(2)} m × ${report.resolved.widthMeters.toFixed(2)} m`,
    `Fit: ${formatFitStatusLabel(report.status)}`,
    `Full/corner units: ${report.fullUnitCount}`,
    `Half/end units: ${report.halfEndUnitCount}`,
    `Custom cut units: ${report.cutUnitCount}`,
  ];
  if (report.firstCut) {
    lines.push(
      `First cut: ${report.firstCut.segmentLabel} · Course ${report.firstCut.courseIndex + 1}`,
    );
  }
  return lines;
}

export function formatModuleFitSummary(report: ModuleFitReport): string {
  return formatModuleFitSummaryLines(report).join('\n');
}

export function reconcileSegmentCourses(params: {
  coursePlans: readonly CmuCoursePlan[];
  placements: readonly CmuUnitPlacement[];
  toleranceMeters?: number;
}): SegmentCourseReconciliation[] {
  const toleranceMeters = params.toleranceMeters ?? RECONCILIATION_TOLERANCE_METERS;
  return params.coursePlans.flatMap((plan) =>
    plan.segmentPlans.map((segmentPlan) =>
      reconcileSingleSegmentCourse({
        segmentPlan,
        placements: params.placements,
        toleranceMeters,
      }),
    ),
  );
}

function reconcileSingleSegmentCourse(params: {
  segmentPlan: CmuSegmentCoursePlan;
  placements: readonly CmuUnitPlacement[];
  toleranceMeters: number;
}): SegmentCourseReconciliation {
  const { segmentPlan } = params;
  const segmentPlacements = params.placements.filter(
    (placement) =>
      placement.segmentId === segmentPlan.segmentId &&
      placement.courseIndex === segmentPlan.courseIndex,
  );
  const availableRunMeters = roundMeters(segmentPlan.endStationMeters - segmentPlan.startStationMeters);
  const occupiedRunMeters = roundMeters(
    segmentPlan.units.reduce((sum, unit) => sum + unit.nominalLengthMeters, 0),
  );
  const fullUnitCount = segmentPlacements.filter(isFullCornerPlacement).length;
  const halfEndUnitCount = segmentPlacements.filter(isHalfEndPlacement).length;
  const cutUnitCount = segmentPlacements.filter(isCutPlacement).length;
  return {
    segmentId: segmentPlan.segmentId,
    courseIndex: segmentPlan.courseIndex,
    availableRunMeters,
    occupiedRunMeters,
    toleranceMeters: params.toleranceMeters,
    fullUnitCount,
    halfEndUnitCount,
    cutUnitCount,
    isReconciled: Math.abs(availableRunMeters - occupiedRunMeters) <= params.toleranceMeters,
  };
}

export function buildModuleFitReportFromPlacements(params: {
  placements: readonly CmuUnitPlacement[];
  requestedFootprint: { lengthMeters: number; widthMeters: number };
  resolvedFootprint: { lengthMeters: number; widthMeters: number };
  coursePlans?: readonly CmuCoursePlan[];
  layout?: DesignWallLayoutParameters | null;
  dimensionBasis?: DesignWallDimensionBasis;
  hasLayoutError?: boolean;
}): ModuleFitReport {
  const { fullUnits, halfEndUnits, cutUnits } = classifyPlacementCounts(params.placements);
  let cutUnitCount = cutUnits.length;
  let status = resolveModuleFitStatus({
    cutUnits,
    halfEndUnitCount: halfEndUnits.length,
    hasLayoutError: params.hasLayoutError ?? false,
  });

  if (import.meta.env.DEV && cutUnitCount === 0 && params.placements.some(isCutPlacement)) {
    console.warn(
      '[DesignBuilder] Module fit report claims 0 custom cuts but generated placements contain cut_block units.',
      { placementCount: params.placements.length },
    );
    status = 'unresolved';
  }

  const firstCutPlacement = cutUnits[0];
  const firstCut = firstCutPlacement
    ? {
        segmentId: firstCutPlacement.segmentId,
        segmentLabel: formatSegmentLabel(firstCutPlacement.segmentId, params.layout),
        courseIndex: firstCutPlacement.courseIndex,
      }
    : undefined;

  const reconciliations = params.coursePlans
    ? reconcileSegmentCourses({ coursePlans: params.coursePlans, placements: params.placements })
    : [];

  const report: ModuleFitReport = {
    status,
    requested: {
      lengthMeters: roundMeters(params.requestedFootprint.lengthMeters),
      widthMeters: roundMeters(params.requestedFootprint.widthMeters),
    },
    resolved: {
      lengthMeters: roundMeters(params.resolvedFootprint.lengthMeters),
      widthMeters: roundMeters(params.resolvedFootprint.widthMeters),
    },
    fullUnitCount: fullUnits.length,
    halfEndUnitCount: halfEndUnits.length,
    cutUnitCount,
    firstCut,
    reconciliations,
    summaryLines: [],
    summary: '',
  };
  report.summaryLines = formatModuleFitSummaryLines(report);
  report.summary = report.summaryLines.join('\n');
  return report;
}

export function unresolvedModuleFitReport(params: {
  requestedFootprint: { lengthMeters: number; widthMeters: number };
  resolvedFootprint?: { lengthMeters: number; widthMeters: number };
}): ModuleFitReport {
  const resolved = params.resolvedFootprint ?? params.requestedFootprint;
  return buildModuleFitReportFromPlacements({
    placements: [],
    requestedFootprint: params.requestedFootprint,
    resolvedFootprint: resolved,
    hasLayoutError: true,
  });
}

export function validateCmuUnitFamily(definition: CmuModuleDefinition): void {
  const lengthDelta = Math.abs(
    definition.nominalModuleLengthMeters -
      (definition.actualFullBlockLengthMeters + definition.headJointMeters),
  );
  const heightDelta = Math.abs(
    definition.nominalModuleHeightMeters -
      (definition.actualBlockHeightMeters + definition.bedJointMeters),
  );
  if (lengthDelta > RECONCILIATION_TOLERANCE_METERS || heightDelta > RECONCILIATION_TOLERANCE_METERS) {
    throw new Error('CMU unit family nominal module dimensions must equal physical block size plus joint.');
  }
}

export function validateCmuUnitFamilyFromWall(wall: CmuWallSystemParameters): void {
  validateCmuUnitFamily(resolveCmuModuleDefinition(wall));
}

function roundMeters(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
