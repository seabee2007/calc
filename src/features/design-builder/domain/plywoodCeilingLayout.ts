import type {
  PlywoodCeilingMemberPlacement,
  PlywoodCeilingPanelPlacement,
  PlywoodCeilingSettings,
  ResolvedPlywoodCeilingLayout,
} from '../types';
import { polygonAreaSquareMeters } from './interiorFloorSlab';
import { resolvePlywoodCeilingSettings } from './plywoodCeilingCatalog';

const AREA_EPSILON = 1e-6;

type Point2D = { x: number; z: number };

function polygonBounds(polygon: readonly Point2D[]): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
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

function buildBraceStations(min: number, max: number, spacingMeters: number): number[] {
  if (max - min <= AREA_EPSILON || spacingMeters <= AREA_EPSILON) {
    return [(min + max) / 2];
  }
  const stations: number[] = [min];
  let station = min + spacingMeters;
  while (station < max - spacingMeters * 0.25) {
    stations.push(station);
    station += spacingMeters;
  }
  if (Math.abs(stations[stations.length - 1]! - max) > AREA_EPSILON) {
    stations.push(max);
  }
  return stations;
}

function createFrameMember(params: {
  id: string;
  kind: PlywoodCeilingMemberPlacement['kind'];
  start: { x: number; z: number };
  end: { x: number; z: number };
  frameCenterY: number;
  tubeSizeMeters: number;
}): PlywoodCeilingMemberPlacement {
  return {
    id: params.id,
    kind: params.kind,
    start: { x: params.start.x, y: params.frameCenterY, z: params.start.z },
    end: { x: params.end.x, y: params.frameCenterY, z: params.end.z },
    widthMeters: params.tubeSizeMeters,
    heightMeters: params.tubeSizeMeters,
  };
}

function createEmptyLayout(
  settings: PlywoodCeilingSettings,
  ceilingAreaSquareMeters: number,
  warnings: string[] = [],
): ResolvedPlywoodCeilingLayout {
  return {
    enabled: false,
    ceilingHeightMeters: settings.ceilingHeightMeters,
    frameBottomElevationMeters: settings.ceilingHeightMeters,
    plywoodColor: settings.plywoodColor,
    sheetWidthMeters: settings.sheetWidthMeters,
    sheetLengthMeters: settings.sheetLengthMeters,
    sheetThicknessMeters: settings.sheetThicknessMeters,
    braceSpacingMeters: settings.braceSpacingMeters,
    tubeSizeMeters: settings.tubeSizeMeters,
    ceilingAreaSquareMeters,
    fullPanelCount: 0,
    cutPanelCount: 0,
    totalPanelCount: 0,
    orderPanelCount: 0,
    longAxis: 'x',
    shortSpanMeters: 0,
    longSpanMeters: 0,
    warnings,
    frameMembers: [],
    panelPlacements: [],
  };
}

export function resolvePlywoodCeilingLayout(params: {
  interiorFacePolygon: readonly Point2D[];
  plywoodCeiling: Partial<PlywoodCeilingSettings> | undefined;
  maxCeilingHeightMeters?: number;
}): ResolvedPlywoodCeilingLayout {
  const settings = resolvePlywoodCeilingSettings(params.plywoodCeiling);
  const ceilingAreaSquareMeters = polygonAreaSquareMeters(params.interiorFacePolygon);
  if (!settings.enabled || params.interiorFacePolygon.length < 3) {
    return createEmptyLayout(settings, ceilingAreaSquareMeters);
  }

  const bounds = polygonBounds(params.interiorFacePolygon);
  const rawWidthX = bounds.maxX - bounds.minX;
  const rawWidthZ = bounds.maxZ - bounds.minZ;
  if (rawWidthX <= AREA_EPSILON || rawWidthZ <= AREA_EPSILON) {
    return createEmptyLayout(settings, ceilingAreaSquareMeters, ['Building footprint is too small for a plywood ceiling.']);
  }

  const warnings: string[] = [];
  let frameBottomElevationMeters = settings.ceilingHeightMeters;
  if (params.maxCeilingHeightMeters != null && frameBottomElevationMeters > params.maxCeilingHeightMeters) {
    frameBottomElevationMeters = params.maxCeilingHeightMeters;
    warnings.push('Ceiling height was clamped to the available interior clear height.');
  }

  const inset = settings.tubeSizeMeters / 2;
  const minX = bounds.minX + inset;
  const maxX = bounds.maxX - inset;
  const minZ = bounds.minZ + inset;
  const maxZ = bounds.maxZ - inset;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  if (spanX <= AREA_EPSILON || spanZ <= AREA_EPSILON) {
    return createEmptyLayout(settings, ceilingAreaSquareMeters, ['Interior span is too narrow for a plywood ceiling frame.']);
  }

  const longAxis: 'x' | 'z' = spanX >= spanZ ? 'x' : 'z';
  const longSpanMeters = longAxis === 'x' ? spanX : spanZ;
  const shortSpanMeters = longAxis === 'x' ? spanZ : spanX;
  const longMin = longAxis === 'x' ? minX : minZ;
  const longMax = longAxis === 'x' ? maxX : maxZ;
  const shortMin = longAxis === 'x' ? minZ : minX;
  const shortMax = longAxis === 'x' ? maxZ : maxX;

  const frameCenterY = frameBottomElevationMeters + settings.tubeSizeMeters / 2;
  const panelCenterY = frameBottomElevationMeters - settings.sheetThicknessMeters / 2 - 0.0005;
  const toWorld = (long: number, shortPos: number): Point2D =>
    longAxis === 'x' ? { x: long, z: shortPos } : { x: shortPos, z: long };

  const frameMembers: PlywoodCeilingMemberPlacement[] = [];
  const cornerA = toWorld(longMin, shortMin);
  const cornerB = toWorld(longMax, shortMin);
  const cornerC = toWorld(longMax, shortMax);
  const cornerD = toWorld(longMin, shortMax);

  frameMembers.push(
    createFrameMember({
      id: 'plywood-ceiling-perimeter-short-0',
      kind: 'perimeter',
      start: cornerA,
      end: cornerB,
      frameCenterY,
      tubeSizeMeters: settings.tubeSizeMeters,
    }),
    createFrameMember({
      id: 'plywood-ceiling-perimeter-long-1',
      kind: 'perimeter',
      start: cornerB,
      end: cornerC,
      frameCenterY,
      tubeSizeMeters: settings.tubeSizeMeters,
    }),
    createFrameMember({
      id: 'plywood-ceiling-perimeter-short-2',
      kind: 'perimeter',
      start: cornerC,
      end: cornerD,
      frameCenterY,
      tubeSizeMeters: settings.tubeSizeMeters,
    }),
    createFrameMember({
      id: 'plywood-ceiling-perimeter-long-3',
      kind: 'perimeter',
      start: cornerD,
      end: cornerA,
      frameCenterY,
      tubeSizeMeters: settings.tubeSizeMeters,
    }),
  );

  const braceStations = buildBraceStations(longMin, longMax, settings.braceSpacingMeters);
  braceStations.forEach((station, index) => {
    const start = toWorld(station, shortMin);
    const end = toWorld(station, shortMax);
    frameMembers.push(
      createFrameMember({
        id: `plywood-ceiling-brace-${index}`,
        kind: 'cross_brace',
        start,
        end,
        frameCenterY,
        tubeSizeMeters: settings.tubeSizeMeters * 0.85,
      }),
    );
  });

  const pitchLong = settings.sheetLengthMeters + settings.panelGapMeters;
  const pitchShort = settings.sheetWidthMeters + settings.panelGapMeters;
  const panelPlacements: PlywoodCeilingPanelPlacement[] = [];
  let fullPanelCount = 0;
  let cutPanelCount = 0;
  let placementIndex = 0;

  const rowCount = Math.ceil((shortSpanMeters + settings.panelGapMeters) / pitchShort);
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowShortStart = shortMin + rowIndex * pitchShort;
    const rowShortEnd = Math.min(rowShortStart + settings.sheetWidthMeters, shortMax);
    const rowShortSize = rowShortEnd - rowShortStart;
    if (rowShortSize <= AREA_EPSILON) continue;

    const rowShortCenter = (rowShortStart + rowShortEnd) / 2;
    const rowStagger = rowIndex % 2 === 1 ? settings.staggerOffsetMeters : 0;
    const panelStartLong = longMin - rowStagger;
    const panelEndLong = longMax;
    const panelSpan = panelEndLong - panelStartLong;
    const colCount = Math.ceil((panelSpan + settings.panelGapMeters) / pitchLong);

    for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
      const panelLongStart = panelStartLong + colIndex * pitchLong;
      const panelLongEnd = Math.min(panelLongStart + settings.sheetLengthMeters, longMax);
      if (panelLongEnd <= longMin + AREA_EPSILON || panelLongStart >= longMax - AREA_EPSILON) {
        continue;
      }
      const clippedLongStart = Math.max(panelLongStart, longMin);
      const clippedLongEnd = Math.min(panelLongEnd, longMax);
      const panelLongSize = clippedLongEnd - clippedLongStart;
      if (panelLongSize <= AREA_EPSILON) continue;

      const isFull =
        Math.abs(panelLongSize - settings.sheetLengthMeters) <= 0.002 &&
        Math.abs(rowShortSize - settings.sheetWidthMeters) <= 0.002;
      if (isFull) fullPanelCount += 1;
      else cutPanelCount += 1;

      const centerLong = (clippedLongStart + clippedLongEnd) / 2;
      const center = toWorld(centerLong, rowShortCenter);
      panelPlacements.push({
        id: `plywood-ceiling-panel-${placementIndex}`,
        kind: isFull ? 'full' : 'cut',
        center: { x: center.x, y: panelCenterY, z: center.z },
        widthMeters: longAxis === 'x' ? panelLongSize : rowShortSize,
        lengthMeters: longAxis === 'x' ? rowShortSize : panelLongSize,
        thicknessMeters: settings.sheetThicknessMeters,
      });
      placementIndex += 1;
    }
  }

  const totalPanelCount = fullPanelCount + cutPanelCount;
  const orderPanelCount = Math.ceil(totalPanelCount * (1 + settings.wasteFactor));

  return {
    enabled: true,
    ceilingHeightMeters: settings.ceilingHeightMeters,
    frameBottomElevationMeters,
    plywoodColor: settings.plywoodColor,
    sheetWidthMeters: settings.sheetWidthMeters,
    sheetLengthMeters: settings.sheetLengthMeters,
    sheetThicknessMeters: settings.sheetThicknessMeters,
    braceSpacingMeters: settings.braceSpacingMeters,
    tubeSizeMeters: settings.tubeSizeMeters,
    ceilingAreaSquareMeters,
    fullPanelCount,
    cutPanelCount,
    totalPanelCount,
    orderPanelCount,
    longAxis,
    shortSpanMeters,
    longSpanMeters,
    warnings,
    frameMembers,
    panelPlacements,
  };
}
