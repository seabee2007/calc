import type {
  PlumbingEquipment,
  PlumbingFitting,
  PlumbingFixture,
  PlumbingNode,
  PlumbingPoint3D,
  PlumbingRun,
  PlumbingSystem,
} from '../plumbingTypes';
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
  validationIssues: Plumbing3DValidationIssue[];
};

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

function pointAtElevation(point: PlumbingPoint3D, y: number): PlumbingPoint3D {
  return { x: point.x, y, z: point.z };
}

function findNode(system: PlumbingSystem, nodeId: string): PlumbingNode | null {
  return system.nodes.find((node) => node.id === nodeId) ?? null;
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

function elevationForMode(params: {
  point: PlumbingPoint3D;
  run: PlumbingRun;
  defaults: PlumbingElevationDefaults;
  cumulativeDistanceM: number;
  issues: Plumbing3DValidationIssue[];
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
      const drop = finiteNumber(slope) && slope > 0 ? cumulativeDistanceM * (slope / 12) : 0;
      const y = base - drop;
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
    return { runId: params.run.id, points: [], validationIssues };
  }

  if (params.run.elevationMode === 'vertical') {
    const first = planPoints[0]!;
    const last = planPoints[planPoints.length - 1] ?? first;
    const startY = hasExplicitElevation(first) ? first.y : defaults.waterInWallHeightM;
    const defaultTopY =
      params.run.system === 'vent'
        ? defaults.roofElevationM + defaults.ventThroughRoofExtensionM
        : defaults.ceilingElevationM;
    const endY = hasExplicitElevation(last) && last.y > startY ? last.y : defaultTopY;
    if (params.run.system === 'vent' && endY < defaults.roofElevationM + defaults.ventThroughRoofExtensionM) {
      validationIssues.push(issue({
        code: 'vent_does_not_rise_through_roof',
        objectType: 'plumbing_run',
        objectId: params.run.id,
        message: 'Vent run does not rise through the roof.',
      }));
    }
    return {
      runId: params.run.id,
      points: [
        { x: first.x, y: startY, z: first.z },
        { x: first.x, y: endY, z: first.z },
      ],
      validationIssues,
    };
  }

  const distances = cumulativeDistances(planPoints);
  const points = planPoints.map((point, index) =>
    pointAtElevation(point, elevationForMode({
      point,
      run: params.run,
      defaults,
      cumulativeDistanceM: distances[index] ?? 0,
      issues: validationIssues,
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

  return { runId: params.run.id, points, validationIssues };
}

export function resolvePlumbingFittingPosition(params: {
  system: PlumbingSystem;
  fitting: PlumbingFitting;
  defaults?: Partial<PlumbingElevationDefaults>;
}): { position: PlumbingPoint3D; validationIssues: Plumbing3DValidationIssue[] } {
  const defaults = mergeDefaults(params.defaults);
  const validationIssues: Plumbing3DValidationIssue[] = [];
  const node = findNode(params.system, params.fitting.nodeId);
  const base = node?.position ?? { x: 0, y: 0, z: 0 };
  const y = params.fitting.elevationMode === 'under_slab'
    ? defaults.slabTopElevationM - defaults.slabThicknessM - defaults.sanitaryUnderSlabCoverM
    : params.fitting.elevationMode === 'overhead'
      ? defaults.ceilingElevationM - defaults.waterOverheadDropM
      : params.fitting.elevationMode === 'vertical'
        ? defaults.waterInWallHeightM
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
  } else if (params.equipment.equipmentType === 'building_drain_exit') {
    y = defaults.slabTopElevationM - defaults.slabThicknessM - defaults.sanitaryUnderSlabCoverM;
  } else if (params.equipment.equipmentType.includes('stack')) {
    y = defaults.slabTopElevationM;
  }
  return { x: base.x, y, z: base.z };
}
