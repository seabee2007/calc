import * as THREE from 'three';
import type {
  FasciaPlacement,
  RakedCapPlacement,
  RoofPlane,
  RoofSystemSettings,
  RoofVec3,
  SoffitPlacement,
  SteelMemberKind,
  SteelMemberSegment,
  TrussPlacement,
} from '../types';
import {
  DEFAULT_RIDGE_CAP_WIDTH_METERS,
  PURLIN_PROFILE_DEPTH_METERS,
  PURLIN_PROFILE_WIDTH_METERS,
  TRUSS_CHORD_PROFILE_METERS,
} from '../domain/roofFramingResolver';

export type PurlinMeshProfile = 'roof_normal' | 'vertical_eave';

const ROOF_PLAN_POINT_MATCH_TOLERANCE_METERS = 0.06;

function roofPlanDistanceSquared(a: Pick<RoofVec3, 'x' | 'z'>, b: Pick<RoofVec3, 'x' | 'z'>): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function cornerMatchesPlanPoint(
  point: Pick<RoofVec3, 'x' | 'z'>,
  candidates: readonly Pick<RoofVec3, 'x' | 'z'>[],
  toleranceMeters: number,
): boolean {
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    nearestDistanceSquared = Math.min(nearestDistanceSquared, roofPlanDistanceSquared(point, candidate));
  }
  return nearestDistanceSquared <= toleranceMeters ** 2;
}

function adjacentEavePair(indices: number[], cornerCount: number): [number, number] | null {
  if (indices.length !== 2) return null;
  const [first, second] = [...indices].sort((a, b) => a - b);
  if (second === first + 1) {
    return [first, second];
  }
  if (first === 0 && second === cornerCount - 1) {
    return [second, first];
  }
  return null;
}

function adjacentCornerPairs(cornerCount: number): [number, number][] {
  return Array.from({ length: cornerCount }, (_, index) => [index, (index + 1) % cornerCount] as [number, number]);
}

export function resolveRoofPlaneEavePair(params: {
  corners: readonly RoofVec3[];
  referencePerimeter?: readonly Pick<RoofVec3, 'x' | 'z'>[];
  planPointToleranceMeters?: number;
}): [number, number] | null {
  if (params.corners.length < 3) {
    return null;
  }

  const toleranceMeters = params.planPointToleranceMeters ?? ROOF_PLAN_POINT_MATCH_TOLERANCE_METERS;
  if (params.referencePerimeter && params.referencePerimeter.length >= 2) {
    const referenceMatches = params.corners
      .map((corner, index) =>
        cornerMatchesPlanPoint(corner, params.referencePerimeter!, toleranceMeters) ? index : -1,
      )
      .filter((index) => index >= 0);
    const matchedPair = adjacentEavePair(referenceMatches, params.corners.length);
    if (matchedPair) {
      return matchedPair;
    }
  }

  let bestPair: { pair: [number, number]; averageY: number; lengthSquared: number } | null = null;
  for (const pair of adjacentCornerPairs(params.corners.length)) {
    const first = params.corners[pair[0]]!;
    const second = params.corners[pair[1]]!;
    const lengthSquared = roofPlanDistanceSquared(first, second);
    if (lengthSquared <= 1e-8) {
      continue;
    }
    const averageY = (first.y + second.y) / 2;
    if (
      !bestPair ||
      averageY < bestPair.averageY - 0.001 ||
      (Math.abs(averageY - bestPair.averageY) <= 0.001 && lengthSquared > bestPair.lengthSquared)
    ) {
      bestPair = { pair, averageY, lengthSquared };
    }
  }

  return bestPair?.pair ?? null;
}

export function buildRoofCladdingRenderPlanes(params: {
  planes: readonly RoofPlane[];
  clearanceMeters: number;
}): RoofPlane[] {
  return params.planes.map((plane) => ({
    ...plane,
    corners: plane.corners.map((corner) => ({
      ...corner,
      y: corner.y + params.clearanceMeters,
    })),
  }));
}

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
    case 'top_chord_left_eave_extension':
    case 'top_chord_right_eave_extension':
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

function basePlateAxes(spanDirection?: THREE.Vector3): {
  widthAxis: THREE.Vector3;
  upAxis: THREE.Vector3;
  spanAxis: THREE.Vector3;
} {
  const spanAxis = spanDirection?.clone() ?? new THREE.Vector3(0, 0, 1);
  spanAxis.y = 0;
  if (spanAxis.lengthSq() <= 1e-8) {
    spanAxis.set(0, 0, 1);
  } else {
    spanAxis.normalize();
  }

  const upAxis = new THREE.Vector3(0, 1, 0);
  const widthAxis = new THREE.Vector3().crossVectors(upAxis, spanAxis);
  if (widthAxis.lengthSq() <= 1e-8) {
    widthAxis.set(1, 0, 0);
  } else {
    widthAxis.normalize();
  }

  return { widthAxis, upAxis, spanAxis };
}

export function buildTrussBasePlateMesh(params: {
  bearing: THREE.Vector3;
  settings: RoofSystemSettings;
  material: THREE.Material;
  spanDirection?: THREE.Vector3;
}): THREE.Mesh {
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(
      params.settings.steelTrusses.basePlateWidthMeters,
      params.settings.steelTrusses.basePlateThicknessMeters,
      params.settings.steelTrusses.basePlateLengthMeters,
    ),
    params.material,
  );
  const { widthAxis, upAxis, spanAxis } = basePlateAxes(params.spanDirection);
  plate.position.set(
    params.bearing.x,
    params.bearing.y - params.settings.steelTrusses.basePlateThicknessMeters / 2,
    params.bearing.z,
  );
  plate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(widthAxis, upAxis, spanAxis));
  return plate;
}

export function buildTrussAnchorBoltMeshes(params: {
  bearing: THREE.Vector3;
  settings: RoofSystemSettings;
  material: THREE.Material;
  spanDirection?: THREE.Vector3;
}): THREE.Mesh[] {
  const bolts: THREE.Mesh[] = [];
  const boltGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6);
  const boltCount = Math.min(params.settings.steelTrusses.anchorBoltsPerBearing, 4);
  const { widthAxis, spanAxis } = basePlateAxes(params.spanDirection);
  for (let index = 0; index < boltCount; index += 1) {
    const bolt = new THREE.Mesh(boltGeometry, params.material);
    const widthOffset = (index % 2 === 0 ? -1 : 1) * (params.settings.steelTrusses.basePlateWidthMeters * 0.25);
    const spanOffset = (index < 2 ? -1 : 1) * (params.settings.steelTrusses.basePlateLengthMeters * 0.25);
    bolt.position
      .copy(params.bearing)
      .add(widthAxis.clone().multiplyScalar(widthOffset))
      .add(spanAxis.clone().multiplyScalar(spanOffset));
    bolt.position.y = params.bearing.y + 0.02;
    bolts.push(bolt);
  }
  return bolts;
}

export function buildPurlinMesh(params: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  planeNormal: THREE.Vector3;
  material: THREE.Material;
  profile?: PurlinMeshProfile;
}): THREE.Mesh {
  const direction = params.end.clone().sub(params.start);
  const length = direction.length();
  if (length <= 0.001) {
    return new THREE.Mesh(
      new THREE.BoxGeometry(PURLIN_PROFILE_WIDTH_METERS, PURLIN_PROFILE_WIDTH_METERS, PURLIN_PROFILE_DEPTH_METERS),
      params.material,
    );
  }

  if (params.profile === 'vertical_eave') {
    return buildVerticalEavePurlinMesh(params);
  }

  const runAxis = direction.clone().normalize();
  const outwardNormal = params.planeNormal.clone();
  if (outwardNormal.lengthSq() <= 1e-8) {
    outwardNormal.set(0, 1, 0);
  } else {
    outwardNormal.normalize();
  }
  if (outwardNormal.y < 0) {
    outwardNormal.negate();
  }

  const yAxis = runAxis;
  const zAxis = outwardNormal;
  const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis);
  if (xAxis.lengthSq() <= 1e-8) {
    xAxis.set(1, 0, 0);
  } else {
    xAxis.normalize();
  }
  const zOrtho = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(PURLIN_PROFILE_WIDTH_METERS, length, PURLIN_PROFILE_DEPTH_METERS),
    params.material,
  );
  mesh.position.copy(params.start.clone().add(params.end).multiplyScalar(0.5));
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zOrtho));
  return mesh;
}

function buildVerticalEavePurlinMesh(params: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  planeNormal: THREE.Vector3;
  material: THREE.Material;
}): THREE.Mesh {
  const normal = params.planeNormal.clone();
  if (normal.lengthSq() <= 1e-8) {
    normal.set(0, 1, 0);
  } else {
    normal.normalize();
  }
  if (normal.y < 0) {
    normal.negate();
  }

  const runAxis = params.end.clone().sub(params.start);
  runAxis.y = 0;
  if (runAxis.lengthSq() <= 1e-8) {
    runAxis.copy(params.end).sub(params.start);
  }
  if (runAxis.lengthSq() <= 1e-8) {
    runAxis.set(1, 0, 0);
  } else {
    runAxis.normalize();
  }

  const outboardAxis = new THREE.Vector3().crossVectors(runAxis, normal);
  outboardAxis.y = 0;
  if (outboardAxis.lengthSq() <= 1e-8) {
    outboardAxis.set(-runAxis.z, 0, runAxis.x);
  }
  if (outboardAxis.lengthSq() <= 1e-8) {
    outboardAxis.set(1, 0, 0);
  } else {
    outboardAxis.normalize();
  }

  const roofSlopeAlongOutboard =
    normal.y === 0 ? 0 : -(normal.x * outboardAxis.x + normal.z * outboardAxis.z) / normal.y;
  if (roofSlopeAlongOutboard > 0) {
    outboardAxis.negate();
  }

  const halfWidth = PURLIN_PROFILE_WIDTH_METERS / 2;
  const startTopPlanePoint = params.start.clone().add(normal.clone().multiplyScalar(PURLIN_PROFILE_DEPTH_METERS / 2));
  const endTopPlanePoint = params.end.clone().add(normal.clone().multiplyScalar(PURLIN_PROFILE_DEPTH_METERS / 2));
  const startBottomPoint = params.start.clone().add(normal.clone().multiplyScalar(-PURLIN_PROFILE_DEPTH_METERS / 2));
  const endBottomPoint = params.end.clone().add(normal.clone().multiplyScalar(-PURLIN_PROFILE_DEPTH_METERS / 2));

  const roofParallelY = (planePoint: THREE.Vector3, x: number, z: number): number =>
    normal.y === 0
      ? planePoint.y
      : planePoint.y - (normal.x * (x - planePoint.x) + normal.z * (z - planePoint.z)) / normal.y;

  const pointAt = (
    center: THREE.Vector3,
    crossOffsetMeters: number,
    y: number,
  ): THREE.Vector3 => new THREE.Vector3(
    center.x + outboardAxis.x * crossOffsetMeters,
    y,
    center.z + outboardAxis.z * crossOffsetMeters,
  );

  const startInboardBottom = pointAt(params.start, -halfWidth, startBottomPoint.y);
  const startOutboardBottom = pointAt(params.start, halfWidth, startBottomPoint.y);
  const endOutboardBottom = pointAt(params.end, halfWidth, endBottomPoint.y);
  const endInboardBottom = pointAt(params.end, -halfWidth, endBottomPoint.y);
  const startInboardTop = pointAt(
    params.start,
    -halfWidth,
    roofParallelY(startTopPlanePoint, params.start.x - outboardAxis.x * halfWidth, params.start.z - outboardAxis.z * halfWidth),
  );
  const startOutboardTop = pointAt(
    params.start,
    halfWidth,
    roofParallelY(startTopPlanePoint, params.start.x + outboardAxis.x * halfWidth, params.start.z + outboardAxis.z * halfWidth),
  );
  const endOutboardTop = pointAt(
    params.end,
    halfWidth,
    roofParallelY(endTopPlanePoint, params.end.x + outboardAxis.x * halfWidth, params.end.z + outboardAxis.z * halfWidth),
  );
  const endInboardTop = pointAt(
    params.end,
    -halfWidth,
    roofParallelY(endTopPlanePoint, params.end.x - outboardAxis.x * halfWidth, params.end.z - outboardAxis.z * halfWidth),
  );

  const vertices = [
    startInboardBottom,
    startOutboardBottom,
    endOutboardBottom,
    endInboardBottom,
    startInboardTop,
    startOutboardTop,
    endOutboardTop,
    endInboardTop,
  ];
  const indices = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    1, 2, 6, 1, 6, 5,
    0, 4, 7, 0, 7, 3,
    0, 1, 5, 0, 5, 4,
    3, 7, 6, 3, 6, 2,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]),
      3,
    ),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, params.material);
  mesh.userData.purlinProfile = 'vertical_eave';
  return mesh;
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

export function createFasciaTrimGeometry(params: {
  placement: FasciaPlacement;
  slabTopMeters: number;
}): THREE.BufferGeometry {
  const { placement, slabTopMeters } = params;
  const renderOutboardBiasMeters = 0.003;
  const vertices = [
    placement.topStart,
    placement.topEnd,
    placement.bottomEnd,
    placement.bottomStart,
  ].map((vertex) => ({
    x: vertex.x + placement.faceOutwardNormal.x * renderOutboardBiasMeters,
    y: vertex.y,
    z: vertex.z + placement.faceOutwardNormal.z * renderOutboardBiasMeters,
  }));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      vertices.flatMap((vertex) => [vertex.x, slabTopMeters + vertex.y, vertex.z]),
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createSoffitPanelGeometry(params: {
  placement: SoffitPlacement;
  slabTopMeters: number;
}): THREE.BufferGeometry {
  const { placement, slabTopMeters } = params;
  const renderDownBiasMeters = 0.002;
  const vertices = [
    placement.innerStart,
    placement.innerEnd,
    placement.outerEnd,
    placement.outerStart,
  ].map((vertex) => ({
    x: vertex.x,
    y: vertex.y - renderDownBiasMeters,
    z: vertex.z,
  }));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      vertices.flatMap((vertex) => [vertex.x, slabTopMeters + vertex.y, vertex.z]),
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
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

function roofWingNormal(ridgeDir: THREE.Vector3, slopeDir: THREE.Vector3): THREE.Vector3 {
  const normal = new THREE.Vector3().crossVectors(ridgeDir, slopeDir).normalize();
  if (normal.y < 0) {
    normal.negate();
  }
  return normal;
}

function pushQuad(indices: number[], a: number, b: number, c: number, d: number): void {
  indices.push(a, b, c, a, c, d);
}

function projectedWingDirection(params: {
  edgeDir: THREE.Vector3;
  edgeMid: THREE.Vector3;
  planeNormal: THREE.Vector3;
  planeCorners: readonly THREE.Vector3[];
}): THREE.Vector3 {
  const centroid = params.planeCorners
    .reduce((sum, corner) => sum.add(corner), new THREE.Vector3())
    .multiplyScalar(1 / Math.max(1, params.planeCorners.length));
  const towardPlane = centroid.sub(params.edgeMid);
  const projected = towardPlane
    .clone()
    .sub(params.edgeDir.clone().multiplyScalar(towardPlane.dot(params.edgeDir)))
    .sub(params.planeNormal.clone().multiplyScalar(towardPlane.dot(params.planeNormal)));
  if (projected.lengthSq() > 1e-8) {
    return projected.normalize();
  }

  const fallback = new THREE.Vector3().crossVectors(params.planeNormal, params.edgeDir);
  if (fallback.lengthSq() <= 1e-8) {
    return new THREE.Vector3(1, 0, 0);
  }
  fallback.normalize();
  return fallback.dot(towardPlane) < 0 ? fallback.negate() : fallback;
}

export function createFoldedRoofEdgeCapGroup(params: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  capWidthMeters: number;
  capThicknessMeters: number;
  material: THREE.Material;
  adjacentPlanes: readonly {
    normal: THREE.Vector3;
    corners: readonly THREE.Vector3[];
  }[];
  miterBottomEnds?: boolean;
}): THREE.Group {
  const group = new THREE.Group();
  const edgeVector = params.end.clone().sub(params.start);
  const edgeLengthMeters = edgeVector.length();
  if (edgeLengthMeters <= 0.001) {
    return group;
  }

  const edgeDir = edgeVector.clone().normalize();
  const edgeMid = params.start.clone().add(params.end).multiplyScalar(0.5);
  const halfWidthMeters = params.capWidthMeters / 2;
  const miterInsetMeters = params.miterBottomEnds
    ? Math.min(halfWidthMeters, edgeLengthMeters * 0.3)
    : 0;
  const vertices: THREE.Vector3[] = [];
  const indices: number[] = [];

  const planes = params.adjacentPlanes.slice(0, 2);
  const sharedRidgeNormal = planes
    .reduce((sum, plane) => {
      const normal = plane.normal.clone().normalize();
      if (normal.y < 0) {
        normal.negate();
      }
      return sum.add(normal);
    }, new THREE.Vector3());
  if (sharedRidgeNormal.lengthSq() <= 1e-8) {
    sharedRidgeNormal.set(0, 1, 0);
  } else {
    sharedRidgeNormal.normalize();
  }
  const ridgeStartTop = params.start.clone().add(sharedRidgeNormal.clone().multiplyScalar(params.capThicknessMeters));
  const ridgeEndTop = params.end.clone().add(sharedRidgeNormal.clone().multiplyScalar(params.capThicknessMeters));

  for (const plane of planes) {
    const normal = plane.normal.clone().normalize();
    if (normal.y < 0) {
      normal.negate();
    }
    const wingDir = projectedWingDirection({
      edgeDir,
      edgeMid,
      planeNormal: normal,
      planeCorners: plane.corners,
    });

    const baseIndex = vertices.length;
    const outerStart = params.start
      .clone()
      .add(edgeDir.clone().multiplyScalar(miterInsetMeters))
      .add(wingDir.clone().multiplyScalar(halfWidthMeters));
    const outerEnd = params.end
      .clone()
      .add(edgeDir.clone().multiplyScalar(-miterInsetMeters))
      .add(wingDir.clone().multiplyScalar(halfWidthMeters));
    const outerStartTop = outerStart.clone().add(normal.clone().multiplyScalar(params.capThicknessMeters));
    const outerEndTop = outerEnd.clone().add(normal.clone().multiplyScalar(params.capThicknessMeters));
    vertices.push(ridgeStartTop.clone(), outerStartTop, outerEndTop, ridgeEndTop.clone());

    const faceNormal = new THREE.Vector3().crossVectors(
      vertices[baseIndex + 1]!.clone().sub(vertices[baseIndex]!),
      vertices[baseIndex + 2]!.clone().sub(vertices[baseIndex]!),
    );
    if (faceNormal.dot(normal) < 0) {
      pushQuad(indices, baseIndex, baseIndex + 3, baseIndex + 2, baseIndex + 1);
    } else {
      pushQuad(indices, baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]),
      3,
    ),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  group.add(new THREE.Mesh(geometry, params.material));
  return group;
}

/** One continuous folded ridge cap with its underside seated on the cladding ridge. */
export function createFoldedRidgeCapGroup(
  start: THREE.Vector3,
  end: THREE.Vector3,
  capWidthMeters: number,
  capThicknessMeters: number,
  roofPitchRadians: number,
  material: THREE.Material,
  options?: { miterBottomEnds?: boolean },
): THREE.Group {
  const group = new THREE.Group();
  const ridgeVector = end.clone().sub(start);
  const ridgeLengthMeters = ridgeVector.length();
  if (ridgeLengthMeters <= 0.001) {
    return group;
  }
  const ridgeDir = ridgeVector.clone().normalize();
  const halfWidthMeters = capWidthMeters / 2;
  const leftSlope = slopeDirectionFromRidge(ridgeDir, -1, roofPitchRadians);
  const rightSlope = slopeDirectionFromRidge(ridgeDir, 1, roofPitchRadians);
  const leftNormal = roofWingNormal(ridgeDir, leftSlope);
  const rightNormal = roofWingNormal(ridgeDir, rightSlope);
  const bottomMiterInsetMeters = options?.miterBottomEnds
    ? Math.min(halfWidthMeters, ridgeLengthMeters * 0.45)
    : 0;
  const miteredStart = start.clone().add(ridgeDir.clone().multiplyScalar(bottomMiterInsetMeters));
  const miteredEnd = end.clone().add(ridgeDir.clone().multiplyScalar(-bottomMiterInsetMeters));

  const leftOuterStart = miteredStart.clone().add(leftSlope.clone().multiplyScalar(halfWidthMeters));
  const leftOuterEnd = miteredEnd.clone().add(leftSlope.clone().multiplyScalar(halfWidthMeters));
  const rightOuterStart = miteredStart.clone().add(rightSlope.clone().multiplyScalar(halfWidthMeters));
  const rightOuterEnd = miteredEnd.clone().add(rightSlope.clone().multiplyScalar(halfWidthMeters));

  const leftTopRidgeStart = start.clone().add(leftNormal.clone().multiplyScalar(capThicknessMeters));
  const leftTopRidgeEnd = end.clone().add(leftNormal.clone().multiplyScalar(capThicknessMeters));
  const leftTopOuterStart = leftOuterStart.clone().add(leftNormal.clone().multiplyScalar(capThicknessMeters));
  const leftTopOuterEnd = leftOuterEnd.clone().add(leftNormal.clone().multiplyScalar(capThicknessMeters));
  const rightTopRidgeStart = start.clone().add(rightNormal.clone().multiplyScalar(capThicknessMeters));
  const rightTopRidgeEnd = end.clone().add(rightNormal.clone().multiplyScalar(capThicknessMeters));
  const rightTopOuterStart = rightOuterStart.clone().add(rightNormal.clone().multiplyScalar(capThicknessMeters));
  const rightTopOuterEnd = rightOuterEnd.clone().add(rightNormal.clone().multiplyScalar(capThicknessMeters));

  const vertices = [
    start,
    end,
    leftOuterStart,
    leftOuterEnd,
    rightOuterStart,
    rightOuterEnd,
    leftTopRidgeStart,
    leftTopRidgeEnd,
    leftTopOuterStart,
    leftTopOuterEnd,
    rightTopRidgeStart,
    rightTopRidgeEnd,
    rightTopOuterStart,
    rightTopOuterEnd,
  ];
  const indices: number[] = [];

  pushQuad(indices, 6, 7, 9, 8);
  pushQuad(indices, 10, 11, 13, 12);
  pushQuad(indices, 2, 3, 9, 8);
  pushQuad(indices, 4, 12, 13, 5);
  pushQuad(indices, 0, 6, 7, 1);
  pushQuad(indices, 0, 1, 11, 10);
  pushQuad(indices, 0, 2, 8, 6);
  pushQuad(indices, 0, 10, 12, 4);
  pushQuad(indices, 1, 7, 9, 3);
  pushQuad(indices, 1, 5, 13, 11);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]),
      3,
    ),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  group.add(new THREE.Mesh(geometry, material));
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

/** Solid trapezoidal raked cap prism: bottom may step, top follows roof underside. */
export function createRakedCapPrismGeometry(params: {
  spanMeters: number;
  startBottomY: number;
  endBottomY: number;
  startTopY: number;
  endTopY: number;
  wallDepthMeters: number;
}): THREE.BufferGeometry {
  return createRakedCapStripGeometry([params]);
}

/** Continuous raked cap strip along the wall tangent — shared top slope, stepped bottom envelope. */
export const RAKED_CAP_STRIP_STATION_GAP_TOLERANCE_METERS = 0.001;

export type RakedCapStripRenderSegment = {
  spanMeters: number;
  startBottomY: number;
  endBottomY: number;
  startTopY: number;
  endTopY: number;
  wallDepthMeters: number;
};

export function buildRakedCapStripRenderSegments(
  caps: readonly RakedCapPlacement[],
  gapToleranceMeters = RAKED_CAP_STRIP_STATION_GAP_TOLERANCE_METERS,
): {
  startStationMeters: number;
  segments: RakedCapStripRenderSegment[];
} | null {
  const sortedCaps = [...caps].sort(
    (left, right) => left.startStationMeters - right.startStationMeters,
  );

  if (sortedCaps.length === 0) {
    return null;
  }

  const segments: RakedCapStripRenderSegment[] = [];
  let previousCap: RakedCapPlacement | null = null;

  for (const cap of sortedCaps) {
    if (previousCap) {
      const gapMeters =
        cap.startStationMeters - previousCap.endStationMeters;

      if (gapMeters > gapToleranceMeters) {
        segments.push({
          spanMeters: gapMeters,
          startBottomY: previousCap.endBottomY,
          endBottomY: cap.startBottomY,
          startTopY: previousCap.endTopY,
          endTopY: cap.startTopY,
          wallDepthMeters: Math.max(
            previousCap.wallDepthMeters,
            cap.wallDepthMeters,
          ),
        });
      }
    }

    segments.push({
      spanMeters: cap.endStationMeters - cap.startStationMeters,
      startBottomY: cap.startBottomY,
      endBottomY: cap.endBottomY,
      startTopY: cap.startTopY,
      endTopY: cap.endTopY,
      wallDepthMeters: cap.wallDepthMeters,
    });
    previousCap = cap;
  }

  return {
    startStationMeters: sortedCaps[0]!.startStationMeters,
    segments,
  };
}

export function createRakedCapStripGeometry(
  segments: ReadonlyArray<{
    spanMeters: number;
    startBottomY: number;
    endBottomY: number;
    startTopY: number;
    endTopY: number;
    wallDepthMeters: number;
  }>,
): THREE.BufferGeometry {
  /**
   * A rake-cap strip is a single closed extruded profile:
   *
   * - the top contour follows the roof underside;
   * - every segment retains its own flat CMU-contact bottom;
   * - a vertical riser is emitted at each CMU step;
   * - the solid is extruded through the wall depth.
   *
   * The previous indexed-mesh implementation accidentally omitted the
   * top/bottom faces, duplicated side faces, and discarded a segment's
   * `startBottomY` after the first station. That made one slope appear
   * culled and turned stepped cap bottoms into diagonal planes.
   */
  const usableSegments = segments.filter((segment) => {
    const spanMeters = Number(segment.spanMeters);
    const values = [
      spanMeters,
      segment.startBottomY,
      segment.endBottomY,
      segment.startTopY,
      segment.endTopY,
      segment.wallDepthMeters,
    ];

    return (
      spanMeters > 0.0005 &&
      values.every((value) => Number.isFinite(value)) &&
      (segment.startTopY > segment.startBottomY ||
        segment.endTopY > segment.endBottomY)
    );
  });

  if (usableSegments.length === 0) {
    return new THREE.BufferGeometry();
  }

  const depthMeters = Math.max(
    0.05,
    ...usableSegments.map((segment) => segment.wallDepthMeters),
  );
  const halfDepthMeters = depthMeters / 2;
  const pointToleranceMeters = 0.000001;

  type ProfilePoint = { x: number; y: number };

  const topProfile: ProfilePoint[] = [];
  const bottomProfile: ProfilePoint[] = [];

  const appendPoint = (
    target: ProfilePoint[],
    point: ProfilePoint,
  ): void => {
    const previous = target[target.length - 1];

    if (
      previous &&
      Math.abs(previous.x - point.x) <= pointToleranceMeters &&
      Math.abs(previous.y - point.y) <= pointToleranceMeters
    ) {
      return;
    }

    target.push(point);
  };

  let stationMeters = 0;
  const firstSegment = usableSegments[0]!;

  appendPoint(topProfile, {
    x: stationMeters,
    y: firstSegment.startTopY,
  });

  for (let index = 0; index < usableSegments.length; index += 1) {
    const segment = usableSegments[index]!;
    const nextSegment = usableSegments[index + 1];
    const startStationMeters = stationMeters;
    const endStationMeters = startStationMeters + segment.spanMeters;

    /**
     * Roof-contact top values should be continuous. Preserve a real
     * discontinuity if upstream geometry supplies one, but do not create
     * duplicate vertices for harmless floating-point noise.
     */
    appendPoint(topProfile, {
      x: endStationMeters,
      y: segment.endTopY,
    });

    if (
      nextSegment &&
      Math.abs(segment.endTopY - nextSegment.startTopY) >
        pointToleranceMeters
    ) {
      appendPoint(topProfile, {
        x: endStationMeters,
        y: nextSegment.startTopY,
      });
    }

    stationMeters = endStationMeters;
  }

  /**
   * Trace the CMU-contact profile from the far end back to the start.
   *
   * At every shared station this includes:
   *   current segment start-bottom
   *   previous segment end-bottom
   *
   * Those two points share X but may differ in Y, creating the required
   * vertical step instead of diagonally bridging between CMU courses.
   */
  let reverseStationMeters = stationMeters;
  const lastSegment = usableSegments[usableSegments.length - 1]!;

  appendPoint(bottomProfile, {
    x: reverseStationMeters,
    y: lastSegment.endBottomY,
  });

  for (let index = usableSegments.length - 1; index >= 0; index -= 1) {
    const segment = usableSegments[index]!;
    const previousSegment = usableSegments[index - 1];
    const startStationMeters =
      reverseStationMeters - segment.spanMeters;

    appendPoint(bottomProfile, {
      x: startStationMeters,
      y: segment.startBottomY,
    });

    if (
      previousSegment &&
      Math.abs(
        segment.startBottomY - previousSegment.endBottomY,
      ) > pointToleranceMeters
    ) {
      appendPoint(bottomProfile, {
        x: startStationMeters,
        y: previousSegment.endBottomY,
      });
    }

    reverseStationMeters = startStationMeters;
  }

  const outline = [...topProfile, ...bottomProfile];

  if (outline.length < 3) {
    return new THREE.BufferGeometry();
  }

  const shape = new THREE.Shape();
  shape.moveTo(outline[0]!.x, outline[0]!.y);

  for (let index = 1; index < outline.length; index += 1) {
    const point = outline[index]!;
    shape.lineTo(point.x, point.y);
  }

  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depthMeters,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });

  /**
   * ExtrudeGeometry spans local Z = 0..depth. Center it so the existing
   * renderer position remains at the wall centerline.
   */
  geometry.translate(0, 0, -halfDepthMeters);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}


export function createRakedConcreteCapMaterial(selected: boolean): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: selected ? 0x9ca3af : 0x78716c,
    metalness: 0.08,
    roughness: 0.88,
  });
}
