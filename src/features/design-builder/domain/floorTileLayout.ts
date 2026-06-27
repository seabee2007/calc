import type { FloorTilePlacement, InteriorFloorTileSettings, ResolvedFloorTileLayout } from '../types';
import {
  groutJointWidthMeters,
  resolveFloorTileSizePreset,
  resolveInteriorFloorTileSettings,
} from './floorTileCatalog';
import { polygonAreaSquareMeters } from './interiorFloorSlab';
import { resolveFloorTileQuantities } from './floorTileQuantities';

const TILE_AREA_EPSILON = 1e-6;

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

function signedPolygonAreaSquareMeters(polygon: readonly Point2D[]): number {
  let area = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    area += current.x * next.z - next.x * current.z;
  }
  return area / 2;
}

function clippedPolygonAreaSquareMeters(polygon: readonly Point2D[]): number {
  return Math.abs(signedPolygonAreaSquareMeters(polygon));
}

type TileClipBoundary = 'left' | 'right' | 'bottom' | 'top';

function isInsideClipBoundary(point: Point2D, boundary: TileClipBoundary, value: number): boolean {
  switch (boundary) {
    case 'left':
      return point.x >= value - TILE_AREA_EPSILON;
    case 'right':
      return point.x <= value + TILE_AREA_EPSILON;
    case 'bottom':
      return point.z >= value - TILE_AREA_EPSILON;
    case 'top':
      return point.z <= value + TILE_AREA_EPSILON;
  }
}

function intersectSegmentWithClipBoundary(
  start: Point2D,
  end: Point2D,
  boundary: TileClipBoundary,
  value: number,
): Point2D {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const denominator = boundary === 'left' || boundary === 'right' ? dx : dz;
  if (Math.abs(denominator) <= TILE_AREA_EPSILON) {
    return { ...end };
  }
  const t = ((boundary === 'left' || boundary === 'right' ? value - start.x : value - start.z) / denominator);
  return {
    x: start.x + dx * t,
    z: start.z + dz * t,
  };
}

function pushDistinctPoint(points: Point2D[], point: Point2D): void {
  const prior = points.at(-1);
  if (
    prior &&
    Math.abs(prior.x - point.x) <= TILE_AREA_EPSILON &&
    Math.abs(prior.z - point.z) <= TILE_AREA_EPSILON
  ) {
    return;
  }
  points.push(point);
}

function clipPolygonAgainstBoundary(
  polygon: readonly Point2D[],
  boundary: TileClipBoundary,
  value: number,
): Point2D[] {
  if (polygon.length === 0) return [];
  const clipped: Point2D[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const previous = polygon[(index + polygon.length - 1) % polygon.length]!;
    const currentInside = isInsideClipBoundary(current, boundary, value);
    const previousInside = isInsideClipBoundary(previous, boundary, value);
    if (currentInside) {
      if (!previousInside) {
        pushDistinctPoint(clipped, intersectSegmentWithClipBoundary(previous, current, boundary, value));
      }
      pushDistinctPoint(clipped, current);
    } else if (previousInside) {
      pushDistinctPoint(clipped, intersectSegmentWithClipBoundary(previous, current, boundary, value));
    }
  }
  const first = clipped[0];
  const last = clipped.at(-1);
  if (
    first &&
    last &&
    Math.abs(first.x - last.x) <= TILE_AREA_EPSILON &&
    Math.abs(first.z - last.z) <= TILE_AREA_EPSILON
  ) {
    clipped.pop();
  }
  return clipped;
}

function clipPolygonToTileRectangle(
  polygon: readonly Point2D[],
  left: number,
  right: number,
  bottom: number,
  top: number,
): Point2D[] {
  return [
    ['left', left],
    ['right', right],
    ['bottom', bottom],
    ['top', top],
  ].reduce(
    (subject, [boundary, value]) =>
      clipPolygonAgainstBoundary(subject, boundary as TileClipBoundary, value as number),
    [...polygon],
  );
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

/** Clip only edges that cross the floor boundary; preserve nominal edges facing the field. */
export function computeTileRenderBounds(params: {
  center: Point2D;
  widthMeters: number;
  depthMeters: number;
  polygon: readonly Point2D[];
}): {
  renderCenter: Point2D;
  renderWidthMeters: number;
  renderDepthMeters: number;
  renderPolygon: Point2D[];
  installedAreaSquareMeters: number;
} | null {
  const halfW = params.widthMeters / 2;
  const halfD = params.depthMeters / 2;
  const left = params.center.x - halfW;
  const right = params.center.x + halfW;
  const bottom = params.center.z - halfD;
  const top = params.center.z + halfD;
  const renderPolygon = clipPolygonToTileRectangle(params.polygon, left, right, bottom, top);
  if (renderPolygon.length < 3) {
    return null;
  }
  const installedAreaSquareMeters = clippedPolygonAreaSquareMeters(renderPolygon);
  if (installedAreaSquareMeters <= TILE_AREA_EPSILON) {
    return null;
  }
  const bounds = polygonBounds(renderPolygon);
  const renderWidthMeters = Math.max(0, bounds.maxX - bounds.minX);
  const renderDepthMeters = Math.max(0, bounds.maxZ - bounds.minZ);

  return {
    renderCenter: { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 },
    renderWidthMeters,
    renderDepthMeters,
    renderPolygon,
    installedAreaSquareMeters,
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
      placements.push({
        id: `floor-tile-${placementIndex}`,
        kind,
        center,
        widthMeters: preset.widthMeters,
        depthMeters: preset.depthMeters,
        renderCenter: renderBounds.renderCenter,
        renderWidthMeters: renderBounds.renderWidthMeters,
        renderDepthMeters: renderBounds.renderDepthMeters,
        renderPolygon: renderBounds.renderPolygon,
        installedAreaSquareMeters: renderBounds.installedAreaSquareMeters,
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
