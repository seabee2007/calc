import type {
  CmuWallSystemParameters,
  DesignEstimatePreviewLine,
  GableRoofSystemParameters,
  SteelTrussSystemParameters,
  ThickenedEdgeSlabParameters,
  WallOpeningParameters,
} from '../types';
import { generateCmuLayout } from '../geometry/designGeometry';
import {
  collectLintelClosureCutBlockMetadata,
  countLintelClosureCutBlocks,
} from '../domain/lintelCourseClosureSolver';
import { createDefaultRoofSystemSettings, normalizeRoofSystemSettings } from '../domain/roofSystemDefaults';
import {
  OPENING_GROUT_CONCEPTUAL_WARNING,
  calculateCmuOpeningGroutSummary,
} from '../domain/cmuOpeningRules';
import {
  applyGroutWaste,
  computeCellCoreVolumeCubicMeters,
  resolveCmuCoreGeometry,
} from '../domain/cmuCoreGeometry';
import {
  applyMeasurementSystemToPreviewLines,
  type DesignMeasurementSystem,
} from './designQuantityUnits';

const SQUARE_METERS_PER_SQUARE_FOOT = 0.09290304;

export const CMU_BLOCK_BREAKDOWN_PREVIEW_LINE_IDS = [
  'cmu-standard-blocks',
  'cmu-special-blocks',
  'cmu-terminal-cut-blocks',
  'cmu-closure-cut-blocks',
  'cmu-lintel-closure-cut-blocks',
  'cmu-infill-blocks',
  'cmu-top-closure-cut-course',
  'gable-cut-blocks',
  'gable-end-cmu',
  'gable-end-cut-blocks',
] as const;

export function resolveCmuOrderBlockQuantity(params: {
  totalGeneratedBlocks: number;
  wasteFactor?: number;
}): number {
  const waste = Math.max(0, params.wasteFactor ?? 0);
  return Math.ceil(Math.max(0, params.totalGeneratedBlocks) * (1 + waste));
}

export function omitCmuBlockBreakdownPreviewLines(
  lines: readonly DesignEstimatePreviewLine[],
): DesignEstimatePreviewLine[] {
  const omit = new Set<string>(CMU_BLOCK_BREAKDOWN_PREVIEW_LINE_IDS);
  return lines.filter((line) => !omit.has(line.id));
}

export function calculateCmuFullCoreFillVolumeCubicMeters(
  totalBlocks: number,
  wall: CmuWallSystemParameters,
): number {
  const core = resolveCmuCoreGeometry(wall);
  const perBlockVolume = computeCellCoreVolumeCubicMeters(core);
  const grossVolume = Math.max(0, totalBlocks) * perBlockVolume;
  const wastePercent = Math.max(0, (wall.groutWastePercent ?? 0.1) * 100);
  return applyGroutWaste(grossVolume, wastePercent).netVolumeCubicMeters;
}

function buildCmuCoreFillGroutPreviewLine(
  input: Pick<CmuBuildingQuantityInput, 'designModelId' | 'wallObjectId' | 'wall'>,
  totalGeneratedBlocks: number,
): DesignEstimatePreviewLine {
  const core = resolveCmuCoreGeometry(input.wall);
  const volumeCubicMeters = calculateCmuFullCoreFillVolumeCubicMeters(totalGeneratedBlocks, input.wall);
  return {
    id: 'cmu-core-fill-grout',
    designModelId: input.designModelId,
    designObjectId: input.wallObjectId,
    quantityType: 'cmu_core_fill_grout',
    description: 'CMU core fill grout (every block)',
    quantity: roundQuantity(cubicMetersToCubicYards(volumeCubicMeters), 3),
    unit: 'CY',
    formula: 'total_blocks * cell_core_volume * (1 + grout_waste_percent)',
    parameterSnapshot: {
      totalGeneratedBlocks,
      coreGeometry: core,
      groutWastePercent: input.wall.groutWastePercent ?? 0.1,
      perBlockCoreVolumeCubicMeters: computeCellCoreVolumeCubicMeters(core),
      volumeCubicMeters,
    },
    source: 'parametric_design_builder',
    confidence: 'calculated_from_parameters',
    divisionCode: '04',
    divisionName: 'Masonry',
  };
}

function buildSiteCutCmuBlocksPreviewLine(
  input: Pick<CmuBuildingQuantityInput, 'designModelId' | 'wallObjectId' | 'wall'>,
  totalGeneratedBlocks: number,
): DesignEstimatePreviewLine {
  const quantity = resolveCmuOrderBlockQuantity({
    totalGeneratedBlocks,
    wasteFactor: input.wall.wasteFactor,
  });
  return {
    id: 'cmu-blocks',
    designModelId: input.designModelId,
    designObjectId: input.wallObjectId,
    quantityType: 'cmu_block_count',
    description: 'CMU blocks (order as full units, cut on site)',
    quantity,
    unit: 'EA',
    formula: 'ceil(total_generated_blocks * (1 + waste_factor))',
    parameterSnapshot: {
      ...input.wall,
      result: {
        totalGeneratedBlocks,
        orderBlockQuantity: quantity,
        orderingPolicy: 'site_cut_from_full_units',
      },
    },
    source: 'parametric_design_builder',
    confidence: 'calculated_from_parameters',
    divisionCode: '04',
    divisionName: 'Masonry',
  };
}
const CUBIC_METERS_PER_CUBIC_YARD = 0.764554857984;

export function roundQuantity(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function metersToFeet(meters: number): number {
  return meters / 0.3048;
}

export function squareMetersToSquareFeet(squareMeters: number): number {
  return squareMeters / SQUARE_METERS_PER_SQUARE_FOOT;
}

export function cubicMetersToCubicYards(cubicMeters: number): number {
  return cubicMeters / CUBIC_METERS_PER_CUBIC_YARD;
}

export function calculateFloorArea(lengthMeters: number, widthMeters: number): number {
  return Math.max(0, lengthMeters) * Math.max(0, widthMeters);
}

export function calculateOpeningArea(opening: Pick<WallOpeningParameters, 'widthMeters' | 'heightMeters'>): number {
  return Math.max(0, opening.widthMeters) * Math.max(0, opening.heightMeters);
}

export function calculateWallGrossArea(params: CmuWallSystemParameters): number {
  return 2 * (Math.max(0, params.lengthMeters) + Math.max(0, params.widthMeters)) * Math.max(0, params.heightMeters);
}

export function calculateWallOpeningArea(openings: readonly WallOpeningParameters[]): number {
  return openings.reduce((sum, opening) => sum + calculateOpeningArea(opening), 0);
}

export function calculateWallRoughOpeningArea(params: CmuWallSystemParameters): number {
  return calculateCmuOpeningGroutSummary(params).roughOpeningAreaSquareMeters;
}

export function calculateWallNetArea(params: CmuWallSystemParameters): number {
  return Math.max(0, calculateWallGrossArea(params) - calculateWallRoughOpeningArea(params));
}

export function calculateCmuBlockCount(params: CmuWallSystemParameters): number {
  const blockFaceArea = Math.max(0, params.blockLengthMeters) * Math.max(0, params.blockHeightMeters);
  if (blockFaceArea === 0) return 0;
  const netBlocks = calculateWallNetArea(params) / blockFaceArea;
  return Math.ceil(netBlocks * (1 + Math.max(0, params.wasteFactor)));
}

export interface SlabVolumeResult {
  footprintAreaSquareMeters: number;
  slabFieldVolumeCubicMeters: number;
  thickenedEdgeVolumeCubicMeters: number;
  totalConcreteVolumeCubicMeters: number;
  edgeBandAreaSquareMeters: number;
}

export function calculateThickenedEdgeSlabVolume(params: ThickenedEdgeSlabParameters): SlabVolumeResult {
  const length = Math.max(0, params.lengthMeters);
  const width = Math.max(0, params.widthMeters);
  const slabThickness = Math.max(0, params.slabThicknessMeters);
  const edgeWidth = Math.max(0, params.edgeWidthMeters);
  const edgeDepth = Math.max(0, params.edgeDepthMeters);
  const footprintArea = calculateFloorArea(length, width);
  const innerLength = Math.max(0, length - 2 * edgeWidth);
  const innerWidth = Math.max(0, width - 2 * edgeWidth);
  const innerArea = innerLength * innerWidth;
  const edgeBandArea = Math.max(0, footprintArea - innerArea);

  if (params.edgeMode === 'replaces_slab_at_perimeter') {
    const slabFieldVolume = innerArea * slabThickness;
    const thickenedEdgeVolume = edgeBandArea * edgeDepth;
    return {
      footprintAreaSquareMeters: footprintArea,
      slabFieldVolumeCubicMeters: slabFieldVolume,
      thickenedEdgeVolumeCubicMeters: thickenedEdgeVolume,
      totalConcreteVolumeCubicMeters: slabFieldVolume + thickenedEdgeVolume,
      edgeBandAreaSquareMeters: edgeBandArea,
    };
  }

  const slabFieldVolume = footprintArea * slabThickness;
  const addedDepth = Math.max(0, edgeDepth - slabThickness);
  const thickenedEdgeVolume = edgeBandArea * addedDepth;
  return {
    footprintAreaSquareMeters: footprintArea,
    slabFieldVolumeCubicMeters: slabFieldVolume,
    thickenedEdgeVolumeCubicMeters: thickenedEdgeVolume,
    totalConcreteVolumeCubicMeters: slabFieldVolume + thickenedEdgeVolume,
    edgeBandAreaSquareMeters: edgeBandArea,
  };
}

export function calculateGableRoofArea(params: GableRoofSystemParameters): number {
  const roofLength = Math.max(0, params.lengthMeters + 2 * params.overhangMeters);
  const halfSpanRun = Math.max(0, params.widthMeters / 2 + params.overhangMeters);
  const slopeFactor = Math.sqrt(1 + params.pitchRisePerRun ** 2);
  return 2 * roofLength * halfSpanRun * slopeFactor;
}

export function calculateTrussCount(params: SteelTrussSystemParameters): number {
  const length = Math.max(0, params.buildingLengthMeters);
  const spacing = Math.max(0, params.spacingMeters);
  if (length === 0 || spacing === 0) return 0;
  return Math.ceil(length / spacing) + 1;
}

export interface CmuBuildingQuantityInput {
  designModelId: string;
  wallObjectId: string;
  slabObjectId: string;
  roofObjectId: string;
  trussObjectId: string;
  wall: CmuWallSystemParameters;
  slab: ThickenedEdgeSlabParameters;
  roof: GableRoofSystemParameters;
  truss: SteelTrussSystemParameters;
  measurementSystem?: DesignMeasurementSystem;
}

export function buildCmuBuildingEstimatePreview(input: CmuBuildingQuantityInput): DesignEstimatePreviewLine[] {
  const wallGrossArea = calculateWallGrossArea(input.wall);
  const wallActualOpeningArea = calculateWallOpeningArea(input.wall.openings);
  const cmuLayout = generateCmuLayout(input.wall);
  const openingGrout = cmuLayout.openingGrout;
  const wallOpeningArea = openingGrout.roughOpeningAreaSquareMeters;
  const wallNetArea = calculateWallNetArea(input.wall);
  const terminalCutLengthMeters = cmuLayout.terminalClosures.reduce((sum, closure) => sum + closure.remainingLengthMeters, 0);
  const orderBlockQuantity = resolveCmuOrderBlockQuantity({
    totalGeneratedBlocks: cmuLayout.totalBlocks,
    wasteFactor: input.wall.wasteFactor,
  });
  const mortarAllowanceBags = Math.ceil(cmuLayout.totalBlocks / 100);
  const bondBeamLengthMeters = cmuLayout.bondBeamLengthMeters;
  const reinforcedCellCount = cmuLayout.groutedCellCount;
  const slab = calculateThickenedEdgeSlabVolume(input.slab);
  const roofArea = calculateGableRoofArea(input.roof);
  const trussCount = calculateTrussCount(input.truss);

  return omitCmuBlockBreakdownPreviewLines([
    {
      id: 'slab-concrete',
      designModelId: input.designModelId,
      designObjectId: input.slabObjectId,
      quantityType: 'slab_concrete',
      description: 'Thickened edge slab concrete',
      quantity: roundQuantity(cubicMetersToCubicYards(slab.totalConcreteVolumeCubicMeters), 2),
      unit: 'CY',
      formula: 'total_concrete_volume = slab_field_volume + thickened_edge_volume',
      parameterSnapshot: { ...input.slab, result: slab },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '03',
      divisionName: 'Concrete',
    },
    {
      ...buildSiteCutCmuBlocksPreviewLine(input, cmuLayout.totalBlocks),
      parameterSnapshot: {
        ...input.wall,
        result: {
          grossAreaSquareMeters: wallGrossArea,
          openingAreaSquareMeters: wallOpeningArea,
          actualOpeningAreaSquareMeters: wallActualOpeningArea,
          roughOpeningAreaSquareMeters: openingGrout.roughOpeningAreaSquareMeters,
          netAreaSquareMeters: wallNetArea,
          totalGeneratedBlocks: cmuLayout.totalBlocks,
          orderBlockQuantity,
          orderingPolicy: 'site_cut_from_full_units',
          blockBreakdown: cmuLayout.counts,
          courseCount: cmuLayout.courseCount,
          moduleFits: cmuLayout.moduleFits,
          terminalClosures: cmuLayout.terminalClosures,
          totalTerminalCutLengthMeters: roundQuantity(terminalCutLengthMeters, 3),
          openingGrout,
          warnings: [...new Set([...cmuLayout.warnings, ...openingGrout.warnings])],
        },
      },
    },
    {
      id: 'mortar-allowance',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'mortar_allowance',
      description: 'Mortar allowance',
      quantity: mortarAllowanceBags,
      unit: 'BAG',
      formula: 'ceil(total_generated_blocks / 100)',
      parameterSnapshot: { totalBlocks: cmuLayout.totalBlocks, blockBreakdown: cmuLayout.counts, moduleFits: cmuLayout.moduleFits },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'cmu-lintels',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_lintels',
      description: 'Precast concrete lintel',
      quantity: openingGrout.lintelCount,
      unit: 'EA',
      formula: 'one_lintel_per_opening_with_configured_bearing',
      parameterSnapshot: {
        openings: input.wall.openings,
        lintels: cmuLayout.lintels,
        openingGrout,
        warning: OPENING_GROUT_CONCEPTUAL_WARNING,
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'opening-rough-area',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'opening_rough_area',
      description: 'Door/window rough opening area',
      quantity: roundQuantity(squareMetersToSquareFeet(openingGrout.roughOpeningAreaSquareMeters), 2),
      unit: 'SF',
      formula: 'rough_opening_area = sum(rough_opening_width * rough_opening_height)',
      parameterSnapshot: {
        openings: input.wall.openings,
        resolvedOpenings: openingGrout.resolvedOpenings,
        warning: OPENING_GROUT_CONCEPTUAL_WARNING,
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'opening-actual-area',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'opening_actual_area',
      description: 'Door/window actual unit area',
      quantity: roundQuantity(squareMetersToSquareFeet(openingGrout.actualOpeningAreaSquareMeters), 2),
      unit: 'SF',
      formula: 'actual_opening_area = sum(actual_unit_width * actual_unit_height)',
      parameterSnapshot: {
        openings: input.wall.openings,
        resolvedOpenings: openingGrout.resolvedOpenings,
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '08',
      divisionName: 'Openings',
    },
    {
      id: 'door-window-units',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'door_window_units',
      description: 'Door/window units by actual size',
      quantity: input.wall.openings.length,
      unit: 'EA',
      formula: 'door_window_units = count(configured_actual_openings)',
      parameterSnapshot: {
        openings: input.wall.openings,
        resolvedOpenings: openingGrout.resolvedOpenings.map((opening) => ({
          id: opening.id,
          type: opening.type,
          actualWidthMeters: opening.actualWidthMeters,
          actualHeightMeters: opening.actualHeightMeters,
          roughOpeningWidthMeters: opening.roughOpeningWidthMeters,
          roughOpeningHeightMeters: opening.roughOpeningHeightMeters,
        })),
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '08',
      divisionName: 'Openings',
    },
    {
      id: 'cmu-jamb-grout',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_jamb_grout',
      description: 'Jamb/core fill around openings',
      quantity: roundQuantity(cubicMetersToCubicYards(openingGrout.jambGroutVolumeCubicMeters), 2),
      unit: 'CY',
      formula: 'jamb_grout = sum(jamb_cell_fill_placements.net_volume_cubic_meters)',
      parameterSnapshot: {
        openingGrout,
        groutFillPlacementIds: openingGrout.groutFillPlacementIds,
        coreGeometry: openingGrout.coreGeometry,
        warning: OPENING_GROUT_CONCEPTUAL_WARNING,
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'cmu-lintel-grout',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_lintel_grout',
      description: 'Bond-beam lintel grout',
      quantity: roundQuantity(cubicMetersToCubicYards(openingGrout.lintelGroutVolumeCubicMeters), 2),
      unit: 'CY',
      formula: 'lintel_grout = sum(lintel_cell_fill_placements.net_volume_cubic_meters)',
      parameterSnapshot: {
        openingGrout,
        groutFillPlacementIds: openingGrout.groutFillPlacementIds,
        coreGeometry: openingGrout.coreGeometry,
        warning: OPENING_GROUT_CONCEPTUAL_WARNING,
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'cmu-sill-grout',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_sill_grout',
      description: 'Sill grout at window openings',
      quantity: roundQuantity(cubicMetersToCubicYards(openingGrout.sillGroutVolumeCubicMeters ?? 0), 2),
      unit: 'CY',
      formula: 'sill_grout = sum(sill_cell_fill_placements.net_volume_cubic_meters)',
      parameterSnapshot: {
        openingGrout,
        groutFillPlacementIds: openingGrout.groutFillPlacementIds,
        coreGeometry: openingGrout.coreGeometry,
        warning: OPENING_GROUT_CONCEPTUAL_WARNING,
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'cmu-opening-grout-total',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_opening_grout_total',
      description: 'Opening-related CMU grout total',
      quantity: roundQuantity(
        cubicMetersToCubicYards(
          (openingGrout.jambGroutVolumeCubicMeters ?? 0) +
            (openingGrout.lintelGroutVolumeCubicMeters ?? 0) +
            (openingGrout.sillGroutVolumeCubicMeters ?? 0) +
            (openingGrout.closureGroutVolumeCubicMeters ?? 0),
        ),
        2,
      ),
      unit: 'CY',
      formula: 'opening_grout_total = jamb_grout + lintel_grout + sill_grout + closure_grout',
      parameterSnapshot: {
        openingGrout,
        groutFillPlacementIds: openingGrout.groutFillPlacementIds,
        overlapDeduplicationCubicMeters: openingGrout.overlapDeduplicationCubicMeters,
        coreGeometry: openingGrout.coreGeometry,
        warning: OPENING_GROUT_CONCEPTUAL_WARNING,
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'cmu-closure-grout',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_closure_grout',
      description: 'Closure grout at opening jambs',
      quantity: roundQuantity(cubicMetersToCubicYards(openingGrout.closureGroutVolumeCubicMeters), 2),
      unit: 'CY',
      formula: 'closure_grout_volume = sum(course residual gaps * wall thickness * course height * fill factor), only for grout_fill closures',
      parameterSnapshot: {
        openingCourseClosures: cmuLayout.openingCourseClosures,
        openingGrout,
        warning: OPENING_GROUT_CONCEPTUAL_WARNING,
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'cmu-closure-cut-blocks',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_closure_cut_blocks',
      description: 'Course closure cut blocks at opening jambs',
      quantity: openingGrout.courseClosureCutBlockCount,
      unit: 'EA',
      formula: 'closure_cut_blocks = count(opening course closures classified as cut_block)',
      parameterSnapshot: {
        openingCourseClosures: cmuLayout.openingCourseClosures,
        openingGrout,
        warning: OPENING_GROUT_CONCEPTUAL_WARNING,
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'cmu-lintel-closure-cut-blocks',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_lintel_closure_cut_blocks',
      description: 'CMU lintel closure cut blocks',
      quantity: countLintelClosureCutBlocks(cmuLayout.lintelCourseAssemblies),
      unit: 'EA',
      formula: 'lintel_closure_cut_blocks = count(lintel_course cut_block placements)',
      parameterSnapshot: {
        lintelClosureCutBlocks: collectLintelClosureCutBlockMetadata(cmuLayout.lintelCourseAssemblies),
        lintelCourseAssemblies: cmuLayout.lintelCourseAssemblies,
        warning: OPENING_GROUT_CONCEPTUAL_WARNING,
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'cmu-bond-beam-grout',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_bond_beam_grout',
      description: 'Top bond beam grout',
      quantity: roundQuantity(cubicMetersToCubicYards(openingGrout.bondBeamGroutVolumeCubicMeters), 2),
      unit: 'CY',
      formula: 'bond_beam_grout = bond_beam_length * wall_thickness * module_height * core_fill_factor * (1 + grout_waste)',
      parameterSnapshot: {
        bondBeamEnabled: input.wall.bondBeamEnabled,
        openingGrout,
        warning: OPENING_GROUT_CONCEPTUAL_WARNING,
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'cmu-total-grout',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_total_grout',
      description: 'CMU grout fill total',
      quantity: roundQuantity(cubicMetersToCubicYards(openingGrout.totalGroutVolumeCubicMeters), 2),
      unit: 'CY',
      formula: 'total_grout = standard_core_fill + jamb_grout + lintel_grout + sill_grout + bond_beam_grout + closure_grout - overlap_deduplication',
      parameterSnapshot: {
        openingGrout,
        groutFillPlacements: cmuLayout.groutFillPlacements,
        overlapDeduplicationCubicMeters: openingGrout.overlapDeduplicationCubicMeters,
        coreGeometry: openingGrout.coreGeometry,
        warning: OPENING_GROUT_CONCEPTUAL_WARNING,
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    buildCmuCoreFillGroutPreviewLine(input, cmuLayout.totalBlocks),
    {
      id: 'cmu-bond-beam',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_bond_beam',
      description: 'Top course bond beam',
      quantity: roundQuantity(bondBeamLengthMeters, 2),
      unit: 'M',
      formula: 'bond_beam_length = wall_perimeter_when_enabled',
      parameterSnapshot: { bondBeamEnabled: input.wall.bondBeamEnabled, bondBeamLengthMeters },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'grouted-cells-columns',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'grouted_cells_columns',
      description: 'Vertical reinforced/grouted cells',
      quantity: reinforcedCellCount + cmuLayout.pilasters.length,
      unit: 'EA',
      formula: 'ceil(wall_perimeter / grouted_cell_spacing) + generated_pilasters',
      parameterSnapshot: {
        groutedCellSpacingMeters: input.wall.groutedCellSpacingMeters,
        pilasters: cmuLayout.pilasters,
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'cmu-wall-area',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_wall_net_area',
      description: 'CMU wall net area',
      quantity: roundQuantity(squareMetersToSquareFeet(wallNetArea), 2),
      unit: 'SF',
      formula: 'net_wall_area = gross_wall_area - openings_area',
      parameterSnapshot: {
        ...input.wall,
        result: {
          grossAreaSquareMeters: wallGrossArea,
          openingAreaSquareMeters: wallOpeningArea,
          actualOpeningAreaSquareMeters: wallActualOpeningArea,
          roughOpeningAreaSquareMeters: openingGrout.roughOpeningAreaSquareMeters,
          netAreaSquareMeters: wallNetArea,
        },
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'roof-area',
      designModelId: input.designModelId,
      designObjectId: input.roofObjectId,
      quantityType: 'roof_area',
      description: 'Gable roof surface area',
      quantity: roundQuantity(squareMetersToSquareFeet(roofArea), 2),
      unit: 'SF',
      formula: 'roof_area = 2 * roof_length_with_overhang * half_span_run_with_overhang * sqrt(1 + pitch^2)',
      parameterSnapshot: { ...input.roof, result: { roofAreaSquareMeters: roofArea } },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '07',
      divisionName: 'Thermal & Moisture Protection',
    },
    {
      id: 'steel-trusses',
      designModelId: input.designModelId,
      designObjectId: input.trussObjectId,
      quantityType: 'steel_truss_count',
      description: 'Steel trusses by spacing',
      quantity: trussCount,
      unit: 'EA',
      formula: 'truss_count = ceil(building_length / spacing) + 1',
      parameterSnapshot: { ...input.truss, result: { trussCount } },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '05',
      divisionName: 'Metals',
    },
  ]);
}

export interface FrameInfillQuantityInput extends CmuBuildingQuantityInput {
  frameObjectId: string;
  infillObjectId: string;
  gableEndObjectId: string;
  buildingSystemMode: import('../types').BuildingSystemMode;
  frameSystem: import('../types').StructuralFrameSystemParameters;
  infillSystem: import('../types').CmuInfillSystemParameters;
  gableEndSystem: import('../types').GableEndSystemParameters;
  geometryResult: import('../geometry/designGeometry').DesignGeometryResult;
  roofSystem?: import('../types').RoofSystemSettings;
}

export function buildFrameInfillEstimatePreview(input: FrameInfillQuantityInput): DesignEstimatePreviewLine[] {
  const resolvedRoof = input.geometryResult.resolvedRoofSystem;
  const hiddenLegacyLineIds = new Set<DesignEstimatePreviewLine['id']>([
    'slab-concrete',
    'cmu-blocks',
    'cmu-core-fill-grout',
  ]);
  if (resolvedRoof?.supported) {
    hiddenLegacyLineIds.add('steel-trusses');
  }
  const base = omitCmuBlockBreakdownPreviewLines(
    buildCmuBuildingEstimatePreview(input).filter((line) => !hiddenLegacyLineIds.has(line.id)),
  );
  const breakdown = input.geometryResult.structuralConcreteVolumeBreakdown;
  const structuralVolume = input.geometryResult.structuralConcreteVolumeCubicMeters ?? 0;
  const roofSettings = normalizeRoofSystemSettings(input.roofSystem);
  const rakedCapVolumeCubicMeters = resolvedRoof?.rakedCapVolumeCubicMeters ?? 0;
  const rakedCapLinearLengthMeters = (resolvedRoof?.gableEnds ?? [])
    .flatMap((gableEnd) => gableEnd.rakedCapPlacements)
    .reduce((sum, cap) => sum + (cap.endStationMeters - cap.startStationMeters), 0);
  const metaBase = {
    buildingSystemMode: input.buildingSystemMode,
    quantityFormula: 'parametric_design_builder',
  };
  const columnVolumeCubicMeters =
    (breakdown?.columnBelowPlinthVolumeCubicMeters ??
      breakdown?.columnBelowGradeVolumeCubicMeters ??
      0) +
    (breakdown?.columnAbovePlinthVolumeCubicMeters ??
      breakdown?.columnAboveGradeVolumeCubicMeters ??
      0);

  const plinthBeamVolume =
    breakdown?.plinthBeamVolumeCubicMeters ?? breakdown?.gradeBeamVolumeCubicMeters ?? 0;
  const roofBeamVolume =
    breakdown?.roofBeamVolumeCubicMeters ?? breakdown?.ringBeamVolumeCubicMeters ?? 0;
  const tieBeamVolume = breakdown?.tieBeamVolumeCubicMeters ?? 0;

  const structuralLines: DesignEstimatePreviewLine[] = breakdown
    ? [
        {
          id: 'rc-roof-beams-volume',
          designModelId: input.designModelId,
          designObjectId: input.frameObjectId,
          quantityType: 'rc_roof_beams_volume',
          description: 'RC Roof Beams',
          quantity: roundQuantity(cubicMetersToCubicYards(roofBeamVolume), 2),
          unit: 'CY',
          formula: 'sum(roof_beam span * width * depth)',
          parameterSnapshot: {
            beams: input.frameSystem.beams.filter(
              (beam) => beam.kind === 'roof_beam' || beam.kind === 'ring_beam',
            ),
            structuralObjectId: input.frameObjectId,
            ...metaBase,
          },
          source: 'parametric_design_builder',
          confidence: 'calculated_from_parameters',
          divisionCode: '03',
          divisionName: 'Concrete',
        },
        {
          id: 'rc-plinth-beams-volume',
          designModelId: input.designModelId,
          designObjectId: input.frameObjectId,
          quantityType: 'rc_plinth_beams_volume',
          description: 'RC Plinth Beams',
          quantity: roundQuantity(cubicMetersToCubicYards(plinthBeamVolume), 2),
          unit: 'CY',
          formula: 'sum(plinth_beam span * width * depth)',
          parameterSnapshot: {
            beams: input.frameSystem.beams.filter(
              (beam) => beam.kind === 'plinth_beam' || beam.kind === 'grade_beam',
            ),
            structuralObjectId: input.frameObjectId,
            ...metaBase,
          },
          source: 'parametric_design_builder',
          confidence: 'calculated_from_parameters',
          divisionCode: '03',
          divisionName: 'Concrete',
        },
        ...(breakdown.interiorFloorSlabVolumeCubicMeters > 0
          ? [
              {
                id: 'interior-floor-slab-volume',
                designModelId: input.designModelId,
                designObjectId: input.frameObjectId,
                quantityType: 'interior_floor_slab_volume',
                description: 'Interior Floor Slab',
                quantity: roundQuantity(
                  cubicMetersToCubicYards(breakdown.interiorFloorSlabVolumeCubicMeters),
                  2,
                ),
                unit: 'CY',
                formula: 'interior_footprint_area * slab_thickness',
                parameterSnapshot: {
                  interiorFloorSlab: input.geometryResult.interiorFloorSlab,
                  structuralObjectId: input.frameObjectId,
                  ...metaBase,
                },
                source: 'parametric_design_builder',
                confidence: 'calculated_from_parameters',
                divisionCode: '03',
                divisionName: 'Concrete',
              },
            ]
          : []),
        {
          id: 'rc-tie-beams-volume',
          designModelId: input.designModelId,
          designObjectId: input.frameObjectId,
          quantityType: 'rc_tie_beams_volume',
          description: 'RC Tie Beams',
          quantity: roundQuantity(cubicMetersToCubicYards(tieBeamVolume), 2),
          unit: 'CY',
          formula: 'sum(tie_beam span * width * depth)',
          parameterSnapshot: {
            beams: input.frameSystem.beams.filter((beam) => beam.kind === 'tie_beam'),
            structuralObjectId: input.frameObjectId,
            ...metaBase,
          },
          source: 'parametric_design_builder',
          confidence: 'calculated_from_parameters',
          divisionCode: '03',
          divisionName: 'Concrete',
        },
        {
          id: 'rc-columns-volume',
          designModelId: input.designModelId,
          designObjectId: input.frameObjectId,
          quantityType: 'rc_columns_volume',
          description: 'RC Columns',
          quantity: roundQuantity(cubicMetersToCubicYards(columnVolumeCubicMeters), 2),
          unit: 'CY',
          formula: 'column below plinth + column in CMU zone (beam intersections excluded)',
          parameterSnapshot: {
            columns: input.frameSystem.columns,
            columnBelowPlinthVolumeCubicMeters:
              breakdown.columnBelowPlinthVolumeCubicMeters ?? breakdown.columnBelowGradeVolumeCubicMeters,
            columnAbovePlinthVolumeCubicMeters:
              breakdown.columnAbovePlinthVolumeCubicMeters ?? breakdown.columnAboveGradeVolumeCubicMeters,
            structuralObjectId: input.frameObjectId,
            ...metaBase,
          },
          source: 'parametric_design_builder',
          confidence: 'calculated_from_parameters',
          divisionCode: '03',
          divisionName: 'Concrete',
        },
        {
          id: 'isolated-footings-volume',
          designModelId: input.designModelId,
          designObjectId: input.frameObjectId,
          quantityType: 'isolated_footings_volume',
          description: 'Isolated Footings',
          quantity: roundQuantity(cubicMetersToCubicYards(breakdown.footingVolumeCubicMeters), 2),
          unit: 'CY',
          formula: 'footing width * length * thickness per column',
          parameterSnapshot: {
            footings: input.geometryResult.isolatedFootings ?? [],
            structuralObjectId: input.frameObjectId,
            ...metaBase,
          },
          source: 'parametric_design_builder',
          confidence: 'calculated_from_parameters',
          divisionCode: '03',
          divisionName: 'Concrete',
        },
        {
          id: 'rc-structural-total-volume',
          designModelId: input.designModelId,
          designObjectId: input.frameObjectId,
          quantityType: 'rc_structural_concrete_volume',
          description: 'RC structural concrete total (deduplicated)',
          quantity: roundQuantity(cubicMetersToCubicYards(structuralVolume), 2),
          unit: 'CY',
          formula: 'roof + plinth + tie + columns + footings minus beam/column intersections',
          parameterSnapshot: {
            breakdown,
            structuralObjectId: input.frameObjectId,
            ...metaBase,
          },
          source: 'parametric_design_builder',
          confidence: 'calculated_from_parameters',
          divisionCode: '03',
          divisionName: 'Concrete',
        },
      ]
    : [
        {
          id: 'rc-beams-volume',
          designModelId: input.designModelId,
          designObjectId: input.frameObjectId,
          quantityType: 'rc_structural_concrete_volume',
          description: 'RC structural concrete volume (deduplicated beam/column intersections)',
          quantity: roundQuantity(cubicMetersToCubicYards(structuralVolume), 2),
          unit: 'CY',
          formula: 'unionVolume(columns, beams) with intersection subtraction',
          parameterSnapshot: {
            beams: input.frameSystem.beams,
            columns: input.frameSystem.columns,
            structuralConcreteVolumeCubicMeters: structuralVolume,
            structuralObjectId: input.frameObjectId,
            ...metaBase,
          },
          source: 'parametric_design_builder',
          confidence: 'calculated_from_parameters',
          divisionCode: '03',
          divisionName: 'Concrete',
        },
      ];

  return omitCmuBlockBreakdownPreviewLines([
    ...base,
    ...structuralLines,
    buildSiteCutCmuBlocksPreviewLine(
      input,
      input.geometryResult.blockCount ?? input.geometryResult.wallCmuLayout.totalBlocks,
    ),
    buildCmuCoreFillGroutPreviewLine(
      input,
      input.geometryResult.blockCount ?? input.geometryResult.wallCmuLayout.totalBlocks,
    ),
    ...(resolvedRoof?.supported
      ? [
          {
            id: 'roof-surface-area',
            designModelId: input.designModelId,
            designObjectId: input.roofObjectId,
            quantityType: 'roof_surface_area',
            description: 'Roof Surface Area',
            quantity: roundQuantity(squareMetersToSquareFeet(resolvedRoof.roofSurfaceAreaSquareMeters), 2),
            unit: 'SF',
            formula: 'sum(resolved_roof_plane_areas)',
            parameterSnapshot: {
              roofType: resolvedRoof.roofType,
              roofSurfaceAreaSquareMeters: resolvedRoof.roofSurfaceAreaSquareMeters,
              roofObjectId: input.roofObjectId,
              ...metaBase,
            },
            source: 'parametric_design_builder',
            confidence: 'calculated_from_parameters',
            divisionCode: '07',
            divisionName: 'Thermal & Moisture Protection',
          },
          {
            id: 'roof-framing-reference-length',
            designModelId: input.designModelId,
            designObjectId: input.roofObjectId,
            quantityType: 'roof_framing_reference_length',
            description: 'Rafter / Truss Reference Length',
            quantity: roundQuantity(metersToFeet(resolvedRoof.roofMemberReferenceLengthMeters), 2),
            unit: 'LF',
            formula: 'hypot(roof_run, roof_rise)',
            parameterSnapshot: {
              roofRunMeters: resolvedRoof.roofRunMeters,
              roofRiseMeters: resolvedRoof.roofRiseMeters,
              roofMemberReferenceLengthMeters: resolvedRoof.roofMemberReferenceLengthMeters,
              roofObjectId: input.roofObjectId,
              ...metaBase,
            },
            source: 'parametric_design_builder',
            confidence: 'calculated_from_parameters',
            divisionCode: '06',
            divisionName: 'Wood, Plastics & Composites',
          },
          ...(resolvedRoof.roofType === 'gable' && roofSettings.steelTrusses.enabled
            ? [
                {
                  id: 'steel-trusses',
                  designModelId: input.designModelId,
                  designObjectId: input.trussObjectId,
                  quantityType: 'steel_roof_truss_count',
                  description: 'Steel trusses by spacing',
                  quantity: resolvedRoof.trussCount,
                  unit: 'EA',
                  formula: 'max(2, ceil(building_length / max_spacing) + 1)',
                  parameterSnapshot: {
                    trussCount: resolvedRoof.trussCount,
                    actualTrussSpacingMeters: resolvedRoof.actualTrussSpacingMeters,
                    trussObjectId: input.trussObjectId,
                    ...metaBase,
                  },
                  source: 'parametric_design_builder',
                  confidence: 'calculated_from_parameters',
                  divisionCode: '05',
                  divisionName: 'Metals',
                },
                {
                  id: 'steel-truss-chords-web',
                  designModelId: input.designModelId,
                  designObjectId: input.trussObjectId,
                  quantityType: 'steel_truss_chords_web_allowance',
                  description: 'Steel Truss Chords and Web Allowance',
                  quantity: roundQuantity(
                    metersToFeet(
                      (resolvedRoof.roofMemberReferenceLengthMeters * 2 +
                        (resolvedRoof.exteriorRoofBeamBounds.depthMeters >=
                        resolvedRoof.exteriorRoofBeamBounds.widthMeters
                          ? resolvedRoof.exteriorRoofBeamBounds.widthMeters
                          : resolvedRoof.exteriorRoofBeamBounds.depthMeters) +
                        resolvedRoof.roofMemberReferenceLengthMeters *
                          2 *
                          roofSettings.steelTrusses.webSteelAllowanceFactor) *
                        resolvedRoof.trussCount,
                    ),
                    2,
                  ),
                  unit: 'LF',
                  formula: '(top_chords + bottom_chord + web_allowance) * truss_count',
                  parameterSnapshot: {
                    webSteelAllowanceFactor: roofSettings.steelTrusses.webSteelAllowanceFactor,
                    trussCount: resolvedRoof.trussCount,
                    ...metaBase,
                  },
                  source: 'parametric_design_builder',
                  confidence: 'calculated_from_parameters',
                  divisionCode: '05',
                  divisionName: 'Metals',
                },
                {
                  id: 'truss-base-plates',
                  designModelId: input.designModelId,
                  designObjectId: input.trussObjectId,
                  quantityType: 'truss_base_plate_count',
                  description: 'Truss Base Plates',
                  quantity: resolvedRoof.trussCount * 2,
                  unit: 'EA',
                  formula: 'truss_count * 2',
                  parameterSnapshot: { trussCount: resolvedRoof.trussCount, ...metaBase },
                  source: 'parametric_design_builder',
                  confidence: 'calculated_from_parameters',
                  divisionCode: '05',
                  divisionName: 'Metals',
                },
                {
                  id: 'truss-anchor-bolts',
                  designModelId: input.designModelId,
                  designObjectId: input.trussObjectId,
                  quantityType: 'truss_anchor_bolt_count',
                  description: 'Anchor Bolts',
                  quantity:
                    resolvedRoof.trussCount *
                    2 *
                    roofSettings.steelTrusses.anchorBoltsPerBearing,
                  unit: 'EA',
                  formula: 'base_plate_count * anchor_bolts_per_bearing',
                  parameterSnapshot: {
                    anchorBoltsPerBearing: roofSettings.steelTrusses.anchorBoltsPerBearing,
                    ...metaBase,
                  },
                  source: 'parametric_design_builder',
                  confidence: 'calculated_from_parameters',
                  divisionCode: '05',
                  divisionName: 'Metals',
                },
              ]
            : []),
          ...(roofSettings.purlins.enabled
            ? [
                {
                  id: 'steel-purlins',
                  designModelId: input.designModelId,
                  designObjectId: input.roofObjectId,
                  quantityType: 'steel_purlin_length',
                  description: 'Steel Purlins',
                  quantity: roundQuantity(
                    metersToFeet(
                      resolvedRoof.purlinRowsPerSlope * 2 * Math.max(resolvedRoof.ridgeLengthMeters, 0.001),
                    ),
                    2,
                  ),
                  unit: 'LF',
                  formula: 'purlin_rows_per_slope * 2 * ridge_length',
                  parameterSnapshot: {
                    purlinRowsPerSlope: resolvedRoof.purlinRowsPerSlope,
                    ridgeLengthMeters: resolvedRoof.ridgeLengthMeters,
                    ...metaBase,
                  },
                  source: 'parametric_design_builder',
                  confidence: 'calculated_from_parameters',
                  divisionCode: '05',
                  divisionName: 'Metals',
                },
              ]
            : []),
          ...(roofSettings.corrugatedMetal.enabled
            ? [
                {
                  id: 'corrugated-metal-roofing',
                  designModelId: input.designModelId,
                  designObjectId: input.roofObjectId,
                  quantityType: 'corrugated_metal_roofing_area',
                  description: 'Corrugated Metal Roofing',
                  quantity: roundQuantity(
                    squareMetersToSquareFeet(
                      resolvedRoof.roofSurfaceAreaSquareMeters *
                        (1 + roofSettings.corrugatedMetal.wastePercent / 100),
                    ),
                    2,
                  ),
                  unit: 'SF',
                  formula: 'resolved_roof_surface_area * (1 + waste_percent / 100)',
                  parameterSnapshot: {
                    wastePercent: roofSettings.corrugatedMetal.wastePercent,
                    roofSurfaceAreaSquareMeters: resolvedRoof.roofSurfaceAreaSquareMeters,
                    ...metaBase,
                  },
                  source: 'parametric_design_builder',
                  confidence: 'calculated_from_parameters',
                  divisionCode: '07',
                  divisionName: 'Thermal & Moisture Protection',
                },
                ...(roofSettings.corrugatedMetal.ridgeCapEnabled && resolvedRoof.ridgeLengthMeters > 0
                  ? [
                      {
                        id: 'ridge-cap',
                        designModelId: input.designModelId,
                        designObjectId: input.roofObjectId,
                        quantityType: 'ridge_cap_length',
                        description: 'Ridge Cap',
                        quantity: roundQuantity(
                          metersToFeet(
                            resolvedRoof.ridgeLengthMeters *
                              (1 + roofSettings.corrugatedMetal.ridgeCapLapAllowancePercent / 100),
                          ),
                          2,
                        ),
                        unit: 'LF',
                        formula: 'ridge_length * (1 + lap_allowance_percent / 100)',
                        parameterSnapshot: {
                          ridgeLengthMeters: resolvedRoof.ridgeLengthMeters,
                          ridgeCapLapAllowancePercent: roofSettings.corrugatedMetal.ridgeCapLapAllowancePercent,
                          ...metaBase,
                        },
                        source: 'parametric_design_builder',
                        confidence: 'calculated_from_parameters',
                        divisionCode: '07',
                        divisionName: 'Thermal & Moisture Protection',
                      },
                    ]
                  : []),
              ]
            : []),
          ...(resolvedRoof.roofType === 'gable' && rakedCapVolumeCubicMeters > 0
            ? [
                {
                  id: 'raked-concrete-cap',
                  designModelId: input.designModelId,
                  designObjectId: input.gableEndObjectId,
                  quantityType: 'raked_concrete_cap_volume',
                  description: 'Raked Concrete Cap — Concrete Volume',
                  quantity: roundQuantity(cubicMetersToCubicYards(rakedCapVolumeCubicMeters), 2),
                  unit: 'CY',
                  formula: 'sum(resolved_raked_cap_segment_volumes)',
                  parameterSnapshot: {
                    rakedCapVolumeCubicMeters,
                    rakedCapLinearLengthMeters,
                    gableEndSegmentIds: resolvedRoof.gableEndSegmentIds,
                    gableEndId: input.gableEndObjectId,
                    ...metaBase,
                  },
                  source: 'parametric_design_builder',
                  confidence: 'calculated_from_parameters',
                  divisionCode: '03',
                  divisionName: 'Concrete',
                },
                {
                  id: 'raked-concrete-cap-length',
                  designModelId: input.designModelId,
                  designObjectId: input.gableEndObjectId,
                  quantityType: 'raked_concrete_cap_linear_length',
                  description: 'Raked Concrete Cap — Linear Length',
                  quantity: roundQuantity(rakedCapLinearLengthMeters, 2),
                  unit: 'LF',
                  formula: 'sum(resolved_raked_cap_segment_lengths)',
                  parameterSnapshot: {
                    rakedCapLinearLengthMeters,
                    gableEndSegmentIds: resolvedRoof.gableEndSegmentIds,
                    gableEndId: input.gableEndObjectId,
                    ...metaBase,
                  },
                  source: 'parametric_design_builder',
                  confidence: 'calculated_from_parameters',
                  divisionCode: '03',
                  divisionName: 'Concrete',
                },
                {
                  id: 'raked-concrete-cap-reinf-placeholder',
                  designModelId: input.designModelId,
                  designObjectId: input.gableEndObjectId,
                  quantityType: 'raked_concrete_cap_reinforcement_placeholder',
                  description: 'Raked Concrete Cap — Reinforcement Allowance (placeholder)',
                  quantity: 0,
                  unit: 'EA',
                  formula: 'reserved_for_future_structural_detailing',
                  parameterSnapshot: {
                    rakedCapVolumeCubicMeters,
                    gableEndSegmentIds: resolvedRoof.gableEndSegmentIds,
                    gableEndId: input.gableEndObjectId,
                    ...metaBase,
                  },
                  source: 'parametric_design_builder',
                  confidence: 'calculated_from_parameters',
                  divisionCode: '03',
                  divisionName: 'Concrete',
                },
              ]
            : []),
        ]
      : []),
  ]);
}

export function buildDesignEstimatePreview(input: FrameInfillQuantityInput): DesignEstimatePreviewLine[] {
  const measurementSystem = input.measurementSystem ?? 'imperial';
  const lines =
    input.buildingSystemMode === 'reinforced_concrete_frame_with_cmu_infill'
      ? buildFrameInfillEstimatePreview(input)
      : buildCmuBuildingEstimatePreview(input);
  return applyMeasurementSystemToPreviewLines(lines, measurementSystem);
}
