import type {
  CmuInfillPanel,
  CmuWallSystemParameters,
  DesignWallLayoutParameters,
  DesignWallSegment,
  RcFrameFoundationSettings,
  StructuralBeam,
  StructuralColumn,
  WallFooting,
} from "../types";
import type { SegmentFrame } from "../geometry/designGeometry";
import { projectPointToSegmentStation } from "./openingPlacementResolver";
import { findColumnAtNode } from "./structuralFrameLayout";
import {
  resolveFoundationElevations,
  TOP_OF_PLINTH_BEAM_Y,
} from "./foundationElevations";
import { normalizeRcFrameFoundationSettings } from "./rcFrameFoundationMigration";
import { resolveDesignMasonrySettings } from "./masonrySettings";
import {
  resolvePartitionWallCourseJoinTrims,
  type PartitionWallCourseJoinTrim,
} from "./partitionWallJoinRules";

export const FRAME_INFILL_RENDER_EPSILON_METERS = 0.001;
export const FRAME_INFILL_BOUNDS_TOLERANCE_METERS = 0.002;

export type Vec3 = { x: number; y: number; z: number };

export type ResolvedInfillPanelBounds = {
  panelId: string;
  hostSegmentId: string;
  leftColumnId?: string;
  rightColumnId?: string;
  startStationMeters: number;
  endStationMeters: number;
  clearWidthMeters: number;
  bottomElevationMeters: number;
  topElevationMeters: number;
  clearHeightMeters: number;
  /** CMU/infill centerline offset used to align block faces to the roof-beam inside face. */
  infillCenterlineInwardOffsetMeters?: number;
  /** Interlocked running-bond trims applied per masonry course at partition wall joins. */
  partitionWallCourseJoinTrim?: PartitionWallCourseJoinTrim;
  hostWallCenterlineStart: Vec3;
  hostWallCenterlineEnd: Vec3;
  tangent: Vec3;
  outwardNormal: Vec3;
  inwardNormal: Vec3;
  leftSupportInsideFaceWorld: Vec3;
  rightSupportInsideFaceWorld: Vec3;
  leftSupportInsideFaceStation: number;
  rightSupportInsideFaceStation: number;
};

export function columnProjectedHalfExtentAlongTangent(
  column: StructuralColumn,
  tangent: { x: number; z: number },
): number {
  const halfW = column.widthMeters / 2;
  const halfD = column.depthMeters / 2;
  return Math.abs(tangent.x) * halfW + Math.abs(tangent.z) * halfD;
}

export function columnInsideFaceWorldPoint(
  column: StructuralColumn,
  frame: SegmentFrame,
  side: "start" | "end",
): { x: number; z: number } {
  const projectedHalf = columnProjectedHalfExtentAlongTangent(
    column,
    frame.tangent,
  );
  const sign = side === "start" ? 1 : -1;
  return {
    x: column.position.x + frame.tangent.x * projectedHalf * sign,
    z: column.position.z + frame.tangent.z * projectedHalf * sign,
  };
}

export function resolveInsideFaceStation(params: {
  column: StructuralColumn;
  frame: SegmentFrame;
  side: "start" | "end";
}): number {
  const facePoint = columnInsideFaceWorldPoint(
    params.column,
    params.frame,
    params.side,
  );
  const station = projectPointToSegmentStation(facePoint, params.frame);
  if (params.side === "start") {
    return Math.max(0, station);
  }
  return Math.min(params.frame.lengthMeters, station);
}

function segmentBeamElevations(
  beams: readonly StructuralBeam[],
  segmentId: string,
  wallHeightMeters: number,
): { plinthBeamTopMeters: number; roofBeamBottomMeters: number } {
  const plinthBeam = beams.find(
    (beam) =>
      (beam.kind === "plinth_beam" || beam.kind === "grade_beam") &&
      beam.hostSegmentId === segmentId,
  );
  const roofBeam = beams.find(
    (beam) =>
      (beam.kind === "roof_beam" || beam.kind === "ring_beam") &&
      beam.hostSegmentId === segmentId,
  );
  return {
    plinthBeamTopMeters: plinthBeam?.topElevationMeters ?? TOP_OF_PLINTH_BEAM_Y,
    roofBeamBottomMeters:
      roofBeam?.baseElevationMeters ?? wallHeightMeters + TOP_OF_PLINTH_BEAM_Y,
  };
}

function exteriorSegmentAndNodeIds(layout: DesignWallLayoutParameters): {
  segmentIds: Set<string>;
  nodeIds: Set<string>;
} {
  const first = layout.segments[0];
  if (!first) {
    return {
      segmentIds: new Set(layout.segments.map((segment) => segment.id)),
      nodeIds: new Set(layout.nodes.map((node) => node.id)),
    };
  }

  const segmentIds = new Set<string>();
  const nodeIds = new Set<string>();
  const startNodeId = first.startNodeId;
  let currentNodeId = startNodeId;
  const used = new Set<string>();

  while (used.size < layout.segments.length) {
    const next = layout.segments.find(
      (segment) =>
        !used.has(segment.id) && segment.startNodeId === currentNodeId,
    );
    if (!next) break;
    segmentIds.add(next.id);
    nodeIds.add(next.startNodeId);
    nodeIds.add(next.endNodeId);
    used.add(next.id);
    currentNodeId = next.endNodeId;
    if (currentNodeId === startNodeId) break;
  }

  if (segmentIds.size === 0) {
    return {
      segmentIds: new Set(layout.segments.map((segment) => segment.id)),
      nodeIds: new Set(layout.nodes.map((node) => node.id)),
    };
  }

  return { segmentIds, nodeIds };
}

function pointOnFrameAtStation(
  frame: SegmentFrame,
  stationMeters: number,
  y: number,
): Vec3 {
  return {
    x: frame.centerlineStart.x + frame.tangent.x * stationMeters,
    y,
    z: frame.centerlineStart.z + frame.tangent.z * stationMeters,
  };
}

function trimInfillBoundsToStations(params: {
  bounds: ResolvedInfillPanelBounds;
  frame: SegmentFrame;
  startStationMeters: number;
  endStationMeters: number;
}): ResolvedInfillPanelBounds | null {
  const startStationMeters = Math.max(
    0,
    Math.min(params.frame.lengthMeters, params.startStationMeters),
  );
  const endStationMeters = Math.max(
    0,
    Math.min(params.frame.lengthMeters, params.endStationMeters),
  );
  const clearWidthMeters = endStationMeters - startStationMeters;
  if (clearWidthMeters <= 0.05) return null;

  return {
    ...params.bounds,
    startStationMeters,
    endStationMeters,
    clearWidthMeters,
    leftSupportInsideFaceStation: startStationMeters,
    rightSupportInsideFaceStation: endStationMeters,
    leftSupportInsideFaceWorld: pointOnFrameAtStation(
      params.frame,
      startStationMeters,
      params.bounds.bottomElevationMeters,
    ),
    rightSupportInsideFaceWorld: pointOnFrameAtStation(
      params.frame,
      endStationMeters,
      params.bounds.bottomElevationMeters,
    ),
  };
}

function trimInteriorPartitionInfillAtExteriorShell(params: {
  bounds: ResolvedInfillPanelBounds;
  segment: DesignWallSegment;
  frame: SegmentFrame;
  exteriorSegmentIds: ReadonlySet<string>;
  exteriorNodeIds: ReadonlySet<string>;
}): ResolvedInfillPanelBounds | null {
  if (params.exteriorSegmentIds.has(params.segment.id)) {
    return params.bounds;
  }

  const trimMeters = params.frame.wallThicknessMeters / 2;
  let startStationMeters = params.bounds.startStationMeters;
  let endStationMeters = params.bounds.endStationMeters;

  if (params.exteriorNodeIds.has(params.segment.startNodeId)) {
    startStationMeters = Math.max(startStationMeters, trimMeters);
  }
  if (params.exteriorNodeIds.has(params.segment.endNodeId)) {
    endStationMeters = Math.min(
      endStationMeters,
      params.frame.lengthMeters - trimMeters,
    );
  }

  return trimInfillBoundsToStations({
    bounds: params.bounds,
    frame: params.frame,
    startStationMeters,
    endStationMeters,
  });
}

export function resolveInfillPanelBoundsForSegment(params: {
  panelId: string;
  segmentId: string;
  segment: { startNodeId: string; endNodeId: string; wallHeightMeters: number };
  frame: SegmentFrame;
  columns: StructuralColumn[];
  beams: StructuralBeam[];
  gradeBeamTopMeters?: number;
  ringBeamBaseMeters?: number;
  plinthBeamTopMeters?: number;
  roofBeamBottomMeters?: number;
}): ResolvedInfillPanelBounds | null {
  const startCol = findColumnAtNode(params.columns, params.segment.startNodeId);
  const endCol = findColumnAtNode(params.columns, params.segment.endNodeId);
  const leftSupportInsideFaceStation = startCol
    ? resolveInsideFaceStation({
        column: startCol,
        frame: params.frame,
        side: "start",
      })
    : 0;
  const rightSupportInsideFaceStation = endCol
    ? resolveInsideFaceStation({
        column: endCol,
        frame: params.frame,
        side: "end",
      })
    : params.frame.lengthMeters;
  const panelStartStationMeters = leftSupportInsideFaceStation;
  const panelEndStationMeters = rightSupportInsideFaceStation;
  const clearWidthMeters = panelEndStationMeters - panelStartStationMeters;
  if (clearWidthMeters <= 0.05) return null;

  const elevations =
    params.plinthBeamTopMeters != null && params.roofBeamBottomMeters != null
      ? {
          plinthBeamTopMeters: params.plinthBeamTopMeters,
          roofBeamBottomMeters: params.roofBeamBottomMeters,
        }
      : params.gradeBeamTopMeters != null && params.ringBeamBaseMeters != null
        ? {
            plinthBeamTopMeters: params.gradeBeamTopMeters,
            roofBeamBottomMeters: params.ringBeamBaseMeters,
          }
        : segmentBeamElevations(
            params.beams,
            params.segmentId,
            params.segment.wallHeightMeters,
          );
  const roofBeam = params.beams.find(
    (beam) =>
      (beam.kind === "roof_beam" || beam.kind === "ring_beam") &&
      beam.hostSegmentId === params.segmentId,
  );
  const infillCenterlineInwardOffsetMeters = roofBeam
    ? roofBeam.widthMeters / 2 - params.frame.wallThicknessMeters
    : 0;

  const leftSupportInsideFaceWorld = startCol
    ? {
        ...columnInsideFaceWorldPoint(startCol, params.frame, "start"),
        y: elevations.plinthBeamTopMeters,
      }
    : {
        x: params.frame.centerlineStart.x,
        y: elevations.plinthBeamTopMeters,
        z: params.frame.centerlineStart.z,
      };
  const rightSupportInsideFaceWorld = endCol
    ? {
        ...columnInsideFaceWorldPoint(endCol, params.frame, "end"),
        y: elevations.plinthBeamTopMeters,
      }
    : {
        x: params.frame.centerlineEnd.x,
        y: elevations.plinthBeamTopMeters,
        z: params.frame.centerlineEnd.z,
      };

  return {
    panelId: params.panelId,
    hostSegmentId: params.segmentId,
    leftColumnId: startCol?.id,
    rightColumnId: endCol?.id,
    startStationMeters: panelStartStationMeters,
    endStationMeters: panelEndStationMeters,
    clearWidthMeters,
    bottomElevationMeters: elevations.plinthBeamTopMeters,
    topElevationMeters: elevations.roofBeamBottomMeters,
    clearHeightMeters:
      elevations.roofBeamBottomMeters - elevations.plinthBeamTopMeters,
    infillCenterlineInwardOffsetMeters,
    hostWallCenterlineStart: {
      x: params.frame.centerlineStart.x,
      y: elevations.plinthBeamTopMeters,
      z: params.frame.centerlineStart.z,
    },
    hostWallCenterlineEnd: {
      x: params.frame.centerlineEnd.x,
      y: elevations.plinthBeamTopMeters,
      z: params.frame.centerlineEnd.z,
    },
    tangent: { x: params.frame.tangent.x, y: 0, z: params.frame.tangent.z },
    outwardNormal: {
      x: params.frame.outwardNormal.x,
      y: 0,
      z: params.frame.outwardNormal.z,
    },
    inwardNormal: {
      x: params.frame.inwardNormal.x,
      y: 0,
      z: params.frame.inwardNormal.z,
    },
    leftSupportInsideFaceWorld,
    rightSupportInsideFaceWorld,
    leftSupportInsideFaceStation,
    rightSupportInsideFaceStation,
  };
}

function columnStationOnFrame(
  column: StructuralColumn,
  frame: SegmentFrame,
): number {
  return projectPointToSegmentStation(column.position, frame);
}

function supportColumnsForSegment(params: {
  segment: { startNodeId: string; endNodeId: string };
  segmentId: string;
  frame: SegmentFrame;
  columns: StructuralColumn[];
}): StructuralColumn[] {
  return params.columns
    .filter((column) => {
      if (
        column.hostNodeId === params.segment.startNodeId ||
        column.hostNodeId === params.segment.endNodeId
      ) {
        return true;
      }
      return column.hostSegmentId === params.segmentId;
    })
    .map((column) => ({
      column,
      station:
        column.hostNodeId === params.segment.startNodeId
          ? 0
          : column.hostNodeId === params.segment.endNodeId
            ? params.frame.lengthMeters
            : columnStationOnFrame(column, params.frame),
    }))
    .filter(
      (entry) =>
        entry.station >= -0.001 &&
        entry.station <= params.frame.lengthMeters + 0.001,
    )
    .sort((a, b) => a.station - b.station)
    .map((entry) => entry.column);
}

export function resolveInfillPanelBoundsForSegmentSupports(params: {
  panelIdPrefix: string;
  segmentId: string;
  segment: { startNodeId: string; endNodeId: string; wallHeightMeters: number };
  frame: SegmentFrame;
  columns: StructuralColumn[];
  beams: StructuralBeam[];
}): ResolvedInfillPanelBounds[] {
  const supports = supportColumnsForSegment({
    segment: params.segment,
    segmentId: params.segmentId,
    frame: params.frame,
    columns: params.columns,
  });
  if (supports.length <= 2) {
    const single = resolveInfillPanelBoundsForSegment({
      panelId: `${params.panelIdPrefix}-0`,
      segmentId: params.segmentId,
      segment: params.segment,
      frame: params.frame,
      columns: params.columns,
      beams: params.beams,
    });
    return single ? [single] : [];
  }

  const bounds: ResolvedInfillPanelBounds[] = [];
  for (let index = 0; index < supports.length - 1; index += 1) {
    const leftColumn = supports[index]!;
    const rightColumn = supports[index + 1]!;
    const segmentBounds = resolveInfillPanelBoundsBetweenColumns({
      panelId: `${params.panelIdPrefix}-${index}`,
      segmentId: params.segmentId,
      segment: params.segment,
      frame: params.frame,
      beams: params.beams,
      leftColumn,
      rightColumn,
    });
    if (segmentBounds) bounds.push(segmentBounds);
  }
  return bounds;
}

function resolveInfillPanelBoundsBetweenColumns(params: {
  panelId: string;
  segmentId: string;
  segment: { wallHeightMeters: number };
  frame: SegmentFrame;
  beams: StructuralBeam[];
  leftColumn: StructuralColumn;
  rightColumn: StructuralColumn;
}): ResolvedInfillPanelBounds | null {
  const leftSupportInsideFaceStation = resolveInsideFaceStation({
    column: params.leftColumn,
    frame: params.frame,
    side: "start",
  });
  const rightSupportInsideFaceStation = resolveInsideFaceStation({
    column: params.rightColumn,
    frame: params.frame,
    side: "end",
  });
  const clearWidthMeters =
    rightSupportInsideFaceStation - leftSupportInsideFaceStation;
  if (clearWidthMeters <= 0.05) return null;

  const elevations = segmentBeamElevations(
    params.beams,
    params.segmentId,
    params.segment.wallHeightMeters,
  );
  const roofBeam = params.beams.find(
    (beam) =>
      (beam.kind === "roof_beam" || beam.kind === "ring_beam") &&
      beam.hostSegmentId === params.segmentId,
  );
  const infillCenterlineInwardOffsetMeters = roofBeam
    ? roofBeam.widthMeters / 2 - params.frame.wallThicknessMeters
    : 0;
  const leftSupportInsideFaceWorld = {
    ...columnInsideFaceWorldPoint(params.leftColumn, params.frame, "start"),
    y: elevations.plinthBeamTopMeters,
  };
  const rightSupportInsideFaceWorld = {
    ...columnInsideFaceWorldPoint(params.rightColumn, params.frame, "end"),
    y: elevations.plinthBeamTopMeters,
  };

  return {
    panelId: params.panelId,
    hostSegmentId: params.segmentId,
    leftColumnId: params.leftColumn.id,
    rightColumnId: params.rightColumn.id,
    startStationMeters: leftSupportInsideFaceStation,
    endStationMeters: rightSupportInsideFaceStation,
    clearWidthMeters,
    bottomElevationMeters: elevations.plinthBeamTopMeters,
    topElevationMeters: elevations.roofBeamBottomMeters,
    clearHeightMeters:
      elevations.roofBeamBottomMeters - elevations.plinthBeamTopMeters,
    infillCenterlineInwardOffsetMeters,
    hostWallCenterlineStart: {
      x: params.frame.centerlineStart.x,
      y: elevations.plinthBeamTopMeters,
      z: params.frame.centerlineStart.z,
    },
    hostWallCenterlineEnd: {
      x: params.frame.centerlineEnd.x,
      y: elevations.plinthBeamTopMeters,
      z: params.frame.centerlineEnd.z,
    },
    tangent: { x: params.frame.tangent.x, y: 0, z: params.frame.tangent.z },
    outwardNormal: {
      x: params.frame.outwardNormal.x,
      y: 0,
      z: params.frame.outwardNormal.z,
    },
    inwardNormal: {
      x: params.frame.inwardNormal.x,
      y: 0,
      z: params.frame.inwardNormal.z,
    },
    leftSupportInsideFaceWorld,
    rightSupportInsideFaceWorld,
    leftSupportInsideFaceStation,
    rightSupportInsideFaceStation,
  };
}

export function resolveInfillPanelBoundsForLayout(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  columns: StructuralColumn[];
  beams: StructuralBeam[];
}): ResolvedInfillPanelBounds[] {
  const bounds: ResolvedInfillPanelBounds[] = [];
  const exterior = exteriorSegmentAndNodeIds(params.layout);
  const partitionCourseJoinTrims = resolvePartitionWallCourseJoinTrims({
    layout: params.layout,
    segmentFrames: params.segmentFrames,
  });
  params.layout.segments.forEach((segment, index) => {
    const frame = params.segmentFrames.find(
      (candidate) => candidate.segmentId === segment.id,
    );
    if (!frame) return;
    const resolvedEntries = resolveInfillPanelBoundsForSegmentSupports({
      panelIdPrefix: `infill-${segment.id}-${index}`,
      segmentId: segment.id,
      segment,
      frame,
      columns: params.columns,
      beams: params.beams,
    });
    for (const resolved of resolvedEntries) {
      const trimmed = trimInteriorPartitionInfillAtExteriorShell({
        bounds: resolved,
        segment,
        frame,
        exteriorSegmentIds: exterior.segmentIds,
        exteriorNodeIds: exterior.nodeIds,
      });
      if (!trimmed) continue;
      bounds.push({
        ...trimmed,
        partitionWallCourseJoinTrim:
          segment.wallRole === "partition"
            ? partitionCourseJoinTrims.get(segment.id)
            : undefined,
      });
    }
  });
  return bounds;
}

function segmentBelowGradeElevations(params: {
  beams: readonly StructuralBeam[];
  segmentId: string;
  wallHeightMeters: number;
  foundation?: RcFrameFoundationSettings;
  wallFootingTopMeters?: number;
  topSupportBottomMeters?: number;
}): { bottomSupportTopMeters: number; topSupportBottomMeters: number } | null {
  const foundation = params.foundation
    ? normalizeRcFrameFoundationSettings(params.foundation)
    : null;
  if (foundation && !foundation.tieBeam.enabled) return null;

  const tieBeam = params.beams.find(
    (beam) =>
      beam.kind === "tie_beam" && beam.hostSegmentId === params.segmentId,
  );
  const plinthBeam = params.beams.find(
    (beam) =>
      (beam.kind === "plinth_beam" || beam.kind === "grade_beam") &&
      beam.hostSegmentId === params.segmentId,
  );
  const elevations = foundation
    ? resolveFoundationElevations({
        foundation,
        wallHeightMeters: params.wallHeightMeters,
      })
    : null;

  const tieBeamTopMeters =
    tieBeam?.topElevationMeters ?? elevations?.topOfTieBeamY;
  const plinthBeamBottomMeters =
    plinthBeam?.baseElevationMeters ?? elevations?.bottomOfPlinthBeamY;
  if (tieBeamTopMeters == null || plinthBeamBottomMeters == null) return null;

  const bottomSupportTopMeters = params.wallFootingTopMeters ?? tieBeamTopMeters;
  const topSupportBottomMeters =
    params.topSupportBottomMeters ?? plinthBeamBottomMeters;
  const clearHeightMeters = topSupportBottomMeters - bottomSupportTopMeters;
  if (clearHeightMeters <= 0.05) return null;

  return { bottomSupportTopMeters, topSupportBottomMeters };
}

function belowGradeInfillCenterlineOffset(frame: SegmentFrame): number {
  return (
    (frame.start.x - frame.centerlineStart.x) * frame.inwardNormal.x +
    (frame.start.z - frame.centerlineStart.z) * frame.inwardNormal.z
  );
}

export function resolveBelowGradeInfillPanelBoundsForSegment(params: {
  panelId: string;
  segmentId: string;
  segment: { startNodeId: string; endNodeId: string; wallHeightMeters: number };
  frame: SegmentFrame;
  columns: StructuralColumn[];
  beams: StructuralBeam[];
  foundation?: RcFrameFoundationSettings;
  wallFootingTopMeters?: number;
}): ResolvedInfillPanelBounds | null {
  const aboveGrade = resolveInfillPanelBoundsForSegment({
    panelId: params.panelId,
    segmentId: params.segmentId,
    segment: params.segment,
    frame: params.frame,
    columns: params.columns,
    beams: params.beams,
  });
  if (!aboveGrade) return null;

  const belowGradeElevations = segmentBelowGradeElevations({
    beams: params.beams,
    segmentId: params.segmentId,
    wallHeightMeters: params.segment.wallHeightMeters,
    foundation: params.foundation,
    wallFootingTopMeters: params.wallFootingTopMeters,
  });
  if (!belowGradeElevations) return null;

  const { bottomSupportTopMeters, topSupportBottomMeters } = belowGradeElevations;
  const infillCenterlineInwardOffsetMeters =
    belowGradeInfillCenterlineOffset(params.frame);

  return {
    ...aboveGrade,
    panelId: params.panelId,
    infillCenterlineInwardOffsetMeters,
    bottomElevationMeters: bottomSupportTopMeters,
    topElevationMeters: topSupportBottomMeters,
    clearHeightMeters: topSupportBottomMeters - bottomSupportTopMeters,
    hostWallCenterlineStart: {
      ...aboveGrade.hostWallCenterlineStart,
      y: bottomSupportTopMeters,
    },
    hostWallCenterlineEnd: {
      ...aboveGrade.hostWallCenterlineEnd,
      y: bottomSupportTopMeters,
    },
    leftSupportInsideFaceWorld: {
      ...aboveGrade.leftSupportInsideFaceWorld,
      y: bottomSupportTopMeters,
    },
    rightSupportInsideFaceWorld: {
      ...aboveGrade.rightSupportInsideFaceWorld,
      y: bottomSupportTopMeters,
    },
  };
}

export function resolveBelowGradeInfillPanelBoundsForLayout(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  columns: StructuralColumn[];
  beams: StructuralBeam[];
  foundation?: RcFrameFoundationSettings;
  wallFootings?: readonly WallFooting[];
}): ResolvedInfillPanelBounds[] {
  const bounds: ResolvedInfillPanelBounds[] = [];
  const exterior = exteriorSegmentAndNodeIds(params.layout);
  const partitionCourseJoinTrims = resolvePartitionWallCourseJoinTrims({
    layout: params.layout,
    segmentFrames: params.segmentFrames,
  });
  const wallFootingBySegmentId = new Map(
    (params.wallFootings ?? []).map((footing) => [footing.hostSegmentId, footing]),
  );
  params.layout.segments.forEach((segment, index) => {
    const frame = params.segmentFrames.find(
      (candidate) => candidate.segmentId === segment.id,
    );
    if (!frame) return;
    const aboveGradeBounds = resolveInfillPanelBoundsForSegmentSupports({
      panelIdPrefix: `infill-below-${segment.id}-${index}`,
      segmentId: segment.id,
      segment,
      frame,
      columns: params.columns,
      beams: params.beams,
    });
    const foundationElevations = params.foundation
      ? resolveFoundationElevations({
          foundation: params.foundation,
          wallHeightMeters: segment.wallHeightMeters,
        })
      : null;
    const partitionTopSupportBottomMeters =
      segment.wallRole === "partition" &&
      foundationElevations &&
      foundationElevations.interiorFloorSlabThicknessMeters > 0
        ? foundationElevations.interiorFloorSlabTopY -
          foundationElevations.interiorFloorSlabThicknessMeters
        : undefined;
    const belowGradeElevations = segmentBelowGradeElevations({
      beams: params.beams,
      segmentId: segment.id,
      wallHeightMeters: segment.wallHeightMeters,
      foundation: params.foundation,
      wallFootingTopMeters: wallFootingBySegmentId.get(segment.id)?.topElevationMeters,
      topSupportBottomMeters: partitionTopSupportBottomMeters,
    });
    if (!belowGradeElevations) return;
    const bottomSupportTopMeters = belowGradeElevations.bottomSupportTopMeters;
    const infillCenterlineInwardOffsetMeters =
      belowGradeInfillCenterlineOffset(frame);
    for (const aboveGrade of aboveGradeBounds) {
      const belowGradeBounds: ResolvedInfillPanelBounds = {
        ...aboveGrade,
        infillCenterlineInwardOffsetMeters,
        bottomElevationMeters: bottomSupportTopMeters,
        topElevationMeters: belowGradeElevations.topSupportBottomMeters,
        clearHeightMeters:
          belowGradeElevations.topSupportBottomMeters -
          bottomSupportTopMeters,
        hostWallCenterlineStart: {
          ...aboveGrade.hostWallCenterlineStart,
          y: bottomSupportTopMeters,
        },
        hostWallCenterlineEnd: {
          ...aboveGrade.hostWallCenterlineEnd,
          y: bottomSupportTopMeters,
        },
        leftSupportInsideFaceWorld: {
          ...aboveGrade.leftSupportInsideFaceWorld,
          y: bottomSupportTopMeters,
        },
        rightSupportInsideFaceWorld: {
          ...aboveGrade.rightSupportInsideFaceWorld,
          y: bottomSupportTopMeters,
        },
      };
      const exteriorTrimmed = trimInteriorPartitionInfillAtExteriorShell({
        bounds: belowGradeBounds,
        segment,
        frame,
        exteriorSegmentIds: exterior.segmentIds,
        exteriorNodeIds: exterior.nodeIds,
      });
      if (!exteriorTrimmed) continue;
      bounds.push({
        ...exteriorTrimmed,
        partitionWallCourseJoinTrim:
          segment.wallRole === "partition"
            ? partitionCourseJoinTrims.get(segment.id)
            : undefined,
      });
    }
  });
  return bounds;
}

export function belowGradeInfillPanelFromResolvedBounds(params: {
  bounds: ResolvedInfillPanelBounds;
  wall: CmuWallSystemParameters;
  beams: StructuralBeam[];
  existingPanel?: CmuInfillPanel;
}): CmuInfillPanel {
  const masonrySettings = resolveDesignMasonrySettings(params.wall);
  const tieBeam = params.beams.find(
    (beam) =>
      beam.kind === "tie_beam" &&
      beam.hostSegmentId === params.bounds.hostSegmentId,
  );
  const plinthBeam = params.beams.find(
    (beam) =>
      (beam.kind === "plinth_beam" || beam.kind === "grade_beam") &&
      beam.hostSegmentId === params.bounds.hostSegmentId,
  );
  return {
    id: params.existingPanel?.id ?? params.bounds.panelId,
    hostSegmentId: params.bounds.hostSegmentId,
    infillZone: "below_grade",
    leftSupportType: params.bounds.leftColumnId ? "column" : "wall_end",
    leftSupportId: params.bounds.leftColumnId,
    rightSupportType: params.bounds.rightColumnId ? "column" : "wall_end",
    rightSupportId: params.bounds.rightColumnId,
    bottomSupportType: "tie_beam",
    bottomSupportId: tieBeam?.id ?? params.existingPanel?.bottomSupportId,
    topSupportType: "plinth_beam",
    topSupportId: plinthBeam?.id ?? params.existingPanel?.topSupportId,
    startStationMeters: params.bounds.startStationMeters,
    endStationMeters: params.bounds.endStationMeters,
    bottomElevationMeters: params.bounds.bottomElevationMeters,
    topElevationMeters: params.bounds.topElevationMeters,
    masonrySettings: params.existingPanel?.masonrySettings ?? {
      blockModule: masonrySettings.blockModule,
      bondPattern: masonrySettings.bondPattern,
      snapToModule: masonrySettings.snapToModule,
      wasteFactor: masonrySettings.wasteFactor,
    },
  };
}

export function infillPanelFromResolvedBounds(params: {
  bounds: ResolvedInfillPanelBounds;
  wall: CmuWallSystemParameters;
  beams: StructuralBeam[];
  existingPanel?: CmuInfillPanel;
}): CmuInfillPanel {
  const masonrySettings = resolveDesignMasonrySettings(params.wall);
  const plinthBeam = params.beams.find(
    (beam) =>
      (beam.kind === "plinth_beam" || beam.kind === "grade_beam") &&
      beam.hostSegmentId === params.bounds.hostSegmentId,
  );
  const roofBeam = params.beams.find(
    (beam) =>
      (beam.kind === "roof_beam" || beam.kind === "ring_beam") &&
      beam.hostSegmentId === params.bounds.hostSegmentId,
  );
  return {
    id: params.existingPanel?.id ?? params.bounds.panelId,
    hostSegmentId: params.bounds.hostSegmentId,
    infillZone: "above_grade",
    leftSupportType: params.bounds.leftColumnId ? "column" : "wall_end",
    leftSupportId: params.bounds.leftColumnId,
    rightSupportType: params.bounds.rightColumnId ? "column" : "wall_end",
    rightSupportId: params.bounds.rightColumnId,
    bottomSupportType: plinthBeam ? "plinth_beam" : "grade_beam",
    bottomSupportId: plinthBeam?.id ?? params.existingPanel?.bottomSupportId,
    topSupportType: roofBeam ? "roof_beam" : "ring_beam",
    topSupportId: roofBeam?.id ?? params.existingPanel?.topSupportId,
    startStationMeters: params.bounds.startStationMeters,
    endStationMeters: params.bounds.endStationMeters,
    bottomElevationMeters: params.bounds.bottomElevationMeters,
    topElevationMeters: params.bounds.topElevationMeters,
    masonrySettings: params.existingPanel?.masonrySettings ?? {
      blockModule: masonrySettings.blockModule,
      bondPattern: masonrySettings.bondPattern,
      snapToModule: masonrySettings.snapToModule,
      wasteFactor: masonrySettings.wasteFactor,
    },
  };
}

export function boundsSnapshotFromPanel(
  panel: CmuInfillPanel,
  frame: SegmentFrame,
): ResolvedInfillPanelBounds {
  const clearWidthMeters = panel.endStationMeters - panel.startStationMeters;
  return {
    panelId: panel.id,
    hostSegmentId: panel.hostSegmentId,
    leftColumnId: panel.leftSupportId,
    rightColumnId: panel.rightSupportId,
    startStationMeters: panel.startStationMeters,
    endStationMeters: panel.endStationMeters,
    clearWidthMeters,
    bottomElevationMeters: panel.bottomElevationMeters,
    topElevationMeters: panel.topElevationMeters,
    clearHeightMeters: panel.topElevationMeters - panel.bottomElevationMeters,
    infillCenterlineInwardOffsetMeters: 0,
    hostWallCenterlineStart: {
      x: frame.centerlineStart.x,
      y: panel.bottomElevationMeters,
      z: frame.centerlineStart.z,
    },
    hostWallCenterlineEnd: {
      x: frame.centerlineEnd.x,
      y: panel.bottomElevationMeters,
      z: frame.centerlineEnd.z,
    },
    tangent: { x: frame.tangent.x, y: 0, z: frame.tangent.z },
    outwardNormal: { x: frame.outwardNormal.x, y: 0, z: frame.outwardNormal.z },
    inwardNormal: { x: frame.inwardNormal.x, y: 0, z: frame.inwardNormal.z },
    leftSupportInsideFaceStation: panel.startStationMeters,
    rightSupportInsideFaceStation: panel.endStationMeters,
    leftSupportInsideFaceWorld: {
      x: frame.exteriorStart.x + frame.tangent.x * panel.startStationMeters,
      y: panel.bottomElevationMeters,
      z: frame.exteriorStart.z + frame.tangent.z * panel.startStationMeters,
    },
    rightSupportInsideFaceWorld: {
      x: frame.exteriorStart.x + frame.tangent.x * panel.endStationMeters,
      y: panel.bottomElevationMeters,
      z: frame.exteriorStart.z + frame.tangent.z * panel.endStationMeters,
    },
  };
}

export function assertNear(
  value: number,
  expected: number,
  toleranceMeters: number,
  label: string,
): void {
  if (Math.abs(value - expected) > toleranceMeters) {
    throw new Error(`${label}: expected ${expected}, received ${value}`);
  }
}

export function logInfillPanelBoundsTableForDev(
  bounds: ResolvedInfillPanelBounds,
  firstCmuStartStation?: number,
  lastCmuEndStation?: number,
): void {
  if (
    !import.meta.env.DEV ||
    import.meta.env.VITE_DESIGN_BUILDER_INFILL_BOUNDS_DEBUG !== "1"
  ) {
    return;
  }
  console.table({
    panelId: bounds.panelId,
    hostSegmentId: bounds.hostSegmentId,
    leftColumnId: bounds.leftColumnId,
    rightColumnId: bounds.rightColumnId,
    leftSupportInsideFaceStation: bounds.leftSupportInsideFaceStation,
    rightSupportInsideFaceStation: bounds.rightSupportInsideFaceStation,
    panelStartStationMeters: bounds.startStationMeters,
    panelEndStationMeters: bounds.endStationMeters,
    clearWidthMeters: bounds.clearWidthMeters,
    firstCmuStartStation,
    lastCmuEndStation,
    bottomElevationMeters: bounds.bottomElevationMeters,
    topElevationMeters: bounds.topElevationMeters,
  });
}

export function verifyInfillPanelPlacementBounds(
  bounds: ResolvedInfillPanelBounds,
  firstCmuStartStation: number,
  lastCmuEndStation: number,
): void {
  assertNear(
    firstCmuStartStation,
    bounds.startStationMeters,
    FRAME_INFILL_BOUNDS_TOLERANCE_METERS,
    "first CMU start station",
  );
  assertNear(
    lastCmuEndStation,
    bounds.endStationMeters,
    FRAME_INFILL_BOUNDS_TOLERANCE_METERS,
    "last CMU end station",
  );
}
