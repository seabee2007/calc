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
  OPENING_GROUT_CONCEPTUAL_WARNING,
  calculateCmuOpeningGroutSummary,
} from '../domain/cmuOpeningRules';

const SQUARE_METERS_PER_SQUARE_FOOT = 0.09290304;
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
}

export function buildCmuBuildingEstimatePreview(input: CmuBuildingQuantityInput): DesignEstimatePreviewLine[] {
  const wallGrossArea = calculateWallGrossArea(input.wall);
  const wallActualOpeningArea = calculateWallOpeningArea(input.wall.openings);
  const blockCount = calculateCmuBlockCount(input.wall);
  const cmuLayout = generateCmuLayout(input.wall);
  const openingGrout = cmuLayout.openingGrout;
  const wallOpeningArea = openingGrout.roughOpeningAreaSquareMeters;
  const wallNetArea = calculateWallNetArea(input.wall);
  const standardBlocks = cmuLayout.counts.full;
  const terminalCutLengthMeters = cmuLayout.terminalClosures.reduce((sum, closure) => sum + closure.remainingLengthMeters, 0);
  const specialBlocks =
    cmuLayout.counts.half +
    cmuLayout.counts.end +
    cmuLayout.counts.corner +
    cmuLayout.counts.jamb +
    cmuLayout.counts.cut;
  const mortarAllowanceBags = Math.ceil(cmuLayout.totalBlocks / 100);
  const bondBeamLengthMeters = cmuLayout.bondBeamLengthMeters;
  const reinforcedCellCount = cmuLayout.groutedCellCount;
  const slab = calculateThickenedEdgeSlabVolume(input.slab);
  const roofArea = calculateGableRoofArea(input.roof);
  const trussCount = calculateTrussCount(input.truss);

  return [
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
      id: 'cmu-blocks',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_block_count',
      description: 'CMU total blocks including waste',
      quantity: Math.max(blockCount, cmuLayout.totalBlocks),
      unit: 'EA',
      formula: 'ceil(((gross_wall_area - openings_area) / block_face_area) * (1 + waste_factor))',
      parameterSnapshot: {
        ...input.wall,
        result: {
          grossAreaSquareMeters: wallGrossArea,
          openingAreaSquareMeters: wallOpeningArea,
          actualOpeningAreaSquareMeters: wallActualOpeningArea,
          roughOpeningAreaSquareMeters: openingGrout.roughOpeningAreaSquareMeters,
          netAreaSquareMeters: wallNetArea,
          blockBreakdown: cmuLayout.counts,
          courseCount: cmuLayout.courseCount,
          moduleFits: cmuLayout.moduleFits,
          terminalClosures: cmuLayout.terminalClosures,
          openingGrout,
          warnings: [...new Set([...cmuLayout.warnings, ...openingGrout.warnings])],
        },
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'cmu-standard-blocks',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_standard_blocks',
      description: 'CMU full/standard blocks',
      quantity: standardBlocks,
      unit: 'EA',
      formula: 'generated_full_block_count_from_courses',
      parameterSnapshot: { ...input.wall, result: { blockBreakdown: cmuLayout.counts, courseCount: cmuLayout.courseCount, moduleFits: cmuLayout.moduleFits } },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'cmu-special-blocks',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_special_blocks',
      description: 'CMU half/end/corner/jamb/cut blocks',
      quantity: specialBlocks,
      unit: 'EA',
      formula: 'generated_half_end_corner_jamb_cut_block_count_from_courses_and_openings',
      parameterSnapshot: { ...input.wall, result: { blockBreakdown: cmuLayout.counts, moduleFits: cmuLayout.moduleFits, terminalClosures: cmuLayout.terminalClosures } },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
    },
    {
      id: 'cmu-terminal-cut-blocks',
      designModelId: input.designModelId,
      designObjectId: input.wallObjectId,
      quantityType: 'cmu_terminal_cut_blocks',
      description: 'Terminal cut block',
      quantity: cmuLayout.terminalClosures.length,
      unit: 'EA',
      formula: 'terminal_cut_blocks = count(non_modular_terminal_closure units)',
      parameterSnapshot: {
        terminalClosures: cmuLayout.terminalClosures,
        totalTerminalCutLengthMeters: roundQuantity(terminalCutLengthMeters, 3),
        source: 'closed_perimeter_solver',
      },
      source: 'parametric_design_builder',
      confidence: 'calculated_from_parameters',
      divisionCode: '04',
      divisionName: 'Masonry',
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
      description: 'CMU lintels above openings',
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
      description: 'Jamb grout fill at door/window openings',
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
      description: 'Lintel grout at door/window openings',
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
      description: 'Course closure grout at opening jambs',
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
      description: 'Conceptual grouted cells / pilasters',
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
  ];
}
