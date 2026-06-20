import type { CmuWallSystemParameters, DesignWallDimensionBasis, DesignWallLayoutParameters } from '../types';
import type { ClosedFootprintModuleFitProposal } from './cmuModuleRules';
import {
  analyzeCmuModuleFit,
  resolveCmuModuleDefinition,
} from './cmuModuleRules';
import { buildModuleFitReportFromPlacements, type ModuleFitReport } from './moduleFitReport';
import { createOutsideFaceRectangleLayout, deriveExteriorBounds } from './wallLayoutRules';
import { generateCmuLayoutFromWallLayout, resolveWallLayoutGeometry } from '../geometry/designGeometry';

export function resolveLayoutFootprintDimensions(
  layout: DesignWallLayoutParameters,
): { lengthMeters: number; widthMeters: number } | null {
  const bounds = deriveExteriorBounds(layout);
  if (!bounds || layout.nodes.length < 4) return null;
  return {
    lengthMeters: bounds.exteriorLengthMeters,
    widthMeters: bounds.exteriorWidthMeters,
  };
}

export function buildClosedFootprintModuleFitReport(params: {
  requestedFootprint: { lengthMeters: number; widthMeters: number };
  resolvedFootprint: { lengthMeters: number; widthMeters: number };
  cmu: CmuWallSystemParameters;
  layout: DesignWallLayoutParameters;
}): ModuleFitReport {
  const resolvedGeometry = resolveWallLayoutGeometry(params.layout, params.cmu);
  const layoutResult = generateCmuLayoutFromWallLayout(params.layout, params.cmu, resolvedGeometry);
  return buildModuleFitReportFromPlacements({
    placements: layoutResult.unitPlacements,
    requestedFootprint: params.requestedFootprint,
    resolvedFootprint: params.resolvedFootprint,
    coursePlans: layoutResult.coursePlans,
    layout: params.layout,
    dimensionBasis: params.layout.dimensionBasis,
    hasLayoutError: !params.layout.isFootprintClosed,
  });
}

export function resolveClosedFootprintToCmuModules(params: {
  requestedFootprint: { lengthMeters: number; widthMeters: number };
  dimensionBasis: DesignWallDimensionBasis;
  cmu: CmuWallSystemParameters;
  layout?: DesignWallLayoutParameters | null;
}): ClosedFootprintModuleFitProposal {
  const definition = resolveCmuModuleDefinition(params.cmu);
  const lengthFit = analyzeCmuModuleFit(params.requestedFootprint.lengthMeters, definition.nominalModuleLengthMeters);
  const widthFit = analyzeCmuModuleFit(params.requestedFootprint.widthMeters, definition.nominalModuleLengthMeters);
  const resolvedLength = roundMeters(params.requestedFootprint.lengthMeters);
  const resolvedWidth = roundMeters(params.requestedFootprint.widthMeters);

  const layout =
    params.layout ??
    createOutsideFaceRectangleLayout({
      lengthMeters: resolvedLength,
      widthMeters: resolvedWidth,
      wallHeightMeters: params.cmu.heightMeters,
      wallThicknessMeters: params.cmu.wallThicknessMeters,
    });

  const layoutCmu: CmuWallSystemParameters = {
    ...params.cmu,
    lengthMeters: resolvedLength,
    widthMeters: resolvedWidth,
  };

  const moduleFitReport = buildClosedFootprintModuleFitReport({
    requestedFootprint: {
      lengthMeters: roundMeters(params.requestedFootprint.lengthMeters),
      widthMeters: roundMeters(params.requestedFootprint.widthMeters),
    },
    resolvedFootprint: {
      lengthMeters: resolvedLength,
      widthMeters: resolvedWidth,
    },
    cmu: layoutCmu,
    layout,
  });

  const cutBlocksRequired =
    moduleFitReport.status === 'cut_required' ||
    moduleFitReport.status === 'opening_conflict' ||
    moduleFitReport.status === 'unresolved';

  return {
    dimensionBasis: params.dimensionBasis,
    requested: moduleFitReport.requested,
    resolved: moduleFitReport.resolved,
    adjustment: {
      lengthMeters: roundMeters(resolvedLength - params.requestedFootprint.lengthMeters),
      widthMeters: roundMeters(resolvedWidth - params.requestedFootprint.widthMeters),
    },
    lengthFit,
    widthFit,
    cornerCondition: cutBlocksRequired ? 'cut_blocks_required' : 'full_half_compatible',
    cutBlocksRequired,
    unitCounts: {
      full: moduleFitReport.fullUnitCount,
      half: moduleFitReport.halfEndUnitCount,
      end: 0,
      corner: 0,
      cut: moduleFitReport.cutUnitCount,
    },
    moduleFitReport,
    summary: moduleFitReport.summary,
  };
}

function roundMeters(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
