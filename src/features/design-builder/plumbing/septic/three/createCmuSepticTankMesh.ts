import * as THREE from 'three';
import { septicOuterDimensions, sideLocalPoint } from '../septicGeometry';
import type { SepticTankModel } from '../septicTypes';

export type CmuSepticTankMeshOptions = {
  selected?: boolean;
  trackGeometry?: <T extends THREE.BufferGeometry>(geometry: T) => T;
  trackMaterial?: <T extends THREE.Material>(material: T) => T;
};

function material(options: CmuSepticTankMeshOptions, color: number, opacity = 1): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.84,
    metalness: 0.04,
    transparent: opacity < 1,
    opacity,
  });
  return options.trackMaterial?.(mat) ?? mat;
}

function box(
  options: CmuSepticTankMeshOptions,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  mat: THREE.Material,
): THREE.Mesh {
  const geometry = options.trackGeometry?.(new THREE.BoxGeometry(...size)) ?? new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.position.set(...position);
  return mesh;
}

function cylinderBetween(
  options: CmuSepticTankMeshOptions,
  name: string,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  mat: THREE.Material,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = options.trackGeometry?.(new THREE.CylinderGeometry(radius, radius, length, 16)) ??
    new THREE.CylinderGeometry(radius, radius, length, 16);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

export function createCmuSepticTankMesh(
  tank: SepticTankModel,
  options: CmuSepticTankMeshOptions = {},
): THREE.Group {
  const g = tank.geometry;
  const outer = septicOuterDimensions(tank);
  const topY = tank.placement.topSlabTopElevationM;
  const wallHeight = g.insideTotalDepthM;
  const wallCenterY = topY - g.topSlabThicknessM - wallHeight / 2;
  const bottomSlabCenterY = topY - g.topSlabThicknessM - wallHeight - g.bottomSlabThicknessM / 2;
  const topSlabCenterY = topY - g.topSlabThicknessM / 2;
  const group = new THREE.Group();
  group.name = `cmuSepticTank:${tank.id}`;
  group.position.set(tank.placement.centerX, 0, tank.placement.centerZ);
  group.rotation.y = -tank.placement.rotationRad;
  group.userData.septicTankId = tank.id;

  const concrete = material(options, options.selected ? 0x67e8f9 : 0x9ca3af);
  const cmu = material(options, options.selected ? 0x38bdf8 : 0x64748b);
  const pipe = material(options, 0xf8fafc);
  const cover = material(options, 0x334155);
  const liquid = material(options, 0x38bdf8, 0.28);

  group.add(box(options, 'bottom slab', [outer.length, g.bottomSlabThicknessM, outer.width], [0, bottomSlabCenterY, 0], concrete));
  group.add(box(options, 'left CMU wall', [g.wallThicknessM, wallHeight, outer.width], [-outer.length / 2 + g.wallThicknessM / 2, wallCenterY, 0], cmu));
  group.add(box(options, 'right CMU wall', [g.wallThicknessM, wallHeight, outer.width], [outer.length / 2 - g.wallThicknessM / 2, wallCenterY, 0], cmu));
  group.add(box(options, 'front CMU wall', [outer.length, wallHeight, g.wallThicknessM], [0, wallCenterY, -outer.width / 2 + g.wallThicknessM / 2], cmu));
  group.add(box(options, 'back CMU wall', [outer.length, wallHeight, g.wallThicknessM], [0, wallCenterY, outer.width / 2 - g.wallThicknessM / 2], cmu));
  const baffleX = -g.insideLengthM / 2 + g.insideLengthM * g.firstCompartmentRatio;
  group.add(box(options, 'internal baffle wall', [g.baffleWallThicknessM, wallHeight, g.insideWidthM], [baffleX, wallCenterY, 0], cmu));
  group.add(box(options, 'top monolithic slab', [outer.length, g.topSlabThicknessM, outer.width], [0, topSlabCenterY, 0], concrete));

  const accessY = topY + 0.015;
  group.add(box(options, 'access covers', [g.accessOpeningLengthM, 0.03, g.accessOpeningWidthM], [-g.insideLengthM * 0.18, accessY, 0], cover));
  group.add(box(options, 'access covers', [g.accessOpeningLengthM, 0.03, g.accessOpeningWidthM], [g.insideLengthM * 0.28, accessY, 0], cover));

  const inletLocal = sideLocalPoint(tank, tank.inletSide);
  const outletLocal = sideLocalPoint(tank, tank.outletSide);
  group.add(cylinderBetween(options, 'inlet pipe stub', new THREE.Vector3(inletLocal.x - 0.35, wallCenterY + 0.25, inletLocal.z), new THREE.Vector3(inletLocal.x + 0.08, wallCenterY + 0.25, inletLocal.z), g.inletPipeDiameterM / 2, pipe));
  group.add(cylinderBetween(options, 'outlet pipe stub', new THREE.Vector3(outletLocal.x - 0.08, wallCenterY + 0.17, outletLocal.z), new THREE.Vector3(outletLocal.x + 0.35, wallCenterY + 0.17, outletLocal.z), g.outletPipeDiameterM / 2, pipe));
  group.add(cylinderBetween(options, 'inlet tee', new THREE.Vector3(inletLocal.x + 0.08, wallCenterY + 0.6, inletLocal.z), new THREE.Vector3(inletLocal.x + 0.08, wallCenterY - 0.25, inletLocal.z), g.inletPipeDiameterM / 2, pipe));
  group.add(cylinderBetween(options, 'outlet tee', new THREE.Vector3(outletLocal.x - 0.08, wallCenterY + 0.52, outletLocal.z), new THREE.Vector3(outletLocal.x - 0.08, wallCenterY - 0.25, outletLocal.z), g.outletPipeDiameterM / 2, pipe));

  if (tank.showCutaway3d) {
    group.add(box(options, 'liquid level plane', [g.insideLengthM, 0.012, g.insideWidthM], [0, topY - g.topSlabThicknessM - g.freeboardM, 0], liquid));
  }

  group.traverse((object) => {
    object.userData.septicTankId = tank.id;
  });
  return group;
}
