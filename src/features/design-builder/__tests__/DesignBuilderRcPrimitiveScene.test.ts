import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildRcBeamMesh,
  buildRcBoxMesh,
  buildRcElevationBoxMesh,
} from '../ui/DesignBuilderRcPrimitiveScene';

describe('DesignBuilderRcPrimitiveScene', () => {
  it('builds named RC box meshes with tracked geometry, rotation, and user data', () => {
    const tracked: THREE.BufferGeometry[] = [];
    const mesh = buildRcBoxMesh({
      name: 'rcBox',
      xSizeMeters: 1,
      ySizeMeters: 2,
      zSizeMeters: 3,
      center: { x: 4, y: 5, z: 6 },
      rotationY: Math.PI / 4,
      material: new THREE.MeshBasicMaterial(),
      trackGeometry: (geometry) => {
        tracked.push(geometry);
        return geometry;
      },
      userData: { structuralElementId: 'box-1' },
    });

    expect(mesh.name).toBe('rcBox');
    expect(mesh.position.toArray()).toEqual([4, 5, 6]);
    expect(mesh.rotation.y).toBeCloseTo(Math.PI / 4, 6);
    expect(mesh.userData.structuralElementId).toBe('box-1');
    expect(tracked).toHaveLength(1);
  });

  it('builds slab-relative elevation boxes from bottom and top elevations', () => {
    const mesh = buildRcElevationBoxMesh({
      name: 'rcElevationBox',
      xSizeMeters: 0.8,
      zSizeMeters: 0.9,
      bottomElevationMeters: -0.25,
      topElevationMeters: 0,
      x: 1,
      z: 2,
      slabTopMeters: 0.1,
      material: new THREE.MeshBasicMaterial(),
      trackGeometry: (geometry) => geometry,
    });

    expect(mesh.name).toBe('rcElevationBox');
    expect(mesh.position.x).toBeCloseTo(1, 6);
    expect(mesh.position.y).toBeCloseTo(-0.025, 6);
    expect(mesh.position.z).toBeCloseTo(2, 6);
  });

  it('builds oriented RC beam meshes between two plan points', () => {
    const mesh = buildRcBeamMesh({
      name: 'rcBeam',
      start: { x: 0, z: 0 },
      end: { x: 3, z: 4 },
      baseElevationMeters: 0.4,
      widthMeters: 0.25,
      depthMeters: 0.3,
      slabTopMeters: 0.1,
      material: new THREE.MeshBasicMaterial(),
      trackGeometry: (geometry) => geometry,
      userData: { structuralElementId: 'beam-1' },
    });

    expect(mesh).not.toBeNull();
    expect(mesh!.name).toBe('rcBeam');
    expect(mesh!.position.x).toBeCloseTo(1.5, 6);
    expect(mesh!.position.y).toBeCloseTo(0.65, 6);
    expect(mesh!.position.z).toBeCloseTo(2, 6);
    expect(mesh!.rotation.y).toBeCloseTo(-Math.atan2(4, 3), 6);
    expect(mesh!.userData.structuralElementId).toBe('beam-1');

    expect(
      buildRcBeamMesh({
        name: 'zeroBeam',
        start: { x: 1, z: 1 },
        end: { x: 1, z: 1 },
        baseElevationMeters: 0,
        widthMeters: 0.25,
        depthMeters: 0.3,
        slabTopMeters: 0.1,
        material: new THREE.MeshBasicMaterial(),
        trackGeometry: (geometry) => geometry,
      }),
    ).toBeNull();
  });
});
