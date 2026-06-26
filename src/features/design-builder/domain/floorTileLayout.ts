import type { FloorTilePlacement, InteriorFloorTileSettings, ResolvedFloorTileLayout } from '../types';
import {
  groutJointWidthMeters,
  resolveFloorTileSizePreset,
  resolveInteriorFloorTileSettings,
} from './floorTileCatalog';
import { polygonAreaSquareMeters } from './interiorFloorSlab';
import { resolveFloorTileQuantities } from './floorTileQuantities';

const TILE_AREA_EPSILON = 1e-6;
const GRID_SAMPLE_COUNT = 12;

type Point2D = { x: number; z: number };

function polygonCentroid(polygon: readonly Point2D[]): Point2D {
  if (polygon.length === 0) return { x: 0, z: 0 };
  let areaSum = 0;
  let cx = 0;
  let cz = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const cross = current.x * next.z - next.x * current.z;
    areaSum += cross;
    cx += (current.x + next.x) * cross;
    cz += (current.z + next.z) * cross;
  }
  if (Math.abs(areaSum) <= TILE_AREA_EPSILON) {
    const avgX = polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length;
    const avgZ = polygon.reduce((sum, point) => sum + point.z, 0) / polygon.length;
    return { x: avgX, z: avgZ };
  }
  const factor = 1 / (3 * areaSum);
  return { x: cx * factor, z: cz * factor };
}

function polygonBounds(polygon: readonly Point2D[]): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of polygon) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  return { minX, maxX, minZ, maxZ };
}

function distancePointToSegmentSquared(point: Point2D, start: Point2D, end: Point2D): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= TILE_AREA_EPSILON) {
    const deltaX = point.x - start.x;
    const deltaZ = point.z - start.z;
    return deltaX * deltaX + deltaZ * deltaZ;
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared),
  );
  const projectedX = start.x + t * dx;
  const projectedZ = start.z + t * dz;
  const deltaX = point.x - projectedX;
  const deltaZ = point.z - projectedZ;
  return deltaX * deltaX + deltaZ * deltaZ;
}

export function pointInOrOnPolygon(
  point: Point2D,
  polygon: readonly Point2D[],
  boundaryEpsilonMeters = 0.002,
): boolean {
  if (pointInPolygon(point, polygon)) return true;
  const boundaryEpsilonSquared = boundaryEpsilonMeters * boundaryEpsilonMeters;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    if (distancePointToSegmentSquared(point, start, end) <= boundaryEpsilonSquared) {
      return true;
    }
  }
  return false;
}

export function pointInPolygon(point: Point2D, polygon: readonly Point2D[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index]!;
    const prior = polygon[previous]!;
    const intersects =
      current.z > point.z !== prior.z > point.z &&
      point.x <
        ((prior.x - current.x) * (point.z - current.z)) / (prior.z - current.z + TILE_AREA_EPSILON) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function rectangleSamplePoints(center: Point2D, widthMeters: number, depthMeters: number): Point2D[] {
  const halfW = widthMeters / 2;
  const halfD = depthMeters / 2;
  const points: Point2D[] = [];
  for (let row = 0; row < GRID_SAMPLE_COUNT; row += 1) {
    for (let col = 0; col < GRID_SAMPLE_COUNT; col += 1) {
      const u = (col + 0.5) / GRID_SAMPLE_COUNT;
      const v = (row + 0.5) / GRID_SAMPLE_COUNT;
      points.push({
        x: center.x - halfW + u * widthMeters,
        z: center.z - halfD + v * depthMeters,
      });
    }
  }
  return points;
}

function estimateRectanglePolygonIntersectionArea(params: {
  center: Point2D;
  widthMeters: number;
  depthMeters: number;
  polygon: readonly Point2D[];
}): { areaSquareMeters: number; insideSampleCount: number; totalSampleCount: number } {
  const samples = rectangleSamplePoints(params.center, params.widthMeters, params.depthMeters);
  let insideSampleCount = 0;
  for (const sample of samples) {
    if (pointInPolygon(sample, params.polygon)) insideSampleCount += 1;
  }
  const nominalArea = params.widthMeters * params.depthMeters;
  return {
    areaSquareMeters: (insideSampleCount / samples.length) * nominalArea,
    insideSampleCount,
    totalSampleCount: samples.length,
  };
}

function isEdgeInside(
  polygon: readonly Point2D[],
  edge: 'left' | 'right' | 'bottom' | 'top',
  left: number,
  right: number,
  bottom: number,
  top: number,
): boolean {
  const edgeSampleCount = 6;
  for (let index = 0; index <= edgeSampleCount; index += 1) {
    const t = index / edgeSampleCount;
    const point =
      edge === 'left'
        ? { x: left, z: bottom + t * (top - bottom) }
        : edge === 'right'
          ? { x: right, z: bottom + t * (top - bottom) }
          : edge === 'bottom'
            ? { x: left + t * (right - left), z: bottom }
            : { x: left + t * (right - left), z: top };
    if (!pointInOrOnPolygon(point, polygon)) return false;
  }
  return true;
}

function isRectangleInside(
  polygon: readonly Point2D[],
  left: number,
  right: number,
  bottom: number,
  top: number,
): boolean {
  return (
    isEdgeInside(polygon, 'left', left, right, bottom, top) &&
    isEdgeInside(polygon, 'right', left, right, bottom, top) &&
    isEdgeInside(polygon, 'bottom', left, right, bottom, top) &&
    isEdgeInside(polygon, 'top', left, right, bottom, top)
  );
}

function resolveClippedTileBounds(params: {
  center: Point2D;
  widthMeters: number;
  depthMeters: number;
  polygon: readonly Point2D[];
}): { left: number; right: number; bottom: number; top: number } {
  const halfW = params.widthMeters / 2;
  const halfD = params.depthMeters / 2;
  const nominalLeft = params.center.x - halfW;
  const nominalRight = params.center.x + halfW;
  const nominalBottom = params.center.z - halfD;
  const nominalTop = params.center.z + halfD;
  let left = nominalLeft;
  let right = nominalRight;
  let bottom = nominalBottom;
  let top = nominalTop;

  const bounds = polygonBounds(params.polygon);

  // Trim each wall side independently so corner modules keep field-side grout spacing.
  if (nominalLeft < bounds.minX - TILE_AREA_EPSILON) {
    left = bounds.minX;
  }
  if (nominalRight > bounds.maxX + TILE_AREA_EPSILON) {
    right = bounds.maxX;
  }
  if (nominalBottom < bounds.minZ - TILE_AREA_EPSILON) {
    bottom = bounds.minZ;
  }
  if (nominalTop > bounds.maxZ + TILE_AREA_EPSILON) {
    top = bounds.maxZ;
  }

  if (!isRectangleInside(params.polygon, left, right, bottom, top)) {
    for (let index = 0; index < params.polygon.length; index += 1) {
      const start = params.polygon[index]!;
      const end = params.polygon[(index + 1) % params.polygon.length]!;
      if (Math.abs(start.x - end.x) <= TILE_AREA_EPSILON) {
        const wallX = (start.x + end.x) / 2;
        if (nominalLeft < wallX - TILE_AREA_EPSILON && right > wallX + TILE_AREA_EPSILON) {
          left = Math.max(left, wallX);
        } else if (nominalRight > wallX + TILE_AREA_EPSILON && left < wallX - TILE_AREA_EPSILON) {
          right = Math.min(right, wallX);
        }
      } else if (Math.abs(start.z - end.z) <= TILE_AREA_EPSILON) {
        const wallZ = (start.z + end.z) / 2;
        if (nominalBottom < wallZ - TILE_AREA_EPSILON && top > wallZ + TILE_AREA_EPSILON) {
          bottom = Math.max(bottom, wallZ);
        } else if (nominalTop > wallZ + TILE_AREA_EPSILON && bottom < wallZ - TILE_AREA_EPSILON) {
          top = Math.min(top, wallZ);
        }
      }
    }
  }

  return { left, right, bottom, top };
}

/** Clip only edges that cross the floor boundary; preserve nominal edges facing the field. */
export function computeTileRenderBounds(params: {
  center: Point2D;
  widthMeters: number;
  depthMeters: number;
  polygon: readonly Point2D[];
}): { renderCenter: Point2D; renderWidthMeters: number; renderDepthMeters: number } | null {
  const { left, right, bottom, top } = resolveClippedTileBounds(params);

  const renderWidthMeters = Math.max(0, right - left);
  const renderDepthMeters = Math.max(0, top - bottom);
  if (renderWidthMeters <= TILE_AREA_EPSILON || renderDepthMeters <= TILE_AREA_EPSILON) {
    return null;
  }
  if (!isRectangleInside(params.polygon, left, right, bottom, top)) {
    return null;
  }

  return {
    renderCenter: { x: (left + right) / 2, z: (bottom + top) / 2 },
    renderWidthMeters,
    renderDepthMeters,
  };
}

function createEmptyLayout(
  settings: InteriorFloorTileSettings,
  floorAreaSquareMeters: number,
): ResolvedFloorTileLayout {
  const preset = resolveFloorTileSizePreset(settings.tileSizeKey);
  const groutJointMeters = groutJointWidthMeters(settings.groutJointWidth);
  return {
    enabled: false,
    tileSizeKey: settings.tileSizeKey,
    tileWidthMeters: preset.widthMeters,
    tileDepthMeters: preset.depthMeters,
    groutJointMeters,
    thinsetThicknessMeters: settings.thinsetThicknessMeters,
    wasteFactor: settings.wasteFactor,
    floorAreaSquareMeters,
    installedAreaSquareMeters: 0,
    fullTileCount: 0,
    cutTileCount: 0,
    totalTileCount: 0,
    orderTileCount: 0,
    thinsetVolumeCubicMeters: 0,
    thinsetBags: 0,
    groutVolumeCubicMeters: 0,
    groutBags: 0,
    placements: [],
  };
}

export function resolveFloorTileLayout(params: {
  interiorFacePolygon: readonly Point2D[];
  floorTileFinish: Partial<InteriorFloorTileSettings> | undefined;
  interiorFloorSlabEnabled: boolean;
}): ResolvedFloorTileLayout {
  const settings = resolveInteriorFloorTileSettings(params.floorTileFinish);
  const floorAreaSquareMeters = polygonAreaSquareMeters(params.interiorFacePolygon);
  if (!params.interiorFloorSlabEnabled || !settings.enabled || params.interiorFacePolygon.length < 3) {
    return createEmptyLayout(settings, floorAreaSquareMeters);
  }

  const preset = resolveFloorTileSizePreset(settings.tileSizeKey);
  const groutJointMeters = groutJointWidthMeters(settings.groutJointWidth);
  const pitchX = preset.widthMeters + groutJointMeters;
  const pitchZ = preset.depthMeters + groutJointMeters;
  if (pitchX <= 0 || pitchZ <= 0) {
    return createEmptyLayout(settings, floorAreaSquareMeters);
  }

  const centroid = polygonCentroid(params.interiorFacePolygon);
  const bounds = polygonBounds(params.interiorFacePolygon);
  const minIndexX = Math.floor((bounds.minX - centroid.x) / pitchX) - 1;
  const maxIndexX = Math.ceil((bounds.maxX - centroid.x) / pitchX) + 1;
  const minIndexZ = Math.floor((bounds.minZ - centroid.z) / pitchZ) - 1;
  const maxIndexZ = Math.ceil((bounds.maxZ - centroid.z) / pitchZ) + 1;

  const placements: FloorTilePlacement[] = [];
  let fullTileCount = 0;
  let cutTileCount = 0;
  let placementIndex = 0;

  for (let indexZ = minIndexZ; indexZ <= maxIndexZ; indexZ += 1) {
    for (let indexX = minIndexX; indexX <= maxIndexX; indexX += 1) {
      const center = {
        x: centroid.x + indexX * pitchX,
        z: centroid.z + indexZ * pitchZ,
      };
      const intersection = estimateRectanglePolygonIntersectionArea({
        center,
        widthMeters: preset.widthMeters,
        depthMeters: preset.depthMeters,
        polygon: params.interiorFacePolygon,
      });
      if (intersection.areaSquareMeters <= TILE_AREA_EPSILON) continue;

      const renderBounds = computeTileRenderBounds({
        center,
        widthMeters: preset.widthMeters,
        depthMeters: preset.depthMeters,
        polygon: params.interiorFacePolygon,
      });
      if (!renderBounds) continue;

      const isFull =
        renderBounds.renderWidthMeters >= preset.widthMeters - TILE_AREA_EPSILON &&
        renderBounds.renderDepthMeters >= preset.depthMeters - TILE_AREA_EPSILON;
      const kind = isFull ? 'full' : 'cut';
      if (kind === 'full') fullTileCount += 1;
      else cutTileCount += 1;
      const tileInstalledAreaSquareMeters =
        renderBounds.renderWidthMeters * renderBounds.renderDepthMeters;
      placements.push({
        id: `floor-tile-${placementIndex}`,
        kind,
        center,
        widthMeters: preset.widthMeters,
        depthMeters: preset.depthMeters,
        renderCenter: renderBounds.renderCenter,
        renderWidthMeters: renderBounds.renderWidthMeters,
        renderDepthMeters: renderBounds.renderDepthMeters,
        installedAreaSquareMeters: tileInstalledAreaSquareMeters,
        rotationY: 0,
      });
      placementIndex += 1;
    }
  }

  const quantities = resolveFloorTileQuantities({
    floorAreaSquareMeters,
    installedAreaSquareMeters: floorAreaSquareMeters,
    fullTileCount,
    cutTileCount,
    tileWidthMeters: preset.widthMeters,
    tileDepthMeters: preset.depthMeters,
    groutJointMeters,
    thinsetThicknessMeters: settings.thinsetThicknessMeters,
    wasteFactor: settings.wasteFactor,
  });

  return {
    enabled: true,
    tileSizeKey: settings.tileSizeKey,
    tileWidthMeters: preset.widthMeters,
    tileDepthMeters: preset.depthMeters,
    groutJointMeters,
    thinsetThicknessMeters: settings.thinsetThicknessMeters,
    wasteFactor: settings.wasteFactor,
    floorAreaSquareMeters,
    installedAreaSquareMeters: floorAreaSquareMeters,
    fullTileCount,
    cutTileCount,
    totalTileCount: fullTileCount + cutTileCount,
    orderTileCount: quantities.orderTileCount,
    thinsetVolumeCubicMeters: quantities.thinsetVolumeCubicMeters,
    thinsetBags: quantities.thinsetBags,
    groutVolumeCubicMeters: quantities.groutVolumeCubicMeters,
    groutBags: quantities.groutBags,
    placements,
  };
}
