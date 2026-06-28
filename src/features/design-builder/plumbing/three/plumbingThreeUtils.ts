import * as THREE from 'three';
import type {
  PlumbingEquipment,
  PlumbingFixture,
  PlumbingNode,
  PlumbingRun,
  PlumbingRunSystem,
  PlumbingSelection,
} from '../plumbingTypes';
import type { PlumbingFitting } from '../plumbingFittingTypes';
import type { ResolvedPlumbingRunPath } from './plumbingElevationResolver';

export type Plumbing3DObjectType =
  | 'plumbing_run'
  | 'plumbing_fitting'
  | 'plumbing_fixture'
  | 'plumbing_rough_in'
  | 'plumbing_equipment'
  | 'septic_tank';

export type Plumbing3DValidationCode =
  | 'plumbing_3d_object_render_failed'
  | 'run_missing_start_node'
  | 'run_missing_end_node'
  | 'sanitary_run_missing_slope'
  | 'sanitary_run_slopes_wrong_direction'
  | 'under_slab_pipe_above_slab'
  | 'pipe_below_grade_missing_elevation_mode'
  | 'vent_does_not_rise_through_roof'
  | 'user_defined_run_missing_elevation'
  | 'sharp_bend_missing_fitting'
  | 'pipe_crosses_footing_without_sleeve'
  | 'pipe_crosses_rc_column'
  | 'fixture_missing_required_node'
  | 'fixture_missing_procedural_renderer'
  | 'fitting_type_missing_procedural_renderer'
  | 'fitting_direction_unresolved'
  | 'solved_plumbing_model_issue';

export type Plumbing3DValidationIssue = {
  code: Plumbing3DValidationCode;
  message: string;
  severity: 'warning' | 'error';
  objectType?: Plumbing3DObjectType;
  objectId?: string;
};

export type Plumbing3DVisibility = {
  showPlumbing: boolean;
  showFixtures: boolean;
  showFittings: boolean;
  showDrain: boolean;
  showVent: boolean;
  showColdWater: boolean;
  showHotWater: boolean;
  showUnderground: boolean;
  showLabels: boolean;
  showCenterlines: boolean;
  showSolvedFittingPorts: boolean;
};

export type Plumbing3DPlacementMode =
  | 'floor-mounted'
  | 'wall-mounted'
  | 'ceiling-mounted'
  | 'buried-port-aligned'
  | 'pipe-centerline-aligned';

export type ConnectorPort = {
  id: string;
  localPosition: THREE.Vector3;
  direction: THREE.Vector3;
  diameter: number;
};

export const DEFAULT_PLUMBING_3D_VISIBILITY: Plumbing3DVisibility = {
  showPlumbing: true,
  showFixtures: true,
  showFittings: true,
  showDrain: true,
  showVent: true,
  showColdWater: true,
  showHotWater: true,
  showUnderground: true,
  showLabels: true,
  showCenterlines: false,
  showSolvedFittingPorts: false,
};

export function normalizePlumbing3DVisibility(
  value: Partial<Plumbing3DVisibility> | null | undefined,
): Plumbing3DVisibility {
  return {
    ...DEFAULT_PLUMBING_3D_VISIBILITY,
    ...(value ?? {}),
  };
}

export type TrackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => T;
export type TrackMaterial = <T extends THREE.Material>(material: T) => T;

export type PlumbingFittingDirection = {
  runId: string;
  run?: PlumbingRun;
  direction: THREE.Vector3;
  center?: THREE.Vector3;
  routePointIndex?: number;
};

export type ConnectedRunDirection = PlumbingFittingDirection;

export function plumbingSelectionForObject(
  objectType: Plumbing3DObjectType,
  objectId: string,
): PlumbingSelection | null {
  switch (objectType) {
    case 'plumbing_run':
      return { kind: 'run', id: objectId };
    case 'plumbing_fitting':
      return { kind: 'fitting', id: objectId };
    case 'plumbing_fixture':
      return { kind: 'fixture', id: objectId };
    case 'plumbing_rough_in':
      return { kind: 'rough-in', id: objectId };
    case 'plumbing_equipment':
      return { kind: 'equipment', id: objectId };
    case 'septic_tank':
      return { kind: 'septic-tank', id: objectId };
    default:
      return null;
  }
}

export function markPlumbingObject3D(params: {
  group: THREE.Object3D;
  objectType: Plumbing3DObjectType;
  objectId: string;
  selectionPriority?: number;
}): THREE.Object3D {
  const plumbingSelection = plumbingSelectionForObject(params.objectType, params.objectId);
  params.group.traverse((object) => {
    object.userData.objectType = params.objectType;
    object.userData.objectId = params.objectId;
    if (plumbingSelection) {
      object.userData.selectable = true;
      object.userData.plumbingSelection = plumbingSelection;
      object.userData.selectionPriority = params.selectionPriority ?? 70;
    }
  });
  return params.group;
}

export function selectionMatchesPlumbingObject(
  selection: PlumbingSelection | null | undefined,
  objectType: Plumbing3DObjectType,
  objectId: string,
): boolean {
  if (!selection || selection.kind === 'none') return false;
  if (objectType === 'plumbing_run') return selection.kind === 'run' && selection.id === objectId;
  if (objectType === 'plumbing_fitting') return selection.kind === 'fitting' && selection.id === objectId;
  if (objectType === 'plumbing_fixture') return selection.kind === 'fixture' && selection.id === objectId;
  if (objectType === 'plumbing_rough_in') return selection.kind === 'rough-in' && selection.id === objectId;
  if (objectType === 'plumbing_equipment') return selection.kind === 'equipment' && selection.id === objectId;
  if (objectType === 'septic_tank') return selection.kind === 'septic-tank' && selection.id === objectId;
  return false;
}

export function systemVisible(system: PlumbingRunSystem, visibility: Plumbing3DVisibility): boolean {
  if (system === 'sanitary') return visibility.showDrain;
  if (system === 'vent') return visibility.showVent;
  if (system === 'cold_water') return visibility.showColdWater;
  if (system === 'hot_water') return visibility.showHotWater;
  return true;
}

export function runVisible(run: PlumbingRun, visibility: Plumbing3DVisibility): boolean {
  if (!visibility.showPlumbing || !systemVisible(run.system, visibility)) return false;
  if (!visibility.showUnderground && run.elevationMode === 'under_slab') return false;
  return true;
}

export function fittingVisible(fitting: PlumbingFitting, visibility: Plumbing3DVisibility): boolean {
  if (!visibility.showPlumbing || !visibility.showFittings) return false;
  if (!visibility.showUnderground && fitting.elevationMode === 'under_slab') return false;
  if (fitting.system === 'multi') return true;
  return systemVisible(fitting.system, visibility);
}

export function fixtureVisible(_fixture: PlumbingFixture, visibility: Plumbing3DVisibility): boolean {
  return visibility.showPlumbing && visibility.showFixtures;
}

export function equipmentVisible(equipment: PlumbingEquipment, visibility: Plumbing3DVisibility): boolean {
  if (!visibility.showPlumbing) return false;
  if (
    equipment.equipmentType === 'cleanout' ||
    equipment.equipmentType === 'distribution_box' ||
    equipment.equipmentType === 'building_drain_exit' ||
    equipment.equipmentType === 'waste_stack'
  ) {
    return visibility.showDrain;
  }
  if (
    equipment.equipmentType === 'vent_stack' ||
    equipment.equipmentType === 'combined_stack' ||
    equipment.equipmentType === 'roof_vent_termination'
  ) {
    return visibility.showVent;
  }
  return visibility.showColdWater || visibility.showHotWater;
}

export function diameterInchesToVisualRadiusMeters(diameterInches: number | null | undefined): number {
  if (diameterInches == null || !Number.isFinite(diameterInches) || diameterInches <= 0) return 0.035;
  return Math.max(0.018, Math.min(0.12, diameterInches * 0.0254 / 2));
}

export function fittingSocketLengthMeters(diameterInches: number | null | undefined): number {
  const pipeDiameterM = diameterInches != null && Number.isFinite(diameterInches) && diameterInches > 0
    ? diameterInches * 0.0254
    : diameterInchesToVisualRadiusMeters(diameterInches) * 2;
  return Math.max(pipeDiameterM * 2.5, 0.15);
}

export function vectorFromPoint(point: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
}

export function getDirectionBetweenPoints(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 {
  const direction = new THREE.Vector3().subVectors(to, from);
  if (direction.lengthSq() <= 0.000001) return new THREE.Vector3(1, 0, 0);
  return direction.normalize();
}

export function createCylinderBetween(params: {
  name: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
  radialSegments?: number;
}): THREE.Mesh | null {
  const direction = new THREE.Vector3().subVectors(params.end, params.start);
  const length = direction.length();
  if (!Number.isFinite(length) || length <= 0.0001) return null;
  const geometry = params.trackGeometry?.(
    new THREE.CylinderGeometry(
      params.radius,
      params.radius,
      length,
      params.radialSegments ?? 12,
    ),
  ) ?? new THREE.CylinderGeometry(params.radius, params.radius, length, params.radialSegments ?? 12);
  const mesh = new THREE.Mesh(geometry, params.material);
  mesh.name = params.name;
  mesh.position.copy(params.start).add(params.end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

export function createCylinderBetweenPoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const safeEnd = start.distanceToSquared(end) > 0.000001
    ? end
    : end.clone().add(new THREE.Vector3(0, 0.001, 0));
  const mesh = createCylinderBetween({
    name: 'cylinder between points',
    start,
    end: safeEnd,
    radius,
    material,
  });
  if (!mesh) {
    return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.001, 12), material);
  }
  return mesh;
}

export function createSleeveAlongDirection(params: {
  group: THREE.Group;
  name: string;
  center: THREE.Vector3;
  direction: THREE.Vector3;
  length: number;
  radius: number;
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
  radialSegments?: number;
}): THREE.Mesh | null {
  const direction = params.direction.clone();
  if (direction.lengthSq() <= 0.000001) direction.set(1, 0, 0);
  direction.normalize();
  const half = Math.max(0.02, params.length / 2);
  const start = params.center.clone().addScaledVector(direction, -half);
  const end = params.center.clone().addScaledVector(direction, half);
  const mesh = createCylinderBetween({
    name: params.name,
    start,
    end,
    radius: params.radius,
    material: params.material,
    trackGeometry: params.trackGeometry,
    radialSegments: params.radialSegments,
  });
  if (mesh) params.group.add(mesh);
  return mesh;
}

function pointsNearlyEqual(a: { x: number; z: number }, b: { x: number; z: number }): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) <= 0.025;
}

function pointsNearlyEqual3D(a: THREE.Vector3, b: THREE.Vector3): boolean {
  return a.distanceTo(b) <= 0.055;
}

function directionFromPoints(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
): THREE.Vector3 | null {
  const direction = new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
  if (direction.lengthSq() <= 0.000001) return null;
  return direction.normalize();
}

function nodeForFitting(fitting: PlumbingFitting, nodes: readonly PlumbingNode[]): PlumbingNode | null {
  return nodes.find((node) => node.id === fitting.nodeId) ?? null;
}

function closestRunPathIndex(run: PlumbingRun, point: { x: number; z: number }): number {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  run.path.forEach((candidate, index) => {
    const distance = Math.hypot(candidate.x - point.x, candidate.z - point.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestDistance <= 0.025 ? bestIndex : -1;
}

function closestRunSegmentIndex(run: PlumbingRun, point: { x: number; z: number }): number {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < run.path.length; index += 1) {
    const previous = run.path[index - 1];
    const current = run.path[index];
    if (!previous || !current) continue;
    const dx = current.x - previous.x;
    const dz = current.z - previous.z;
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq <= 0.000001) continue;
    const t = Math.max(0, Math.min(1, ((point.x - previous.x) * dx + (point.z - previous.z) * dz) / lengthSq));
    const closest = {
      x: previous.x + dx * t,
      z: previous.z + dz * t,
    };
    const distance = Math.hypot(point.x - closest.x, point.z - closest.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestDistance <= 0.025 ? bestIndex : -1;
}

function directionsForRunAtNode(run: PlumbingRun, node: PlumbingNode): PlumbingFittingDirection[] {
  const directions: PlumbingFittingDirection[] = [];
  const pathIndex = closestRunPathIndex(run, node.position);
  const point = pathIndex >= 0 ? run.path[pathIndex]! : node.position;
  if (pathIndex > 0) {
    const previous = run.path[pathIndex - 1];
    const direction = previous ? directionFromPoints(point, previous) : null;
    if (direction) directions.push({ runId: run.id, run, direction, routePointIndex: pathIndex });
  }
  if (pathIndex >= 0 && pathIndex < run.path.length - 1) {
    const next = run.path[pathIndex + 1];
    const direction = next ? directionFromPoints(point, next) : null;
    if (direction) directions.push({ runId: run.id, run, direction, routePointIndex: pathIndex });
  }
  if (directions.length > 0) return directions;
  const segmentIndex = closestRunSegmentIndex(run, node.position);
  if (segmentIndex > 0) {
    const previous = run.path[segmentIndex - 1];
    const next = run.path[segmentIndex];
    if (previous) {
      const direction = directionFromPoints(node.position, previous);
      if (direction) directions.push({ runId: run.id, run, direction });
    }
    if (next) {
      const direction = directionFromPoints(node.position, next);
      if (direction) directions.push({ runId: run.id, run, direction });
    }
  }
  if (directions.length > 0) return directions;
  if (run.startNodeId === node.id && run.path[1]) {
    const direction = directionFromPoints(node.position, run.path[1]!);
    if (direction) directions.push({ runId: run.id, run, direction });
  }
  if (run.endNodeId === node.id && run.path[run.path.length - 2]) {
    const direction = directionFromPoints(node.position, run.path[run.path.length - 2]!);
    if (direction) directions.push({ runId: run.id, run, direction });
  }
  if (directions.length > 0) return directions;
  if (pointsNearlyEqual(run.path[0] ?? node.position, node.position) && run.path[1]) {
    const direction = directionFromPoints(node.position, run.path[1]!);
    if (direction) directions.push({ runId: run.id, run, direction });
  }
  const last = run.path[run.path.length - 1];
  const previous = run.path[run.path.length - 2];
  if (last && previous && pointsNearlyEqual(last, node.position)) {
    const direction = directionFromPoints(node.position, previous);
    if (direction) directions.push({ runId: run.id, run, direction });
  }
  return directions;
}

function closestResolvedPathIndex(path: ResolvedPlumbingRunPath, node: PlumbingNode): number {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  path.points.forEach((point, index) => {
    const distance = Math.hypot(point.x - node.position.x, point.z - node.position.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestDistance <= 0.055 ? bestIndex : -1;
}

function closestResolvedSegmentIndex(path: ResolvedPlumbingRunPath, node: PlumbingNode): number {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.points.length; index += 1) {
    const previous = path.points[index - 1];
    const current = path.points[index];
    if (!previous || !current) continue;
    const segment = current.clone().sub(previous);
    const lengthSq = segment.lengthSq();
    if (lengthSq <= 0.000001) continue;
    const nodePoint = vectorFromPoint(node.position);
    const t = Math.max(0, Math.min(1, nodePoint.clone().sub(previous).dot(segment) / lengthSq));
    const closest = previous.clone().add(segment.multiplyScalar(t));
    const distance = closest.distanceTo(nodePoint);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestDistance <= 0.055 ? bestIndex : -1;
}

function directionsForResolvedRunAtNode(
  run: PlumbingRun,
  node: PlumbingNode,
  path: ResolvedPlumbingRunPath,
): PlumbingFittingDirection[] {
  const directions: PlumbingFittingDirection[] = [];
  const pathIndex = closestResolvedPathIndex(path, node);
  if (pathIndex >= 0) {
    const center = vectorFromPoint(path.points[pathIndex]!);
    if (pathIndex > 0) {
      const previous = path.points[pathIndex - 1];
      if (previous) {
        directions.push({
          runId: run.id,
          run,
          direction: getDirectionBetweenPoints(center, vectorFromPoint(previous)),
          center,
          routePointIndex: pathIndex,
        });
      }
    }
    if (pathIndex < path.points.length - 1) {
      const next = path.points[pathIndex + 1];
      if (next) {
        directions.push({
          runId: run.id,
          run,
          direction: getDirectionBetweenPoints(center, vectorFromPoint(next)),
          center,
          routePointIndex: pathIndex,
        });
      }
    }
    return directions;
  }
  const segmentIndex = closestResolvedSegmentIndex(path, node);
  if (segmentIndex > 0) {
    const center = vectorFromPoint(node.position);
    const previous = path.points[segmentIndex - 1];
    const next = path.points[segmentIndex];
    if (previous) {
      directions.push({
        runId: run.id,
        run,
        direction: getDirectionBetweenPoints(center, vectorFromPoint(previous)),
        center,
      });
    }
    if (next) {
      directions.push({
        runId: run.id,
        run,
        direction: getDirectionBetweenPoints(center, vectorFromPoint(next)),
        center,
      });
    }
  }
  return directions;
}

export function getConnectedRunDirectionsAtNode(
  fittingNodeId: string,
  runs: PlumbingRun[],
  resolvedRunPaths: ResolvedPlumbingRunPath[],
): ConnectedRunDirection[] {
  const pathByRunId = new Map(resolvedRunPaths.map((path) => [path.runId, path]));
  return runs.flatMap((run) => {
    const path = pathByRunId.get(run.id);
    if (!path) return [];
    if (run.startNodeId === fittingNodeId && path.points[0] && path.points[1]) {
      const center = vectorFromPoint(path.points[0]);
      return [{ runId: run.id, run, direction: getDirectionBetweenPoints(center, vectorFromPoint(path.points[1])), center }];
    }
    if (run.endNodeId === fittingNodeId && path.points[path.points.length - 1] && path.points[path.points.length - 2]) {
      const center = vectorFromPoint(path.points[path.points.length - 1]!);
      return [{
        runId: run.id,
        run,
        direction: getDirectionBetweenPoints(center, vectorFromPoint(path.points[path.points.length - 2]!)),
        center,
      }];
    }
    return [];
  });
}

export function getConnectedRunDirections(
  fitting: PlumbingFitting,
  runs: readonly PlumbingRun[],
  nodes: readonly PlumbingNode[],
  resolvedRunPaths?: readonly ResolvedPlumbingRunPath[],
): PlumbingFittingDirection[] {
  const node = nodeForFitting(fitting, nodes);
  if (!node) return [];
  const connectedRunIds = new Set(fitting.connectedRunIds);
  if (resolvedRunPaths) {
    const pathByRunId = new Map(resolvedRunPaths.map((path) => [path.runId, path]));
    const resolvedDirections = runs
      .filter((run) => connectedRunIds.has(run.id))
      .flatMap((run) => {
        const path = pathByRunId.get(run.id);
        return path ? directionsForResolvedRunAtNode(run, node, path) : [];
      });
    if (resolvedDirections.length > 0) return resolvedDirections;
  }
  return runs
    .filter((run) => connectedRunIds.has(run.id))
    .flatMap((run) => directionsForRunAtNode(run, node));
}

function centerMatchesAnyFitting(point: THREE.Vector3, fittingCenters: readonly THREE.Vector3[]): boolean {
  return fittingCenters.some((center) => pointsNearlyEqual3D(point, center));
}

export function trimRunPathForFittings(
  runPath: THREE.Vector3[],
  _fittingNodes: PlumbingFitting[],
  socketLengthM: number,
  fittingCenters: readonly THREE.Vector3[] = [],
): THREE.Vector3[] {
  if (runPath.length < 2 || fittingCenters.length === 0) return runPath.map((point) => point.clone());
  const trimmed: THREE.Vector3[] = [];
  for (let index = 1; index < runPath.length; index += 1) {
    const originalStart = runPath[index - 1]!;
    const originalEnd = runPath[index]!;
    const start = originalStart.clone();
    const end = originalEnd.clone();
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    if (length <= 0.0001) continue;
    direction.normalize();
    const trim = Math.min(socketLengthM, length * 0.42);
    if (centerMatchesAnyFitting(originalStart, fittingCenters)) {
      start.addScaledVector(direction, trim);
    }
    if (centerMatchesAnyFitting(originalEnd, fittingCenters)) {
      end.addScaledVector(direction, -trim);
    }
    trimmed.push(start, end);
  }
  return trimmed;
}

export function getPrimaryRunDirection(directions: readonly PlumbingFittingDirection[]): THREE.Vector3 {
  if (directions.length === 0) return new THREE.Vector3(1, 0, 0);
  let bestPair: [THREE.Vector3, THREE.Vector3] | null = null;
  let bestOpposition = Number.POSITIVE_INFINITY;
  for (let a = 0; a < directions.length; a += 1) {
    for (let b = a + 1; b < directions.length; b += 1) {
      const first = directions[a]!.direction;
      const second = directions[b]!.direction;
      const dot = first.dot(second);
      if (dot < bestOpposition) {
        bestOpposition = dot;
        bestPair = [first, second];
      }
    }
  }
  if (bestPair && bestOpposition < -0.35) {
    return bestPair[0].clone().normalize();
  }
  return directions[0]!.direction.clone().normalize();
}

export function getBranchDirection(
  directions: readonly PlumbingFittingDirection[],
  primaryDirection: THREE.Vector3,
): THREE.Vector3 {
  const primary = primaryDirection.clone().normalize();
  const branch = directions
    .map((item) => item.direction)
    .find((direction) => Math.abs(direction.clone().normalize().dot(primary)) < 0.82);
  if (branch) return branch.clone().normalize();
  const perpendicular = new THREE.Vector3(-primary.z, primary.y, primary.x);
  if (perpendicular.lengthSq() <= 0.000001) return new THREE.Vector3(0, 0, 1);
  return perpendicular.normalize();
}

export function createBoxMesh(params: {
  name: string;
  size: [number, number, number];
  position: [number, number, number];
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
}): THREE.Mesh {
  const geometry = params.trackGeometry?.(new THREE.BoxGeometry(...params.size)) ??
    new THREE.BoxGeometry(...params.size);
  const mesh = new THREE.Mesh(geometry, params.material);
  mesh.name = params.name;
  mesh.position.set(...params.position);
  return mesh;
}

export function createCylinderMesh(params: {
  name: string;
  radiusTop: number;
  radiusBottom?: number;
  height: number;
  position: [number, number, number];
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
  radialSegments?: number;
}): THREE.Mesh {
  const geometry = params.trackGeometry?.(
    new THREE.CylinderGeometry(
      params.radiusTop,
      params.radiusBottom ?? params.radiusTop,
      params.height,
      params.radialSegments ?? 16,
    ),
  ) ?? new THREE.CylinderGeometry(
    params.radiusTop,
    params.radiusBottom ?? params.radiusTop,
    params.height,
    params.radialSegments ?? 16,
  );
  const mesh = new THREE.Mesh(geometry, params.material);
  mesh.name = params.name;
  mesh.position.set(...params.position);
  return mesh;
}

export function createSphereMesh(params: {
  name: string;
  radius: number;
  position: [number, number, number];
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
  widthSegments?: number;
  heightSegments?: number;
}): THREE.Mesh {
  const geometry = params.trackGeometry?.(
    new THREE.SphereGeometry(params.radius, params.widthSegments ?? 16, params.heightSegments ?? 10),
  ) ?? new THREE.SphereGeometry(params.radius, params.widthSegments ?? 16, params.heightSegments ?? 10);
  const mesh = new THREE.Mesh(geometry, params.material);
  mesh.name = params.name;
  mesh.position.set(...params.position);
  return mesh;
}

export function addLocalPipe(params: {
  group: THREE.Group;
  name: string;
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
  radialSegments?: number;
}): THREE.Mesh | null {
  const mesh = createCylinderBetween({
    name: params.name,
    start: new THREE.Vector3(...params.start),
    end: new THREE.Vector3(...params.end),
    radius: params.radius,
    material: params.material,
    trackGeometry: params.trackGeometry,
    radialSegments: params.radialSegments,
  });
  if (mesh) params.group.add(mesh);
  return mesh;
}

export function applyPlanRotation(group: THREE.Object3D, rotationRadians: number | undefined): void {
  group.rotation.y = Number.isFinite(rotationRadians) ? -(rotationRadians ?? 0) : 0;
}

export function groupObjectNames(group: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  group.traverse((object) => {
    if (object.name) names.add(object.name);
  });
  return names;
}

export function placeObjectBaseAtY(
  object: THREE.Object3D,
  targetBaseY: number,
  clearance = 0.01,
): { beforeMinY: number; afterMinY: number; targetBaseY: number; clearance: number } | null {
  if (!Number.isFinite(targetBaseY)) return null;
  object.updateMatrixWorld(true);
  const beforeBounds = new THREE.Box3().setFromObject(object);
  if (!Number.isFinite(beforeBounds.min.y)) return null;

  object.position.y += targetBaseY + clearance - beforeBounds.min.y;
  object.updateMatrixWorld(true);

  const afterBounds = new THREE.Box3().setFromObject(object);
  return {
    beforeMinY: beforeBounds.min.y,
    afterMinY: afterBounds.min.y,
    targetBaseY,
    clearance,
  };
}

export function alignObjectPortToWorldPoint(
  object: THREE.Object3D,
  port: ConnectorPort,
  targetWorldPoint: THREE.Vector3,
): { before: THREE.Vector3; after: THREE.Vector3; target: THREE.Vector3; delta: THREE.Vector3 } | null {
  object.updateMatrixWorld(true);
  const currentPortWorld = port.localPosition.clone().applyMatrix4(object.matrixWorld);
  if (
    !Number.isFinite(currentPortWorld.x) ||
    !Number.isFinite(currentPortWorld.y) ||
    !Number.isFinite(currentPortWorld.z)
  ) {
    return null;
  }
  const delta = targetWorldPoint.clone().sub(currentPortWorld);
  object.position.add(delta);
  object.updateMatrixWorld(true);
  const after = port.localPosition.clone().applyMatrix4(object.matrixWorld);
  return {
    before: currentPortWorld,
    after,
    target: targetWorldPoint.clone(),
    delta,
  };
}
