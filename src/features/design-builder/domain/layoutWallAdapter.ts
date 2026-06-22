import type { CmuBuildingPreset } from './designBuilderPreset';
import type {
  CmuWallSystemParameters,
  DesignWallLayoutParameters,
  GableRoofSystemParameters,
  ThickenedEdgeSlabParameters,
  WallOpeningParameters,
} from '../types';
import { generateWallCorners } from './cornerBondEngine';
import { normalizeOpeningsHeadAlignment } from './openingDefaults';
import {
  createOutsideFaceRectangleLayout,
  deriveExteriorBounds,
  migrateOpeningToSegment,
  segmentAngleRadians,
  segmentLength,
} from './wallLayoutRules';

export function layoutFromPreset(preset: CmuBuildingPreset): DesignWallLayoutParameters {
  return createOutsideFaceRectangleLayout({
    lengthMeters: preset.footprint.lengthMeters,
    widthMeters: preset.footprint.widthMeters,
    wallHeightMeters: preset.wall.heightMeters,
    wallThicknessMeters: preset.wall.wallThicknessMeters,
  });
}

export function syncPresetFromLayout(
  preset: CmuBuildingPreset,
  layout: DesignWallLayoutParameters,
): CmuBuildingPreset {
  const bounds = deriveExteriorBounds(layout);
  const lengthMeters = bounds?.exteriorLengthMeters ?? preset.footprint.lengthMeters;
  const widthMeters = bounds?.exteriorWidthMeters ?? preset.footprint.widthMeters;
  const migratedOpenings = normalizeOpeningsHeadAlignment(
    preset.wall.openings.map((opening) => migrateOpeningToSegment(opening, layout, preset.wall)),
  );
  const closed = layout.isFootprintClosed;
  return {
    ...preset,
    footprint: {
      kind: 'rectangle',
      lengthMeters,
      widthMeters,
    },
    wall: {
      ...preset.wall,
      lengthMeters,
      widthMeters,
      heightMeters: layout.defaultWallHeightMeters,
      wallThicknessMeters: layout.defaultWallThicknessMeters,
      openings: migratedOpenings,
    },
    slab: closed
      ? {
          ...preset.slab,
          lengthMeters,
          widthMeters,
        }
      : preset.slab,
    roof: closed
      ? {
          ...preset.roof,
          lengthMeters,
          widthMeters,
        }
      : preset.roof,
    truss: closed
      ? {
          ...preset.truss,
          buildingLengthMeters: lengthMeters,
        }
      : preset.truss,
  };
}

export function segmentIdForWallFace(
  layout: DesignWallLayoutParameters,
  wallFace: NonNullable<WallOpeningParameters['wallFace']>,
): string | null {
  for (const segment of layout.segments) {
    if (wallFaceForSegment(layout, segment.id) === wallFace) {
      return segment.id;
    }
  }
  return null;
}

export function wallFaceForSegment(
  layout: DesignWallLayoutParameters,
  segmentId: string,
): WallOpeningParameters['wallFace'] | null {
  const bounds = deriveExteriorBounds(layout);
  if (!bounds) return null;
  const segment = layout.segments.find((item) => item.id === segmentId);
  if (!segment) return null;
  const angle = segmentAngleRadians(segment, layout.nodes);
  const normalized = ((angle * 180) / Math.PI + 360) % 360;
  if (normalized >= 315 || normalized < 45) return 'south';
  if (normalized >= 45 && normalized < 135) return 'east';
  if (normalized >= 135 && normalized < 225) return 'north';
  return 'west';
}

export function openingToLegacyFaceOffset(
  opening: WallOpeningParameters,
  layout: DesignWallLayoutParameters,
): WallOpeningParameters {
  if (!opening.wallSegmentId || opening.positionAlongSegment == null) return opening;
  const wallFace = wallFaceForSegment(layout, opening.wallSegmentId);
  if (!wallFace) return opening;
  const centerStation = opening.placementUsesCenterStation
    ? opening.positionAlongSegment
    : opening.positionAlongSegment + opening.widthMeters / 2;
  return {
    ...opening,
    wallFace,
    offsetMeters: centerStation - opening.widthMeters / 2,
  };
}

export function wallParamsWithLegacyOpenings(
  wall: CmuWallSystemParameters,
  layout: DesignWallLayoutParameters,
): CmuWallSystemParameters {
  return {
    ...wall,
    openings: normalizeOpeningsHeadAlignment(wall.openings).map((opening) => openingToLegacyFaceOffset(opening, layout)),
  };
}

export interface LayoutSegmentSummary {
  segmentId: string;
  label: string;
  lengthMeters: number;
  angleRadians: number;
  wallHeightMeters: number;
}

export function summarizeLayoutSegments(
  layout: DesignWallLayoutParameters,
): LayoutSegmentSummary[] {
  return layout.segments.map((segment, index) => ({
    segmentId: segment.id,
    label: `Wall segment ${index + 1}`,
    lengthMeters: segmentLength(segment, layout.nodes),
    angleRadians: segmentAngleRadians(segment, layout.nodes),
    wallHeightMeters: segment.wallHeightMeters,
  }));
}

export function layoutCornerWarnings(layout: DesignWallLayoutParameters): string[] {
  return generateWallCorners(layout)
    .filter((corner) => corner.bondStrategy === 'butt' && corner.cornerType === 'outside')
    .map((corner) => `Corner at node ${corner.nodeId} uses butt strategy on an exterior corner.`);
}

export function canGenerateSlabAndRoof(layout: DesignWallLayoutParameters): boolean {
  return layout.isFootprintClosed && layout.segments.length >= 3;
}

export function slabParamsFromLayout(
  preset: CmuBuildingPreset,
  layout: DesignWallLayoutParameters,
): ThickenedEdgeSlabParameters | null {
  if (!canGenerateSlabAndRoof(layout)) return null;
  const synced = syncPresetFromLayout(preset, layout);
  return synced.slab;
}

export function roofParamsFromLayout(
  preset: CmuBuildingPreset,
  layout: DesignWallLayoutParameters,
): GableRoofSystemParameters | null {
  if (!canGenerateSlabAndRoof(layout)) return null;
  const synced = syncPresetFromLayout(preset, layout);
  return synced.roof;
}
