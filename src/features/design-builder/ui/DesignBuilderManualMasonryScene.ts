import * as THREE from 'three';
import type {
  CmuWallSystemParameters,
  MasonryCourseRun,
  MasonryUnitType,
} from '../types';
import { manualBlockColor } from './DesignBuilderWallScene';

type TrackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => T;

export interface ManualMasonryBlockInstance {
  id: string;
  unitType: MasonryUnitType;
  length: number;
  height: number;
  thickness: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

export interface ManualMasonrySceneResult {
  group: THREE.Group;
  selectableObjects: THREE.Object3D[];
}

export function resolveManualMasonryBlockInstances(params: {
  runs: readonly MasonryCourseRun[];
  wall: Pick<
    CmuWallSystemParameters,
    'blockLengthMeters' | 'blockHeightMeters' | 'wallThicknessMeters'
  >;
}): ManualMasonryBlockInstance[] {
  return params.runs.flatMap((run) => {
    const length =
      run.moduleLengthMeters ||
      params.wall.blockLengthMeters * (run.unitType === 'half_block' ? 0.5 : 1);
    const height = run.moduleHeightMeters || params.wall.blockHeightMeters;
    const thickness = run.wallThicknessMeters || params.wall.wallThicknessMeters;
    const tangentLength = Math.hypot(run.tangent?.x ?? 1, run.tangent?.z ?? 0) || 1;
    const tangent = {
      x: (run.tangent?.x ?? 1) / tangentLength,
      z: (run.tangent?.z ?? 0) / tangentLength,
    };
    const normal = { x: -tangent.z, z: tangent.x };
    const origin = run.origin ?? {
      x: run.originX,
      y: run.courseIndex * height,
      z: run.originZ,
    };
    const rotationY = Math.atan2(tangent.z, tangent.x);
    return Array.from({ length: run.count }, (_, index) => ({
      id: `${run.id}:${index}`,
      unitType: run.unitType,
      length,
      height,
      thickness,
      x: origin.x + tangent.x * (index * length + length / 2) + normal.x * (thickness / 2),
      y: origin.y + height / 2,
      z: origin.z + tangent.z * (index * length + length / 2) + normal.z * (thickness / 2),
      rotationY,
    }));
  });
}

export function buildManualMasonrySceneGroup(params: {
  runs: readonly MasonryCourseRun[];
  wall: Pick<
    CmuWallSystemParameters,
    'blockLengthMeters' | 'blockHeightMeters' | 'wallThicknessMeters'
  >;
  slabTopMeters: number;
  createMaterial: (unitType: MasonryUnitType, color: number) => THREE.Material;
  trackGeometry: TrackGeometry;
}): ManualMasonrySceneResult {
  const group = new THREE.Group();
  group.name = 'manualMasonryGroup';
  const selectableObjects: THREE.Object3D[] = [];
  const manualBlocks = resolveManualMasonryBlockInstances({
    runs: params.runs,
    wall: params.wall,
  });
  const manualBlocksByType = new Map<MasonryUnitType, ManualMasonryBlockInstance[]>();
  manualBlocks.forEach((block) => {
    const blocks = manualBlocksByType.get(block.unitType) ?? [];
    blocks.push(block);
    manualBlocksByType.set(block.unitType, blocks);
  });

  manualBlocksByType.forEach((instances, unitType) => {
    const blockGeometry = params.trackGeometry(new THREE.BoxGeometry(1, 1, 1));
    const blockMaterial = params.createMaterial(unitType, manualBlockColor(unitType));
    const blocks = new THREE.InstancedMesh(blockGeometry, blockMaterial, instances.length);
    blocks.name = `manualMasonry:${unitType}`;
    blocks.userData.manualMasonry = true;
    blocks.userData.selectable = true;
    blocks.userData.designObjectType = 'cmu_wall_system';
    blocks.userData.selectionPriority = 60;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    instances.forEach((block, index) => {
      quaternion.setFromEuler(new THREE.Euler(0, block.rotationY, 0));
      matrix.compose(
        new THREE.Vector3(block.x, params.slabTopMeters + block.y, block.z),
        quaternion,
        new THREE.Vector3(block.length, block.height, block.thickness),
      );
      blocks.setMatrixAt(index, matrix);
    });
    blocks.instanceMatrix.needsUpdate = true;
    selectableObjects.push(blocks);
    group.add(blocks);
  });

  return { group, selectableObjects };
}
