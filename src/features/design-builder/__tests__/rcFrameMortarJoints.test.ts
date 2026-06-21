import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { generateDesignGeometry } from '../geometry/designGeometry';
import type { CmuBlockInstance } from '../geometry/designGeometry';
import {
  courseGroupKey,
  generateMortarJointInstances,
  shouldParticipateInMortar,
} from '../rendering/materials/cmuMortarJointInstances';

function frameGeometry() {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  return generateDesignGeometry({
    sourcePath: 'layout_graph',
    buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
    wallLayout: preset.wallLayout,
    wall: preset.wall,
    slab: preset.slab,
    frameSystem: preset.frameSystem,
    foundationSettings: preset.foundationSettings,
    infillSystem: preset.infillSystem,
    gableEndSystem: preset.gableEndSystem,
    roofSystem: preset.roofSystem,
  });
}

function rcInfillBlocks(blocks: readonly CmuBlockInstance[]): CmuBlockInstance[] {
  return blocks.filter(
    (block) =>
      block.source === 'rc_frame_infill' ||
      block.source === 'below_grade_rc_infill' ||
      block.source === 'infill_panel_solver' ||
      block.source === 'panel_top_closure',
  );
}

describe('RC frame CMU mortar head joints', () => {
  it('creates vertical head joints between adjacent full RC infill blocks with zero-gap fallback', () => {
    const geometry = frameGeometry();
    const infillBlocks = rcInfillBlocks(geometry.wallCmuLayout.blocks);
    expect(infillBlocks.length).toBeGreaterThan(0);

    const fullBlocks = infillBlocks.filter((block) => block.blockType === 'full');
    expect(fullBlocks.length).toBeGreaterThan(1);

    const { diagnostics, instances } = generateMortarJointInstances({
      blocks: infillBlocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    expect(diagnostics.headJointCount).toBeGreaterThan(0);
    expect(diagnostics.zeroGapFallbackCount).toBeGreaterThan(0);
    expect(instances.filter((instance) => instance.kind === 'head' && instance.valid).length).toBe(
      diagnostics.headJointCount,
    );
  });

  it('creates head joints for below-grade RC infill blocks', () => {
    const geometry = frameGeometry();
    const belowGradeBlocks = geometry.wallCmuLayout.blocks.filter(
      (block) => block.source === 'below_grade_rc_infill' || block.infillBand === 'below_grade',
    );
    expect(belowGradeBlocks.length).toBeGreaterThan(0);

    const { diagnostics } = generateMortarJointInstances({
      blocks: belowGradeBlocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    expect(diagnostics.headJointCount).toBeGreaterThan(0);
    expect(diagnostics.bedJointCount).toBeGreaterThan(0);
  });

  it('creates head joints for above-grade RC infill blocks', () => {
    const geometry = frameGeometry();
    const aboveGradeBlocks = geometry.wallCmuLayout.blocks.filter(
      (block) => block.source === 'rc_frame_infill' || block.infillBand === 'above_grade',
    );
    expect(aboveGradeBlocks.length).toBeGreaterThan(0);

    const { diagnostics } = generateMortarJointInstances({
      blocks: aboveGradeBlocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    expect(diagnostics.headJointCount).toBeGreaterThan(0);
  });

  it('does not merge opposite wall segments or infill bands in row grouping', () => {
    const geometry = frameGeometry();
    const infillBlocks = rcInfillBlocks(geometry.wallCmuLayout.blocks);
    const keys = new Set(infillBlocks.filter(shouldParticipateInMortar).map(courseGroupKey));
    expect(keys.size).toBeGreaterThan(infillBlocks.length / 20);
  });

  it('does not create head joints across separate bays with opening-sized gaps', () => {
    const blocks: CmuBlockInstance[] = [
      {
        id: 'a',
        face: 'north',
        segmentId: 'seg-a',
        wallFace: 'seg-a',
        infillBand: 'above_grade',
        course: 1,
        courseIndex: 0,
        blockType: 'full',
        source: 'rc_frame_infill',
        stationMeters: 0,
        startAlongMeters: 0,
        endAlongMeters: 0.4,
        x: 0,
        y: 0.1,
        z: 0,
        rotationY: 0,
        lengthMeters: 0.39,
        actualLengthMeters: 0.39,
        heightMeters: 0.19,
        physicalHeightMeters: 0.19,
        depthMeters: 0.19,
      },
      {
        id: 'b',
        face: 'north',
        segmentId: 'seg-a',
        wallFace: 'seg-a',
        infillBand: 'above_grade',
        course: 1,
        courseIndex: 0,
        blockType: 'full',
        source: 'rc_frame_infill',
        stationMeters: 1.2,
        startAlongMeters: 1.2,
        endAlongMeters: 1.6,
        x: 1.4,
        y: 0.1,
        z: 0,
        rotationY: 0,
        lengthMeters: 0.39,
        actualLengthMeters: 0.39,
        heightMeters: 0.19,
        physicalHeightMeters: 0.19,
        depthMeters: 0.19,
      },
    ];

    const { diagnostics } = generateMortarJointInstances({
      blocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    expect(diagnostics.headJointCount).toBe(0);
    expect(diagnostics.skippedNonContiguousGaps).toBe(1);
  });

  it('preserves bed-joint rendering for RC infill', () => {
    const geometry = frameGeometry();
    const infillBlocks = rcInfillBlocks(geometry.wallCmuLayout.blocks);
    const { diagnostics } = generateMortarJointInstances({
      blocks: infillBlocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    expect(diagnostics.bedJointCount).toBeGreaterThan(0);
  });

  it('uses host wall tangent for rotated segment head joints', () => {
    const geometry = frameGeometry();
    const rotated = geometry.wallCmuLayout.blocks.find(
      (block) =>
        (block.source === 'rc_frame_infill' || block.source === 'below_grade_rc_infill') &&
        Math.abs(block.rotationY) > 0.01,
    );
    expect(rotated).toBeDefined();

    const segmentBlocks = geometry.wallCmuLayout.blocks.filter(
      (block) => block.segmentId === rotated!.segmentId && block.courseIndex === rotated!.courseIndex,
    );
    const { instances } = generateMortarJointInstances({
      blocks: segmentBlocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    const headJoint = instances.find((instance) => instance.kind === 'head' && instance.valid);
    expect(headJoint).toBeDefined();
    expect(headJoint!.rotationY).toBeCloseTo(rotated!.rotationY, 6);
  });
});
