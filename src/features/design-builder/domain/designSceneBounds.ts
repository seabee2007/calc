import * as THREE from 'three';
import type { DesignGeometryResult } from '../geometry/designGeometry';
import type { ResolvedCmuOpening } from '../domain/cmuOpeningRules';
import type {
  DesignWallLayoutParameters,
  GableRoofSystemParameters,
  MasonryCourseRun,
  SteelTrussSystemParameters,
  ThickenedEdgeSlabParameters,
} from '../types';
import {
  DEFAULT_PLAN_VIEWPORT,
  fitPlanViewportToBounds,
  type PlanSurfaceSize,
  type PlanViewportState,
} from './pointerPlanMapping';

export type DesignSceneBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  center: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
  radius: number;
};

/** @deprecated Use DesignSceneBounds */
export type DesignLayoutBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  center: { x: number; y: number; z: number };
  width: number;
  depth: number;
  height: number;
};

export type CameraFit3d = {
  target: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  near: number;
  far: number;
};

type BoundsAccumulator = {
  xs: number[];
  ys: number[];
  zs: number[];
};

export function buildLayoutFramingKey(layoutEpoch: number, bounds: DesignSceneBounds | DesignLayoutBounds | null): string {
  if (!bounds) return `blank:${layoutEpoch}`;
  return `${layoutEpoch}:${bounds.minX.toFixed(3)}:${bounds.maxX.toFixed(3)}:${bounds.minZ.toFixed(3)}:${bounds.maxZ.toFixed(3)}`;
}

export function deriveDesignSceneBounds(params: {
  geometryResult?: DesignGeometryResult | null;
  wallLayout?: DesignWallLayoutParameters | null;
  slab?: ThickenedEdgeSlabParameters | null;
  roof?: GableRoofSystemParameters | null;
  truss?: SteelTrussSystemParameters | null;
  manualMasonryRuns?: readonly MasonryCourseRun[];
}): DesignSceneBounds | null {
  const acc: BoundsAccumulator = { xs: [], ys: [0], zs: [] };
  const wallThickness =
    params.wallLayout?.defaultWallThicknessMeters ??
    params.geometryResult?.wallCmuLayout.segmentFrames?.[0]?.wallThicknessMeters ??
    0.19;

  params.wallLayout?.nodes.forEach((node) => addPoint(acc, node.x, 0, node.z));
  params.manualMasonryRuns?.forEach((run) => addPoint(acc, run.originX, run.courseIndex * 0.2, run.originZ));

  const geometry = params.geometryResult;
  geometry?.resolvedFootprint?.exteriorFacePolygon.forEach((point) => addPoint(acc, point.x, 0, point.z));
  geometry?.resolvedFootprint?.interiorFacePolygon.forEach((point) => addPoint(acc, point.x, 0, point.z));
  geometry?.resolvedFootprint?.centerlinePolygon.forEach((point) => addPoint(acc, point.x, 0, point.z));

  geometry?.blockInstances.forEach((block) => {
    const halfLength = Math.max(0, block.lengthMeters) / 2;
    const halfDepth = Math.max(0, block.depthMeters ?? 0) / 2;
    addOrientedBox(
      acc,
      block.x,
      block.y,
      block.z,
      halfLength,
      Math.max(0, block.heightMeters ?? 0) / 2,
      halfDepth,
      block.rotationY,
    );
  });
  geometry?.wallSegments.forEach((segment) => {
    addOrientedBox(
      acc,
      segment.x,
      segment.y,
      segment.z,
      segment.lengthMeters / 2,
      segment.heightMeters / 2,
      segment.thicknessMeters / 2,
      segment.rotationY,
    );
  });
  geometry?.wallCmuLayout.lintels.forEach((lintel) => {
    addOrientedBox(acc, lintel.x, lintel.y, lintel.z, lintel.lengthMeters / 2, lintel.heightMeters / 2, 0.1, lintel.rotationY);
  });
  geometry?.wallCmuLayout.jambGroutCells.forEach((cell) => {
    addOrientedBox(acc, cell.x, cell.y, cell.z, cell.widthMeters / 2, cell.heightMeters / 2, 0.1, cell.rotationY);
  });
  geometry?.wallCmuLayout.groutFillPlacements.forEach((fill) => {
    addOrientedBox(
      acc,
      fill.center.x,
      fill.center.y,
      fill.center.z,
      fill.lengthMeters / 2,
      fill.heightMeters / 2,
      fill.depthMeters / 2,
      fill.rotationY,
    );
  });
  geometry?.wallCmuLayout.pilasters.forEach((pilaster) => {
    const halfSize = Math.max(0.05, wallThickness / 2);
    addOrientedBox(
      acc,
      pilaster.x,
      pilaster.y,
      pilaster.z,
      halfSize,
      pilaster.heightMeters / 2,
      halfSize,
      pilaster.rotationY,
    );
  });
  geometry?.wallCmuLayout.roughOpenings.forEach((opening) => {
    addRoughOpeningBounds(acc, opening, wallThickness);
  });

  geometry?.frameSystem?.columns.forEach((column) => {
    addAxisBox(
      acc,
      column.position.x,
      column.baseElevationMeters + column.heightMeters / 2,
      column.position.z,
      column.widthMeters / 2,
      column.heightMeters / 2,
      column.depthMeters / 2,
    );
  });
  geometry?.frameSystem?.beams.forEach((beam) => {
    const dx = beam.endPoint.x - beam.startPoint.x;
    const dz = beam.endPoint.z - beam.startPoint.z;
    const length = Math.hypot(dx, dz);
    if (length <= 0) return;
    const centerX = (beam.startPoint.x + beam.endPoint.x) / 2;
    const centerZ = (beam.startPoint.z + beam.endPoint.z) / 2;
    const centerY = beam.baseElevationMeters + beam.depthMeters / 2;
    addOrientedBox(acc, centerX, centerY, centerZ, length / 2, beam.depthMeters / 2, beam.widthMeters / 2, -Math.atan2(dz, dx));
  });
  geometry?.gablePlacements?.forEach((placement) => {
    addOrientedBox(
      acc,
      placement.x,
      placement.y,
      placement.z,
      placement.lengthMeters / 2,
      placement.heightMeters / 2,
      placement.depthMeters / 2,
      placement.rotationY,
    );
  });

  const slabThickness = params.slab?.slabThicknessMeters ?? 0.1;
  const resolvedRoof = geometry?.resolvedRoofSystem;
  if (resolvedRoof?.supported) {
    for (const point of resolvedRoof.eaveFootprint) {
      acc.xs.push(point.x);
      acc.zs.push(point.z);
      acc.ys.push(slabThickness + point.y);
    }
    acc.ys.push(slabThickness + resolvedRoof.roofPeakY);
    for (const plane of resolvedRoof.roofTopPlanes) {
      for (const corner of plane.corners) {
        acc.xs.push(corner.x);
        acc.zs.push(corner.z);
        acc.ys.push(slabThickness + corner.y);
      }
    }
  }

  const layoutGraphActive = geometry?.sourcePath === 'layout_graph';

  if (layoutGraphActive && geometry?.resolvedFootprint?.exteriorFacePolygon.length) {
    addSlabAndRoofFromFootprint(acc, geometry.resolvedFootprint.exteriorFacePolygon, slabThickness, params.roof, geometry.wallSegments);
  } else {
    if (geometry?.sourcePath !== 'layout_graph' && params.slab && params.slab.lengthMeters > 0 && params.slab.widthMeters > 0) {
      addAxisBox(acc, 0, slabThickness / 2, 0, params.slab.lengthMeters / 2, slabThickness / 2, params.slab.widthMeters / 2);
    }
    if (params.roof && params.roof.lengthMeters > 0 && params.roof.widthMeters > 0) {
      const roofBaseY = Math.max(...acc.ys, slabThickness);
      const ridgeHeight = (params.roof.widthMeters / 2 + params.roof.overhangMeters) * params.roof.pitchRisePerRun;
      addAxisBox(
        acc,
        0,
        roofBaseY + ridgeHeight / 2,
        0,
        (params.roof.lengthMeters + params.roof.overhangMeters * 2) / 2,
        ridgeHeight / 2,
        (params.roof.widthMeters + params.roof.overhangMeters * 2) / 2,
      );
    }
    if (params.truss && params.truss.buildingLengthMeters > 0) {
      const trussY = Math.max(...acc.ys, slabThickness);
      addAxisBox(acc, 0, trussY, 0, params.truss.buildingLengthMeters / 2, 0.1, Math.max(0.5, params.truss.spacingMeters));
    }
  }

  if (acc.xs.length === 0 || acc.zs.length === 0) return null;
  return makeBounds(acc);
}

/** @deprecated Use deriveDesignSceneBounds */
export function deriveDesignLayoutBounds(params: Parameters<typeof deriveDesignSceneBounds>[0]): DesignLayoutBounds | null {
  const bounds = deriveDesignSceneBounds(params);
  return bounds ? toPlainBounds(bounds) : null;
}

export function fitPlanToLayout(
  bounds: DesignSceneBounds | DesignLayoutBounds | null,
  surface: PlanSurfaceSize,
  padding = 0.18,
): PlanViewportState {
  if (!bounds) return resetPlanView();
  return fitPlanViewportToBounds(
    { minX: bounds.minX, maxX: bounds.maxX, minZ: bounds.minZ, maxZ: bounds.maxZ },
    surface,
    padding,
  );
}

export function resetPlanView(): PlanViewportState {
  return DEFAULT_PLAN_VIEWPORT;
}

export function fitPerspectiveCameraToBounds(params: {
  bounds: DesignSceneBounds | DesignLayoutBounds;
  camera: { fov: number; aspect: number };
  padding?: number;
}): CameraFit3d {
  const padding = params.padding ?? 1.2;
  const center = boundsCenter(params.bounds);
  const width = Math.max(params.bounds.width, 0.1);
  const depth = Math.max(params.bounds.depth, 0.1);
  const height = Math.max(params.bounds.height, 0.1);
  const radius =
    'radius' in params.bounds && Number.isFinite(params.bounds.radius)
      ? params.bounds.radius
      : Math.sqrt((width / 2) ** 2 + (depth / 2) ** 2 + (height / 2) ** 2);

  const halfFovRad = (params.camera.fov * Math.PI) / 180 / 2;
  const fitHorizontal = (Math.max(width, depth) * padding) / (2 * Math.tan(halfFovRad) * Math.max(params.camera.aspect, 0.01));
  const fitVertical = (height * padding) / (2 * Math.tan(halfFovRad));
  const fitRadius = (radius * padding) / Math.sin(halfFovRad);
  const distance = Math.max(fitHorizontal, fitVertical, fitRadius, 2);

  const target = {
    x: center.x,
    y: Math.max(0.8, center.y),
    z: center.z,
  };
  const viewDirection = new THREE.Vector3(0.65, 0.48, 0.72).normalize();
  return {
    target,
    position: {
      x: target.x + viewDirection.x * distance,
      y: target.y + viewDirection.y * distance,
      z: target.z + viewDirection.z * distance,
    },
    near: Math.max(0.01, radius / 1000),
    far: Math.max(1000, distance * 20 + radius * 4),
  };
}

export function fit3dToLayout(
  bounds: DesignSceneBounds | DesignLayoutBounds | null,
  options?: { padding?: number; camera?: { fov: number; aspect: number } },
): CameraFit3d {
  if (!bounds) return reset3dView();
  return fitPerspectiveCameraToBounds({
    bounds,
    camera: options?.camera ?? { fov: 45, aspect: 1 },
    padding: (options?.padding ?? 0.2) + 1,
  });
}

export function reset3dView(): CameraFit3d {
  return {
    target: { x: 0, y: 1.6, z: 0 },
    position: { x: 7.4, y: 5.2, z: 8.2 },
    near: 0.1,
    far: 1000,
  };
}

export function nextNiceGridSize(span: number): number {
  const raw = Math.max(5, span);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

export function getUsefulGridDivisions(gridSize: number, span: number): number {
  const targetCellSize = Math.max(0.25, span / 12);
  return Math.max(4, Math.min(100, Math.round(gridSize / targetCellSize)));
}

export function resolveSceneGridLayout(bounds: DesignSceneBounds | DesignLayoutBounds | null): {
  centerX: number;
  centerZ: number;
  gridSize: number;
  gridDivisions: number;
} {
  if (!bounds) {
    return { centerX: 0, centerZ: 0, gridSize: 14, gridDivisions: 28 };
  }
  const center = boundsCenter(bounds);
  const span = Math.max(bounds.width, bounds.depth, 5);
  const gridSize = nextNiceGridSize(span * 2);
  return {
    centerX: center.x,
    centerZ: center.z,
    gridSize,
    gridDivisions: getUsefulGridDivisions(gridSize, span),
  };
}

export function logDesignFramingDiagnostics(params: {
  mode: 'plan' | '3d';
  bounds: DesignSceneBounds | DesignLayoutBounds | null;
  cameraTargetX?: number;
  cameraTargetZ?: number;
}): void {
  if (!import.meta.env.DEV) return;
  const center = params.bounds ? boundsCenter(params.bounds) : { x: 0, y: 0, z: 0 };
  console.table({
    mode: params.mode,
    minX: params.bounds?.minX ?? 0,
    maxX: params.bounds?.maxX ?? 0,
    minZ: params.bounds?.minZ ?? 0,
    maxZ: params.bounds?.maxZ ?? 0,
    centerX: center.x,
    centerZ: center.z,
    width: params.bounds?.width ?? 0,
    depth: params.bounds?.depth ?? 0,
    cameraTargetX: params.cameraTargetX ?? center.x,
    cameraTargetZ: params.cameraTargetZ ?? center.z,
  });
}

function addRoughOpeningBounds(acc: BoundsAccumulator, opening: ResolvedCmuOpening, wallThickness: number): void {
  const layoutOpening = opening as ResolvedCmuOpening & { worldX?: number; worldZ?: number; rotationY?: number };
  const halfWidth = Math.max(0, opening.roughOpeningWidthMeters) / 2;
  const halfHeight = Math.max(0, opening.roughOpeningHeightMeters) / 2;
  const centerY = opening.roughBottomMeters + halfHeight;
  const halfDepth = Math.max(0.05, wallThickness / 2);

  if (typeof layoutOpening.worldX === 'number' && typeof layoutOpening.worldZ === 'number') {
    addOrientedBox(acc, layoutOpening.worldX, centerY, layoutOpening.worldZ, halfWidth, halfHeight, halfDepth, layoutOpening.rotationY ?? 0);
    return;
  }

  if (opening.wallFace === 'north' || opening.wallFace === 'south') {
    const x = (opening.roughStartAlongMeters + opening.roughEndAlongMeters) / 2;
    const z = opening.wallFace === 'north' ? 0 : 0;
    addOrientedBox(acc, x, centerY, z, halfWidth, halfHeight, halfDepth, 0);
  }
}

function addSlabAndRoofFromFootprint(
  acc: BoundsAccumulator,
  footprint: readonly { x: number; z: number }[],
  slabThickness: number,
  roof: GableRoofSystemParameters | null | undefined,
  wallSegments: DesignGeometryResult['wallSegments'],
): void {
  footprint.forEach((point) => addPoint(acc, point.x, slabThickness, point.z));
  if (!roof || roof.lengthMeters <= 0 || roof.widthMeters <= 0) return;

  const maxWallHeight = wallSegments.reduce((max, segment) => Math.max(max, segment.heightMeters), 0);
  const roofBaseY = slabThickness + maxWallHeight;
  const ridgeHeight = Math.max(0.1, (roof.widthMeters / 2 + roof.overhangMeters) * roof.pitchRisePerRun);
  footprint.forEach((point) => addPoint(acc, point.x, roofBaseY + ridgeHeight, point.z));
}

function boundsCenter(bounds: DesignSceneBounds | DesignLayoutBounds): { x: number; y: number; z: number } {
  if (bounds.center instanceof THREE.Vector3) {
    return { x: bounds.center.x, y: bounds.center.y, z: bounds.center.z };
  }
  return bounds.center;
}

function toPlainBounds(bounds: DesignSceneBounds): DesignLayoutBounds {
  return {
    minX: bounds.minX,
    maxX: bounds.maxX,
    minY: bounds.minY,
    maxY: bounds.maxY,
    minZ: bounds.minZ,
    maxZ: bounds.maxZ,
    center: { x: bounds.center.x, y: bounds.center.y, z: bounds.center.z },
    width: bounds.width,
    depth: bounds.depth,
    height: bounds.height,
  };
}

function addPoint(acc: BoundsAccumulator, x: number, y: number, z: number): void {
  if (![x, y, z].every(Number.isFinite)) return;
  acc.xs.push(x);
  acc.ys.push(y);
  acc.zs.push(z);
}

function addAxisBox(acc: BoundsAccumulator, x: number, y: number, z: number, halfX: number, halfY: number, halfZ: number): void {
  [-1, 1].forEach((sx) => [-1, 1].forEach((sy) => [-1, 1].forEach((sz) => addPoint(acc, x + sx * halfX, y + sy * halfY, z + sz * halfZ))));
}

function addOrientedBox(
  acc: BoundsAccumulator,
  x: number,
  y: number,
  z: number,
  halfLength: number,
  halfY: number,
  halfDepth: number,
  rotationY: number,
): void {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sy) =>
      [-1, 1].forEach((sz) => {
        const lx = sx * halfLength;
        const lz = sz * halfDepth;
        addPoint(acc, x + lx * cos - lz * sin, y + sy * halfY, z - lx * sin + lz * cos);
      }),
    ),
  );
}

function makeBounds(acc: BoundsAccumulator): DesignSceneBounds {
  const minX = Math.min(...acc.xs);
  const maxX = Math.max(...acc.xs);
  const minY = Math.min(...acc.ys);
  const maxY = Math.max(...acc.ys);
  const minZ = Math.min(...acc.zs);
  const maxZ = Math.max(...acc.zs);
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const height = maxY - minY;
  const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  const radius = Math.sqrt((width / 2) ** 2 + (depth / 2) ** 2 + (height / 2) ** 2);
  return { minX, maxX, minY, maxY, minZ, maxZ, center, width, depth, height, radius };
}
