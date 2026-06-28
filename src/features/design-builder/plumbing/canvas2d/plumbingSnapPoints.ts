import type { PlumbingNode, PlumbingPoint3D, PlumbingRun, PlumbingSystem } from '../plumbingTypes';

export type PlumbingSnapPoint = {
  id: string;
  point: PlumbingPoint3D;
  kind: 'node' | 'run-route-point' | 'run-endpoint' | 'septic-node';
  node?: PlumbingNode;
  run?: PlumbingRun;
  pointIndex?: number;
};

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
