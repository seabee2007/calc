import type {
  PlumbingEquipment,
  PlumbingFitting,
  PlumbingFixture,
  PlumbingNode,
  PlumbingPoint3D,
  PlumbingRun,
  PlumbingSystem,
} from '../plumbingTypes';
import { ipc2024MinimumDrainageSlopeInPerFt } from '../domain/ipcDrainageSlope';
import type { Plumbing3DValidationIssue } from './plumbingThreeUtils';

export type PlumbingElevationDefaults = {
  gradeElevationM: number;
  slabTopElevationM: number;
  slabThicknessM: number;
  ceilingElevationM: number;
  roofElevationM: number;
  sanitaryUnderSlabCoverM: number;
  sanitaryDefaultSlopeInPerFt: number;
  waterInWallHeightM: number;
  waterOverheadDropM: number;
  ventThroughRoofExtensionM: number;
};

export const defaultPlumbingElevationDefaults: PlumbingElevationDefaults = {
  gradeElevationM: 0,
  slabTopElevationM: 0,
  slabThicknessM: 0.10,
  ceilingElevationM: 2.7,
  roofElevationM: 3.2,
  sanitaryUnderSlabCoverM: 0.30,
  sanitaryDefaultSlopeInPerFt: 0.25,
  waterInWallHeightM: 0.45,
  waterOverheadDropM: 0.15,
  ventThroughRoofExtensionM: 0.30,
};

export type ResolvedPlumbingRunPath = {
  runId: string;
  points: PlumbingPoint3D[];
  diameterInches: number | null;
  radiusM: number;
  system: PlumbingRun['system'];
  validationIssues: Plumbing3DValidationIssue[];
};

export type ResolvedPlumbingRun3DPath = ResolvedPlumbingRunPath;

function issue(params: Omit<Plumbing3DValidationIssue, 'severity'> & { severity?: Plumbing3DValidationIssue['severity'] }): Plumbing3DValidationIssue {
  return {
    severity: params.severity ?? 'warning',
    ...params,
  };
}

function mergeDefaults(
  defaults?: Partial<PlumbingElevationDefaults>,
): PlumbingElevationDefaults {
  return {
    ...defaultPlumbingElevationDefaults,
    ...(defaults ?? {}),
  };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function diameterInchesToRadiusMeters(diameterInches: number | null | undefined): number {
  if (diameterInches == null || !Number.isFinite(diameterInches) || diameterInches <= 0) return 0.035;
  return Math.max(0.018, Math.min(0.12, diameterInches * 0.0254 / 2));
}

function hasExplicitElevation(point: PlumbingPoint3D): boolean {
  return finiteNumber(point.y) && Math.abs(point.y) > 0.000001;
}

function planDistance(a: PlumbingPoint3D, b: PlumbingPoint3D): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function cumulativeDistances(points: PlumbingPoint3D[]): number[] {
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    distances.push((distances[index - 1] ?? 0) + (previous && current ? planDistance(previous, current) : 0));
  }
  return distances;
}

function pathPlanLength(points: PlumbingPoint3D[]): number {
  const distances = cumulativeDistances(points);
  return distances[distances.length - 1] ?? 0;
}

function pointAtElevation(point: PlumbingPoint3D, y: number): PlumbingPoint3D {
  return { x: point.x, y, z: point.z };
}

function findNode(system: PlumbingSystem, nodeId: string): PlumbingNode | null {
  return system.nodes.find((node) => node.id === nodeId) ?? null;
}

function resolvedRunPathBase(run: PlumbingRun, points: PlumbingPoint3D[], validationIssues: Plumbing3DValidationIssue[]): ResolvedPlumbingRunPath {
  return {
    runId: run.id,
    points,
    diameterInches: run.diameterInches,
    radiusM: diameterInchesToRadiusMeters(run.diameterInches),
    system: run.system,
    validationIssues,
  };
}

function baseRunPath(system: PlumbingSystem, run: PlumbingRun, issues: Plumbing3DValidationIssue[]): PlumbingPoint3D[] {
  const startNode = findNode(system, run.startNodeId);
  const endNode = findNode(system, run.endNodeId);
  if (!startNode) {
    issues.push(issue({
      code: 'run_missing_start_node',
      objectType: 'plumbing_run',
      objectId: run.id,
      message: 'Pipe run start node does not exist.',
      severity: 'error',
    }));
  }
  if (!endNode) {
    issues.push(issue({
      code: 'run_missing_end_node',
      objectType: 'plumbing_run',
      objectId: run.id,
      message: 'Pipe run end node does not exist.',
      severity: 'error',
    }));
  }

  if (run.path.length >= 2) {
    const routePoints = run.path.slice(1, -1);
    return [
      startNode?.position ?? run.path[0]!,
      ...routePoints,
      endNode?.position ?? run.path[run.path.length - 1]!,
    ];
  }
  return [startNode?.position, endNode?.position].filter((point): point is PlumbingPoint3D => Boolean(point));
}

function sanitarySlopeInPerFt(run: PlumbingRun): number {
  return run.slopeInPerFt != null && Number.isFinite(run.slopeInPerFt) && run.slopeInPerFt > 0
    ? run.slopeInPerFt
    : ipc2024MinimumDrainageSlopeInPerFt(run.diameterInches);
}

function resolveSanitaryNodeElevationsToSeptic(system: PlumbingSystem): Map<string, number> {
  const elevations = new Map<string, number>();
  system.nodes
    .filter((node) => node.kind === 'septic_inlet' && node.system === 'sanitary')
    .forEach((node) => elevations.set(node.id, node.position.y));
  if (elevations.size === 0) return elevations;

  let changed = true;
  while (changed) {
    changed = false;
    system.runs
      .filter((run) => run.system === 'sanitary' && run.elevationMode === 'under_slab')
      .forEach((run) => {
        const endElevation = elevations.get(run.endNodeId);
        if (endElevation == null || elevations.has(run.startNodeId)) return;
        const drop = pathPlanLength(run.path) * (sanitarySlopeInPerFt(run) / 12);
        elevations.set(run.startNodeId, endElevation + drop);
        changed = true;
      });
  }
  return elevations;
}

function elevationForMode(params: {
  point: PlumbingPoint3D;
  run: PlumbingRun;
  defaults: PlumbingElevationDefaults;
  cumulativeDistanceM: number;
  issues: Plumbing3DValidationIssue[];
  sanitaryStartElevationM?: number;
}): number {
  const { point, run, defaults, cumulativeDistanceM, issues } = params;
  switch (run.elevationMode) {
    case 'under_slab': {
      const base = defaults.slabTopElevationM - defaults.slabThicknessM - defaults.sanitaryUnderSlabCoverM;
      const slope = run.slopeInPerFt;
      if (run.system === 'sanitary' && (!finiteNumber(slope) || slope <= 0)) {
        issues.push(issue({
          code: 'sanitary_run_missing_slope',
          objectType: 'plumbing_run',
          objectId: run.id,
          message: 'Sanitary run is missing a positive slope for 3D under-slab resolution.',
        }));
      }
      if (finiteNumber(slope) && slope < 0) {
        issues.push(issue({
          code: 'sanitary_run_slopes_wrong_direction',
          objectType: 'plumbing_run',
          objectId: run.id,
          message: 'Sanitary run slope must fall from start node toward end node.',
        }));
      }
      const effectiveSlope = finiteNumber(slope) && slope > 0
        ? slope
        : run.system === 'sanitary'
          ? ipc2024MinimumDrainageSlopeInPerFt(run.diameterInches)
          : 0;
      const drop = effectiveSlope > 0 ? cumulativeDistanceM * (effectiveSlope / 12) : 0;
      const startElevation = finiteNumber(params.sanitaryStartElevationM) ? params.sanitaryStartElevationM : base;
      const y = startElevation - drop;
      if (y >= defaults.slabTopElevationM) {
        issues.push(issue({
          code: 'under_slab_pipe_above_slab',
          objectType: 'plumbing_run',
          objectId: run.id,
          message: 'Under-slab pipe resolved at or above slab top.',
        }));
      }
      return y;
    }
    case 'in_wall':
      return hasExplicitElevation(point) ? point.y : defaults.waterInWallHeightM;
    case 'overhead':
      return defaults.ceilingElevationM - defaults.waterOverheadDropM;
    case 'user_defined':
      if (!finiteNumber(point.y)) {
        issues.push(issue({
          code: 'user_defined_run_missing_elevation',
          objectType: 'plumbing_run',
          objectId: run.id,
          message: 'User-defined pipe run is missing explicit point elevations.',
        }));
      }
      return finiteNumber(point.y) ? point.y : defaults.waterInWallHeightM;
    case 'vertical':
      return hasExplicitElevation(point) ? point.y : defaults.waterInWallHeightM;
    default:
      return defaults.waterInWallHeightM;
  }
}

export function resolvePlumbingRunPath(params: {
  system: PlumbingSystem;
  run: PlumbingRun;
  defaults?: Partial<PlumbingElevationDefaults>;
}): ResolvedPlumbingRunPath {
  const defaults = mergeDefaults(params.defaults);
  const validationIssues: Plumbing3DValidationIssue[] = [];
  const planPoints = baseRunPath(params.system, params.run, validationIssues);
  if (planPoints.length === 0) {
    return resolvedRunPathBase(params.run, [], validationIssues);
  }

  if (params.run.elevationMode === 'vertical') {
    const first = planPoints[0]!;
    const last = planPoints[planPoints.length - 1] ?? first;
    const sanitaryNodeElevations = params.run.system === 'sanitary'
      ? resolveSanitaryNodeElevationsToSeptic(params.system)
      : new Map<string, number>();
    const startY = sanitaryNodeElevations.get(params.run.startNodeId) ??
      (finiteNumber(first.y) ? first.y : defaults.waterInWallHeightM);
    const defaultTopY =
      params.run.system === 'vent'
        ? defaults.roofElevationM + defaults.ventThroughRoofExtensionM
        : defaults.ceilingElevationM;
    const endY = finiteNumber(last.y) && last.y > startY ? last.y : defaultTopY;
    if (params.run.system === 'vent' && endY < defaults.roofElevationM + defaults.ventThroughRoofExtensionM) {
      validationIssues.push(issue({
        code: 'vent_does_not_rise_through_roof',
        objectType: 'plumbing_run',
        objectId: params.run.id,
        message: 'Vent run does not rise through the roof.',
      }));
    }
    return resolvedRunPathBase(
      params.run,
      [
        { x: first.x, y: startY, z: first.z },
        { x: first.x, y: endY, z: first.z },
      ],
      validationIssues,
    );
  }

  const distances = cumulativeDistances(planPoints);
  const sanitaryNodeElevations = params.run.system === 'sanitary' && params.run.elevationMode === 'under_slab'
    ? resolveSanitaryNodeElevationsToSeptic(params.system)
    : new Map<string, number>();
  const sanitaryStartElevationM = sanitaryNodeElevations.get(params.run.startNodeId);
  const points = planPoints.map((point, index) =>
    pointAtElevation(point, elevationForMode({
      point,
      run: params.run,
      defaults,
      cumulativeDistanceM: distances[index] ?? 0,
      issues: validationIssues,
      sanitaryStartElevationM,
    })),
  );

  if (params.run.system === 'vent' && params.run.elevationMode !== 'vertical') {
    const top = Math.max(...points.map((point) => point.y));
    if (top < defaults.roofElevationM + defaults.ventThroughRoofExtensionM) {
      validationIssues.push(issue({
        code: 'vent_does_not_rise_through_roof',
        objectType: 'plumbing_run',
        objectId: params.run.id,
        message: 'Vent run does not rise through the roof.',
      }));
    }
  }

  return resolvedRunPathBase(params.run, points, validationIssues);
}

function closestResolvedPointToNode(
  nodePosition: PlumbingPoint3D,
  paths: readonly ResolvedPlumbingRunPath[],
  connectedRunIds: readonly string[],
): PlumbingPoint3D | null {
  let bestPoint: PlumbingPoint3D | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const connected = new Set(connectedRunIds);
  paths.forEach((path) => {
    if (connected.size > 0 && !connected.has(path.runId)) return;
    path.points.forEach((point) => {
      const distance = Math.hypot(point.x - nodePosition.x, point.z - nodePosition.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPoint = point;
      }
    });
  });
  return bestDistance <= 0.05 ? bestPoint : null;
}

export function resolvePlumbingFittingPosition(params: {
  system: PlumbingSystem;
  fitting: PlumbingFitting;
  defaults?: Partial<PlumbingElevationDefaults>;
  resolvedRunPaths?: readonly ResolvedPlumbingRunPath[];
}): { position: PlumbingPoint3D; validationIssues: Plumbing3DValidationIssue[] } {
  const defaults = mergeDefaults(params.defaults);
  const validationIssues: Plumbing3DValidationIssue[] = [];
  const node = findNode(params.system, params.fitting.nodeId);
  const base = node?.position ?? { x: 0, y: 0, z: 0 };
  const resolvedCenter = node && params.resolvedRunPaths
    ? closestResolvedPointToNode(base, params.resolvedRunPaths, params.fitting.connectedRunIds)
    : null;
  const y = params.fitting.elevationMode === 'under_slab'
    ? resolvedCenter?.y ?? defaults.slabTopElevationM - defaults.slabThicknessM - defaults.sanitaryUnderSlabCoverM
    : params.fitting.elevationMode === 'overhead'
      ? resolvedCenter?.y ?? defaults.ceilingElevationM - defaults.waterOverheadDropM
      : params.fitting.elevationMode === 'vertical'
        ? resolvedCenter?.y ?? (hasExplicitElevation(base) ? base.y : defaults.waterInWallHeightM)
        : resolvedCenter
          ? resolvedCenter.y
          : hasExplicitElevation(base)
          ? base.y
          : defaults.waterInWallHeightM;
  if (!node) {
    validationIssues.push(issue({
      code: 'run_missing_start_node',
      objectType: 'plumbing_fitting',
      objectId: params.fitting.id,
      message: 'Fitting node does not exist.',
      severity: 'error',
    }));
  }
  return { position: { x: base.x, y, z: base.z }, validationIssues };
}

export function resolvePlumbingFixturePosition(params: {
  fixture: PlumbingFixture;
  defaults?: Partial<PlumbingElevationDefaults>;
}): PlumbingPoint3D {
  const defaults = mergeDefaults(params.defaults);
  return {
    x: params.fixture.position.x,
    y: hasExplicitElevation(params.fixture.position) ? params.fixture.position.y : defaults.slabTopElevationM,
    z: params.fixture.position.z,
  };
}

export function resolvePlumbingEquipmentPosition(params: {
  equipment: PlumbingEquipment;
  defaults?: Partial<PlumbingElevationDefaults>;
}): PlumbingPoint3D {
  const defaults = mergeDefaults(params.defaults);
  const base = params.equipment.position;
  let y = hasExplicitElevation(base) ? base.y : defaults.waterInWallHeightM;
  if (params.equipment.equipmentType === 'roof_vent_termination') {
    y = defaults.roofElevationM + defaults.ventThroughRoofExtensionM;
  } else if (params.equipment.equipmentType === 'building_drain_exit' || params.equipment.equipmentType === 'distribution_box') {
    y = defaults.slabTopElevationM - defaults.slabThicknessM - defaults.sanitaryUnderSlabCoverM;
  } else if (params.equipment.equipmentType.includes('stack')) {
    y = defaults.slabTopElevationM;
  }
  return { x: base.x, y, z: base.z };
}
