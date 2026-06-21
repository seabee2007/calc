import { describe, expect, it } from 'vitest';
import type { CmuBlockInstance } from '../../geometry/designGeometry';
import {
  generateMortarJointInstances,
  MORTAR_FACE_RECESS_METERS,
} from '../rendering/materials/cmuMortarJointInstances';

function makeBlock(params: Partial<CmuBlockInstance> & Pick<CmuBlockInstance, 'id'>): CmuBlockInstance {
  const startAlongMeters = params.startAlongMeters ?? 0;
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
    actualLengthMeters: params.actualLengthMeters ?? lengthMeters,
    heightMeters: params.heightMeters ?? 0.19,
    physicalHeightMeters: params.physicalHeightMeters ?? 0.19,
    depthMeters: params.depthMeters ?? 0.19,
    ...params,
  };
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
    expect(instances.filter((instance) => instance.kind === 'head' && instance.valid)).toHaveLength(1);
    expect(instances.find((instance) => instance.kind === 'head')?.scaleX).toBeCloseTo(0.01, 3);
    expect(instances.find((instance) => instance.kind === 'bed')?.scaleX).toBeCloseTo(0.79, 3);
    expect(instances.every((instance) => instance.scaleZ < 0.19)).toBe(true);
    expect(instances[0].scaleZ).toBeCloseTo(0.19 - MORTAR_FACE_RECESS_METERS * 2, 3);
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
});
