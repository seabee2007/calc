import type {
  CmuInfillPanel,
  CmuWallSystemParameters,
  DesignWallLayoutParameters,
  StructuralBeam,
  StructuralColumn,
} from '../types';
import type { SegmentFrame } from '../geometry/designGeometry';
import { projectPointToSegmentStation } from './openingPlacementResolver';
import { findColumnAtNode } from './structuralFrameLayout';
import { TOP_OF_PLINTH_BEAM_Y } from './foundationElevations';
import { resolveDesignMasonrySettings } from './masonrySettings';

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
  side: 'start' | 'end',
): { x: number; z: number } {
  const projectedHalf = columnProjectedHalfExtentAlongTangent(column, frame.tangent);
  const sign = side === 'start' ? 1 : -1;
  return {
    x: column.position.x + frame.tangent.x * projectedHalf * sign,
    z: column.position.z + frame.tangent.z * projectedHalf * sign,
  };
}

export function resolveInsideFaceStation(params: {
  column: StructuralColumn;
  frame: SegmentFrame;
  side: 'start' | 'end';
}): number {
  const facePoint = columnInsideFaceWorldPoint(params.column, params.frame, params.side);
  const station = projectPointToSegmentStation(facePoint, params.frame);
  if (params.side === 'start') {
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
      (beam.kind === 'plinth_beam' || beam.kind === 'grade_beam') && beam.hostSegmentId === segmentId,
  );
  const roofBeam = beams.find(
    (beam) =>
      (beam.kind === 'roof_beam' || beam.kind === 'ring_beam') && beam.hostSegmentId === segmentId,
  );
  return {
    plinthBeamTopMeters: plinthBeam?.topElevationMeters ?? TOP_OF_PLINTH_BEAM_Y,
    roofBeamBottomMeters:
      roofBeam?.baseElevationMeters ??
      wallHeightMeters + TOP_OF_PLINTH_BEAM_Y,
  };
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
    ? resolveInsideFaceStation({ column: startCol, frame: params.frame, side: 'start' })
    : 0;
  const rightSupportInsideFaceStation = endCol
    ? resolveInsideFaceStation({ column: endCol, frame: params.frame, side: 'end' })
    : params.frame.lengthMeters;
  const panelStartStationMeters = leftSupportInsideFaceStation;
  const panelEndStationMeters = rightSupportInsideFaceStation;
  const clearWidthMeters = panelEndStationMeters - panelStartStationMeters;
  if (clearWidthMeters <= 0.05) return null;

  const elevations =
    params.plinthBeamTopMeters != null && params.roofBeamBottomMeters != null
      ? { plinthBeamTopMeters: params.plinthBeamTopMeters, roofBeamBottomMeters: params.roofBeamBottomMeters }
      : params.gradeBeamTopMeters != null && params.ringBeamBaseMeters != null
        ? { plinthBeamTopMeters: params.gradeBeamTopMeters, roofBeamBottomMeters: params.ringBeamBaseMeters }
        : segmentBeamElevations(params.beams, params.segmentId, params.segment.wallHeightMeters);

  const leftSupportInsideFaceWorld = startCol
    ? { ...columnInsideFaceWorldPoint(startCol, params.frame, 'start'), y: elevations.plinthBeamTopMeters }
    : {
        x: params.frame.centerlineStart.x,
        y: elevations.plinthBeamTopMeters,
        z: params.frame.centerlineStart.z,
      };
  const rightSupportInsideFaceWorld = endCol
    ? { ...columnInsideFaceWorldPoint(endCol, params.frame, 'end'), y: elevations.plinthBeamTopMeters }
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
    clearHeightMeters: elevations.roofBeamBottomMeters - elevations.plinthBeamTopMeters,
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
    outwardNormal: { x: params.frame.outwardNormal.x, y: 0, z: params.frame.outwardNormal.z },
    inwardNormal: { x: params.frame.inwardNormal.x, y: 0, z: params.frame.inwardNormal.z },
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
  params.layout.segments.forEach((segment, index) => {
    const frame = params.segmentFrames.find((candidate) => candidate.segmentId === segment.id);
    if (!frame) return;
    const resolved = resolveInfillPanelBoundsForSegment({
      panelId: `infill-${segment.id}-${index}`,
      segmentId: segment.id,
      segment,
      frame,
      columns: params.columns,
      beams: params.beams,
    });
    if (resolved) bounds.push(resolved);
  });
  return bounds;
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
      (beam.kind === 'plinth_beam' || beam.kind === 'grade_beam') &&
      beam.hostSegmentId === params.bounds.hostSegmentId,
  );
  const roofBeam = params.beams.find(
    (beam) =>
      (beam.kind === 'roof_beam' || beam.kind === 'ring_beam') &&
      beam.hostSegmentId === params.bounds.hostSegmentId,
  );
  return {
    id: params.existingPanel?.id ?? params.bounds.panelId,
    hostSegmentId: params.bounds.hostSegmentId,
    leftSupportType: params.bounds.leftColumnId ? 'column' : 'wall_end',
    leftSupportId: params.bounds.leftColumnId,
    rightSupportType: params.bounds.rightColumnId ? 'column' : 'wall_end',
    rightSupportId: params.bounds.rightColumnId,
    bottomSupportType: plinthBeam ? 'plinth_beam' : 'grade_beam',
    bottomSupportId: plinthBeam?.id ?? params.existingPanel?.bottomSupportId,
    topSupportType: roofBeam ? 'roof_beam' : 'ring_beam',
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

export function assertNear(value: number, expected: number, toleranceMeters: number, label: string): void {
  if (Math.abs(value - expected) > toleranceMeters) {
    throw new Error(`${label}: expected ${expected}, received ${value}`);
  }
}

export function logInfillPanelBoundsTableForDev(
  bounds: ResolvedInfillPanelBounds,
  firstCmuStartStation?: number,
  lastCmuEndStation?: number,
): void {
  if (!import.meta.env.DEV) return;
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
    'first CMU start station',
  );
  assertNear(
    lastCmuEndStation,
    bounds.endStationMeters,
    FRAME_INFILL_BOUNDS_TOLERANCE_METERS,
    'last CMU end station',
  );
}
