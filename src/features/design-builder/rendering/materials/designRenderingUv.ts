import * as THREE from 'three';

/** Box UVs scaled in meters so textures repeat by real member length, not end-to-end stretch. */
export function createMeterScaledBoxGeometry(
  widthMeters: number,
  heightMeters: number,
  depthMeters: number,
): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(widthMeters, heightMeters, depthMeters);
  applyMeterScaledBoxUvs(geometry, widthMeters, heightMeters, depthMeters);
  return geometry;
}

export function applyMeterScaledBoxUvs(
  geometry: THREE.BufferGeometry,
  widthMeters: number,
  heightMeters: number,
  depthMeters: number,
): void {
  const uv = geometry.getAttribute('uv');
  if (!uv) return;

  const halfW = Math.max(widthMeters, 0.001) / 2;
  const halfH = Math.max(heightMeters, 0.001) / 2;
  const halfD = Math.max(depthMeters, 0.001) / 2;

  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) {
    const px = positions.getX(index);
    const py = positions.getY(index);
    const pz = positions.getZ(index);
    const ax = Math.abs(px) / halfW;
    const ay = Math.abs(py) / halfH;
    const az = Math.abs(pz) / halfD;

    let u = 0;
    let v = 0;
    if (ax >= ay && ax >= az) {
      u = pz + halfD;
      v = py + halfH;
    } else if (ay >= ax && ay >= az) {
      u = px + halfW;
      v = pz + halfD;
    } else {
      u = px + halfW;
      v = py + halfH;
    }
    uv.setXY(index, u, v);
  }
  uv.needsUpdate = true;
  ensureAoUv2(geometry);
}

/** Ambient-occlusion maps require a second UV channel in Three.js. */
export function ensureAoUv2(geometry: THREE.BufferGeometry): void {
  const uv = geometry.getAttribute('uv');
  if (!uv) return;
  geometry.setAttribute('uv2', uv.clone());
}

/** Unit cube with meter-scaled UVs for instanced CMU blocks (scale applied via instance matrix). */
export function createCmuInstancedUnitGeometry(): THREE.BoxGeometry {
  return createMeterScaledBoxGeometry(1, 1, 1);
}

export type RoofCladdingUvParams = {
  corners: ReadonlyArray<{ x: number; y: number; z: number }>;
  slabTopMeters: number;
  planeNormal: THREE.Vector3;
  ridgeDirection: THREE.Vector3;
  corrugationRepeatPerMeter?: number;
  /** When true, corrugation runs along the ridge instead of ridge-to-eave. */
  swapCorrugationAxis?: boolean;
};

/**
 * Roof cladding UVs: U runs ridge-to-eave (corrugation direction), V runs along the ridge.
 */
export function createRoofCladdingGeometry(params: RoofCladdingUvParams): THREE.BufferGeometry {
  const { corners, slabTopMeters, planeNormal, ridgeDirection } = params;
  const corrugationRepeatPerMeter = params.corrugationRepeatPerMeter ?? 12;

  const worldCorners = corners.map(
    (corner) => new THREE.Vector3(corner.x, slabTopMeters + corner.y, corner.z),
  );
  const positions: number[] = [];
  for (const corner of worldCorners) {
    positions.push(corner.x, corner.y, corner.z);
  }

  const indices = corners.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const normal = planeNormal.clone().normalize();
  let ridgeAxis =
    corners.length === 3
      ? (() => {
          const eaveCorners = [...worldCorners]
            .sort((a, b) => a.y - b.y)
            .slice(0, 2);
          const edge = eaveCorners[1]!.clone().sub(eaveCorners[0]!);
          edge.y = 0;
          return edge.lengthSq() > 1e-8 ? edge : ridgeDirection.clone();
        })()
      : ridgeDirection.clone();
  ridgeAxis.y = 0;
  if (ridgeAxis.lengthSq() <= 1e-8) {
    ridgeAxis.set(1, 0, 0);
  } else {
    ridgeAxis.normalize();
  }

  let downslopeAxis = new THREE.Vector3().crossVectors(normal, ridgeAxis);
  if (downslopeAxis.lengthSq() <= 1e-8) {
    downslopeAxis = new THREE.Vector3().crossVectors(ridgeAxis, normal);
  }
  downslopeAxis.normalize();

  const slopeExtents = worldCorners.reduce(
    (extents, corner) => {
      const projected = corner.dot(downslopeAxis);
      if (projected < extents.minProjection) {
        extents.minProjection = projected;
        extents.minY = corner.y;
      }
      if (projected > extents.maxProjection) {
        extents.maxProjection = projected;
        extents.maxY = corner.y;
      }
      return extents;
    },
    {
      minProjection: Number.POSITIVE_INFINITY,
      minY: 0,
      maxProjection: Number.NEGATIVE_INFINITY,
      maxY: 0,
    },
  );
  if (slopeExtents.maxY > slopeExtents.minY) {
    downslopeAxis.negate();
  }

  const origin = worldCorners[0]!.clone();
  const uvs: number[] = [];
  for (const corner of worldCorners) {
    const offset = corner.clone().sub(origin);
    const alongRidgeMeters = offset.dot(ridgeAxis);
    const alongSlopeMeters = offset.dot(downslopeAxis);
    const corrugationCoord = alongSlopeMeters * corrugationRepeatPerMeter;
    const ridgeCoord = alongRidgeMeters;
    if (params.swapCorrugationAxis) {
      uvs.push(ridgeCoord, corrugationCoord);
    } else {
      uvs.push(corrugationCoord, ridgeCoord);
    }
  }

  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  ensureAoUv2(geometry);
  return geometry;
}

export function resolveRoofRidgeDirection(
  planeCorners: ReadonlyArray<{ x: number; z: number }>,
  fallbackRidge?: { x: number; z: number },
): THREE.Vector3 {
  if (planeCorners.length === 3) {
    const edge = new THREE.Vector3(
      planeCorners[1]!.x - planeCorners[0]!.x,
      0,
      planeCorners[1]!.z - planeCorners[0]!.z,
    );
    if (edge.lengthSq() > 1e-8) {
      return edge.normalize();
    }
  }
  if (fallbackRidge && Math.hypot(fallbackRidge.x, fallbackRidge.z) > 1e-6) {
    return new THREE.Vector3(fallbackRidge.x, 0, fallbackRidge.z).normalize();
  }
  if (planeCorners.length >= 2) {
    const edge = new THREE.Vector3(
      planeCorners[1]!.x - planeCorners[0]!.x,
      0,
      planeCorners[1]!.z - planeCorners[0]!.z,
    );
    if (edge.lengthSq() > 1e-8) {
      return edge.normalize();
    }
  }
  return new THREE.Vector3(1, 0, 0);
}

export type VerticalCladdingUvParams = {
  corners: ReadonlyArray<{ x: number; y: number; z: number }>;
  slabTopMeters: number;
  corrugationRepeatPerMeter?: number;
};

function inferVerticalWallProjection(worldCorners: THREE.Vector3[]): (corner: THREE.Vector3) => THREE.Vector2 {
  const xs = worldCorners.map((corner) => corner.x);
  const zs = worldCorners.map((corner) => corner.z);
  const xRange = Math.max(...xs) - Math.min(...xs);
  const zRange = Math.max(...zs) - Math.min(...zs);
  if (xRange <= 0.02 && zRange > 0.02) {
    return (corner) => new THREE.Vector2(corner.y, corner.z);
  }
  if (zRange <= 0.02 && xRange > 0.02) {
    return (corner) => new THREE.Vector2(corner.y, corner.x);
  }
  return (corner) => new THREE.Vector2(corner.y, corner.z);
}

function triangulateVerticalWallCorners(worldCorners: THREE.Vector3[]): number[] {
  if (worldCorners.length < 3) return [];
  if (worldCorners.length === 3) return [0, 1, 2];
  if (worldCorners.length === 4) return [0, 1, 2, 0, 2, 3];

  const project = inferVerticalWallProjection(worldCorners);
  const shapePoints = worldCorners.map((corner) => project(corner));
  const faces = THREE.ShapeUtils.triangulateShape(shapePoints, []);
  if (faces.length > 0) {
    const indices: number[] = [];
    for (const face of faces) {
      indices.push(face[0]!, face[1]!, face[2]!);
    }
    return indices;
  }

  const indices: number[] = [];
  for (let index = 1; index < worldCorners.length - 1; index += 1) {
    indices.push(0, index, index + 1);
  }
  return indices;
}

/** Vertical wall cladding UVs: U runs bottom-to-top (corrugation direction), V runs along the wall base. */
export function createVerticalCladdingGeometry(params: VerticalCladdingUvParams): THREE.BufferGeometry {
  const { corners, slabTopMeters } = params;
  const corrugationRepeatPerMeter = params.corrugationRepeatPerMeter ?? 12;

  const worldCorners = corners.map(
    (corner) => new THREE.Vector3(corner.x, slabTopMeters + corner.y, corner.z),
  );
  const positions: number[] = [];
  for (const corner of worldCorners) {
    positions.push(corner.x, corner.y, corner.z);
  }

  const indices = triangulateVerticalWallCorners(worldCorners);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (indices.length > 0) {
    geometry.setIndex(indices);
  }
  geometry.computeVertexNormals();

  const sortedByHeight = [...worldCorners].sort((a, b) => a.y - b.y);
  const baseA = sortedByHeight[0]!;
  const baseB = sortedByHeight[1]!;
  const baseEdge = baseB.clone().sub(baseA);
  const baseLength = baseEdge.length() || 1;
  baseEdge.divideScalar(baseLength);
  const bottomY = Math.min(baseA.y, baseB.y);

  const uvs: number[] = [];
  for (const corner of worldCorners) {
    const alongBaseMeters = corner.clone().sub(baseA).dot(baseEdge);
    const verticalMeters = corner.y - bottomY;
    uvs.push(verticalMeters * corrugationRepeatPerMeter, alongBaseMeters);
  }

  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  ensureAoUv2(geometry);
  return geometry;
}
