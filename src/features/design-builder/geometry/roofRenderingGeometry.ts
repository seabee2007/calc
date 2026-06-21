import * as THREE from 'three';
import type { RoofSystemSettings, SteelMemberKind, SteelMemberSegment, TrussPlacement } from '../types';
import {
  DEFAULT_RIDGE_CAP_THICKNESS_METERS,
  DEFAULT_RIDGE_CAP_WIDTH_METERS,
  PURLIN_PROFILE_DEPTH_METERS,
  PURLIN_PROFILE_WIDTH_METERS,
  ROOF_RIDGE_CAP_CLEARANCE_METERS,
  TRUSS_CHORD_PROFILE_METERS,
} from '../domain/roofFramingResolver';

export function createMemberBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  profileWidthMeters: number,
  profileDepthMeters: number,
  material: THREE.Material,
): THREE.Mesh {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length <= 0.001) {
    return new THREE.Mesh(new THREE.BoxGeometry(profileWidthMeters, profileWidthMeters, profileWidthMeters), material);
  }
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(profileWidthMeters, length, profileDepthMeters),
    material,
  );
  mesh.position.copy(start.clone().add(end).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

export function memberKindMaterialColor(memberKind: SteelMemberKind): number {
  switch (memberKind) {
    case 'top_chord_left':
    case 'top_chord_right':
      return 0xf97316;
    case 'bottom_chord':
      return 0xa855f7;
    case 'vertical_web':
    case 'diagonal_web':
      return 0xeab308;
    default:
      return 0x64748b;
  }
}

export function createCorrugatedMetalMaterial(): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#94a3b8';
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < canvas.height; row += 8) {
      context.fillStyle = row % 16 === 0 ? '#cbd5e1' : '#64748b';
      context.fillRect(0, row, canvas.width, 4);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 8);
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xb0bec5,
    metalness: 0.65,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
}

export function createSteelTrussMaterials(): {
  chord: THREE.MeshStandardMaterial;
  web: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  bolt: THREE.MeshStandardMaterial;
  purlin: THREE.MeshStandardMaterial;
} {
  return {
    chord: new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.78, roughness: 0.32 }),
    web: new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.75, roughness: 0.36 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.82, roughness: 0.3 }),
    bolt: new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 }),
    purlin: new THREE.MeshStandardMaterial({ color: 0x78909c, metalness: 0.76, roughness: 0.34 }),
  };
}

function isWebMember(kind: SteelMemberKind): boolean {
  return kind === 'diagonal_web' || kind === 'vertical_web';
}

export function buildSteelTrussMemberMeshes(params: {
  placement: TrussPlacement;
  slabOffsetY: number;
  materials: { chord: THREE.Material; web: THREE.Material };
  debugGuides?: boolean;
}): { chordMeshes: THREE.Mesh[]; webMeshes: THREE.Mesh[] } {
  const chordMeshes: THREE.Mesh[] = [];
  const webMeshes: THREE.Mesh[] = [];
  for (const member of params.placement.members) {
    const start = new THREE.Vector3(
      member.start.x,
      params.slabOffsetY + member.start.y,
      member.start.z,
    );
    const end = new THREE.Vector3(
      member.end.x,
      params.slabOffsetY + member.end.y,
      member.end.z,
    );
    const material = params.debugGuides
      ? new THREE.MeshStandardMaterial({
          color: memberKindMaterialColor(member.memberKind),
          metalness: 0.5,
          roughness: 0.45,
        })
      : isWebMember(member.memberKind)
        ? params.materials.web
        : params.materials.chord;
    const mesh = createMemberBetween(
      start,
      end,
      TRUSS_CHORD_PROFILE_METERS,
      TRUSS_CHORD_PROFILE_METERS,
      material,
    );
    mesh.userData.trussMemberKind = member.memberKind;
    mesh.userData.trussId = params.placement.id;
    if (isWebMember(member.memberKind)) {
      webMeshes.push(mesh);
    } else {
      chordMeshes.push(mesh);
    }
  }
  return { chordMeshes, webMeshes };
}

export function buildTrussBasePlateMesh(params: {
  bearing: THREE.Vector3;
  settings: RoofSystemSettings;
  material: THREE.Material;
}): THREE.Mesh {
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(
      params.settings.steelTrusses.basePlateWidthMeters,
      params.settings.steelTrusses.basePlateThicknessMeters,
      params.settings.steelTrusses.basePlateLengthMeters,
    ),
    params.material,
  );
  plate.position.set(
    params.bearing.x,
    params.bearing.y - params.settings.steelTrusses.basePlateThicknessMeters / 2,
    params.bearing.z,
  );
  return plate;
}

export function buildTrussAnchorBoltMeshes(params: {
  bearing: THREE.Vector3;
  settings: RoofSystemSettings;
  material: THREE.Material;
}): THREE.Mesh[] {
  const bolts: THREE.Mesh[] = [];
  const boltGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6);
  const boltCount = Math.min(params.settings.steelTrusses.anchorBoltsPerBearing, 4);
  for (let index = 0; index < boltCount; index += 1) {
    const bolt = new THREE.Mesh(boltGeometry, params.material);
    const offsetX = (index % 2 === 0 ? -1 : 1) * (params.settings.steelTrusses.basePlateWidthMeters * 0.25);
    const offsetZ = (index < 2 ? -1 : 1) * (params.settings.steelTrusses.basePlateLengthMeters * 0.25);
    bolt.position.set(params.bearing.x + offsetX, params.bearing.y + 0.02, params.bearing.z + offsetZ);
    bolts.push(bolt);
  }
  return bolts;
}

export function buildPurlinMesh(
  start: THREE.Vector3,
  end: THREE.Vector3,
  material: THREE.Material,
): THREE.Mesh {
  return createMemberBetween(
    start,
    end,
    PURLIN_PROFILE_WIDTH_METERS,
    PURLIN_PROFILE_DEPTH_METERS,
    material,
  );
}

export function buildTrussPlaneGuide(params: {
  placement: TrussPlacement;
  slabOffsetY: number;
}): THREE.Line {
  const { placement, slabOffsetY } = params;
  const points = [
    new THREE.Vector3(placement.bearingLeft.x, slabOffsetY + placement.bearingLeft.y, placement.bearingLeft.z),
    new THREE.Vector3(placement.apex.x, slabOffsetY + placement.apex.y, placement.apex.z),
    new THREE.Vector3(placement.bearingRight.x, slabOffsetY + placement.bearingRight.y, placement.bearingRight.z),
    new THREE.Vector3(placement.bearingLeft.x, slabOffsetY + placement.bearingLeft.y, placement.bearingLeft.z),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x14b8a6, transparent: true, opacity: 0.55 });
  return new THREE.Line(geometry, material);
}

export function createRidgeCapMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.72, roughness: 0.34 });
}

function slopeDirectionFromRidge(
  ridgeDir: THREE.Vector3,
  planSideSign: 1 | -1,
  roofPitchRadians: number,
): THREE.Vector3 {
  const planPerp = new THREE.Vector3(-ridgeDir.z, 0, ridgeDir.x);
  if (planPerp.lengthSq() <= 1e-8) {
    planPerp.set(0, 0, planSideSign);
  } else {
    planPerp.normalize().multiplyScalar(planSideSign);
  }
  return new THREE.Vector3(
    planPerp.x,
    -Math.tan(roofPitchRadians),
    planPerp.z,
  ).normalize();
}

function createRidgeCapWing(
  ridgeMidpoint: THREE.Vector3,
  ridgeDir: THREE.Vector3,
  slopeDir: THREE.Vector3,
  halfWidthMeters: number,
  capThicknessMeters: number,
  ridgeLengthMeters: number,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(halfWidthMeters, capThicknessMeters, ridgeLengthMeters),
    material,
  );
  const xAxis = slopeDir.clone().normalize();
  const zAxis = ridgeDir.clone().normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  xAxis.crossVectors(yAxis, zAxis).normalize();
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
  mesh.position.copy(
    ridgeMidpoint.clone().add(slopeDir.clone().normalize().multiplyScalar(halfWidthMeters / 2)),
  );
  return mesh;
}

/** Folded ridge cap: two pitched wings meeting at the ridge apex. */
export function createFoldedRidgeCapGroup(
  start: THREE.Vector3,
  end: THREE.Vector3,
  capWidthMeters: number,
  capThicknessMeters: number,
  roofPitchRadians: number,
  material: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  const ridgeVector = end.clone().sub(start);
  const ridgeLengthMeters = ridgeVector.length();
  if (ridgeLengthMeters <= 0.001) {
    return group;
  }
  const ridgeDir = ridgeVector.clone().normalize();
  const ridgeMidpoint = start.clone().add(end).multiplyScalar(0.5);
  ridgeMidpoint.y += ROOF_RIDGE_CAP_CLEARANCE_METERS;
  const halfWidthMeters = capWidthMeters / 2;

  for (const sign of [-1, 1] as const) {
    const slopeDir = slopeDirectionFromRidge(ridgeDir, sign, roofPitchRadians);
    group.add(
      createRidgeCapWing(
        ridgeMidpoint,
        ridgeDir,
        slopeDir,
        halfWidthMeters,
        capThicknessMeters,
        ridgeLengthMeters,
        material,
      ),
    );
  }
  return group;
}

/** @deprecated Use createFoldedRidgeCapGroup */
export function createRidgeCapBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  capWidthMeters: number,
  capThicknessMeters: number,
  roofPitchRadians: number,
  material: THREE.Material,
): THREE.Mesh {
  const group = createFoldedRidgeCapGroup(
    start,
    end,
    capWidthMeters,
    capThicknessMeters,
    roofPitchRadians,
    material,
  );
  if (group.children.length === 0) {
    return new THREE.Mesh(
      new THREE.BoxGeometry(capWidthMeters, capThicknessMeters, 0.01),
      material,
    );
  }
  return group.children[0] as THREE.Mesh;
}

/** @deprecated Use createRidgeCapBetween */
export function buildRidgeCapMesh(
  ridgeStart: THREE.Vector3,
  ridgeEnd: THREE.Vector3,
  thicknessMeters: number,
): THREE.Mesh {
  return createRidgeCapBetween(
    ridgeStart,
    ridgeEnd,
    DEFAULT_RIDGE_CAP_WIDTH_METERS,
    thicknessMeters,
    0,
    createRidgeCapMaterial(),
  );
}

export function buildHipMemberMesh(
  start: THREE.Vector3,
  end: THREE.Vector3,
  material: THREE.Material,
): THREE.Mesh {
  return createMemberBetween(start, end, TRUSS_CHORD_PROFILE_METERS, TRUSS_CHORD_PROFILE_METERS, material);
}

export function toWorldVector(point: { x: number; y: number; z: number }, slabOffsetY: number): THREE.Vector3 {
  return new THREE.Vector3(point.x, slabOffsetY + point.y, point.z);
}

export function memberWorldEndpoints(
  member: SteelMemberSegment,
  slabOffsetY: number,
): { start: THREE.Vector3; end: THREE.Vector3 } {
  return {
    start: toWorldVector(member.start, slabOffsetY),
    end: toWorldVector(member.end, slabOffsetY),
  };
}
