import type { PlumbingNode, PlumbingPoint3D, PlumbingRun, PlumbingSystem } from '../plumbingTypes';

export type PlumbingSnapPoint = {
  id: string;
  point: PlumbingPoint3D;
  kind: 'node' | 'run-route-point' | 'run-endpoint' | 'septic-node';
  node?: PlumbingNode;
  run?: PlumbingRun;
  pointIndex?: number;
};

export type PlumbingRunSegmentSnap = {
  run: PlumbingRun;
  runId: string;
  segmentIndex: number;
  point: PlumbingPoint3D;
  distanceMeters: number;
};

function projectPointToSegment(
  point: { x: number; z: number },
  a: PlumbingPoint3D,
  b: PlumbingPoint3D,
): { point: PlumbingPoint3D; distanceMeters: number } {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq <= 0) {
    return {
      point: a,
      distanceMeters: Math.hypot(point.x - a.x, point.z - a.z),
    };
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lenSq));
  const projected = {
    x: a.x + t * dx,
    y: a.y + ((b.y ?? 0) - (a.y ?? 0)) * t,
    z: a.z + t * dz,
  };
  return {
    point: projected,
    distanceMeters: Math.hypot(point.x - projected.x, point.z - projected.z),
  };
}

export function collectPlumbingSnapPoints(system: PlumbingSystem): PlumbingSnapPoint[] {
  const points: PlumbingSnapPoint[] = [];
  system.nodes.forEach((node) => {
    points.push({
      id: node.id,
      point: node.position,
      kind: node.septicTankId ? 'septic-node' : 'node',
      node,
    });
  });
  system.runs.forEach((run) => {
    run.path.forEach((point, index) => {
      if (index === 0 || index === run.path.length - 1) {
        points.push({ id: `${run.id}-endpoint-${index}`, point, kind: 'run-endpoint', run, pointIndex: index });
      } else {
        points.push({ id: `${run.id}-route-${index}`, point, kind: 'run-route-point', run, pointIndex: index });
      }
    });
  });
  return points;
}

export function findNearestPlumbingNode(params: {
  system: PlumbingSystem;
  point: { x: number; z: number };
  toleranceMeters: number;
  systemFilter?: PlumbingNode['system'];
}): PlumbingNode | null {
  let best: { node: PlumbingNode; distance: number } | null = null;
  params.system.nodes.forEach((node) => {
    if (params.systemFilter && node.system !== params.systemFilter) return;
    const distance = Math.hypot(node.position.x - params.point.x, node.position.z - params.point.z);
    if (distance > params.toleranceMeters) return;
    if (!best || distance < best.distance) best = { node, distance };
  });
  return best?.node ?? null;
}

export function findNearestPlumbingRunSegment(params: {
  system: PlumbingSystem;
  point: { x: number; z: number };
  toleranceMeters: number;
  systemFilter?: PlumbingRun['system'];
  excludeRunIds?: ReadonlySet<string>;
}): PlumbingRunSegmentSnap | null {
  let best: PlumbingRunSegmentSnap | null = null;
  params.system.runs.forEach((run) => {
    if (params.systemFilter && run.system !== params.systemFilter) return;
    if (params.excludeRunIds?.has(run.id)) return;
    for (let index = 1; index < run.path.length; index += 1) {
      const previous = run.path[index - 1];
      const current = run.path[index];
      if (!previous || !current) continue;
      const projected = projectPointToSegment(params.point, previous, current);
      if (projected.distanceMeters > params.toleranceMeters) continue;
      if (!best || projected.distanceMeters < best.distanceMeters) {
        best = {
          run,
          runId: run.id,
          segmentIndex: index,
          point: projected.point,
          distanceMeters: projected.distanceMeters,
        };
      }
    }
  });
  return best;
}
