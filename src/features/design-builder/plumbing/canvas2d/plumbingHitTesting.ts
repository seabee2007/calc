import type { PlumbingSelection, PlumbingSystem } from '../plumbingTypes';

function distancePointToSegment(point: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq <= 0) return Math.hypot(point.x - a.x, point.z - a.z);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lenSq));
  return Math.hypot(point.x - (a.x + t * dx), point.z - (a.z + t * dz));
}

export function hitTestPlumbingSystem(params: {
  system: PlumbingSystem;
  point: { x: number; z: number };
  toleranceMeters: number;
}): PlumbingSelection {
  const { system, point, toleranceMeters } = params;
  for (const equipment of [...system.equipment].reverse()) {
    if (Math.hypot(equipment.position.x - point.x, equipment.position.z - point.z) <= toleranceMeters * 1.35) {
      return { kind: 'equipment', id: equipment.id };
    }
  }
  for (const node of [...system.nodes].reverse()) {
    if (Math.hypot(node.position.x - point.x, node.position.z - point.z) <= toleranceMeters) {
      return { kind: 'node', id: node.id };
    }
  }
  for (const fixture of [...system.fixtures].reverse()) {
    if (Math.hypot(fixture.position.x - point.x, fixture.position.z - point.z) <= Math.max(0.35, toleranceMeters * 2)) {
      return { kind: 'fixture', id: fixture.id };
    }
  }
  for (const run of [...system.runs].reverse()) {
    for (let index = 0; index < run.path.length; index += 1) {
      const routePoint = run.path[index];
      if (routePoint && index > 0 && index < run.path.length - 1 && Math.hypot(routePoint.x - point.x, routePoint.z - point.z) <= toleranceMeters) {
        return { kind: 'run-route-point', runId: run.id, pointIndex: index };
      }
    }
    for (let index = 1; index < run.path.length; index += 1) {
      const previous = run.path[index - 1];
      const current = run.path[index];
      if (previous && current && distancePointToSegment(point, previous, current) <= toleranceMeters) {
        return { kind: 'run', id: run.id };
      }
    }
  }
  return { kind: 'none' };
}
