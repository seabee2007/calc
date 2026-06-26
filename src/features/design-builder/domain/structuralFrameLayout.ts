import type {
  DesignWallLayoutParameters,
  RcFrameFoundationSettings,
  StructuralBeam,
  StructuralColumn,
  StructuralFoundationSettings,
  StructuralFrameSystemParameters,
} from '../types';
import type { SegmentFrame } from '../geometry/designGeometry';
import {
  getExteriorPerimeterSegmentIds,
  getStructuralColumnNodeIds,
} from '../geometry/designGeometry';
import { resolveInsideFaceStation } from './infillPanelBoundsResolver';
import {
  normalizeRcFrameFoundationSettings,
  plinthBeamElevations,
  resolveColumnGeometry,
  resolveFoundationElevations,
  roofBeamElevations,
  tieBeamElevations,
  TOP_OF_PLINTH_BEAM_Y,
} from './foundationElevations';
import { createIsolatedFootingsForColumns } from './isolatedFootingLayout';
import type { IsolatedFooting } from '../types';
import {
  DEFAULT_RC_COLUMN_DEPTH_METERS,
  DEFAULT_RC_COLUMN_WIDTH_METERS,
} from './structuralFrameDefaults';

export type ColumnFootprint = {
  column: StructuralColumn;
  exteriorMinX: number;
  exteriorMaxX: number;
  exteriorMinZ: number;
  exteriorMaxZ: number;
  insideFaceAlongSegment: (segmentId: string, station: number) => number;
};

export type FrameLayoutResult = {
  frameSystem: StructuralFrameSystemParameters;
  isolatedFootings: IsolatedFooting[];
};

function columnIdForNode(nodeId: string): string {
  return `col-${nodeId}`;
}

function beamId(kind: StructuralBeam['kind'], segmentId: string): string {
  return `beam-${kind}-${segmentId}`;
}

function resolveFoundation(params: StructuralFoundationSettings | RcFrameFoundationSettings | undefined): RcFrameFoundationSettings {
  return normalizeRcFrameFoundationSettings(params);
}

function resolveColumnDimensions(
  foundation: RcFrameFoundationSettings,
  frameSystem: StructuralFrameSystemParameters,
): { widthMeters: number; depthMeters: number } {
  return {
    widthMeters:
      foundation.columns.widthMeters ||
      frameSystem.defaultColumnWidthMeters ||
      DEFAULT_RC_COLUMN_WIDTH_METERS,
    depthMeters:
      foundation.columns.depthMeters ||
      frameSystem.defaultColumnDepthMeters ||
      DEFAULT_RC_COLUMN_DEPTH_METERS,
  };
}

export function columnExteriorBounds(column: StructuralColumn): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const halfW = column.widthMeters / 2;
  const halfD = column.depthMeters / 2;
  return {
    minX: column.position.x - halfW,
    maxX: column.position.x + halfW,
    minZ: column.position.z - halfD,
    maxZ: column.position.z + halfD,
  };
}

/** Station on segment where column inside face meets infill (segment-local, meters from exterior start). */
export function columnInsideFaceStationOnSegment(
  column: StructuralColumn,
  frame: SegmentFrame,
  side: 'start' | 'end',
): number {
  return resolveInsideFaceStation({ column, frame, side });
}

export function createCornerColumnsForLayout(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  frameSystem: StructuralFrameSystemParameters;
  wallHeightMeters: number;
  foundation: StructuralFoundationSettings | RcFrameFoundationSettings | undefined;
}): StructuralColumn[] {
  const foundation = resolveFoundation(params.foundation);
  const elevations = resolveFoundationElevations({
    foundation,
    wallHeightMeters: params.wallHeightMeters,
  });
  const { width, depth } = {
    width: resolveColumnDimensions(foundation, params.frameSystem).widthMeters,
    depth: resolveColumnDimensions(foundation, params.frameSystem).depthMeters,
  };
  const exteriorSegmentIds = getExteriorPerimeterSegmentIds(params.layout);
  const nodeIds = new Set(getStructuralColumnNodeIds(params.layout, exteriorSegmentIds));
  const nodeById = new Map(params.layout.nodes.map((n) => [n.id, n]));
  const columns: StructuralColumn[] = [];
  for (const nodeId of nodeIds) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const geometry = resolveColumnGeometry({
      column: { widthMeters: width, depthMeters: depth },
      elevations,
    });
    columns.push({
      id: columnIdForNode(nodeId),
      name: `Corner Column ${nodeId}`,
      kind: 'rc_column',
      position: { x: node.x, z: node.z },
      widthMeters: width,
      depthMeters: depth,
      ...geometry,
      hostNodeId: nodeId,
      source: 'auto_frame_layout',
    });
  }
  return columns;
}

function beamBetweenColumns(params: {
  kind: StructuralBeam['kind'];
  startCol: StructuralColumn;
  endCol: StructuralColumn;
  segmentId: string;
  widthMeters: number;
  depthMeters: number;
  baseElevationMeters: number;
  topElevationMeters: number;
}): StructuralBeam {
  const startFace = facePointToward(params.startCol, params.endCol.position);
  const endFace = facePointToward(params.endCol, params.startCol.position);
  return {
    id: beamId(params.kind, params.segmentId),
    name: `${params.kind} ${params.segmentId}`,
    kind: params.kind,
    startColumnId: params.startCol.id,
    endColumnId: params.endCol.id,
    startPoint: { x: startFace.x, y: params.baseElevationMeters, z: startFace.z },
    endPoint: { x: endFace.x, y: params.baseElevationMeters, z: endFace.z },
    widthMeters: params.widthMeters,
    depthMeters: params.depthMeters,
    baseElevationMeters: params.baseElevationMeters,
    topElevationMeters: params.topElevationMeters,
    hostSegmentId: params.segmentId,
    source: 'auto_frame_layout',
  };
}

/** Face-to-face point on column toward target (not center-to-center). */
function facePointToward(
  column: StructuralColumn,
  target: { x: number; z: number },
): { x: number; z: number } {
  const dx = target.x - column.position.x;
  const dz = target.z - column.position.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = dx / len;
  const nz = dz / len;
  const halfExtent = Math.max(column.widthMeters, column.depthMeters) / 2;
  return {
    x: column.position.x + nx * halfExtent,
    z: column.position.z + nz * halfExtent,
  };
}

export function createPerimeterBeamsForLayout(params: {
  layout: DesignWallLayoutParameters;
  columns: StructuralColumn[];
  frameSystem: StructuralFrameSystemParameters;
  foundation: StructuralFoundationSettings | RcFrameFoundationSettings | undefined;
  wallHeightMeters: number;
}): StructuralBeam[] {
  const foundation = resolveFoundation(params.foundation);
  const colByNode = new Map<string, StructuralColumn>();
  for (const col of params.columns) {
    if (col.hostNodeId) colByNode.set(col.hostNodeId, col);
  }

  const plinthElevations = plinthBeamElevations(foundation);
  const roofElevations = roofBeamElevations(params.wallHeightMeters, foundation);
  const tieElevations = tieBeamElevations(foundation, params.wallHeightMeters);
  const exteriorSegmentIds = getExteriorPerimeterSegmentIds(params.layout);

  const beams: StructuralBeam[] = [];
  for (const seg of params.layout.segments) {
    const startCol = colByNode.get(seg.startNodeId);
    const endCol = colByNode.get(seg.endNodeId);
    if (!startCol || !endCol) continue;

    const isExterior = exteriorSegmentIds.has(seg.id);
    const includePlinthBeam =
      foundation.plinthBeam.enabled &&
      (isExterior
        ? foundation.plinthBeam.followsExteriorSegments
        : foundation.plinthBeam.followsInteriorSegments);

    if (includePlinthBeam) {
      beams.push(
        beamBetweenColumns({
          kind: 'plinth_beam',
          startCol,
          endCol,
          segmentId: seg.id,
          widthMeters: foundation.plinthBeam.widthMeters,
          depthMeters: foundation.plinthBeam.depthMeters,
          baseElevationMeters: plinthElevations.baseElevationMeters,
          topElevationMeters: plinthElevations.topElevationMeters,
        }),
      );
    }

    if (foundation.roofBeam.enabled && isExterior) {
      beams.push(
        beamBetweenColumns({
          kind: 'roof_beam',
          startCol,
          endCol,
          segmentId: seg.id,
          widthMeters: foundation.roofBeam.widthMeters,
          depthMeters: foundation.roofBeam.depthMeters,
          baseElevationMeters: roofElevations.baseElevationMeters,
          topElevationMeters: roofElevations.topElevationMeters,
        }),
      );
    }

    if (foundation.tieBeam.enabled && isExterior) {
      beams.push(
        beamBetweenColumns({
          kind: 'tie_beam',
          startCol,
          endCol,
          segmentId: seg.id,
          widthMeters: foundation.tieBeam.widthMeters,
          depthMeters: foundation.tieBeam.depthMeters,
          baseElevationMeters: tieElevations.baseElevationMeters,
          topElevationMeters: tieElevations.topElevationMeters,
        }),
      );
    }
  }
  return beams;
}

export function autoFrameLayout(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  frameSystem: StructuralFrameSystemParameters;
  foundation: StructuralFoundationSettings | RcFrameFoundationSettings | undefined;
}): FrameLayoutResult {
  return reconcileStructuralFrameWithFoundation({
    layout: params.layout,
    segmentFrames: params.segmentFrames,
    frameSystem: params.frameSystem,
    foundation: params.foundation,
    wallHeightMeters: params.layout.defaultWallHeightMeters,
  });
}

export function reconcileStructuralFrameWithFoundation(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  frameSystem: StructuralFrameSystemParameters;
  foundation: StructuralFoundationSettings | RcFrameFoundationSettings | undefined;
  wallHeightMeters: number;
}): FrameLayoutResult {
  const foundation = resolveFoundation(params.foundation);
  const wallHeight = params.wallHeightMeters;
  const columns =
    params.frameSystem.columns.length > 0
      ? params.frameSystem.columns
      : createCornerColumnsForLayout({
          layout: params.layout,
          segmentFrames: params.segmentFrames,
          frameSystem: params.frameSystem,
          wallHeightMeters: wallHeight,
          foundation,
        });

  const resolvedBeams = createPerimeterBeamsForLayout({
    layout: params.layout,
    columns,
    frameSystem: params.frameSystem,
    foundation,
    wallHeightMeters: wallHeight,
  });

  const elevations = resolveFoundationElevations({
    foundation,
    wallHeightMeters: wallHeight,
  });
  const reconciledColumns = columns.map((column) => ({
    ...column,
    ...resolveColumnGeometry({
      column,
      elevations,
    }),
  }));
  const isolatedFootings = createIsolatedFootingsForColumns({
    columns: reconciledColumns,
    foundation,
    topOfFootingY: elevations.topOfFootingY,
  });

  return {
    frameSystem: {
      ...params.frameSystem,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      columns: reconciledColumns,
      beams: resolvedBeams,
    },
    isolatedFootings,
  };
}

export function findColumnAtNode(
  columns: StructuralColumn[],
  nodeId: string,
): StructuralColumn | undefined {
  return columns.find((c) => c.hostNodeId === nodeId);
}

export function beamSpanLengthMeters(beam: StructuralBeam): number {
  return Math.hypot(
    beam.endPoint.x - beam.startPoint.x,
    beam.endPoint.z - beam.startPoint.z,
  );
}

export function columnVolumeCubicMeters(column: StructuralColumn): number {
  return column.widthMeters * column.depthMeters * column.heightMeters;
}

export function beamVolumeCubicMeters(beam: StructuralBeam): number {
  return beamSpanLengthMeters(beam) * beam.widthMeters * beam.depthMeters;
}

/** Subtract approximate intersection volume at column/beam joints. */
export function beamColumnIntersectionVolumeCubicMeters(
  column: StructuralColumn,
  beam: StructuralBeam,
): number {
  const overlapW = Math.min(column.widthMeters, beam.widthMeters);
  const overlapD = Math.min(column.depthMeters, beam.depthMeters);
  const overlapH = Math.min(
    column.topElevationMeters - column.baseElevationMeters,
    beam.topElevationMeters - beam.baseElevationMeters,
  );
  return overlapW * overlapD * overlapH;
}

export function deduplicatedStructuralConcreteVolumeCubicMeters(params: {
  columns: StructuralColumn[];
  beams: StructuralBeam[];
}): number {
  let total = 0;
  for (const col of params.columns) {
    total += columnVolumeCubicMeters(col);
  }
  for (const beam of params.beams) {
    total += beamVolumeCubicMeters(beam);
  }
  for (const beam of params.beams) {
    const startCol = params.columns.find((c) => c.id === beam.startColumnId);
    const endCol = params.columns.find((c) => c.id === beam.endColumnId);
    if (startCol) total -= beamColumnIntersectionVolumeCubicMeters(startCol, beam);
    if (endCol) total -= beamColumnIntersectionVolumeCubicMeters(endCol, beam);
  }
  return Math.max(0, total);
}

export { TOP_OF_PLINTH_BEAM_Y, TOP_OF_PLINTH_BEAM_Y as TOP_OF_GRADE_BEAM_Y };
