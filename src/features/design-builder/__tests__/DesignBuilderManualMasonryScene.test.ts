import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { MasonryCourseRun } from '../types';
import {
  buildManualMasonrySceneGroup,
  resolveManualMasonryBlockInstances,
} from '../ui/DesignBuilderManualMasonryScene';

const wall = {
  blockLengthMeters: 0.4,
  blockHeightMeters: 0.2,
  wallThicknessMeters: 0.15,
};

function manualRun(partial: Partial<MasonryCourseRun>): MasonryCourseRun {
  return {
    id: partial.id ?? 'run-1',
    wallSegmentId: partial.wallSegmentId ?? 'segment-1',
    origin: partial.origin ?? { x: 0, y: 0, z: 0 },
    tangent: partial.tangent ?? { x: 1, z: 0 },
    courseIndex: partial.courseIndex ?? 0,
    startModuleIndex: partial.startModuleIndex ?? 0,
    unitType: partial.unitType ?? 'full_block',
    count: partial.count ?? 1,
    moduleLengthMeters: partial.moduleLengthMeters ?? 0.4,
    moduleHeightMeters: partial.moduleHeightMeters ?? 0.2,
    wallThicknessMeters: partial.wallThicknessMeters ?? 0.15,
    direction: partial.direction ?? 'forward',
    source: partial.source ?? 'manual',
    originX: partial.originX ?? partial.origin?.x ?? 0,
    originZ: partial.originZ ?? partial.origin?.z ?? 0,
    orientation: partial.orientation ?? 'east',
  };
}

function materialFor(unitType: string, color: number): THREE.Material {
  const material = new THREE.MeshBasicMaterial({ color });
  material.name = unitType;
  return material;
}

describe('DesignBuilderManualMasonryScene', () => {
  it('resolves manual course runs into world block instances', () => {
    const instances = resolveManualMasonryBlockInstances({
      wall,
      runs: [
        manualRun({
          id: 'north-run',
          origin: { x: 1, y: 0.4, z: 2 },
          tangent: { x: 0, z: 1 },
          count: 2,
        }),
        manualRun({
          id: 'fallback-half',
          unitType: 'half_block',
          origin: { x: 0, y: 0, z: 0 },
          moduleLengthMeters: 0,
          moduleHeightMeters: 0,
          wallThicknessMeters: 0,
        }),
      ],
    });

    expect(instances).toHaveLength(3);
    expect(instances[0]).toMatchObject({
      id: 'north-run:0',
      unitType: 'full_block',
      length: 0.4,
      height: 0.2,
      thickness: 0.15,
    });
    expect(instances[0]?.x).toBeCloseTo(0.925, 6);
    expect(instances[0]?.y).toBeCloseTo(0.5, 6);
    expect(instances[0]?.z).toBeCloseTo(2.2, 6);
    expect(instances[0]?.rotationY).toBeCloseTo(Math.PI / 2, 6);
    expect(instances[1]?.z).toBeCloseTo(2.6, 6);
    expect(instances[2]).toMatchObject({
      id: 'fallback-half:0',
      unitType: 'half_block',
      length: 0.2,
      height: 0.2,
      thickness: 0.15,
    });
  });

  it('builds selectable instanced meshes grouped by manual unit type', () => {
    const tracked: THREE.BufferGeometry[] = [];
    const scene = buildManualMasonrySceneGroup({
      wall,
      slabTopMeters: 0.12,
      runs: [
        manualRun({
          id: 'full-run',
          origin: { x: 1, y: 0.4, z: 2 },
          tangent: { x: 0, z: 1 },
          count: 2,
        }),
        manualRun({
          id: 'half-run',
          unitType: 'half_block',
          origin: { x: -1, y: 0.2, z: -2 },
          tangent: { x: 1, z: 0 },
        }),
      ],
      createMaterial: materialFor,
      trackGeometry: (geometry) => {
        tracked.push(geometry);
        return geometry;
      },
    });

    expect(scene.group.name).toBe('manualMasonryGroup');
    expect(scene.group.children).toHaveLength(2);
    expect(scene.selectableObjects).toHaveLength(2);
    expect(tracked).toHaveLength(2);
    const fullBlocks = scene.group.getObjectByName('manualMasonry:full_block') as THREE.InstancedMesh;
    expect(fullBlocks.count).toBe(2);
    expect(fullBlocks.userData).toMatchObject({
      manualMasonry: true,
      selectable: true,
      designObjectType: 'cmu_wall_system',
      selectionPriority: 60,
    });

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    fullBlocks.getMatrixAt(0, matrix);
    matrix.decompose(position, quaternion, scale);
    expect(position.x).toBeCloseTo(0.925, 6);
    expect(position.y).toBeCloseTo(0.62, 6);
    expect(position.z).toBeCloseTo(2.2, 6);
    expect(scale.x).toBeCloseTo(0.4, 6);
    expect(scale.y).toBeCloseTo(0.2, 6);
    expect(scale.z).toBeCloseTo(0.15, 6);
  });
});
