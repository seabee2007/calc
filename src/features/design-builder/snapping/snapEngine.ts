import {
  axisLockedPoint,
  dedupeCandidates,
  makeCandidate,
  midpoint,
  orthogonalPoint,
  polarPoint,
  projectPointToSegment,
  segmentIntersection,
  snappedGridPoint,
} from './snapGeometry';
import {
  DEFAULT_SNAP_SETTINGS,
  type ResolveSnapParams,
  type SnapCandidate,
  type SnapResult,
  type SnapSettings,
  type SnapType,
} from './snapTypes';

const PRIORITY: Record<SnapType, number> = {
  none: 99,
  endpoint: 3,
  intersection: 4,
  midpoint: 5,
  perpendicular: 6,
  nearest: 6,
  ortho: 7,
  polar: 7,
  grid: 8,
  'cmu-module': 8,
  parallel: 9,
  extension: 9,
};

export function mergeSnapSettings(settings: Partial<SnapSettings>): SnapSettings {
  return {
    ...DEFAULT_SNAP_SETTINGS,
    ...settings,
    objectSnap: {
      ...DEFAULT_SNAP_SETTINGS.objectSnap,
      ...settings.objectSnap,
    },
    polarAnglesDegrees: settings.polarAnglesDegrees ?? DEFAULT_SNAP_SETTINGS.polarAnglesDegrees,
  };
}

export function resolveSnap(params: ResolveSnapParams): SnapResult {
  const settings = mergeSnapSettings(params.settings);
  const rawScreenPoint = params.rawScreenPoint;
  const rawWorldPoint = params.rawWorldPoint;

  if (params.keyboard?.altHeld) {
    return rawResult(params, []);
  }

  const candidates: SnapCandidate[] = [];
  const objectSnapEnabled = settings.objectSnap.enabled;

  if (objectSnapEnabled) {
    const objectCandidates = buildObjectCandidates(params, settings);
    candidates.push(...objectCandidates.filter((candidate) => candidate.distancePx <= settings.tolerancePx));
  }

  if (params.commandState?.basePoint) {
    const basePoint = params.commandState.basePoint;
    if (params.keyboard?.horizontalLock || params.keyboard?.verticalLock) {
      const point = axisLockedPoint(basePoint, rawWorldPoint, params.keyboard.horizontalLock ? 'x' : 'z');
      candidates.push(makeCandidate({
        rawScreenPoint,
        worldPoint: point,
        planToScreenPoint: params.planToScreenPoint,
        snapType: params.keyboard.horizontalLock ? 'ortho' : 'ortho',
        priority: 1,
        label: params.keyboard.horizontalLock ? 'Horizontal' : 'Vertical',
      }));
    } else if (params.keyboard?.shiftHeld || settings.orthogonal) {
      const point = orthogonalPoint(basePoint, rawWorldPoint);
      candidates.push(makeCandidate({
        rawScreenPoint,
        worldPoint: point,
        planToScreenPoint: params.planToScreenPoint,
        snapType: 'ortho',
        priority: PRIORITY.ortho,
        label: Math.abs(point.z - basePoint.z) < Math.abs(point.x - basePoint.x) ? 'Ortho 0°' : 'Ortho 90°',
      }));
    } else if (settings.polar) {
      const polar = polarPoint(basePoint, rawWorldPoint, settings.polarAnglesDegrees);
      candidates.push(makeCandidate({
        rawScreenPoint,
        worldPoint: polar.point,
        planToScreenPoint: params.planToScreenPoint,
        snapType: 'polar',
        priority: PRIORITY.polar,
        label: `Polar ${Math.round(polar.angleDegrees)}°`,
      }));
    }
  }

  if (settings.snapMode === 'cmu_module' && settings.moduleLengthMeters && settings.moduleLengthMeters > 0) {
    const candidate = makeCandidate({
      rawScreenPoint,
      worldPoint: snappedGridPoint(rawWorldPoint, settings.moduleLengthMeters),
      planToScreenPoint: params.planToScreenPoint,
      snapType: 'cmu-module',
      priority: PRIORITY['cmu-module'],
      label: 'CMU module',
    });
    if (candidate.distancePx <= settings.tolerancePx) candidates.push(candidate);
  } else if (settings.snapMode === 'grid') {
    const candidate = makeCandidate({
      rawScreenPoint,
      worldPoint: snappedGridPoint(rawWorldPoint, settings.gridSpacingMeters),
      planToScreenPoint: params.planToScreenPoint,
      snapType: 'grid',
      priority: PRIORITY.grid,
      label: 'Grid',
    });
    if (candidate.distancePx <= settings.tolerancePx) candidates.push(candidate);
  }

  const ranked = dedupeCandidates(candidates);
  const cycled = pickCycledCandidate(ranked, params.keyboard?.tabCycleIndex);
  if (!cycled) return rawResult(params, ranked);

  return {
    worldPoint: cycled.worldPoint,
    screenPoint: cycled.screenPoint,
    snapped: true,
    snapType: cycled.snapType,
    sourceId: cycled.sourceId,
    distancePx: cycled.distancePx,
    label: cycled.label,
    confidence: cycled.confidence,
    candidates: ranked,
  };
}

function buildObjectCandidates(params: ResolveSnapParams, settings: SnapSettings): SnapCandidate[] {
  const rawScreenPoint = params.rawScreenPoint;
  const rawWorldPoint = params.rawWorldPoint;
  const candidates: SnapCandidate[] = [];
  const points = params.geometry?.points ?? [];
  const segments = params.geometry?.segments ?? [];

  points.forEach((snapPoint) => {
    if (!settings.objectSnap[snapPoint.snapType]) return;
    candidates.push(makeCandidate({
      rawScreenPoint,
      worldPoint: snapPoint.point,
      planToScreenPoint: params.planToScreenPoint,
      snapType: snapPoint.snapType,
      priority: PRIORITY[snapPoint.snapType],
      sourceId: snapPoint.id,
      label: snapPoint.label ?? labelForType(snapPoint.snapType),
    }));
  });

  if (settings.objectSnap.midpoint) {
    segments.forEach((segment) => {
      candidates.push(makeCandidate({
        rawScreenPoint,
        worldPoint: midpoint(segment.start, segment.end),
        planToScreenPoint: params.planToScreenPoint,
        snapType: 'midpoint',
        priority: PRIORITY.midpoint,
        sourceId: segment.id,
        label: 'Midpoint',
      }));
    });
  }

  if (settings.objectSnap.intersection) {
    for (let index = 0; index < segments.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < segments.length; otherIndex += 1) {
        const intersection = segmentIntersection(segments[index]!, segments[otherIndex]!);
        if (!intersection) continue;
        candidates.push(makeCandidate({
          rawScreenPoint,
          worldPoint: intersection,
          planToScreenPoint: params.planToScreenPoint,
          snapType: 'intersection',
          priority: PRIORITY.intersection,
          sourceId: `${segments[index]!.id}:${segments[otherIndex]!.id}`,
          label: 'Intersection',
        }));
      }
    }
  }

  if (settings.objectSnap.nearest || settings.objectSnap.perpendicular) {
    segments.forEach((segment) => {
      const projected = projectPointToSegment(rawWorldPoint, segment);
      if (projected.isEndpoint) return;
      if (settings.objectSnap.nearest) {
        candidates.push(makeCandidate({
          rawScreenPoint,
          worldPoint: projected.point,
          planToScreenPoint: params.planToScreenPoint,
          snapType: 'nearest',
          priority: PRIORITY.nearest,
          sourceId: segment.id,
          label: 'Nearest',
        }));
      }
      if (settings.objectSnap.perpendicular && params.commandState?.basePoint) {
        candidates.push(makeCandidate({
          rawScreenPoint,
          worldPoint: projected.point,
          planToScreenPoint: params.planToScreenPoint,
          snapType: 'perpendicular',
          priority: PRIORITY.perpendicular,
          sourceId: segment.id,
          label: 'Perpendicular',
        }));
      }
    });
  }

  return candidates;
}

function pickCycledCandidate(candidates: readonly SnapCandidate[], tabCycleIndex: number | undefined): SnapCandidate | null {
  if (candidates.length === 0) return null;
  if (!tabCycleIndex) return candidates[0]!;
  return candidates[((tabCycleIndex % candidates.length) + candidates.length) % candidates.length]!;
}

function rawResult(params: ResolveSnapParams, candidates: SnapCandidate[]): SnapResult {
  return {
    worldPoint: params.rawWorldPoint,
    screenPoint: params.rawScreenPoint,
    snapped: false,
    snapType: 'none',
    distancePx: 0,
    confidence: 0,
    candidates,
  };
}

function labelForType(type: SnapType): string {
  switch (type) {
    case 'endpoint':
      return 'Endpoint';
    case 'midpoint':
      return 'Midpoint';
    case 'intersection':
      return 'Intersection';
    case 'nearest':
      return 'Nearest';
    default:
      return type;
  }
}
