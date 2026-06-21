import * as THREE from 'three';
import type { CmuBlockInstance } from '../../geometry/designGeometry';
import {
  generateMortarJointInstances,
  type MortarJointDiagnostics,
  type MortarJointInstance,
} from './cmuMortarJointInstances';
import { resolveMortarMaterial, type ResolveDesignMaterialOptions } from './designMaterialLibrary';

export type BuildMortarJointMeshesParams = {
  blocks: readonly CmuBlockInstance[];
  mortarJointMeters: number;
  defaultBlockDepthMeters: number;
  defaultBlockHeightMeters: number;
  slabTopMeters: number;
  materialOptions: ResolveDesignMaterialOptions;
  debugMode?: boolean;
  trackGeometry: (geometry: THREE.BufferGeometry) => THREE.BufferGeometry;
  trackMaterial: (material: THREE.Material) => THREE.Material;
};

export type MortarJointMeshes = {
  group: THREE.Group;
  diagnostics: MortarJointDiagnostics;
};

function composeMortarMatrix(
  instance: MortarJointInstance,
  slabTopMeters: number,
  target: THREE.Matrix4,
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  scale: THREE.Vector3,
): void {
  quaternion.setFromEuler(new THREE.Euler(0, instance.rotationY, 0));
  position.set(instance.x, slabTopMeters + instance.y, instance.z);
  scale.set(instance.scaleX, instance.scaleY, instance.scaleZ);
  target.compose(position, quaternion, scale);
}

function createDebugMaterial(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
}

export function buildMortarJointMeshes(params: BuildMortarJointMeshesParams): MortarJointMeshes {
  const { instances, diagnostics } = generateMortarJointInstances({
    blocks: params.blocks,
    mortarJointMeters: params.mortarJointMeters,
    defaultBlockDepthMeters: params.defaultBlockDepthMeters,
    defaultBlockHeightMeters: params.defaultBlockHeightMeters,
  });

  const group = new THREE.Group();
  group.name = 'mortarJointGroup';

  if (instances.length === 0) {
    return { group, diagnostics };
  }

  const unitGeometry = params.trackGeometry(new THREE.BoxGeometry(1, 1, 1));
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  if (params.debugMode) {
    const headInstances = instances.filter((instance) => instance.kind === 'head' && instance.valid);
    const bedInstances = instances.filter((instance) => instance.kind === 'bed' && instance.valid);
    const invalidInstances = instances.filter((instance) => !instance.valid);

    const addDebugMesh = (items: MortarJointInstance[], color: number, name: string) => {
      if (items.length === 0) return;
      const material = params.trackMaterial(createDebugMaterial(color));
      const mesh = new THREE.InstancedMesh(unitGeometry, material, items.length);
      mesh.name = name;
      items.forEach((instance, index) => {
        composeMortarMatrix(instance, params.slabTopMeters, matrix, position, quaternion, scale);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    };

    addDebugMesh(headInstances, 0x2563eb, 'headJointInstancedMesh');
    addDebugMesh(bedInstances, 0xeab308, 'bedJointInstancedMesh');
    addDebugMesh(invalidInstances, 0xdc2626, 'invalidMortarJointInstancedMesh');
    return { group, diagnostics };
  }

  const headInstances = instances.filter((instance) => instance.kind === 'head' && instance.valid);
  const bedInstances = instances.filter((instance) => instance.kind === 'bed' && instance.valid);
  const mortarMaterial = resolveMortarMaterial(params.materialOptions, params.trackMaterial);

  const addMortarMesh = (items: MortarJointInstance[], name: string) => {
    if (items.length === 0) return;
    const mesh = new THREE.InstancedMesh(unitGeometry, mortarMaterial, items.length);
    mesh.name = name;
    items.forEach((instance, index) => {
      composeMortarMatrix(instance, params.slabTopMeters, matrix, position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  };

  addMortarMesh(headInstances, 'headJointInstancedMesh');
  addMortarMesh(bedInstances, 'bedJointInstancedMesh');

  return { group, diagnostics };
}
