import type {
  DesignGeometryResult,
  DesignGeometryPoint,
} from '../geometry/designGeometry';
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

export function deriveDesignLayoutBounds(params: {
  geometryResult?: DesignGeometryResult | null;
  wallLayout?: DesignWallLayoutParameters | null;
  slab?: ThickenedEdgeSlabParameters | null;
  roof?: GableRoofSystemParameters | null;
  truss?: SteelTrussSystemParameters | null;
  manualMasonryRuns?: readonly MasonryCourseRun[];
}): DesignLayoutBounds | null {
  const acc: BoundsAccumulator = { xs: [], ys: [0], zs: [] };
  params.wallLayout?.nodes.forEach((node) => addPoint(acc, node.x, 0, node.z));
  params.manualMasonryRuns?.forEach((run) => addPoint(acc, run.originX, run.courseIndex * 0.2, run.originZ));

  const geometry = params.geometryResult;
  geometry?.resolvedFootprint?.exteriorFacePolygon.forEach((point) => addPoint(acc, point.x, 0, point.z));
  geometry?.resolvedFootprint?.interiorFacePolygon.forEach((point) => addPoint(acc, point.x, 0, point.z));
  geometry?.blockInstances.forEach((block) => {
    const halfLength = Math.max(0, block.lengthMeters) / 2;
    const halfDepth = Math.max(0, block.depthMeters ?? 0) / 2;
    addOrientedBox(acc, block.x, block.y, block.z, halfLength, Math.max(0, block.heightMeters ?? 0) / 2, halfDepth, block.rotationY);
  });
  geometry?.wallSegments.forEach((segment) => {
    addOrientedBox(acc, segment.x, segment.y, segment.z, segment.lengthMeters / 2, segment.heightMeters / 2, segment.thicknessMeters / 2, segment.rotationY);
  });
  geometry?.wallCmuLayout.lintels.forEach((lintel) => {
    addOrientedBox(acc, lintel.x, lintel.y, lintel.z, lintel.lengthMeters / 2, lintel.heightMeters / 2, 0.1, lintel.rotationY);
  });
  geometry?.wallCmuLayout.jambGroutCells.forEach((cell) => {
    addOrientedBox(acc, cell.x, cell.y, cell.z, cell.widthMeters / 2, cell.heightMeters / 2, 0.1, cell.rotationY);
  });

  if (geometry?.sourcePath !== 'layout_graph' && params.slab && params.slab.lengthMeters > 0 && params.slab.widthMeters > 0) {
    addAxisBox(acc, 0, params.slab.slabThicknessMeters / 2, 0, params.slab.lengthMeters / 2, params.slab.slabThicknessMeters / 2, params.slab.widthMeters / 2);
  }
  if (params.roof && params.roof.lengthMeters > 0 && params.roof.widthMeters > 0) {
    addAxisBox(acc, 0, Math.max(...acc.ys, 0), 0, (params.roof.lengthMeters + params.roof.overhangMeters * 2) / 2, 0.1, (params.roof.widthMeters + params.roof.overhangMeters * 2) / 2);
  }
  if (params.truss && params.truss.buildingLengthMeters > 0) {
    addAxisBox(acc, 0, Math.max(...acc.ys, 0), 0, params.truss.buildingLengthMeters / 2, 0.1, Math.max(0.5, params.truss.spacingMeters));
  }

  if (acc.xs.length === 0 || acc.zs.length === 0) return null;
  return makeBounds(acc);
}

export function fitPlanToLayout(
  bounds: DesignLayoutBounds | null,
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

export function fit3dToLayout(bounds: DesignLayoutBounds | null, padding = 0.2): CameraFit3d {
  if (!bounds) return reset3dView();
  const span = Math.max(bounds.width, bounds.depth, bounds.height, 1);
  const distance = span * (1.45 + padding);
  const target = {
    x: bounds.center.x,
    y: Math.max(0.8, bounds.center.y),
    z: bounds.center.z,
  };
  return {
    target,
    position: {
      x: target.x + distance * 0.82,
      y: target.y + distance * 0.62,
      z: target.z + distance * 0.92,
    },
    near: Math.max(0.01, span / 1000),
    far: Math.max(1000, span * 20),
  };
}

export function reset3dView(): CameraFit3d {
  return {
    target: { x: 0, y: 1.6, z: 0 },
    position: { x: 7.4, y: 5.2, z: 8.2 },
    near: 0.1,
    far: 1000,
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

function addOrientedBox(acc: BoundsAccumulator, x: number, y: number, z: number, halfLength: number, halfY: number, halfDepth: number, rotationY: number): void {
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

function makeBounds(acc: BoundsAccumulator): DesignLayoutBounds {
  const minX = Math.min(...acc.xs);
  const maxX = Math.max(...acc.xs);
  const minY = Math.min(...acc.ys);
  const maxY = Math.max(...acc.ys);
  const minZ = Math.min(...acc.zs);
  const maxZ = Math.max(...acc.zs);
  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    width: maxX - minX,
    depth: maxZ - minZ,
    height: maxY - minY,
  };
}
