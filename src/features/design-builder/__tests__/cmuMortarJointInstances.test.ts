import { describe, expect, it } from 'vitest';
import type { CmuBlockInstance } from '../../geometry/designGeometry';
import {
  courseGroupKey,
  generateMortarJointInstances,
  JOINT_EPSILON_METERS,
  MORTAR_FACE_RECESS_METERS,
  MORTAR_SURFACE_THICKNESS_METERS,
} from '../rendering/materials/cmuMortarJointInstances';

function makeBlock(params: Partial<CmuBlockInstance> & Pick<CmuBlockInstance, 'id'>): CmuBlockInstance {
  const startAlongMeters = params.startAlongMeters ?? params.stationMeters ?? 0;
  const lengthMeters = params.lengthMeters ?? 0.39;
  return {
    id: params.id,
    face: params.face ?? 'north',
    segmentId: params.segmentId ?? 'seg-a',
    course: params.course ?? 1,
    courseIndex: params.courseIndex ?? 0,
    blockType: params.blockType ?? 'full',
    x: params.x ?? 0,
    y: params.y ?? 0.195,
    z: params.z ?? 0,
    rotationY: params.rotationY ?? 0,
    lengthMeters,
    startAlongMeters,
    endAlongMeters: params.endAlongMeters ?? startAlongMeters + lengthMeters,
    stationMeters: params.stationMeters ?? startAlongMeters,
    actualLengthMeters: params.actualLengthMeters ?? lengthMeters,
    heightMeters: params.heightMeters ?? 0.19,
    physicalHeightMeters: params.physicalHeightMeters ?? 0.19,
    depthMeters: params.depthMeters ?? 0.19,
    ...params,
  };
}

function makeSpanBlock(
  params: Partial<CmuBlockInstance> &
    Pick<CmuBlockInstance, 'id'> & {
      startAlongMeters: number;
      endAlongMeters: number;
    },
): CmuBlockInstance {
  return makeBlock({
    ...params,
    x: params.x ?? (params.startAlongMeters + params.endAlongMeters) / 2,
    lengthMeters: params.lengthMeters ?? params.endAlongMeters - params.startAlongMeters,
    actualLengthMeters: params.actualLengthMeters ?? params.endAlongMeters - params.startAlongMeters,
  });
}

describe('generateMortarJointInstances', () => {
  it('creates head and bed joints for adjacent blocks in the same course', () => {
    const blocks = [
      makeBlock({ id: 'a', startAlongMeters: 0, endAlongMeters: 0.39, x: -0.195 }),
      makeBlock({ id: 'b', startAlongMeters: 0.4, endAlongMeters: 0.79, x: 0.205 }),
    ];
    const { instances, diagnostics } = generateMortarJointInstances({
      blocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    expect(diagnostics.headJointCount).toBe(1);
    expect(diagnostics.bedJointCount).toBe(1);
    expect(instances.filter((instance) => instance.kind === 'head' && instance.valid)).toHaveLength(2);
    expect(instances.filter((instance) => instance.kind === 'bed' && instance.valid)).toHaveLength(2);
    expect(instances.find((instance) => instance.kind === 'head')?.scaleX).toBeCloseTo(0.01, 3);
    expect(instances.find((instance) => instance.kind === 'bed')?.scaleX).toBeCloseTo(0.79, 3);
    expect(instances.every((instance) => instance.scaleZ < 0.19)).toBe(true);
    expect(instances[0].scaleZ).toBeCloseTo(MORTAR_SURFACE_THICKNESS_METERS, 3);
  });

  it('places mortar as recessed surface strips on both wall faces', () => {
    const blocks = [
      makeBlock({ id: 'a', startAlongMeters: 0, endAlongMeters: 0.39, x: -0.195 }),
      makeBlock({ id: 'b', startAlongMeters: 0.4, endAlongMeters: 0.79, x: 0.205 }),
    ];
    const { instances } = generateMortarJointInstances({
      blocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    const heads = instances.filter((instance) => instance.kind === 'head' && instance.valid);
    expect(heads).toHaveLength(2);
    expect(heads[0]!.x).toBeCloseTo(heads[1]!.x, 6);
    expect(Math.abs(heads[0]!.z - heads[1]!.z)).toBeCloseTo(
      0.19 - MORTAR_FACE_RECESS_METERS * 2 - MORTAR_SURFACE_THICKNESS_METERS,
      3,
    );
    expect(heads.every((instance) => instance.scaleZ <= MORTAR_SURFACE_THICKNESS_METERS)).toBe(true);
  });

  it('creates zero-gap fallback head joints for nominal-abutting RC infill blocks', () => {
    const blocks = [
      makeBlock({
        id: 'a',
        source: 'rc_frame_infill',
        infillBand: 'above_grade',
        startAlongMeters: 0,
        endAlongMeters: 0.4,
        stationMeters: 0,
        nominalLengthMeters: 0.4,
      }),
      makeBlock({
        id: 'b',
        source: 'rc_frame_infill',
        infillBand: 'above_grade',
        startAlongMeters: 0.4,
        endAlongMeters: 0.8,
        stationMeters: 0.4,
        nominalLengthMeters: 0.4,
      }),
    ];
    const { diagnostics, instances } = generateMortarJointInstances({
      blocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    expect(diagnostics.headJointCount).toBe(1);
    expect(diagnostics.zeroGapFallbackCount).toBe(1);
    const head = instances.find((instance) => instance.kind === 'head' && instance.valid);
    expect(head?.zeroGapFallback).toBe(true);
    expect(head?.scaleX).toBeCloseTo(0.01, 3);
  });

  it('creates head joints for half and cut blocks at boundaries', () => {
    const blocks = [
      makeBlock({
        id: 'half',
        blockType: 'half',
        startAlongMeters: 0,
        endAlongMeters: 0.2,
        actualLengthMeters: 0.195,
      }),
      makeBlock({
        id: 'full',
        startAlongMeters: 0.2,
        endAlongMeters: 0.6,
        actualLengthMeters: 0.39,
      }),
      makeBlock({
        id: 'cut',
        blockType: 'cut',
        startAlongMeters: 0.6,
        endAlongMeters: 0.75,
        actualLengthMeters: 0.15,
      }),
    ];
    const { diagnostics } = generateMortarJointInstances({
      blocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    expect(diagnostics.headJointCount).toBe(2);
    expect(diagnostics.zeroGapFallbackCount).toBe(2);
  });

  it('skips opening-sized gaps between blocks', () => {
    const blocks = [
      makeBlock({ id: 'a', startAlongMeters: 0, endAlongMeters: 0.39 }),
      makeBlock({ id: 'b', startAlongMeters: 1.2, endAlongMeters: 1.59 }),
    ];
    const { diagnostics } = generateMortarJointInstances({
      blocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    expect(diagnostics.headJointCount).toBe(0);
    expect(diagnostics.skippedNonContiguousGaps).toBe(1);
    expect(diagnostics.bedJointCount).toBe(2);
  });

  it('caps jamb closure rows and trims bed joints back from door openings', () => {
    const blocks = [
      makeSpanBlock({ id: 'left-field', startAlongMeters: 1.6, endAlongMeters: 2.0 }),
      makeSpanBlock({
        id: 'left-jamb',
        source: 'opening_jamb_closure',
        blockType: 'cut',
        nearOpeningId: 'door-1',
        adjacentTo: 'rough_opening_start',
        startAlongMeters: 2.0,
        endAlongMeters: 2.4,
      }),
      makeSpanBlock({
        id: 'right-jamb',
        source: 'opening_jamb_closure',
        blockType: 'cut',
        nearOpeningId: 'door-1',
        adjacentTo: 'rough_opening_end',
        startAlongMeters: 3.3,
        endAlongMeters: 3.48,
      }),
      makeSpanBlock({ id: 'right-field', startAlongMeters: 3.48, endAlongMeters: 3.88 }),
    ];
    const { diagnostics, instances } = generateMortarJointInstances({
      blocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    expect(diagnostics.skippedNonContiguousGaps).toBe(1);
    expect(diagnostics.headJointCount).toBe(4);

    const headStations = instances
      .filter((instance) => instance.kind === 'head' && instance.valid)
      .map((instance) => Number(instance.x.toFixed(3)));
    expect(headStations).toEqual(expect.arrayContaining([2.395, 3.305]));

    const bedSpans = instances
      .filter((instance) => instance.kind === 'bed' && instance.valid)
      .map((instance) => ({
        start: instance.x - instance.scaleX / 2,
        end: instance.x + instance.scaleX / 2,
      }));
    expect(bedSpans.some((span) => span.end > 2.4 && span.start < 3.3)).toBe(false);
    expect(Math.max(...bedSpans.filter((span) => span.end <= 2.4).map((span) => span.end))).toBeCloseTo(2.39, 6);
    expect(Math.min(...bedSpans.filter((span) => span.start >= 3.3).map((span) => span.start))).toBeCloseTo(3.31, 6);
  });

  it('does not merge blocks on different courses', () => {
    const blocks = [
      makeBlock({ id: 'a', courseIndex: 0, y: 0.195 }),
      makeBlock({ id: 'b', courseIndex: 1, y: 0.395, startAlongMeters: 0, endAlongMeters: 0.39 }),
    ];
    const { diagnostics } = generateMortarJointInstances({
      blocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    expect(diagnostics.headJointCount).toBe(0);
    expect(diagnostics.bedJointCount).toBe(2);
  });

  it('does not merge above-grade and below-grade rows on the same segment', () => {
    const blocks = [
      makeBlock({ id: 'below', courseIndex: 0, infillBand: 'below_grade', source: 'below_grade_rc_infill' }),
      makeBlock({
        id: 'above',
        courseIndex: 0,
        infillBand: 'above_grade',
        source: 'rc_frame_infill',
        startAlongMeters: 0,
        endAlongMeters: 0.4,
      }),
    ];
    expect(courseGroupKey(blocks[0])).not.toBe(courseGroupKey(blocks[1]));
  });

  it('keeps below-grade top closure rows out of above-grade mortar groups', () => {
    const belowTopClosure = makeBlock({
      id: 'below-top',
      segmentId: 'seg-a',
      wallFace: 'seg-a',
      courseIndex: 5,
      course: 5,
      y: -0.55,
      source: 'panel_top_closure',
      infillBand: 'below_grade',
    });
    const aboveCourse = makeBlock({
      id: 'above-course',
      segmentId: 'seg-a',
      wallFace: 'seg-a',
      courseIndex: 5,
      course: 5,
      y: 1.095,
      source: 'rc_frame_infill',
      infillBand: 'above_grade',
    });

    expect(courseGroupKey(belowTopClosure)).toContain(':below_grade:5');
    expect(courseGroupKey(aboveCourse)).toContain(':above_grade:5');
    expect(courseGroupKey(belowTopClosure)).not.toBe(courseGroupKey(aboveCourse));
  });

  it('marks overlapping block pairs as invalid head-joint candidates', () => {
    const blocks = [
      makeBlock({ id: 'a', startAlongMeters: 0, endAlongMeters: 0.45 }),
      makeBlock({ id: 'b', startAlongMeters: 0.4, endAlongMeters: 0.79 }),
    ];
    const { diagnostics, instances } = generateMortarJointInstances({
      blocks,
      mortarJointMeters: 0.01,
      defaultBlockDepthMeters: 0.19,
      defaultBlockHeightMeters: 0.19,
    });

    expect(diagnostics.invalidJointCount).toBe(1);
    expect(instances.some((instance) => instance.kind === 'head' && !instance.valid)).toBe(true);
    expect(Math.abs(0.4 - 0.45)).toBeGreaterThan(JOINT_EPSILON_METERS);
  });
});
