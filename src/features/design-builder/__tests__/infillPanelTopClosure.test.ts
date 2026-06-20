import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import {
  FRAME_INFILL_HEIGHT_TOLERANCE_METERS,
  FRAME_INFILL_BOUNDS_TOLERANCE_METERS,
  TOP_CLOSURE_PRACTICAL_MIN_HEIGHT_METERS,
  resolvePanelVerticalCourses,
  solveInfillPanelBlocks,
  resolveInfillPanelsWithBounds,
} from '../domain/cmuInfillPanelSolver';
import { resolveCmuModuleDefinition } from '../domain/cmuModuleRules';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
} from '../geometry/designGeometry';
import { buildDesignEstimatePreview } from '../quantity/designQuantityFormulas';

describe('infill panel top closure course', () => {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
  const module = resolveCmuModuleDefinition(preset.wall);

  function solveFirstPanel(panelTopElevationMeters?: number) {
    const entries = resolveInfillPanelsWithBounds({
      layout: preset.wallLayout,
      segmentFrames: frames,
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
      wall: preset.wall,
    });
    const { panel, bounds } = entries[0]!;
    const adjustedPanel =
      panelTopElevationMeters == null
        ? panel
        : { ...panel, topElevationMeters: panelTopElevationMeters };
    const frame = frames.find((candidate) => candidate.segmentId === panel.hostSegmentId)!;
    return solveInfillPanelBlocks({
      panel: adjustedPanel,
      bounds: { ...bounds, topElevationMeters: adjustedPanel.topElevationMeters },
      frame,
      wall: preset.wall,
    });
  }

  it('produces only full courses for exact modular panel height', () => {
    const bottom = 0;
    const top = bottom + 10 * module.nominalModuleHeightMeters;
    const vertical = resolvePanelVerticalCourses({
      panelBottomElevationMeters: bottom,
      panelTopElevationMeters: top,
      nominalCourseHeightMeters: module.nominalModuleHeightMeters,
    });
    expect(vertical.hasTopClosureCourse).toBe(false);
    expect(vertical.topClosureHeightMeters).toBeLessThanOrEqual(FRAME_INFILL_HEIGHT_TOLERANCE_METERS);

    const solved = solveFirstPanel(top);
    const topClosureBlocks = solved.blocks.filter((block) => block.source === 'panel_top_closure');
    expect(topClosureBlocks).toHaveLength(0);
    expect(solved.topClosureCutBlockCount).toBe(0);
  });

  it('produces one top cut-height course for non-modular panel height', () => {
    const bottom = 0;
    const top = bottom + 10 * module.nominalModuleHeightMeters + 0.05;
    const vertical = resolvePanelVerticalCourses({
      panelBottomElevationMeters: bottom,
      panelTopElevationMeters: top,
      nominalCourseHeightMeters: module.nominalModuleHeightMeters,
    });
    expect(vertical.hasTopClosureCourse).toBe(true);
    expect(vertical.topClosureHeightMeters).toBeCloseTo(0.05, 3);

    const solved = solveFirstPanel(top);
    const topClosureBlocks = solved.blocks.filter((block) => block.source === 'panel_top_closure');
    expect(topClosureBlocks.length).toBeGreaterThan(0);
    expect(topClosureBlocks.every((block) => block.kind === 'cut_height_block')).toBe(true);
    expect(new Set(topClosureBlocks.map((block) => block.courseIndex)).size).toBe(1);
  });

  it('top closure reaches ring beam underside within tolerance', () => {
    const solved = solveFirstPanel();
    const topClosureBlocks = solved.blocks.filter((block) => block.source === 'panel_top_closure');
    expect(topClosureBlocks.length).toBeGreaterThan(0);

    topClosureBlocks.forEach((block) => {
      const courseBottom = block.y - (block.physicalHeightMeters ?? block.heightMeters ?? 0) / 2;
      const courseTop = courseBottom + (block.physicalHeightMeters ?? block.heightMeters ?? 0);
      expect(courseTop).toBeGreaterThanOrEqual(solved.panel.topElevationMeters - FRAME_INFILL_HEIGHT_TOLERANCE_METERS);
      expect(courseTop).toBeLessThanOrEqual(solved.panel.topElevationMeters + FRAME_INFILL_HEIGHT_TOLERANCE_METERS);
    });
  });

  it('top closure does not overlap ring beam', () => {
    const solved = solveFirstPanel();
    solved.blocks
      .filter((block) => block.source === 'panel_top_closure')
      .forEach((block) => {
        const courseTop =
          block.y + (block.physicalHeightMeters ?? block.heightMeters ?? 0) / 2;
        expect(courseTop).toBeLessThanOrEqual(solved.panel.topElevationMeters + FRAME_INFILL_HEIGHT_TOLERANCE_METERS);
      });
  });

  it('top closure retains running-bond phase and individual head joints', () => {
    const solved = solveFirstPanel();
    const topCourseIndex = Math.max(
      ...solved.blocks.filter((block) => block.source === 'panel_top_closure').map((block) => block.courseIndex ?? 0),
    );
    const topClosureBlocks = solved.blocks
      .filter((block) => block.courseIndex === topCourseIndex && block.source === 'panel_top_closure')
      .sort((a, b) => (a.stationMeters ?? 0) - (b.stationMeters ?? 0));

    expect(topClosureBlocks.length).toBeGreaterThan(1);
    expect(new Set(topClosureBlocks.map((block) => block.stationMeters)).size).toBe(topClosureBlocks.length);
    expect(topClosureBlocks.every((block) => block.kind === 'cut_height_block')).toBe(true);

    const runningBondOffset = topCourseIndex % 2 === 1;
    const startsWithHalf = topClosureBlocks[0]?.blockType === 'half';
    if (runningBondOffset) {
      expect(startsWithHalf).toBe(true);
    } else {
      expect(startsWithHalf).toBe(false);
    }
  });

  it('each top closure unit is an individual placement with physical height metadata', () => {
    const solved = solveFirstPanel();
    const topClosureBlocks = solved.blocks.filter((block) => block.source === 'panel_top_closure');
    topClosureBlocks.forEach((block) => {
      expect(block.physicalHeightMeters).toBeGreaterThan(FRAME_INFILL_HEIGHT_TOLERANCE_METERS);
      expect(block.heightMeters).toBe(block.physicalHeightMeters);
      expect(block.lengthMeters).toBeGreaterThan(0);
    });
  });

  it('flags impractical top closure heights without leaving a gap', () => {
    const bottom = 0;
    const tinyTop = bottom + 10 * module.nominalModuleHeightMeters + 0.03;
    const solved = solveFirstPanel(tinyTop);
    expect(solved.blocks.some((block) => block.source === 'panel_top_closure')).toBe(true);
    expect(solved.warnings.some((warning) => warning.includes('Top CMU closure course is under'))).toBe(true);
    expect(0.03).toBeLessThan(TOP_CLOSURE_PRACTICAL_MIN_HEIGHT_METERS);
  });

  it('reports separate top closure quantity from grout and concrete', () => {
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: preset.wall,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
        buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
        frameSystem: preset.frameSystem,
        infillSystem: preset.infillSystem,
        gableEndSystem: preset.gableEndSystem,
      }),
    );
    const lines = buildDesignEstimatePreview({
      designModelId: 'model-1',
      wallObjectId: 'wall-1',
      slabObjectId: 'slab-1',
      roofObjectId: 'roof-1',
      trussObjectId: 'truss-1',
      frameObjectId: 'frame-1',
      infillObjectId: 'infill-1',
      gableEndObjectId: 'gable-1',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      frameSystem: preset.frameSystem,
      infillSystem: preset.infillSystem,
      gableEndSystem: preset.gableEndSystem,
      geometryResult: geometry,
    });

    expect(lines.some((line) => line.quantityType === 'cmu_top_closure_cut_course')).toBe(true);
    expect(lines.some((line) => line.quantityType === 'rc_structural_concrete_volume')).toBe(true);
    const topClosureLine = lines.find((line) => line.quantityType === 'cmu_top_closure_cut_course')!;
    expect(topClosureLine.quantity).toBeGreaterThan(0);
    expect(geometry.wallCmuLayout.topClosureCutBlockCount).toBe(topClosureLine.quantity);
  });
});
