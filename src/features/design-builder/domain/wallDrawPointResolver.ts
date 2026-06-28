import type { SegmentFrame } from '../geometry/designGeometry';
import type { DesignBuilderSnapMode, DesignWallLayoutParameters, ModuleFitMode } from '../types';
import {
  EXACT_RECTANGLE_CORNER_SNAP_LABEL,
  resolveDesignSnapPoint,
  type DesignSnapTarget,
} from './designSnapRules';
import { snapLengthToCmuHalfModule } from './cmuModuleRules';
import {
  GUIDE_CAPTURE_RADIUS_PX,
  projectExactSegmentLength,
  resolveDrawWallGuidance,
  resolveOrthogonalCornerPoint,
  resolveShiftConstrainedPoint,
} from './wallLayoutRules';
import { ORTHOGONAL_COMMIT_TOLERANCE_METERS } from './wallFootprintValidation';

type PlanPoint = { x: number; z: number };

export type ResolvedWallDrawPoint = {
  point: PlanPoint;
  rawPoint: PlanPoint;
  snapTarget: DesignSnapTarget;
  constraintLabel: string | null;
  metrics: {
    lengthMeters: number;
    angleDegrees: number;
  };
  exactLengthApplied: boolean;
  moduleLengthApplied: boolean;
  closure?: {
    exactCorner: PlanPoint;
    captured: boolean;
    closingLengthMeters: number;
    closingAngleDegrees: number;
    isExactClosure: boolean;
    exactLengthConflict: boolean;
    rawDistancePx: number;
  };
};

export function resolveWallDrawPoint(params: {
  layout: DesignWallLayoutParameters;
  activeNodeId: string | null;
  rawPoint: PlanPoint;
  snapMode: DesignBuilderSnapMode;
  moduleLengthMeters: number;
  pixelsPerMeter: number;
  shiftHeld?: boolean;
  altHeld?: boolean;
  exactLengthMeters?: number;
  moduleFitMode: ModuleFitMode;
  previousSnap?: DesignSnapTarget | null;
  segmentFrames?: readonly SegmentFrame[];
}): ResolvedWallDrawPoint {
  const activeNode = params.activeNodeId
    ? params.layout.nodes.find((node) => node.id === params.activeNodeId) ?? null
    : null;
  const exactCorner =
    params.layout.orthogonalLock && params.activeNodeId && !params.altHeld
      ? resolveOrthogonalCornerPoint({ layout: params.layout, activeNodeId: params.activeNodeId })
      : null;
  const snapTarget = resolveDesignSnapPoint({
    layout: params.layout,
    point: params.rawPoint,
    snapMode: params.snapMode,
    moduleLengthMeters: params.moduleLengthMeters,
    pixelsPerMeter: params.pixelsPerMeter,
    altHeld: params.altHeld,
    segmentFrames: params.segmentFrames,
    drawContext: {
      activeNodeId: params.activeNodeId,
      orthogonalLock: params.layout.orthogonalLock,
      shiftHeld: params.shiftHeld,
      closureCornerCandidate: exactCorner,
    },
    previousSnap: params.previousSnap,
  });

  if (!activeNode || !params.activeNodeId) {
    return {
      point: snapTarget.point,
      rawPoint: params.rawPoint,
      snapTarget,
      constraintLabel: null,
      metrics: { lengthMeters: 0, angleDegrees: 0 },
      exactLengthApplied: false,
      moduleLengthApplied: false,
    };
  }

  const closureSnapCaptured =
    snapTarget.type === 'guide' &&
    snapTarget.captured &&
    snapTarget.label === EXACT_RECTANGLE_CORNER_SNAP_LABEL &&
    exactCorner != null;

  const exactClosureLengthMeters = exactCorner ? distance(activeNode, exactCorner) : null;
  const exactLengthConflict =
    params.exactLengthMeters != null &&
    params.exactLengthMeters > 0 &&
    exactClosureLengthMeters != null &&
    Math.abs(params.exactLengthMeters - exactClosureLengthMeters) > ORTHOGONAL_COMMIT_TOLERANCE_METERS;

  const resolved = applyDrawGuidanceAfterSnap({
    layout: params.layout,
    activeNodeId: params.activeNodeId,
    snapTarget,
    shiftHeld: params.shiftHeld,
    altHeld: params.altHeld,
  });
  let point = resolved.point;
  let constraintLabel = resolved.constraintLabel;
  let exactLengthApplied = false;
  let moduleLengthApplied = false;

  if (closureSnapCaptured && exactCorner) {
    point = exactCorner;
    constraintLabel = exactLengthConflict
      ? 'Closure overrides typed length: exact rectangle corner'
      : 'Closure: exact rectangle corner';
  } else {
    if (params.exactLengthMeters != null && params.exactLengthMeters > 0) {
      point = projectExactSegmentLength(activeNode, point.x, point.z, params.exactLengthMeters);
      exactLengthApplied = true;
    } else if (params.moduleFitMode === 'snap_during_draw') {
      const length = distance(activeNode, point);
      const modularLength = snapLengthToCmuHalfModule(length, params.moduleLengthMeters);
      if (modularLength > 0) {
        point = projectExactSegmentLength(activeNode, point.x, point.z, modularLength);
        moduleLengthApplied = true;
      }
    }

    if (exactCorner) {
      const finalDistancePx = distance(point, exactCorner) * Math.max(1, params.pixelsPerMeter);
      if (finalDistancePx <= GUIDE_CAPTURE_RADIUS_PX && !nearPlanPoint(point, exactCorner)) {
        constraintLabel = exactLengthConflict
          ? 'Typed length conflicts with exact rectangle closure'
          : 'Closure: not exact';
      } else if (nearPlanPoint(point, exactCorner)) {
        constraintLabel = 'Closure: exact rectangle corner';
      }
    }
  }

  const metrics = resolveMetrics(activeNode, point);
  const closure = exactCorner
    ? resolveClosureMetadata({
        activeNode,
        exactCorner,
        point,
        rawPoint: params.rawPoint,
        pixelsPerMeter: params.pixelsPerMeter,
        captured: closureSnapCaptured,
        exactLengthConflict,
        layout: params.layout,
      })
    : undefined;

  return {
    point,
    rawPoint: params.rawPoint,
    snapTarget,
    constraintLabel,
    metrics,
    exactLengthApplied,
    moduleLengthApplied,
    closure,
  };
}

function applyDrawGuidanceAfterSnap(params: {
  layout: DesignWallLayoutParameters;
  activeNodeId: string;
  snapTarget: DesignSnapTarget;
  shiftHeld?: boolean;
  altHeld?: boolean;
}): { point: PlanPoint; constraintLabel: string | null } {
  if (params.altHeld) {
    return { point: params.snapTarget.point, constraintLabel: null };
  }
  if (params.snapTarget.type === 'node' || params.snapTarget.type === 'endpoint') {
    return { point: params.snapTarget.point, constraintLabel: null };
  }
  if (params.snapTarget.type === 'guide') {
    if (params.snapTarget.label === EXACT_RECTANGLE_CORNER_SNAP_LABEL) {
      return { point: params.snapTarget.point, constraintLabel: 'Closure: exact rectangle corner' };
    }
    if (params.shiftHeld || params.snapTarget.captured) {
      return { point: params.snapTarget.point, constraintLabel: params.snapTarget.label ?? 'Current segment: 90 deg locked' };
    }
  }
  if (params.shiftHeld) {
    const constrained = resolveShiftConstrainedPoint({
      layout: params.layout,
      activeNodeId: params.activeNodeId,
      rawPoint: params.snapTarget.point,
    });
    if (params.snapTarget.type === 'grid' || params.snapTarget.type === 'cmu_module') {
      const activeNode = params.layout.nodes.find((node) => node.id === params.activeNodeId);
      if (activeNode) {
        const dx = constrained.point.x - activeNode.x;
        const dz = constrained.point.z - activeNode.z;
        const length = Math.hypot(dx, dz);
        if (length > 0) {
          const dir = { x: dx / length, z: dz / length };
          const t =
            (params.snapTarget.point.x - activeNode.x) * dir.x +
            (params.snapTarget.point.z - activeNode.z) * dir.z;
          return {
            point: { x: activeNode.x + dir.x * t, z: activeNode.z + dir.z * t },
            constraintLabel: constrained.kind === 'parallel' ? 'Current segment: parallel locked' : 'Current segment: 90 deg locked',
          };
        }
      }
    }
    return {
      point: constrained.point,
      constraintLabel: constrained.kind === 'parallel' ? 'Current segment: parallel locked' : 'Current segment: 90 deg locked',
    };
  }
  if (params.layout.orthogonalLock) {
    const guidance = resolveDrawWallGuidance({
      layout: params.layout,
      activeNodeId: params.activeNodeId,
      rawPoint: params.snapTarget.point,
      orthogonalLock: true,
    });
    if (guidance.kind !== 'free') {
      return {
        point: guidance.point,
        constraintLabel: guidance.kind === 'parallel' ? 'Current segment: parallel locked' : 'Current segment: 90 deg locked',
      };
    }
  }
  return { point: params.snapTarget.point, constraintLabel: null };
}

function resolveMetrics(start: PlanPoint, point: PlanPoint): { lengthMeters: number; angleDegrees: number } {
  return {
    lengthMeters: distance(start, point),
    angleDegrees: ((Math.atan2(point.z - start.z, point.x - start.x) * 180) / Math.PI + 360) % 360,
  };
}

function resolveClosureMetadata(params: {
  layout: DesignWallLayoutParameters;
  activeNode: PlanPoint;
  exactCorner: PlanPoint;
  point: PlanPoint;
  rawPoint: PlanPoint;
  pixelsPerMeter: number;
  captured: boolean;
  exactLengthConflict: boolean;
}): NonNullable<ResolvedWallDrawPoint['closure']> {
  const firstSegment = params.layout.segments[0];
  const firstNode = firstSegment
    ? params.layout.nodes.find((node) => node.id === firstSegment.startNodeId) ?? null
    : null;
  const closingTarget = firstNode ?? params.exactCorner;
  const closingVector = {
    x: closingTarget.x - params.point.x,
    z: closingTarget.z - params.point.z,
  };
  return {
    exactCorner: params.exactCorner,
    captured: params.captured,
    closingLengthMeters: Math.hypot(closingVector.x, closingVector.z),
    closingAngleDegrees: ((Math.atan2(closingVector.z, closingVector.x) * 180) / Math.PI + 360) % 360,
    isExactClosure: nearPlanPoint(params.point, params.exactCorner),
    exactLengthConflict: params.exactLengthConflict,
    rawDistancePx: distance(params.rawPoint, params.exactCorner) * Math.max(1, params.pixelsPerMeter),
  };
}

function nearPlanPoint(
  left: PlanPoint,
  right: PlanPoint,
  toleranceMeters = ORTHOGONAL_COMMIT_TOLERANCE_METERS,
): boolean {
  return distance(left, right) <= toleranceMeters;
}

function distance(left: PlanPoint, right: PlanPoint): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}
