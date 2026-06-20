import type {
  BuildingSystemMode,
  CmuWallSystemParameters,
  DesignWallDimensionBasis,
  ModuleFitCandidate,
  ModuleFitStatus,
  WallOpeningParameters,
} from '../types';
import { resolveCmuModuleDefinition } from './cmuModuleRules';
import { buildClosedFootprintModuleFitReport } from './closedFootprintModuleFit';
import { createOutsideFaceRectangleLayout, deriveExteriorBounds } from './wallLayoutRules';
import {
  deriveInfillPanelsForLayout,
  panelClearWidthMeters,
  solveInfillPanelBlocks,
} from './cmuInfillPanelSolver';
import type { SegmentFrame } from '../geometry/designGeometry';
import type { DesignWallLayoutParameters } from '../types';
import type { StructuralBeam, StructuralColumn } from '../types';

export type ModuleFitContext = {
  buildingSystemMode: BuildingSystemMode;
  dimensionBasis: DesignWallDimensionBasis;
  requestedDimensionMeters: number;
  wall: CmuWallSystemParameters;
  columnWidthMeters?: number;
  openings?: WallOpeningParameters[];
  layout?: DesignWallLayoutParameters | null;
  segmentFrames?: SegmentFrame[];
  columns?: StructuralColumn[];
  beams?: StructuralBeam[];
};

function classifyCounts(full: number, half: number, cut: number): ModuleFitStatus {
  if (cut > 0) return 'cut_required';
  if (half > 0) return 'bond_modular';
  return 'fully_modular';
}

function solvePanelCountsForWidth(params: {
  clearWidthMeters: number;
  wall: CmuWallSystemParameters;
  bondPattern: 'running_bond' | 'stack_bond';
}): { full: number; half: number; cut: number } {
  const module = resolveCmuModuleDefinition(params.wall);
  const courseCount = 1;
  let full = 0;
  let half = 0;
  let cut = 0;
  for (let courseIndex = 0; courseIndex < courseCount; courseIndex += 1) {
    const jointOffset =
      params.bondPattern === 'running_bond' && courseIndex % 2 === 1
        ? module.nominalModuleLengthMeters / 2
        : 0;
    let station = jointOffset;
    while (station < params.clearWidthMeters - 0.001) {
      const remaining = params.clearWidthMeters - station;
      if (remaining >= module.nominalModuleLengthMeters - 0.005) {
        full += 1;
        station += module.nominalModuleLengthMeters;
      } else if (remaining >= module.nominalModuleLengthMeters / 2 - 0.005) {
        half += 1;
        station += module.nominalModuleLengthMeters / 2;
      } else if (remaining >= 0.08) {
        cut += 1;
        station += remaining;
      } else {
        break;
      }
    }
  }
  return { full, half, cut };
}

export function evaluateModuleFitForClearSpan(params: ModuleFitContext & {
  clearWidthMeters: number;
}): ModuleFitCandidate {
  const bondPattern = params.wall.bondPattern ?? 'running_bond';
  const counts = solvePanelCountsForWidth({
    clearWidthMeters: params.clearWidthMeters,
    wall: params.wall,
    bondPattern,
  });
  const status = classifyCounts(counts.full, counts.half, counts.cut);
  const explanation =
    status === 'fully_modular'
      ? 'Panel clear span closes with full blocks only.'
      : status === 'bond_modular'
        ? 'Panel clear span closes with valid half blocks; no cut blocks required.'
        : 'Panel clear span requires at least one cut block.';
  return {
    requestedDimensionMeters: params.requestedDimensionMeters,
    candidateDimensionMeters: params.clearWidthMeters,
    adjustmentMeters: params.clearWidthMeters - params.requestedDimensionMeters,
    status,
    fullBlockCount: counts.full,
    halfBlockCount: counts.half,
    cutBlockCount: counts.cut,
    explanation,
  };
}

export function evaluateRequestedDimensionModuleFit(params: ModuleFitContext): ModuleFitCandidate {
  const module = resolveCmuModuleDefinition(params.wall);
  const columnWidth = params.columnWidthMeters ?? 0.35;

  if (
    params.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill' &&
    params.layout &&
    params.segmentFrames &&
    params.columns &&
    params.beams
  ) {
    const panels = deriveInfillPanelsForLayout({
      layout: params.layout,
      segmentFrames: params.segmentFrames,
      columns: params.columns,
      beams: params.beams,
      wall: params.wall,
    });
    const longestPanel = panels.reduce(
      (max, p) => Math.max(max, panelClearWidthMeters(p)),
      0,
    );
    const clearWidth = longestPanel > 0 ? longestPanel : Math.max(0, params.requestedDimensionMeters - 2 * columnWidth);
    return evaluateModuleFitForClearSpan({ ...params, clearWidthMeters: clearWidth });
  }

  const clearWidth = Math.max(0, params.requestedDimensionMeters);
  return evaluateModuleFitForClearSpan({ ...params, clearWidthMeters: clearWidth });
}

export function evaluateClosedFootprintCandidate(params: {
  requestedDimensionMeters: number;
  candidateDimensionMeters: number;
  dimension: 'length' | 'width';
  wall: CmuWallSystemParameters;
  layout?: DesignWallLayoutParameters | null;
}): ModuleFitCandidate {
  const bounds = params.layout ? deriveExteriorBounds(params.layout) : null;
  const baseLength = bounds?.exteriorLengthMeters ?? params.wall.lengthMeters;
  const baseWidth = bounds?.exteriorWidthMeters ?? params.wall.widthMeters;
  const lengthMeters = params.dimension === 'length' ? params.candidateDimensionMeters : baseLength;
  const widthMeters = params.dimension === 'width' ? params.candidateDimensionMeters : baseWidth;
  const layout =
    params.layout && params.dimension === 'length'
      ? {
          ...params.layout,
          nodes: scaleRectangleNodes(params.layout, lengthMeters, widthMeters),
        }
      : params.layout && params.dimension === 'width'
        ? {
            ...params.layout,
            nodes: scaleRectangleNodes(params.layout, lengthMeters, widthMeters),
          }
        : createOutsideFaceRectangleLayout({
            lengthMeters,
            widthMeters,
            wallHeightMeters: params.wall.heightMeters,
            wallThicknessMeters: params.wall.wallThicknessMeters,
          });
  const report = buildClosedFootprintModuleFitReport({
    requestedFootprint: { lengthMeters: baseLength, widthMeters: baseWidth },
    resolvedFootprint: { lengthMeters, widthMeters },
    cmu: { ...params.wall, lengthMeters, widthMeters, openings: [] },
    layout,
  });
  const explanation =
    report.status === 'fully_modular'
      ? `${lengthMeters.toFixed(2)} m × ${widthMeters.toFixed(2)} m — 0 cuts, 0 half/end units`
      : report.status === 'bond_modular'
        ? `${lengthMeters.toFixed(2)} m × ${widthMeters.toFixed(2)} m — 0 cuts, ${report.halfEndUnitCount} valid half/end units`
        : `${lengthMeters.toFixed(2)} m × ${widthMeters.toFixed(2)} m — ${report.cutUnitCount} custom cut units`;
  return {
    requestedDimensionMeters: params.requestedDimensionMeters,
    candidateDimensionMeters: params.candidateDimensionMeters,
    adjustmentMeters: params.candidateDimensionMeters - params.requestedDimensionMeters,
    status: report.status,
    fullBlockCount: report.fullUnitCount,
    halfBlockCount: report.halfEndUnitCount,
    cutBlockCount: report.cutUnitCount,
    explanation,
  };
}

function scaleRectangleNodes(
  layout: DesignWallLayoutParameters,
  lengthMeters: number,
  widthMeters: number,
): DesignWallLayoutParameters['nodes'] {
  const bounds = deriveExteriorBounds(layout);
  if (!bounds) return layout.nodes;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const halfLength = lengthMeters / 2;
  const halfWidth = widthMeters / 2;
  return layout.nodes.map((node) => ({
    ...node,
    x: node.x < centerX ? centerX - halfLength : centerX + halfLength,
    z: node.z < centerZ ? centerZ - halfWidth : centerZ + halfWidth,
  }));
}

function compareCandidates(a: ModuleFitCandidate, b: ModuleFitCandidate): number {
  const statusRank = (status: ModuleFitStatus) => {
    if (status === 'fully_modular') return 0;
    if (status === 'bond_modular') return 1;
    if (status === 'opening_conflict') return 2;
    if (status === 'cut_required') return 3;
    return 4;
  };
  const rankDiff = statusRank(a.status) - statusRank(b.status);
  if (rankDiff !== 0) return rankDiff;
  const cutDiff = a.cutBlockCount - b.cutBlockCount;
  if (cutDiff !== 0) return cutDiff;
  return Math.abs(a.adjustmentMeters) - Math.abs(b.adjustmentMeters);
}

export function buildModuleFitCandidateTable(params: ModuleFitContext & {
  dimension?: 'length' | 'width';
}): ModuleFitCandidate[] {
  const module = resolveCmuModuleDefinition(params.wall);
  const step = module.nominalModuleLengthMeters / 2;
  const base = params.requestedDimensionMeters;
  const dimension = params.dimension ?? 'length';
  const candidates: ModuleFitCandidate[] = [];
  for (let offset = -6; offset <= 6; offset += 1) {
    const candidate = roundMeters(base + offset * step);
    if (candidate <= 0) continue;
    if (params.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill') {
      const columnWidth = params.columnWidthMeters ?? 0.35;
      const clearWidth = Math.max(0.4, candidate - 2 * columnWidth);
      candidates.push(
        evaluateModuleFitForClearSpan({
          ...params,
          requestedDimensionMeters: base,
          clearWidthMeters: clearWidth,
        }),
      );
      continue;
    }
    candidates.push(
      evaluateClosedFootprintCandidate({
        requestedDimensionMeters: base,
        candidateDimensionMeters: candidate,
        dimension,
        wall: params.wall,
        layout: params.layout,
      }),
    );
  }
  return candidates.sort(compareCandidates);
}

function roundMeters(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
export function nearestModularCandidate(
  candidates: ModuleFitCandidate[],
  preference: 'fully_modular' | 'bond_modular' | 'any' = 'any',
): ModuleFitCandidate | null {
  const preferred =
    preference === 'fully_modular'
      ? candidates.filter((candidate) => candidate.status === 'fully_modular')
      : preference === 'bond_modular'
        ? candidates.filter((candidate) => candidate.status === 'bond_modular' || candidate.status === 'fully_modular')
        : candidates.filter(
            (candidate) => candidate.status === 'fully_modular' || candidate.status === 'bond_modular',
          );
  return preferred[0] ?? candidates[0] ?? null;
}

/** Required 3 m regression helper — uses solver, not modulo. */
export function classifyThreeMeterDimension(params: Omit<ModuleFitContext, 'requestedDimensionMeters'>): ModuleFitCandidate {
  return evaluateRequestedDimensionModuleFit({
    ...params,
    requestedDimensionMeters: 3,
  });
}

export function evaluateSegmentPanelModuleFit(params: {
  panelClearWidthMeters: number;
  wall: CmuWallSystemParameters;
  frame: SegmentFrame;
  panel: import('../types').CmuInfillPanel;
}): ModuleFitCandidate {
  const result = solveInfillPanelBlocks({
    panel: params.panel,
    frame: params.frame,
    wall: params.wall,
  });
  const status = classifyCounts(
    result.fullBlockCount,
    result.halfBlockCount,
    result.cutBlockCount,
  );
  return {
    requestedDimensionMeters: params.panelClearWidthMeters,
    candidateDimensionMeters: params.panelClearWidthMeters,
    adjustmentMeters: 0,
    status,
    fullBlockCount: result.fullBlockCount,
    halfBlockCount: result.halfBlockCount,
    cutBlockCount: result.cutBlockCount,
    explanation: `Solved panel: ${result.fullBlockCount} full, ${result.halfBlockCount} half, ${result.cutBlockCount} cut.`,
  };
}
