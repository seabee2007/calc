import * as THREE from 'three';
import type {
  PlumbingEquipment,
  PlumbingFixture,
  PlumbingRun,
  PlumbingRunSystem,
  PlumbingSelection,
} from '../plumbingTypes';
import type { PlumbingFitting } from '../plumbingFittingTypes';

export type Plumbing3DObjectType =
  | 'plumbing_run'
  | 'plumbing_fitting'
  | 'plumbing_fixture'
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
  | 'fitting_type_missing_procedural_renderer';

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

export function vectorFromPoint(point: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
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
