import { getPlumbingFixtureDefinition } from '../plumbingFixtureLibrary';
import { requiredRoughInSystemsForFixture } from './plumbingFixtureRoughIns';
import { SUPPORTED_PROCEDURAL_PLUMBING_FITTING_TYPES } from '../three/createProceduralPlumbingFittingMesh';
import { SUPPORTED_PROCEDURAL_PLUMBING_FIXTURE_TYPES } from '../three/createProceduralPlumbingFixtureMesh';
import { defaultPlumbingElevationDefaults } from '../three/plumbingElevationResolver';
import {
  IPC_2024_MIN_SEPTIC_SETBACK_FROM_BUILDING_M,
  ipc2024MinimumDrainageSlopeInPerFt,
} from './ipcDrainageSlope';
import { septicTankFootprintPolygon } from '../septic/septicGeometry';
import {
  isFittingAllowedForMaterial,
  isFittingAllowedForSystem,
} from './plumbingFittingCompatibility';
import { solvePlumbingModel } from './plumbingModelSolver';
import type {
  PlumbingMaterial,
  PlumbingPoint3D,
  PlumbingRun,
  PlumbingRoughInSystem,
  PlumbingSystem,
  PlumbingValidationIssue,
} from '../plumbingTypes';

export type PlumbingValidationContext = {
  wallFootings?: readonly {
    id: string;
    startPoint: { x: number; z: number };
    endPoint: { x: number; z: number };
    widthMeters: number;
  }[];
  beams?: readonly {
    id: string;
    startPoint: { x: number; z: number; y?: number };
    endPoint: { x: number; z: number; y?: number };
    widthMeters: number;
    kind?: string;
    baseElevationMeters?: number;
    topElevationMeters?: number;
  }[];
  isolatedFootings?: readonly {
    id: string;
    position: { x: number; z: number };
    widthMeters: number;
    lengthMeters: number;
  }[];
  columns?: readonly {
    id: string;
    position: { x: number; z: number };
    widthMeters: number;
    depthMeters: number;
  }[];
  buildingFootprint?: readonly { x: number; z: number }[];
};

function issue(params: Omit<PlumbingValidationIssue, 'id'>): PlumbingValidationIssue {
  return {
    id: `${params.code}-${params.objectId ?? params.objectKind}-${Math.random().toString(36).slice(2, 8)}`,
    ...params,
  };
}

function distancePointToSegment(point: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq <= 0) return Math.hypot(point.x - a.x, point.z - a.z);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lenSq));
  return Math.hypot(point.x - (a.x + t * dx), point.z - (a.z + t * dz));
}

function segmentIntersectsRect(
  a: { x: number; z: number },
  b: { x: number; z: number },
  rect: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  const inside = (p: { x: number; z: number }) => p.x >= rect.minX && p.x <= rect.maxX && p.z >= rect.minZ && p.z <= rect.maxZ;
  if (inside(a) || inside(b)) return true;
  const edges = [
    [{ x: rect.minX, z: rect.minZ }, { x: rect.maxX, z: rect.minZ }],
    [{ x: rect.maxX, z: rect.minZ }, { x: rect.maxX, z: rect.maxZ }],
    [{ x: rect.maxX, z: rect.maxZ }, { x: rect.minX, z: rect.maxZ }],
    [{ x: rect.minX, z: rect.maxZ }, { x: rect.minX, z: rect.minZ }],
  ] as const;
  return edges.some(([c, d]) => segmentsIntersect(a, b, c, d));
}

function orientation(a: { x: number; z: number }, b: { x: number; z: number }, c: { x: number; z: number }): number {
  return (b.z - a.z) * (c.x - b.x) - (b.x - a.x) * (c.z - b.z);
}

function segmentsIntersect(
  a: { x: number; z: number },
  b: { x: number; z: number },
  c: { x: number; z: number },
  d: { x: number; z: number },
): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function runSegments(run: PlumbingRun): Array<[PlumbingPoint3D, PlumbingPoint3D]> {
  const segments: Array<[PlumbingPoint3D, PlumbingPoint3D]> = [];
  for (let index = 1; index < run.path.length; index += 1) {
    const previous = run.path[index - 1];
    const current = run.path[index];
    if (previous && current) segments.push([previous, current]);
  }
  return segments;
}

function effectiveRunPointY(run: PlumbingRun, point: PlumbingPoint3D): number {
  if (
    run.elevationMode === 'under_slab' &&
    (!Number.isFinite(point.y) || point.y >= defaultPlumbingElevationDefaults.slabTopElevationM - 0.001)
  ) {
    return defaultPlumbingElevationDefaults.slabTopElevationM -
      defaultPlumbingElevationDefaults.slabThicknessM -
      defaultPlumbingElevationDefaults.sanitaryUnderSlabCoverM;
  }
  return Number.isFinite(point.y) ? point.y : defaultPlumbingElevationDefaults.waterInWallHeightM;
}

function runSegmentOverlapsElevation(
  run: PlumbingRun,
  a: PlumbingPoint3D,
  b: PlumbingPoint3D,
  bottom: number,
  top: number,
): boolean {
  const y1 = effectiveRunPointY(run, a);
  const y2 = effectiveRunPointY(run, b);
  return Math.min(y1, y2) <= top && Math.max(y1, y2) >= bottom;
}

function segmentNearSegment(
  a: { x: number; z: number },
  b: { x: number; z: number },
  c: { x: number; z: number },
  d: { x: number; z: number },
  tolerance: number,
): boolean {
  return segmentsIntersect(a, b, c, d) ||
    distancePointToSegment(a, c, d) <= tolerance ||
    distancePointToSegment(b, c, d) <= tolerance ||
    distancePointToSegment(c, a, b) <= tolerance ||
    distancePointToSegment(d, a, b) <= tolerance;
}

function runTouchesAnyNode(run: PlumbingRun, nodeIds: Set<string>): boolean {
  return nodeIds.has(run.startNodeId) || nodeIds.has(run.endNodeId);
}

function hasSleeveFitting(system: PlumbingSystem, run: PlumbingRun): boolean {
  return (system.fittings ?? []).some((fitting) =>
    fitting.connectedRunIds.includes(run.id) &&
    (fitting.type === 'pipe_sleeve' || fitting.type === 'footing_sleeve' || fitting.type === 'wall_sleeve'),
  );
}

function hasFittingForRunBend(system: PlumbingSystem, run: PlumbingRun): boolean {
  return (system.fittings ?? []).some((fitting) => fitting.connectedRunIds.includes(run.id));
}

function bendDegrees(a: PlumbingPoint3D, b: PlumbingPoint3D, c: PlumbingPoint3D): number {
  const v1 = { x: a.x - b.x, z: a.z - b.z };
  const v2 = { x: c.x - b.x, z: c.z - b.z };
  const dot = v1.x * v2.x + v1.z * v2.z;
  const mag = Math.hypot(v1.x, v1.z) * Math.hypot(v2.x, v2.z);
  if (mag <= 0) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

function requiresSchedule(material: PlumbingMaterial): boolean {
  return material === 'pvc' || material === 'abs' || material === 'cpvc' || material === 'cast_iron';
}

function polygonBounds(points: readonly { x: number; z: number }[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minZ: Math.min(bounds.minZ, point.z),
      maxZ: Math.max(bounds.maxZ, point.z),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
}

function boundsDistance(a: ReturnType<typeof polygonBounds>, b: ReturnType<typeof polygonBounds>): number {
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dz = Math.max(0, Math.max(a.minZ - b.maxZ, b.minZ - a.maxZ));
  return Math.hypot(dx, dz);
}

function sanitaryRunReachesSeptic(system: PlumbingSystem, startRunId: string): boolean {
  const septicNodeIds = new Set(system.nodes.filter((node) => node.kind === 'septic_inlet').map((node) => node.id));
  if (septicNodeIds.size === 0) return false;
  const startRun = system.runs.find((run) => run.id === startRunId);
  if (!startRun || startRun.system !== 'sanitary') return false;
  const queue = [startRun.endNodeId];
  const visitedNodes = new Set<string>();
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (septicNodeIds.has(nodeId)) return true;
    if (visitedNodes.has(nodeId)) continue;
    visitedNodes.add(nodeId);
    system.runs
      .filter((run) => run.system === 'sanitary' && run.startNodeId === nodeId)
      .forEach((run) => queue.push(run.endNodeId));
  }
  return false;
}

export function validatePlumbingSystem(
  system: PlumbingSystem,
  context: PlumbingValidationContext = {},
): PlumbingValidationIssue[] {
  const issues: PlumbingValidationIssue[] = [];
  const nodeIds = new Set(system.nodes.map((node) => node.id));
  const runsByNodeId = new Map<string, PlumbingRun[]>();
  const roughInsByFixtureSystem = new Map<string, string>();
  system.runs.forEach((run) => {
    if (!runsByNodeId.has(run.startNodeId)) runsByNodeId.set(run.startNodeId, []);
    if (!runsByNodeId.has(run.endNodeId)) runsByNodeId.set(run.endNodeId, []);
    runsByNodeId.get(run.startNodeId)?.push(run);
    runsByNodeId.get(run.endNodeId)?.push(run);
  });
  (system.roughIns ?? []).forEach((roughIn) => {
    roughInsByFixtureSystem.set(`${roughIn.fixtureId}|${roughIn.system}`, roughIn.id);
  });

  system.fixtures.forEach((fixture) => {
    const definition = getPlumbingFixtureDefinition(fixture.fixtureType);
    requiredRoughInSystemsForFixture(fixture).forEach((systemType) => {
      if (!roughInsByFixtureSystem.has(`${fixture.id}|${systemType}`)) {
        issues.push(issue({
          severity: 'warning',
          code: 'fixture_missing_required_rough_in',
          objectKind: 'fixture',
          objectId: fixture.id,
          message: `${fixture.mark} is missing its ${systemType.replace('_', ' ')} rough-in assembly.`,
        }));
      }
    });
    if (!SUPPORTED_PROCEDURAL_PLUMBING_FIXTURE_TYPES.has(fixture.fixtureType)) {
      issues.push(issue({
        severity: 'warning',
        code: 'fixture_missing_procedural_renderer',
        objectKind: 'fixture',
        objectId: fixture.id,
        message: `${fixture.displayName} does not have a procedural 3D renderer.`,
      }));
    }
    definition.connections.forEach((connection) => {
      const nodeIdsForSystem = fixture.connectionNodeIds[connection.system] ?? [];
      const existingNodes = nodeIdsForSystem.filter((nodeId) => nodeIds.has(nodeId));
      if (existingNodes.length === 0) {
        issues.push(issue({
          severity: 'error',
          code: 'fixture_missing_required_node',
          objectKind: 'fixture',
          objectId: fixture.id,
          message: `${fixture.mark} is missing its ${connection.label} connection node.`,
        }));
        return;
      }
      if (
        !roughInsByFixtureSystem.has(`${fixture.id}|${connection.system}`) &&
        !existingNodes.some((nodeId) => (runsByNodeId.get(nodeId) ?? []).some((run) => run.system === connection.system))
      ) {
        issues.push(issue({
          severity: 'warning',
          code: 'fixture_missing_required_run',
          objectKind: 'fixture',
          objectId: fixture.id,
          message: `${fixture.mark} ${connection.label} is not connected to a ${connection.system.replace('_', ' ')} run.`,
        }));
      }
    });
  });

  (system.roughIns ?? []).forEach((roughIn) => {
    const fixture = system.fixtures.find((item) => item.id === roughIn.fixtureId);
    if (!fixture) {
      issues.push(issue({
        severity: 'error',
        code: 'rough_in_missing_fixture',
        objectKind: 'rough-in',
        objectId: roughIn.id,
        message: 'Rough-in assembly references a missing fixture.',
      }));
    }
    if (!system.nodes.some((node) => node.id === roughIn.fixtureNodeId)) {
      issues.push(issue({
        severity: 'error',
        code: 'rough_in_missing_fixture_node',
        objectKind: 'rough-in',
        objectId: roughIn.id,
        message: 'Rough-in assembly references a missing fixture connection node.',
      }));
    }
    const bottomNode = system.nodes.find((node) => node.id === roughIn.riserBottomNodeId);
    const topNode = system.nodes.find((node) => node.id === roughIn.riserTopNodeId);
    if (!bottomNode) {
      issues.push(issue({
        severity: 'error',
        code: 'rough_in_missing_bottom_node',
        objectKind: 'rough-in',
        objectId: roughIn.id,
        message: 'Rough-in riser is missing its bottom node.',
      }));
    }
    if (!topNode) {
      issues.push(issue({
        severity: 'error',
        code: 'rough_in_missing_top_node',
        objectKind: 'rough-in',
        objectId: roughIn.id,
        message: 'Rough-in riser is missing its top node.',
      }));
    }
    if (bottomNode && topNode && topNode.position.y <= bottomNode.position.y) {
      issues.push(issue({
        severity: 'warning',
        code: 'rough_in_invalid_riser_height',
        objectKind: 'rough-in',
        objectId: roughIn.id,
        message: 'Rough-in riser has zero or negative height.',
      }));
    }
    const riserRun = system.runs.find((run) => run.id === roughIn.riserRunId);
    const branchRun = roughIn.branchRunId ? system.runs.find((run) => run.id === roughIn.branchRunId) : null;
    const roughInFittings = roughIn.fittingIds
      .map((id) => (system.fittings ?? []).find((fitting) => fitting.id === id))
      .filter((fitting): fitting is NonNullable<typeof fitting> => Boolean(fitting));
    if (!riserRun || roughInFittings.length !== roughIn.fittingIds.length) {
      issues.push(issue({
        severity: 'warning',
        code: 'rough_in_missing_takeoff_mapping',
        objectKind: 'rough-in',
        objectId: roughIn.id,
        message: 'Rough-in assembly is missing takeoff-backed run or fitting records.',
      }));
    }
    if (roughIn.system === 'sanitary' && (!branchRun || !roughIn.tapNodeId)) {
      issues.push(issue({
        severity: 'warning',
        code: 'rough_in_disconnected_sanitary',
        objectKind: 'rough-in',
        objectId: roughIn.id,
        message: 'Sanitary rough-in is not connected to a sloped branch and main tap.',
      }));
    }
    if (roughIn.system === 'sanitary' && branchRun && !sanitaryRunReachesSeptic(system, branchRun.id)) {
      issues.push(issue({
        severity: 'warning',
        code: 'sanitary_drain_path_missing_septic',
        objectKind: 'rough-in',
        objectId: roughIn.id,
        message: 'Sanitary rough-in does not have a directed drain path from fixture to septic inlet.',
      }));
    }
    if (
      branchRun &&
      roughIn.tapNodeId &&
      !roughInFittings.some((fitting) =>
        fitting.nodeId === roughIn.tapNodeId &&
        fitting.connectedRunIds.includes(branchRun.id) &&
        (fitting.type === 'wye' || fitting.type === 'combo_wye_45' || fitting.type === 'tee' || fitting.type === 'sanitary_tee'),
      )
    ) {
      issues.push(issue({
        severity: 'warning',
        code: 'branch_missing_tap_fitting',
        objectKind: 'rough-in',
        objectId: roughIn.id,
        message: 'Rough-in branch enters the main without a modeled tap fitting.',
      }));
    }
    if (fixture?.fixtureType === 'toilet') {
      if (!roughInFittings.some((fitting) => fitting.type === 'closet_flange')) {
        issues.push(issue({
          severity: 'warning',
          code: 'wc_missing_closet_flange',
          objectKind: 'rough-in',
          objectId: roughIn.id,
          message: 'WC rough-in is missing a closet flange.',
        }));
      }
      if (!roughInFittings.some((fitting) => fitting.type === 'closet_bend')) {
        issues.push(issue({
          severity: 'warning',
          code: 'wc_missing_closet_bend',
          objectKind: 'rough-in',
          objectId: roughIn.id,
          message: 'WC rough-in is missing a closet bend.',
        }));
      }
    }
    const trapRequiredFixtureTypes = new Set(['lavatory', 'kitchen_sink', 'utility_sink', 'floor_drain', 'shower', 'tub', 'laundry_box']);
    if (
      roughIn.system === 'sanitary' &&
      fixture &&
      trapRequiredFixtureTypes.has(fixture.fixtureType) &&
      !roughInFittings.some((fitting) => fitting.type === 'p_trap')
    ) {
      issues.push(issue({
        severity: 'warning',
        code: 'fixture_missing_trap',
        objectKind: 'rough-in',
        objectId: roughIn.id,
        message: `${fixture.mark} rough-in is missing a trap.`,
      }));
    }
  });

  system.runs.forEach((run) => {
    if (!nodeIds.has(run.startNodeId)) {
      issues.push(issue({
        severity: 'error',
        code: 'run_missing_start_node',
        objectKind: 'run',
        objectId: run.id,
        message: 'Pipe run start node does not exist.',
      }));
    }
    if (!nodeIds.has(run.endNodeId)) {
      issues.push(issue({
        severity: 'error',
        code: 'run_missing_end_node',
        objectKind: 'run',
        objectId: run.id,
        message: 'Pipe run end node does not exist.',
      }));
    }
    if (run.diameterInches == null || !Number.isFinite(run.diameterInches)) {
      issues.push(issue({
        severity: 'warning',
        code: 'run_missing_diameter',
        objectKind: 'run',
        objectId: run.id,
        message: 'Pipe run is missing diameter.',
      }));
    }
    if (run.system === 'sanitary' && (run.slopeInPerFt == null || !Number.isFinite(run.slopeInPerFt))) {
      issues.push(issue({
        severity: 'warning',
        code: 'sanitary_run_missing_slope',
        objectKind: 'run',
        objectId: run.id,
        message: 'Sanitary run is missing slope.',
      }));
    }
    if (
      run.system === 'sanitary' &&
      run.slopeInPerFt != null &&
      Number.isFinite(run.slopeInPerFt) &&
      run.slopeInPerFt > 0 &&
      run.slopeInPerFt < ipc2024MinimumDrainageSlopeInPerFt(run.diameterInches)
    ) {
      issues.push(issue({
        severity: 'warning',
        code: 'sanitary_drain_path_slope_below_ipc',
        objectKind: 'run',
        objectId: run.id,
        message: `Sanitary run slope is below the IPC 2024 minimum for ${run.diameterInches ?? 'unknown'} in. pipe.`,
      }));
    }
    if (run.system === 'sanitary' && run.slopeInPerFt != null && Number.isFinite(run.slopeInPerFt) && run.slopeInPerFt <= 0) {
      issues.push(issue({
        severity: 'warning',
        code: 'sanitary_run_slopes_wrong_direction',
        objectKind: 'run',
        objectId: run.id,
        message: 'Sanitary run slope must fall from start node toward end node.',
      }));
    }
    if (run.elevationMode === 'under_slab' && run.path.some((point) => Number.isFinite(point.y) && point.y > defaultPlumbingElevationDefaults.slabTopElevationM)) {
      issues.push(issue({
        severity: 'warning',
        code: 'under_slab_pipe_above_slab',
        objectKind: 'run',
        objectId: run.id,
        message: 'Under-slab pipe has a point above slab top.',
      }));
    }
    if (
      run.elevationMode !== 'under_slab' &&
      run.elevationMode !== 'user_defined' &&
      run.path.some((point) => Number.isFinite(point.y) && point.y < defaultPlumbingElevationDefaults.gradeElevationM)
    ) {
      issues.push(issue({
        severity: 'warning',
        code: 'pipe_below_grade_missing_elevation_mode',
        objectKind: 'run',
        objectId: run.id,
        message: 'Pipe is below grade but is not marked as under-slab or user-defined.',
      }));
    }
    if (
      run.elevationMode === 'user_defined' &&
      run.path.some((point) => !Number.isFinite(point.y))
    ) {
      issues.push(issue({
        severity: 'warning',
        code: 'user_defined_run_missing_elevation',
        objectKind: 'run',
        objectId: run.id,
        message: 'User-defined pipe run is missing explicit point elevations.',
      }));
    }
    if (
      run.system === 'vent' &&
      run.path.length > 0 &&
      run.elevationMode !== 'vertical' &&
      Math.max(...run.path.map((point) => Number.isFinite(point.y) ? point.y : 0)) <
        defaultPlumbingElevationDefaults.roofElevationM + defaultPlumbingElevationDefaults.ventThroughRoofExtensionM
    ) {
      issues.push(issue({
        severity: 'warning',
        code: 'vent_does_not_rise_through_roof',
        objectKind: 'run',
        objectId: run.id,
        message: 'Vent run does not rise through the roof in 3D.',
      }));
    }
    if (run.path.length > 2 && !hasFittingForRunBend(system, run)) {
      for (let index = 1; index < run.path.length - 1; index += 1) {
        const previous = run.path[index - 1];
        const current = run.path[index];
        const next = run.path[index + 1];
        if (!previous || !current || !next) continue;
        if (Math.abs(180 - bendDegrees(previous, current, next)) > 10) {
          issues.push(issue({
            severity: 'warning',
            code: 'sharp_bend_missing_fitting',
            objectKind: 'run',
            objectId: run.id,
            message: 'Pipe run has a sharp bend without a fitting.',
          }));
          break;
        }
      }
    }
    if (run.stockLengthFt == null || !Number.isFinite(run.stockLengthFt)) {
      issues.push(issue({
        severity: 'warning',
        code: 'run_missing_stock_length',
        objectKind: 'run',
        objectId: run.id,
        message: 'Pipe run is missing stock length.',
      }));
    } else if (run.stockLengthFt <= 0) {
      issues.push(issue({
        severity: 'warning',
        code: 'invalid_stock_length',
        objectKind: 'run',
        objectId: run.id,
        message: 'Pipe run stock length must be greater than 0.',
      }));
    }
  });

  (system.fittings ?? []).forEach((fitting) => {
    if (!SUPPORTED_PROCEDURAL_PLUMBING_FITTING_TYPES.has(fitting.type)) {
      issues.push(issue({
        severity: 'warning',
        code: 'fitting_type_missing_procedural_renderer',
        objectKind: 'fitting',
        objectId: fitting.id,
        message: `${fitting.type.replace(/_/g, ' ')} does not have a procedural 3D renderer.`,
      }));
    }
    if (fitting.system !== 'multi' && !isFittingAllowedForSystem(fitting.type, fitting.system)) {
      issues.push(issue({
        severity: 'warning',
        code: 'invalid_fitting_for_system',
        objectKind: 'fitting',
        objectId: fitting.id,
        message: `${fitting.type.replace(/_/g, ' ')} is not valid for ${fitting.system.replace('_', ' ')} piping.`,
      }));
    }
    if (!isFittingAllowedForMaterial(fitting.type, fitting.material)) {
      issues.push(issue({
        severity: 'warning',
        code: 'invalid_fitting_for_material',
        objectKind: 'fitting',
        objectId: fitting.id,
        message: `${fitting.type.replace(/_/g, ' ')} is not valid for ${fitting.material}.`,
      }));
    }
    if (fitting.diameterInches == null || !Number.isFinite(fitting.diameterInches)) {
      issues.push(issue({
        severity: 'warning',
        code: 'fitting_missing_diameter',
        objectKind: 'fitting',
        objectId: fitting.id,
        message: 'Fitting is missing diameter.',
      }));
    }
    if (requiresSchedule(fitting.material) && !fitting.schedule) {
      issues.push(issue({
        severity: 'warning',
        code: 'fitting_missing_schedule',
        objectKind: 'fitting',
        objectId: fitting.id,
        message: 'Rigid pipe fitting is missing schedule.',
      }));
    }
    const connectedRuns = fitting.connectedRunIds
      .map((runId) => system.runs.find((run) => run.id === runId))
      .filter((run): run is PlumbingRun => Boolean(run));
    if (
      fitting.diameterInches != null &&
      connectedRuns.some((run) => run.diameterInches != null && run.diameterInches !== fitting.diameterInches && run.diameterInches !== fitting.secondaryDiameterInches)
    ) {
      issues.push(issue({
        severity: 'warning',
        code: 'fitting_diameter_mismatch',
        objectKind: 'fitting',
        objectId: fitting.id,
        message: 'Fitting diameter does not match connected pipe run diameter.',
      }));
    }
  });

  const sanitaryExitNodes = new Set(
    system.nodes
      .filter((node) => node.kind === 'building_drain_exit' || node.kind === 'septic_inlet')
      .map((node) => node.id),
  );
  if (system.runs.some((run) => run.system === 'sanitary') && sanitaryExitNodes.size > 0) {
    system.runs
      .filter((run) => run.system === 'sanitary')
      .forEach((run) => {
        if (!runTouchesAnyNode(run, sanitaryExitNodes)) {
          issues.push(issue({
            severity: 'warning',
            code: 'sanitary_disconnected',
            objectKind: 'run',
            objectId: run.id,
            message: 'Sanitary run is not connected to a building drain or septic inlet.',
          }));
        }
      });
  }

  const ventTerminalNodes = new Set(
    system.nodes
      .filter((node) => node.kind === 'stack' || node.equipmentId && system.equipment.some((item) => item.id === node.equipmentId && item.equipmentType === 'roof_vent_termination'))
      .map((node) => node.id),
  );
  if (system.runs.some((run) => run.system === 'vent') && ventTerminalNodes.size > 0) {
    system.runs
      .filter((run) => run.system === 'vent')
      .forEach((run) => {
        if (!runTouchesAnyNode(run, ventTerminalNodes)) {
          issues.push(issue({
            severity: 'warning',
            code: 'vent_disconnected',
            objectKind: 'run',
            objectId: run.id,
            message: 'Vent run is not connected to a stack or roof vent.',
          }));
        }
      });
  }

  const marks = new Map<string, string>();
  system.fixtures.forEach((fixture) => {
    const prior = marks.get(fixture.mark);
    if (prior) {
      issues.push(issue({
        severity: 'warning',
        code: 'duplicate_fixture_mark',
        objectKind: 'fixture',
        objectId: fixture.id,
        message: `Fixture mark ${fixture.mark} is duplicated.`,
      }));
    } else {
      marks.set(fixture.mark, fixture.id);
    }
  });

  system.nodes.forEach((node) => {
    const owned =
      (node.fixtureId && system.fixtures.some((fixture) => fixture.id === node.fixtureId)) ||
      (node.equipmentId && system.equipment.some((equipment) => equipment.id === node.equipmentId)) ||
      (node.septicTankId && system.septicTanks.some((tank) => tank.id === node.septicTankId));
    if (!owned && !['building_drain_exit', 'main_service', 'distribution_box', 'stack', 'cleanout', 'valve', 'fitting', 'wye'].includes(node.kind)) {
      issues.push(issue({
        severity: 'warning',
        code: 'orphan_node',
        objectKind: 'node',
        objectId: node.id,
        message: `${node.label} is not owned by a fixture, equipment item, or septic tank.`,
      }));
    }
  });

  if (context.buildingFootprint && context.buildingFootprint.length > 0) {
    const buildingBounds = polygonBounds(context.buildingFootprint);
    system.septicTanks.forEach((tank) => {
      const tankBounds = polygonBounds(septicTankFootprintPolygon(tank));
      if (boundsDistance(tankBounds, buildingBounds) < IPC_2024_MIN_SEPTIC_SETBACK_FROM_BUILDING_M) {
        issues.push(issue({
          severity: 'warning',
          code: 'septic_tank_too_close_to_building',
          objectKind: 'septic-tank',
          objectId: tank.id,
          message: 'Septic tank is less than 10 ft from the building footprint.',
        }));
      }
    });
  }

  system.septicTanks.forEach((tank) => {
    const inletNodeId = tank.connectionNodes.inletNodeId;
    const incomingRuns = system.runs.filter((run) => run.system === 'sanitary' && run.endNodeId === inletNodeId);
    if (incomingRuns.length === 0) {
      issues.push(issue({
        severity: 'warning',
        code: 'septic_missing_distribution_box',
        objectKind: 'septic-tank',
        objectId: tank.id,
        message: 'Septic tank inlet is missing a distribution box connection.',
      }));
      return;
    }
    if (incomingRuns.length > 1) {
      issues.push(issue({
        severity: 'warning',
        code: 'septic_multiple_inlet_lines',
        objectKind: 'septic-tank',
        objectId: tank.id,
        message: 'Septic tank should have one modeled inlet line from the distribution box.',
      }));
    }
    incomingRuns.forEach((run) => {
      const startNode = system.nodes.find((node) => node.id === run.startNodeId);
      if (startNode?.kind !== 'distribution_box') {
        issues.push(issue({
          severity: 'warning',
          code: 'septic_direct_connection_without_distribution_box',
          objectKind: 'run',
          objectId: run.id,
          message: 'Sanitary line enters septic tank directly; route it through a distribution box first.',
        }));
      }
    });
  });

  system.nodes
    .filter((node) => node.kind === 'distribution_box' && node.system === 'sanitary')
    .forEach((node) => {
      const incomingDrainRuns = system.runs.filter((run) =>
        run.system === 'sanitary' &&
        run.endNodeId === node.id &&
        run.startNodeId !== node.id,
      );
      const outgoingSepticRuns = system.runs.filter((run) => {
        if (run.system !== 'sanitary' || run.startNodeId !== node.id) return false;
        const endNode = system.nodes.find((candidate) => candidate.id === run.endNodeId);
        return endNode?.kind === 'septic_inlet';
      });
      if (incomingDrainRuns.length === 0) {
        issues.push(issue({
          severity: 'warning',
          code: 'distribution_box_missing_drain_inlet',
          objectKind: 'node',
          objectId: node.id,
          message: 'Distribution box is missing an incoming fixture/building drain line.',
        }));
      }
      if (outgoingSepticRuns.length === 0) {
        issues.push(issue({
          severity: 'warning',
          code: 'distribution_box_missing_septic_outlet',
          objectKind: 'node',
          objectId: node.id,
          message: 'Distribution box is not connected to the septic inlet.',
        }));
      }
    });

  system.runs.forEach((run) => {
    runSegments(run).forEach(([a, b]) => {
      const plinthBeam = (context.beams ?? []).find((beam) =>
        beam.kind === 'plinth_beam' &&
        segmentNearSegment(
          a,
          b,
          beam.startPoint,
          beam.endPoint,
          Math.max(0.05, beam.widthMeters / 2 + ((run.diameterInches ?? 3) * 0.0254 / 2)),
        ) &&
        runSegmentOverlapsElevation(
          run,
          a,
          b,
          beam.baseElevationMeters ?? Math.min(beam.startPoint.y ?? 0, beam.endPoint.y ?? 0),
          beam.topElevationMeters ?? Math.max(beam.startPoint.y ?? 0, beam.endPoint.y ?? 0) + 0.3,
        ),
      );
      if (plinthBeam) {
        issues.push(issue({
          severity: 'warning',
          code: 'pipe_crosses_plinth_beam',
          objectKind: 'run',
          objectId: run.id,
          message: 'Pipe run passes through the plinth beam; route it through below-grade CMU instead.',
        }));
      }
      const crossesColumn = (context.columns ?? []).find((column) =>
        segmentIntersectsRect(a, b, {
          minX: column.position.x - column.widthMeters / 2,
          maxX: column.position.x + column.widthMeters / 2,
          minZ: column.position.z - column.depthMeters / 2,
          maxZ: column.position.z + column.depthMeters / 2,
        }),
      );
      if (crossesColumn) {
        issues.push(issue({
          severity: 'warning',
          code: 'pipe_crosses_rc_column',
          objectKind: 'run',
          objectId: run.id,
          message: 'Pipe run crosses an RC column.',
        }));
      }
      const crossesFooting = (context.isolatedFootings ?? []).find((footing) =>
        segmentIntersectsRect(a, b, {
          minX: footing.position.x - footing.widthMeters / 2,
          maxX: footing.position.x + footing.widthMeters / 2,
          minZ: footing.position.z - footing.lengthMeters / 2,
          maxZ: footing.position.z + footing.lengthMeters / 2,
        }),
      );
      const crossesStrip =
        (context.wallFootings ?? []).find((footing) => distancePointToSegment(footing.startPoint, a, b) <= footing.widthMeters / 2 || distancePointToSegment(footing.endPoint, a, b) <= footing.widthMeters / 2) ||
        (context.beams ?? []).find((beam) => {
          if (beam.kind === 'plinth_beam' && !plinthBeam) return false;
          return distancePointToSegment(beam.startPoint, a, b) <= beam.widthMeters / 2 ||
            distancePointToSegment(beam.endPoint, a, b) <= beam.widthMeters / 2;
        });
      if (crossesFooting || crossesStrip) {
        if (hasSleeveFitting(system, run)) {
          issues.push(issue({
            severity: 'info',
            code: 'pipe_crosses_foundation_with_sleeve',
            objectKind: 'run',
            objectId: run.id,
            message: 'Pipe run crosses a footing or beam with a modeled sleeve.',
          }));
        } else {
          issues.push(issue({
            severity: 'warning',
            code: 'pipe_crosses_foundation',
            objectKind: 'run',
            objectId: run.id,
            message: 'Pipe run crosses a footing or beam coordination layer.',
          }));
          issues.push(issue({
            severity: 'warning',
            code: 'pipe_crosses_footing_without_sleeve',
            objectKind: 'run',
            objectId: run.id,
            message: 'Pipe run crosses a footing or beam without a sleeve fitting.',
          }));
        }
      }
    });
  });

  const solverIssues = solvePlumbingModel(system).validationIssues;
  const existingIssueKeys = new Set(issues.map((item) => `${item.code}|${item.objectKind}|${item.objectId ?? ''}`));
  solverIssues.forEach((solverIssue) => {
    const key = `${solverIssue.code}|${solverIssue.objectKind}|${solverIssue.objectId ?? ''}`;
    if (existingIssueKeys.has(key)) return;
    existingIssueKeys.add(key);
    issues.push(solverIssue);
  });

  return issues;
}
