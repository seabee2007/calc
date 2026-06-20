import type {
  DesignWallLayoutParameters,
  StructuralBeam,
  StructuralColumn,
  StructuralFoundationSettings,
  StructuralFrameSystemParameters,
} from '../types';
import type { SegmentFrame } from '../geometry/designGeometry';
import { resolveInsideFaceStation } from './infillPanelBoundsResolver';
import {
  gradeBeamElevationsFromSettings,
  resolveColumnGeometry,
  resolveColumnTopElevationMeters,
  resolveFoundationElevations,
  ringBeamElevationsForWallHeight,
  TOP_OF_GRADE_BEAM_Y,
} from './foundationElevations';
import { createIsolatedFootingsForColumns } from './isolatedFootingLayout';
import type { IsolatedFooting } from '../types';
import {
  DEFAULT_GRADE_BEAM_DEPTH_METERS,
  DEFAULT_GRADE_BEAM_WIDTH_METERS,
  DEFAULT_RC_COLUMN_DEPTH_METERS,
  DEFAULT_RC_COLUMN_WIDTH_METERS,
  DEFAULT_RING_BEAM_DEPTH_METERS,
  DEFAULT_RING_BEAM_WIDTH_METERS,
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
  foundation: StructuralFoundationSettings;
  columnTopY?: number;
}): StructuralColumn[] {
  const elevations = resolveFoundationElevations({
    foundation: params.foundation,
    wallHeightMeters: params.wallHeightMeters,
  });
  const columnTopY = params.columnTopY ?? elevations.wallTopY;
  const width = params.frameSystem.defaultColumnWidthMeters || DEFAULT_RC_COLUMN_WIDTH_METERS;
  const depth = params.frameSystem.defaultColumnDepthMeters || DEFAULT_RC_COLUMN_DEPTH_METERS;
  const nodeIds = new Set<string>();
  for (const seg of params.layout.segments) {
    nodeIds.add(seg.startNodeId);
    nodeIds.add(seg.endNodeId);
  }
  const nodeById = new Map(params.layout.nodes.map((n) => [n.id, n]));
  const columns: StructuralColumn[] = [];
  for (const nodeId of nodeIds) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const geometry = resolveColumnGeometry({
      column: { widthMeters: width, depthMeters: depth },
      elevations,
      columnTopY,
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
  foundation: StructuralFoundationSettings;
  wallHeightMeters: number;
}): StructuralBeam[] {
  const colByNode = new Map<string, StructuralColumn>();
  for (const col of params.columns) {
    if (col.hostNodeId) colByNode.set(col.hostNodeId, col);
  }

  const gradeBeam = params.foundation.gradeBeam;
  const gradeElevations = gradeBeamElevationsFromSettings(gradeBeam);
  const ringDepth = params.frameSystem.defaultRingBeamDepthMeters || DEFAULT_RING_BEAM_DEPTH_METERS;
  const ringElevations = ringBeamElevationsForWallHeight({
    wallHeightMeters: params.wallHeightMeters,
    ringBeamDepthMeters: ringDepth,
  });

  const beams: StructuralBeam[] = [];
  for (const seg of params.layout.segments) {
    const startCol = colByNode.get(seg.startNodeId);
    const endCol = colByNode.get(seg.endNodeId);
    if (!startCol || !endCol) continue;

    if (gradeBeam.enabled) {
      beams.push(
        beamBetweenColumns({
          kind: 'grade_beam',
          startCol,
          endCol,
          segmentId: seg.id,
          widthMeters: gradeBeam.widthMeters || params.frameSystem.defaultGradeBeamWidthMeters || DEFAULT_GRADE_BEAM_WIDTH_METERS,
          depthMeters: gradeBeam.depthMeters || params.frameSystem.defaultGradeBeamDepthMeters || DEFAULT_GRADE_BEAM_DEPTH_METERS,
          baseElevationMeters: gradeElevations.baseElevationMeters,
          topElevationMeters: gradeElevations.topElevationMeters,
        }),
      );
    }

    beams.push(
      beamBetweenColumns({
        kind: 'ring_beam',
        startCol,
        endCol,
        segmentId: seg.id,
        widthMeters: params.frameSystem.defaultRingBeamWidthMeters || DEFAULT_RING_BEAM_WIDTH_METERS,
        depthMeters: ringDepth,
        baseElevationMeters: ringElevations.baseElevationMeters,
        topElevationMeters: ringElevations.topElevationMeters,
      }),
    );
  }
  return beams;
}

export function autoFrameLayout(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  frameSystem: StructuralFrameSystemParameters;
  foundation: StructuralFoundationSettings;
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
  foundation: StructuralFoundationSettings;
  wallHeightMeters: number;
}): FrameLayoutResult {
  const wallHeight = params.wallHeightMeters;
  const columns =
    params.frameSystem.columns.length > 0
      ? params.frameSystem.columns
      : createCornerColumnsForLayout({
          layout: params.layout,
          segmentFrames: params.segmentFrames,
          frameSystem: params.frameSystem,
          wallHeightMeters: wallHeight,
          foundation: params.foundation,
        });

  const resolvedBeams = createPerimeterBeamsForLayout({
    layout: params.layout,
    columns,
    frameSystem: params.frameSystem,
    foundation: params.foundation,
    wallHeightMeters: wallHeight,
  });
  const ringBeamTop =
    resolvedBeams.find((beam) => beam.kind === 'ring_beam')?.topElevationMeters ??
    wallHeight + TOP_OF_GRADE_BEAM_Y;
  const elevations = resolveFoundationElevations({
    foundation: params.foundation,
    wallHeightMeters: wallHeight,
  });
  const reconciledColumns = columns.map((column) => ({
    ...column,
    ...resolveColumnGeometry({
      column,
      elevations,
      columnTopY: ringBeamTop,
    }),
  }));
  const isolatedFootings = createIsolatedFootingsForColumns({
    columns: reconciledColumns,
    settings: params.foundation.isolatedFootings,
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

export { TOP_OF_GRADE_BEAM_Y, resolveColumnTopElevationMeters };
