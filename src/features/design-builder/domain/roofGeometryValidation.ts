import type {
  DesignWarning,
  PurlinPlacement,
  ResolvedRoofSystem,
  RoofPlane,
  RoofVec3,
  SteelMemberSegment,
  TrussPlacement,
} from '../types';
import {
  CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
  distanceAlongRoofNormal,
  elevationOnRoofPlaneAtPoint,
  normalizeOutwardRoofNormal,
  offsetPointAlongRoofNormal,
  PURLIN_PROFILE_DEPTH_METERS,
  PURLIN_TO_SHEET_CLEARANCE_METERS,
  TRUSS_CHORD_PROFILE_METERS,
  trussMemberLength,
} from './roofFramingResolver';

export type RoofGeometryWarningCode =
  | 'roof_plane_non_finite'
  | 'roof_plane_degenerate'
  | 'roof_plane_pitch_mismatch'
  | 'roof_cladding_flat_despite_pitch'
  | 'roof_cladding_plane_normal_mismatch'
  | 'roof_ridge_not_on_cladding_planes'
  | 'truss_station_out_of_ridge_range'
  | 'truss_bearing_collapsed_to_ridge'
  | 'truss_top_chord_unreasonable_length'
  | 'hip_jack_rafter_missing'
  | 'hip_jack_rafter_off_roof_plane'
  | 'hip_jack_rafter_does_not_hit_hip'
  | 'purlin_missing_source_plane'
  | 'purlin_endpoint_outside_roof_plane'
  | 'purlin_to_cladding_underside_gap_invalid'
  | 'cladding_display_plane_outside_cladding_perimeter';

export type RoofGeometryValidationIssue = {
  code: RoofGeometryWarningCode;
  message: string;
  severity: DesignWarning['severity'];
  sourceKind:
    | 'roof_plane'
    | 'cladding_display_plane'
    | 'ridge'
    | 'truss'
    | 'hip_member'
    | 'purlin'
    | 'roof';
  sourceId?: string;
  details?: Record<string, string | number | boolean | null>;
};

export type RoofGeometryValidationMetrics = {
  hasNonFiniteGeometry: boolean;
  hasFlatCladdingDespitePitch: boolean;
  maxPurlinPlaneOffsetM: number | null;
  maxCladdingOverrunM: number | null;
  badPlaneIds: string[];
  badPurlinIds: string[];
};

export type RoofGeometryValidationResult = {
  issues: RoofGeometryValidationIssue[];
  metrics: RoofGeometryValidationMetrics;
};

const ROOF_PLANE_MIN_AREA_M2 = 1e-4;
const FOOTPRINT_CONTAINMENT_TOLERANCE_METERS = 0.02;
const NORMAL_MATCH_MIN_DOT = 0.95;
const PURLIN_GAP_TOLERANCE_METERS = 0.01;
const CLADDING_OVERRUN_TOLERANCE_METERS = 0.35;
const PITCH_MISMATCH_TOLERANCE_RADIANS = 0.08;
const RIDGE_ON_PLANE_TOLERANCE_METERS = 0.02;
const HIP_JACK_PLANE_TOLERANCE_METERS = 0.05;
const HIP_JACK_HIT_TOLERANCE_METERS = 0.05;

export function collectResolvedRoofGeometryIssues(
  resolved: ResolvedRoofSystem,
): RoofGeometryValidationResult {
  const issues: RoofGeometryValidationIssue[] = [];
  const badPlaneIds = new Set<string>();
  const badPurlinIds = new Set<string>();
  let maxPurlinPlaneOffsetM: number | null = null;
  let maxCladdingOverrunM: number | null = null;

  const sourcePlaneById = new Map(
    resolved.roofTopPlanes.map((plane) => [plane.id, plane]),
  );
  const displayPlaneBySourceId = new Map(
    resolved.claddingDisplayPlanes.map((plane) => [
      sourceIdForCladdingDisplayPlane(plane.id),
      plane,
    ]),
  );

  for (const plane of resolved.roofTopPlanes) {
    const planeIssues = validateRoofPlane({
      plane,
      kind: 'roof_plane',
      expectedPitchRadians: resolved.roofPitchRadians,
    });
    if (planeIssues.length > 0) badPlaneIds.add(plane.id);
    issues.push(...planeIssues);
  }

  for (const plane of resolved.claddingDisplayPlanes) {
    const planeIssues = validateRoofPlane({
      plane,
      kind: 'cladding_display_plane',
      expectedPitchRadians: null,
    });
    if (planeIssues.length > 0) badPlaneIds.add(plane.id);
    issues.push(...planeIssues);

    if (resolved.roofPitchRadians > 0.01 && isPlaneNearlyFlat(plane)) {
      badPlaneIds.add(plane.id);
      issues.push({
        code: 'roof_cladding_flat_despite_pitch',
        message: 'Roof cladding resolved flat even though roof has pitch.',
        severity: 'review',
        sourceKind: 'cladding_display_plane',
        sourceId: plane.id,
      });
    }

    const sourcePlane = sourcePlaneById.get(sourceIdForCladdingDisplayPlane(plane.id));
    if (sourcePlane) {
      const dot = Math.abs(
        dot3(normalizeOutwardRoofNormal(sourcePlane.normal), normalizeOutwardRoofNormal(plane.normal)),
      );
      if (dot < NORMAL_MATCH_MIN_DOT) {
        badPlaneIds.add(plane.id);
        issues.push({
          code: 'roof_cladding_plane_normal_mismatch',
          message: 'Roof cladding display plane normal does not match the source roof plane.',
          severity: 'review',
          sourceKind: 'cladding_display_plane',
          sourceId: plane.id,
          details: {
            sourcePlaneId: sourcePlane.id,
            normalDot: roundMetric(dot),
            minimumDot: NORMAL_MATCH_MIN_DOT,
          },
        });
      }
    }
  }

  if (resolved.roofType === 'gable') {
    for (const [label, point] of [
      ['start', resolved.claddingRidgeStart],
      ['end', resolved.claddingRidgeEnd],
    ] as const) {
      if (!point) continue;
      const ridgeDisplayElevations = resolved.claddingDisplayPlanes
        .filter((plane) =>
          pointInRoofPlaneFootprint(plane, point, RIDGE_ON_PLANE_TOLERANCE_METERS),
        )
        .map((plane) => elevationOnRoofPlaneAtPoint(plane, point.x, point.z))
        .filter((y): y is number => y != null && Number.isFinite(y));
      const minDisplayY =
        ridgeDisplayElevations.length > 0
          ? Math.min(...ridgeDisplayElevations)
          : null;
      const maxDisplayY =
        ridgeDisplayElevations.length > 0
          ? Math.max(...ridgeDisplayElevations)
          : null;
      const displayElevationSpread =
        minDisplayY != null && maxDisplayY != null ? maxDisplayY - minDisplayY : null;
      if (
        ridgeDisplayElevations.length < 2 ||
        displayElevationSpread == null ||
        displayElevationSpread > RIDGE_ON_PLANE_TOLERANCE_METERS
      ) {
        issues.push({
          code: 'roof_ridge_not_on_cladding_planes',
          message: 'Gable cladding ridge endpoint does not land on a cladding display plane.',
          severity: 'review',
          sourceKind: 'ridge',
          sourceId: `cladding-ridge-${label}`,
          details: {
            x: roundMetric(point.x),
            y: roundMetric(point.y),
            z: roundMetric(point.z),
            displayPlaneMatches: ridgeDisplayElevations.length,
            displayElevationSpreadMeters:
              displayElevationSpread == null ? null : roundMetric(displayElevationSpread),
            toleranceMeters: RIDGE_ON_PLANE_TOLERANCE_METERS,
          },
        });
      }
    }
  }

  for (const truss of resolved.trussPlacements) {
    validateTrussPlacementGeometry(resolved, truss, issues);
  }

  validateHipJackGeometry(resolved, sourcePlaneById, issues);

  for (const purlin of resolved.purlinPlacements) {
    const sourcePlane = sourcePlaneById.get(purlin.slopePlaneId);
    const displayPlane = displayPlaneBySourceId.get(purlin.slopePlaneId);
    if (!sourcePlane) {
      badPurlinIds.add(purlin.id);
      issues.push({
        code: 'purlin_missing_source_plane',
        message: 'Purlin references a roof plane that does not exist.',
        severity: 'review',
        sourceKind: 'purlin',
        sourceId: purlin.id,
        details: { slopePlaneId: purlin.slopePlaneId },
      });
      continue;
    }

    const sourceNormal = normalizeOutwardRoofNormal(sourcePlane.normal);
    for (const [endpointName, endpoint] of [
      ['start', purlin.start],
      ['end', purlin.end],
    ] as const) {
      if (!pointInRoofPlaneFootprint(sourcePlane, endpoint, FOOTPRINT_CONTAINMENT_TOLERANCE_METERS)) {
        badPurlinIds.add(purlin.id);
        issues.push({
          code: 'purlin_endpoint_outside_roof_plane',
          message: 'Purlin endpoint is outside its assigned roof plane.',
          severity: 'review',
          sourceKind: 'purlin',
          sourceId: purlin.id,
          details: {
            endpoint: endpointName,
            slopePlaneId: purlin.slopePlaneId,
            x: roundMetric(endpoint.x),
            z: roundMetric(endpoint.z),
          },
        });
      }
    }

    const center = purlinCenter(purlin);
    const sourceY = elevationOnRoofPlaneAtPoint(sourcePlane, center.x, center.z);
    if (sourceY != null) {
      const offset = Math.abs(
        distanceAlongRoofNormal(
          { x: center.x, y: sourceY, z: center.z },
          center,
          sourceNormal,
        ),
      );
      maxPurlinPlaneOffsetM = Math.max(maxPurlinPlaneOffsetM ?? 0, offset);
    }

    if (!displayPlane) {
      badPurlinIds.add(purlin.id);
      issues.push({
        code: 'purlin_to_cladding_underside_gap_invalid',
        message: 'Purlin cannot be checked because its cladding display plane is missing.',
        severity: 'review',
        sourceKind: 'purlin',
        sourceId: purlin.id,
        details: { slopePlaneId: purlin.slopePlaneId },
      });
      continue;
    }
    const displayTopY = elevationOnRoofPlaneAtPoint(displayPlane, center.x, center.z);
    if (displayTopY == null) {
      badPurlinIds.add(purlin.id);
      issues.push({
        code: 'purlin_to_cladding_underside_gap_invalid',
        message: 'Purlin cannot be checked because cladding display elevation could not be resolved.',
        severity: 'review',
        sourceKind: 'purlin',
        sourceId: purlin.id,
        details: { slopePlaneId: purlin.slopePlaneId },
      });
      continue;
    }
    const purlinNormal = normalizeOutwardRoofNormal(purlin.planeNormal);
    const purlinTop = offsetPointAlongRoofNormal(
      center,
      purlinNormal,
      PURLIN_PROFILE_DEPTH_METERS / 2,
    );
    const displayUnderside = offsetPointAlongRoofNormal(
      { x: center.x, y: displayTopY, z: center.z },
      purlinNormal,
      -CORRUGATED_SHEET_DISPLAY_THICKNESS_METERS,
    );
    const actualGapMeters = distanceAlongRoofNormal(
      purlinTop,
      displayUnderside,
      purlinNormal,
    );
    if (Math.abs(actualGapMeters - PURLIN_TO_SHEET_CLEARANCE_METERS) > PURLIN_GAP_TOLERANCE_METERS) {
      badPurlinIds.add(purlin.id);
      issues.push({
        code: 'purlin_to_cladding_underside_gap_invalid',
        message: 'Purlin top to cladding underside gap is outside tolerance.',
        severity: 'review',
        sourceKind: 'purlin',
        sourceId: purlin.id,
        details: {
          slopePlaneId: purlin.slopePlaneId,
          rowIndex: purlin.rowIndex,
          actualGapMeters: roundMetric(actualGapMeters),
          expectedGapMeters: PURLIN_TO_SHEET_CLEARANCE_METERS,
          toleranceMeters: PURLIN_GAP_TOLERANCE_METERS,
        },
      });
    }
  }

  const referenceBounds = boundsForPoints(
    resolved.roofSheetPerimeter.length > 0
      ? resolved.roofSheetPerimeter
      : resolved.claddingPerimeter,
  );
  if (referenceBounds) {
    for (const plane of resolved.claddingDisplayPlanes) {
      for (const corner of plane.corners) {
        const overrun = boundsOverrunMeters(corner, referenceBounds);
        maxCladdingOverrunM = Math.max(maxCladdingOverrunM ?? 0, overrun);
        if (overrun > CLADDING_OVERRUN_TOLERANCE_METERS) {
          badPlaneIds.add(plane.id);
          issues.push({
            code: 'cladding_display_plane_outside_cladding_perimeter',
            message: 'Cladding display plane extends beyond the expected cladding perimeter.',
            severity: 'review',
            sourceKind: 'cladding_display_plane',
            sourceId: plane.id,
            details: {
              overrunMeters: roundMetric(overrun),
              toleranceMeters: CLADDING_OVERRUN_TOLERANCE_METERS,
            },
          });
        }
      }
    }
  }

  return {
    issues,
    metrics: {
      hasNonFiniteGeometry: issues.some((issue) => issue.code === 'roof_plane_non_finite'),
      hasFlatCladdingDespitePitch: issues.some((issue) => issue.code === 'roof_cladding_flat_despite_pitch'),
      maxPurlinPlaneOffsetM: maxPurlinPlaneOffsetM == null ? null : roundMetric(maxPurlinPlaneOffsetM),
      maxCladdingOverrunM: maxCladdingOverrunM == null ? null : roundMetric(maxCladdingOverrunM),
      badPlaneIds: [...badPlaneIds].sort(),
      badPurlinIds: [...badPurlinIds].sort(),
    },
  };
}

export function validateResolvedRoofGeometry(
  resolved: ResolvedRoofSystem,
): DesignWarning[] {
  return summarizeRoofGeometryIssues(
    collectResolvedRoofGeometryIssues(resolved).issues,
  );
}

export function dedupeDesignWarnings(
  warnings: readonly DesignWarning[],
): DesignWarning[] {
  const seen = new Set<string>();
  const deduped: DesignWarning[] = [];
  for (const warning of warnings) {
    const key = `${warning.code}:${warning.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(warning);
  }
  return deduped;
}

export function summarizeRoofGeometryIssues(
  issues: readonly RoofGeometryValidationIssue[],
): DesignWarning[] {
  const byCode = new Map<RoofGeometryWarningCode, RoofGeometryValidationIssue[]>();
  for (const issue of issues) {
    const list = byCode.get(issue.code) ?? [];
    list.push(issue);
    byCode.set(issue.code, list);
  }

  return dedupeDesignWarnings(
    [...byCode.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, codeIssues]) => ({
        code,
        severity: codeIssues.some((issue) => issue.severity === 'error') ? 'error' : 'review',
        message: messageForIssueGroup(code, codeIssues.length),
      })),
  );
}

function messageForIssueGroup(code: RoofGeometryWarningCode, count: number): string {
  switch (code) {
    case 'roof_plane_non_finite':
      return count === 1
        ? 'Roof geometry contains a non-finite plane coordinate.'
        : `${count} roof plane coordinates are non-finite.`;
    case 'roof_plane_degenerate':
      return count === 1
        ? 'Roof geometry contains a degenerate plane.'
        : `${count} roof planes are degenerate.`;
    case 'roof_plane_pitch_mismatch':
      return count === 1
        ? 'A roof plane pitch does not match the resolved roof pitch.'
        : `${count} roof planes have pitch that does not match the resolved roof pitch.`;
    case 'roof_cladding_flat_despite_pitch':
      return count === 1
        ? 'Roof cladding resolved flat even though roof has pitch.'
        : `${count} roof cladding display planes resolved flat even though roof has pitch.`;
    case 'roof_cladding_plane_normal_mismatch':
      return count === 1
        ? 'A cladding display plane normal does not match its source roof plane.'
        : `${count} cladding display plane normals do not match their source roof planes.`;
    case 'roof_ridge_not_on_cladding_planes':
      return count === 1
        ? 'A gable cladding ridge endpoint does not land on the cladding display planes.'
        : `${count} gable cladding ridge endpoints do not land on the cladding display planes.`;
    case 'truss_station_out_of_ridge_range':
      return count === 1
        ? 'A truss station is outside the structural ridge range.'
        : `${count} truss stations are outside the structural ridge range.`;
    case 'truss_bearing_collapsed_to_ridge':
      return count === 1
        ? 'A truss bearing point collapsed to the ridge point.'
        : `${count} truss bearing points collapsed to their ridge points.`;
    case 'truss_top_chord_unreasonable_length':
      return count === 1
        ? 'A truss top chord length exceeds the expected roof span.'
        : `${count} truss top chord lengths exceed the expected roof span.`;
    case 'hip_jack_rafter_missing':
      return 'A rectangular hip roof is missing generated hip jack rafters.';
    case 'hip_jack_rafter_off_roof_plane':
      return count === 1
        ? 'A hip jack rafter is outside its assigned roof plane.'
        : `${count} hip jack rafters are outside their assigned roof planes.`;
    case 'hip_jack_rafter_does_not_hit_hip':
      return count === 1
        ? 'A hip jack rafter does not terminate on a hip rafter.'
        : `${count} hip jack rafters do not terminate on hip rafters.`;
    case 'purlin_missing_source_plane':
      return count === 1
        ? 'A purlin references a missing roof plane.'
        : `${count} purlins reference missing roof planes.`;
    case 'purlin_endpoint_outside_roof_plane':
      return count === 1
        ? 'A purlin endpoint is outside its assigned roof plane.'
        : `${count} purlin endpoints are outside their assigned roof planes.`;
    case 'purlin_to_cladding_underside_gap_invalid':
      return count === 1
        ? 'A purlin-to-cladding underside gap is outside tolerance.'
        : `${count} purlin-to-cladding underside gaps are outside tolerance.`;
    case 'cladding_display_plane_outside_cladding_perimeter':
      return count === 1
        ? 'A cladding display plane extends beyond the expected roof perimeter.'
        : `${count} cladding display planes extend beyond the expected roof perimeter.`;
  }
}

function validateRoofPlane(params: {
  plane: RoofPlane;
  kind: 'roof_plane' | 'cladding_display_plane';
  expectedPitchRadians: number | null;
}): RoofGeometryValidationIssue[] {
  const issues: RoofGeometryValidationIssue[] = [];
  const { plane } = params;
  const sourceKind = params.kind;
  if (
    !plane.corners.every(isFinitePoint) ||
    !isFinitePoint(plane.normal)
  ) {
    issues.push({
      code: 'roof_plane_non_finite',
      message: 'Roof plane contains non-finite coordinates.',
      severity: 'error',
      sourceKind,
      sourceId: plane.id,
    });
  }
  const area = roofPlaneArea(plane);
  if (!Number.isFinite(area) || area <= ROOF_PLANE_MIN_AREA_M2) {
    issues.push({
      code: 'roof_plane_degenerate',
      message: 'Roof plane has near-zero area.',
      severity: 'error',
      sourceKind,
      sourceId: plane.id,
      details: { areaM2: Number.isFinite(area) ? roundMetric(area) : null },
    });
  }
  if (
    params.expectedPitchRadians != null &&
    params.expectedPitchRadians > 0.01 &&
    Number.isFinite(area) &&
    area > ROOF_PLANE_MIN_AREA_M2
  ) {
    const pitch = roofPlanePitchRadians(plane);
    if (Math.abs(pitch - params.expectedPitchRadians) > PITCH_MISMATCH_TOLERANCE_RADIANS) {
      issues.push({
        code: 'roof_plane_pitch_mismatch',
        message: 'Roof plane pitch does not match resolved roof pitch.',
        severity: 'review',
        sourceKind,
        sourceId: plane.id,
        details: {
          expectedPitchRadians: roundMetric(params.expectedPitchRadians),
          actualPitchRadians: roundMetric(pitch),
          toleranceRadians: PITCH_MISMATCH_TOLERANCE_RADIANS,
        },
      });
    }
  }
  return issues;
}

function validateTrussPlacementGeometry(
  resolved: ResolvedRoofSystem,
  truss: TrussPlacement,
  issues: RoofGeometryValidationIssue[],
): void {
  if (
    truss.stationMeters < -FOOTPRINT_CONTAINMENT_TOLERANCE_METERS ||
    truss.stationMeters > resolved.structuralRidgeLengthMeters + FOOTPRINT_CONTAINMENT_TOLERANCE_METERS
  ) {
    issues.push({
      code: 'truss_station_out_of_ridge_range',
      message: 'Truss station is outside the structural ridge range.',
      severity: 'review',
      sourceKind: 'truss',
      sourceId: truss.id,
      details: {
        stationMeters: roundMetric(truss.stationMeters),
        structuralRidgeLengthMeters: roundMetric(resolved.structuralRidgeLengthMeters),
      },
    });
  }

  const ridgePoint = trussRidgePoint(resolved, truss.stationMeters);
  if (ridgePoint) {
    for (const [bearingName, bearing] of [
      ['left', truss.bearingLeft],
      ['right', truss.bearingRight],
    ] as const) {
      const distance = Math.hypot(bearing.x - ridgePoint.x, bearing.z - ridgePoint.z);
      if (distance <= FOOTPRINT_CONTAINMENT_TOLERANCE_METERS) {
        issues.push({
          code: 'truss_bearing_collapsed_to_ridge',
          message: 'Truss bearing collapsed to the ridge point.',
          severity: 'review',
          sourceKind: 'truss',
          sourceId: truss.id,
          details: { bearing: bearingName, distanceMeters: roundMetric(distance) },
        });
      }
    }
  }

  const maxExpectedTopChordLength = Math.max(
    resolved.rafterLengthMeters,
    resolved.claddingRafterLengthMeters,
    resolved.roofMemberReferenceLengthMeters,
  ) + 0.5;
  const topChordMembers = truss.members.filter(isTopChordMember);
  for (const member of topChordMembers) {
    const length = trussMemberLength(member);
    if (length > maxExpectedTopChordLength) {
      issues.push({
        code: 'truss_top_chord_unreasonable_length',
        message: 'Truss top chord length exceeds expected roof span.',
        severity: 'review',
        sourceKind: 'truss',
        sourceId: truss.id,
        details: {
          memberId: member.id,
          lengthMeters: roundMetric(length),
          maxExpectedLengthMeters: roundMetric(maxExpectedTopChordLength),
        },
      });
    }
  }
}

function isTopChordMember(member: SteelMemberSegment): boolean {
  return member.memberKind === 'top_chord_left' || member.memberKind === 'top_chord_right';
}

function validateHipJackGeometry(
  resolved: ResolvedRoofSystem,
  sourcePlaneById: ReadonlyMap<string, RoofPlane>,
  issues: RoofGeometryValidationIssue[],
): void {
  if (resolved.roofType !== 'hip') return;

  const jacks = resolved.hipFramingMembers.filter((member) => member.memberKind === 'jack');
  const hipRafters = resolved.hipFramingMembers.filter((member) => member.memberKind === 'hip');
  const hasRectangularHip =
    resolved.structuralRidgeStart != null &&
    resolved.structuralRidgeEnd != null &&
    resolved.roofTopPlanes.some((plane) => plane.corners.length === 3) &&
    resolved.roofTopPlanes.some((plane) => plane.corners.length === 4);

  if (hasRectangularHip && jacks.length === 0) {
    issues.push({
      code: 'hip_jack_rafter_missing',
      message: 'Rectangular hip roof did not generate hip jack rafters.',
      severity: 'review',
      sourceKind: 'roof',
    });
    return;
  }

  for (const jack of jacks) {
    const plane = jack.slopePlaneId ? sourcePlaneById.get(jack.slopePlaneId) : undefined;
    if (!plane) {
      issues.push({
        code: 'hip_jack_rafter_off_roof_plane',
        message: 'Hip jack rafter references a missing roof plane.',
        severity: 'review',
        sourceKind: 'hip_member',
        sourceId: jack.id,
        details: { slopePlaneId: jack.slopePlaneId ?? null },
      });
    } else if (!hipJackStaysOnRoofPlane(jack, plane)) {
      issues.push({
        code: 'hip_jack_rafter_off_roof_plane',
        message: 'Hip jack rafter endpoint is outside its assigned roof plane or elevation.',
        severity: 'review',
        sourceKind: 'hip_member',
        sourceId: jack.id,
        details: { slopePlaneId: jack.slopePlaneId ?? null },
      });
    }

    const hitsHip = hipRafters.some(
      (hip) => distancePointToSegmentPlan(jack.end, hip.start, hip.end) <= HIP_JACK_HIT_TOLERANCE_METERS,
    );
    if (!hitsHip) {
      issues.push({
        code: 'hip_jack_rafter_does_not_hit_hip',
        message: 'Hip jack rafter endpoint does not land on a hip rafter.',
        severity: 'review',
        sourceKind: 'hip_member',
        sourceId: jack.id,
      });
    }
  }
}

function hipJackStaysOnRoofPlane(
  jack: { start: RoofVec3; end: RoofVec3 },
  plane: RoofPlane,
): boolean {
  for (const endpoint of [jack.start, jack.end]) {
    if (!pointInRoofPlaneFootprint(plane, endpoint, FOOTPRINT_CONTAINMENT_TOLERANCE_METERS)) {
      return false;
    }
    const surfaceY = elevationOnRoofPlaneAtPoint(plane, endpoint.x, endpoint.z);
    if (surfaceY == null) {
      return false;
    }
    const expectedCenterY = surfaceY + TRUSS_CHORD_PROFILE_METERS / 2;
    if (Math.abs(endpoint.y - expectedCenterY) > HIP_JACK_PLANE_TOLERANCE_METERS) {
      return false;
    }
  }
  return true;
}

function distancePointToSegmentPlan(
  point: Pick<RoofVec3, 'x' | 'z'>,
  start: Pick<RoofVec3, 'x' | 'z'>,
  end: Pick<RoofVec3, 'x' | 'z'>,
): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq <= 1e-9) {
    return Math.hypot(point.x - start.x, point.z - start.z);
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lenSq));
  const projected = { x: start.x + dx * t, z: start.z + dz * t };
  return Math.hypot(point.x - projected.x, point.z - projected.z);
}

function trussRidgePoint(
  resolved: ResolvedRoofSystem,
  stationMeters: number,
): RoofVec3 | null {
  const start = resolved.structuralRidgeStart;
  const end = resolved.structuralRidgeEnd;
  if (!start || !end || resolved.structuralRidgeLengthMeters <= 0) {
    return null;
  }
  const t = Math.max(0, Math.min(1, stationMeters / resolved.structuralRidgeLengthMeters));
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t,
  };
}

function sourceIdForCladdingDisplayPlane(id: string): string {
  return id.replace(/-cladding-display$/, '');
}

function purlinCenter(purlin: PurlinPlacement): RoofVec3 {
  return {
    x: (purlin.start.x + purlin.end.x) / 2,
    y: (purlin.start.y + purlin.end.y) / 2,
    z: (purlin.start.z + purlin.end.z) / 2,
  };
}

function roofPlanePitchRadians(plane: RoofPlane): number {
  const normal = normalizeOutwardRoofNormal(plane.normal);
  return Math.acos(Math.min(1, Math.max(0, Math.abs(normal.y))));
}

function isPlaneNearlyFlat(plane: RoofPlane): boolean {
  const normal = normalizeOutwardRoofNormal(plane.normal);
  return Math.abs(normal.y) > 0.999;
}

function roofPlaneArea(plane: RoofPlane): number {
  if (plane.corners.length < 3) return 0;
  let area = 0;
  const origin = plane.corners[0]!;
  for (let index = 1; index < plane.corners.length - 1; index += 1) {
    area += triangleArea(origin, plane.corners[index]!, plane.corners[index + 1]!);
  }
  return area;
}

function triangleArea(a: RoofVec3, b: RoofVec3, c: RoofVec3): number {
  const ab = sub3(b, a);
  const ac = sub3(c, a);
  const cross = {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x,
  };
  return Math.hypot(cross.x, cross.y, cross.z) / 2;
}

function pointInRoofPlaneFootprint(
  plane: RoofPlane,
  point: Pick<RoofVec3, 'x' | 'z'>,
  toleranceMeters: number,
): boolean {
  if (plane.corners.length < 3) return false;
  const signedDistances = plane.corners.map((start, index) => {
    const end = plane.corners[(index + 1) % plane.corners.length]!;
    const edgeX = end.x - start.x;
    const edgeZ = end.z - start.z;
    const edgeLength = Math.hypot(edgeX, edgeZ) || 1;
    return ((point.x - start.x) * edgeZ - (point.z - start.z) * edgeX) / edgeLength;
  });
  const hasPositive = signedDistances.some((distance) => distance > toleranceMeters);
  const hasNegative = signedDistances.some((distance) => distance < -toleranceMeters);
  return !(hasPositive && hasNegative);
}

function boundsForPoints(points: readonly Pick<RoofVec3, 'x' | 'z'>[]): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} | null {
  const finite = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z));
  if (finite.length === 0) return null;
  return {
    minX: Math.min(...finite.map((point) => point.x)),
    maxX: Math.max(...finite.map((point) => point.x)),
    minZ: Math.min(...finite.map((point) => point.z)),
    maxZ: Math.max(...finite.map((point) => point.z)),
  };
}

function boundsOverrunMeters(
  point: Pick<RoofVec3, 'x' | 'z'>,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
): number {
  return Math.max(
    0,
    bounds.minX - point.x,
    point.x - bounds.maxX,
    bounds.minZ - point.z,
    point.z - bounds.maxZ,
  );
}

function isFinitePoint(point: RoofVec3): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
}

function sub3(a: RoofVec3, b: RoofVec3): RoofVec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot3(a: RoofVec3, b: RoofVec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function roundMetric(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
