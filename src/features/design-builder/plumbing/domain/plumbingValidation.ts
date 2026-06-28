import { getPlumbingFixtureDefinition } from '../plumbingFixtureLibrary';
import {
  isFittingAllowedForMaterial,
  isFittingAllowedForSystem,
} from './plumbingFittingCompatibility';
import type {
  PlumbingMaterial,
  PlumbingPoint3D,
  PlumbingRun,
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

function runTouchesAnyNode(run: PlumbingRun, nodeIds: Set<string>): boolean {
  return nodeIds.has(run.startNodeId) || nodeIds.has(run.endNodeId);
}

function requiresSchedule(material: PlumbingMaterial): boolean {
  return material === 'pvc' || material === 'abs' || material === 'cpvc' || material === 'cast_iron';
}

export function validatePlumbingSystem(
  system: PlumbingSystem,
  context: PlumbingValidationContext = {},
): PlumbingValidationIssue[] {
  const issues: PlumbingValidationIssue[] = [];
  const nodeIds = new Set(system.nodes.map((node) => node.id));
  const runsByNodeId = new Map<string, PlumbingRun[]>();
  system.runs.forEach((run) => {
    if (!runsByNodeId.has(run.startNodeId)) runsByNodeId.set(run.startNodeId, []);
    if (!runsByNodeId.has(run.endNodeId)) runsByNodeId.set(run.endNodeId, []);
    runsByNodeId.get(run.startNodeId)?.push(run);
    runsByNodeId.get(run.endNodeId)?.push(run);
  });

  system.fixtures.forEach((fixture) => {
    const definition = getPlumbingFixtureDefinition(fixture.fixtureType);
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
      if (!existingNodes.some((nodeId) => (runsByNodeId.get(nodeId) ?? []).some((run) => run.system === connection.system))) {
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
    if (!owned && !['building_drain_exit', 'main_service', 'stack', 'cleanout', 'valve', 'fitting', 'wye'].includes(node.kind)) {
      issues.push(issue({
        severity: 'warning',
        code: 'orphan_node',
        objectKind: 'node',
        objectId: node.id,
        message: `${node.label} is not owned by a fixture, equipment item, or septic tank.`,
      }));
    }
  });

  system.runs.forEach((run) => {
    runSegments(run).forEach(([a, b]) => {
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
        (context.beams ?? []).find((beam) => distancePointToSegment(beam.startPoint, a, b) <= beam.widthMeters / 2 || distancePointToSegment(beam.endPoint, a, b) <= beam.widthMeters / 2);
      if (crossesFooting || crossesStrip) {
        issues.push(issue({
          severity: 'warning',
          code: 'pipe_crosses_foundation',
          objectKind: 'run',
          objectId: run.id,
          message: 'Pipe run crosses a footing or beam coordination layer.',
        }));
      }
    });
  });

  return issues;
}
