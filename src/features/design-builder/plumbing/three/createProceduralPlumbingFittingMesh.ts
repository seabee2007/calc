import * as THREE from 'three';
import type { PlumbingFitting, PlumbingFittingType } from '../plumbingFittingTypes';
import {
  addLocalPipe,
  applyPlanRotation,
  createBoxMesh,
  createCylinderMesh,
  createSphereMesh,
  diameterInchesToVisualRadiusMeters,
  markPlumbingObject3D,
  type Plumbing3DValidationIssue,
  type TrackGeometry,
} from './plumbingThreeUtils';
import type { PlumbingThreeMaterials } from './plumbingThreeMaterials';

export const SUPPORTED_PROCEDURAL_PLUMBING_FITTING_TYPES = new Set<PlumbingFittingType>([
  'elbow_90',
  'elbow_90_long_sweep',
  'elbow_45',
  'elbow_22_5',
  'elbow_11_25',
  'tee',
  'sanitary_tee',
  'wye',
  'combo_wye_45',
  'coupling',
  'repair_coupling',
  'reducing_coupling',
  'transition_coupling',
  'cap',
  'plug',
  'cleanout_adapter',
  'cleanout_plug',
  'floor_cleanout',
  'yard_cleanout',
  'p_trap',
  'closet_bend',
  'closet_flange',
  'vent_tee',
  'roof_vent_boot',
  'ball_valve',
  'gate_valve',
  'check_valve',
  'stop_valve',
  'angle_stop',
  'drop_ear_elbow',
  'stub_out_elbow',
  'pipe_sleeve',
  'footing_sleeve',
  'wall_sleeve',
]);

function elbowAngle(type: PlumbingFittingType): number {
  if (type === 'elbow_45') return Math.PI / 4;
  if (type === 'elbow_22_5') return Math.PI / 8;
  if (type === 'elbow_11_25') return Math.PI / 16;
  return Math.PI / 2;
}

function addElbow(
  group: THREE.Group,
  type: PlumbingFittingType,
  radius: number,
  material: THREE.Material,
  trackGeometry?: TrackGeometry,
): void {
  const angle = elbowAngle(type);
  const leg = type === 'elbow_90_long_sweep' || type === 'closet_bend' ? 0.34 : 0.22;
  addLocalPipe({ group, name: 'elbow inlet', start: [-leg, 0, 0], end: [0, 0, 0], radius, material, trackGeometry });
  addLocalPipe({
    group,
    name: type === 'elbow_90_long_sweep' ? 'long sweep elbow outlet' : 'elbow outlet',
    start: [0, 0, 0],
    end: [Math.cos(angle) * leg, 0, Math.sin(angle) * leg],
    radius,
    material,
    trackGeometry,
  });
  group.add(createSphereMesh({
    name: type === 'elbow_90_long_sweep' ? 'long sweep rounded bend' : 'rounded bend',
    radius: radius * 1.35,
    position: [0, 0, 0],
    material,
    trackGeometry,
  }));
}

function addTee(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  addLocalPipe({ group, name: 'tee main', start: [-0.22, 0, 0], end: [0.22, 0, 0], radius, material, trackGeometry });
  addLocalPipe({ group, name: 'tee branch', start: [0, 0, 0], end: [0, 0, 0.22], radius, material, trackGeometry });
  group.add(createSphereMesh({ name: 'tee hub', radius: radius * 1.35, position: [0, 0, 0], material, trackGeometry }));
}

function addWye(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  addLocalPipe({ group, name: 'wye main', start: [-0.24, 0, 0], end: [0.24, 0, 0], radius, material, trackGeometry });
  addLocalPipe({ group, name: 'wye branch', start: [0, 0, 0], end: [0.18, 0, 0.18], radius, material, trackGeometry });
  group.add(createSphereMesh({ name: 'wye hub', radius: radius * 1.3, position: [0, 0, 0], material, trackGeometry }));
}

function addCoupling(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  addLocalPipe({
    group,
    name: 'coupling sleeve',
    start: [-0.13, 0, 0],
    end: [0.13, 0, 0],
    radius: radius * 1.25,
    material,
    trackGeometry,
  });
}

function addReducingCoupling(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  const geometry = trackGeometry?.(new THREE.CylinderGeometry(radius * 0.78, radius * 1.35, 0.3, 14)) ??
    new THREE.CylinderGeometry(radius * 0.78, radius * 1.35, 0.3, 14);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'reducing coupling taper';
  mesh.rotation.z = Math.PI / 2;
  group.add(mesh);
}

function addCap(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  addLocalPipe({ group, name: 'cap body', start: [-0.08, 0, 0], end: [0.02, 0, 0], radius: radius * 1.18, material, trackGeometry });
  group.add(createCylinderMesh({
    name: 'cap end disk',
    radiusTop: radius * 1.22,
    height: 0.025,
    position: [0.04, 0, 0],
    material,
    trackGeometry,
  }));
  group.children[group.children.length - 1]!.rotation.z = Math.PI / 2;
}

function addCleanout(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  addCap(group, radius, material, trackGeometry);
  group.add(createCylinderMesh({
    name: 'cleanout raised marker',
    radiusTop: radius * 1.4,
    height: 0.04,
    position: [0.08, radius * 1.6, 0],
    material,
    trackGeometry,
  }));
}

function addPTrap(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  addLocalPipe({ group, name: 'p-trap inlet', start: [-0.2, 0, 0], end: [-0.06, 0, 0], radius, material, trackGeometry });
  addLocalPipe({ group, name: 'p-trap drop', start: [-0.06, 0, 0], end: [-0.06, -0.16, 0], radius, material, trackGeometry });
  addLocalPipe({ group, name: 'p-trap return', start: [-0.06, -0.16, 0], end: [0.12, -0.16, 0], radius, material, trackGeometry });
  addLocalPipe({ group, name: 'p-trap outlet', start: [0.12, -0.16, 0], end: [0.22, 0, 0], radius, material, trackGeometry });
}

function addClosetFlange(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  const geometry = trackGeometry?.(new THREE.TorusGeometry(radius * 2.1, Math.max(0.012, radius * 0.28), 8, 24)) ??
    new THREE.TorusGeometry(radius * 2.1, Math.max(0.012, radius * 0.28), 8, 24);
  const ring = new THREE.Mesh(geometry, material);
  ring.name = 'closet flange ring';
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
}

function addRoofVentBoot(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  group.add(createCylinderMesh({ name: 'roof vent pipe', radiusTop: radius, height: 0.32, position: [0, 0.16, 0], material, trackGeometry }));
  group.add(createCylinderMesh({
    name: 'roof vent boot cone',
    radiusTop: radius * 0.95,
    radiusBottom: radius * 2.4,
    height: 0.12,
    position: [0, 0.04, 0],
    material,
    trackGeometry,
  }));
  group.add(createCylinderMesh({
    name: 'roof vent flashing disk',
    radiusTop: radius * 3,
    height: 0.014,
    position: [0, -0.025, 0],
    material,
    trackGeometry,
  }));
}

function addValve(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  addLocalPipe({ group, name: 'valve pipe', start: [-0.2, 0, 0], end: [0.2, 0, 0], radius, material, trackGeometry });
  group.add(createBoxMesh({ name: 'valve body', size: [0.13, 0.11, 0.11], position: [0, 0, 0], material, trackGeometry }));
  group.add(createBoxMesh({ name: 'valve handle', size: [0.25, 0.018, 0.04], position: [0, 0.1, 0], material, trackGeometry }));
}

function addSleeve(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  addLocalPipe({ group, name: 'pipe sleeve transparent barrel', start: [-0.23, 0, 0], end: [0.23, 0, 0], radius: radius * 1.6, material, trackGeometry });
}

export function createProceduralPlumbingFittingMesh(params: {
  fitting: PlumbingFitting;
  position: { x: number; y: number; z: number };
  materials: PlumbingThreeMaterials;
  selected?: boolean;
  trackGeometry?: TrackGeometry;
}): { group: THREE.Group; validationIssues: Plumbing3DValidationIssue[] } {
  const group = new THREE.Group();
  group.name = `plumbing_fitting:${params.fitting.id}`;
  group.position.set(params.position.x, params.position.y, params.position.z);
  applyPlanRotation(group, params.fitting.rotationRad);
  group.userData.fittingType = params.fitting.type;

  const validationIssues: Plumbing3DValidationIssue[] = [];
  const radius = diameterInchesToVisualRadiusMeters(params.fitting.diameterInches);
  const supported = SUPPORTED_PROCEDURAL_PLUMBING_FITTING_TYPES.has(params.fitting.type);
  const material = params.selected
    ? params.materials.selected
    : supported
      ? params.fitting.type.includes('sleeve')
        ? params.materials.sleeve
        : params.materials.fitting
      : params.materials.warning;

  if (!supported) {
    validationIssues.push({
      code: 'fitting_type_missing_procedural_renderer',
      severity: 'warning',
      objectType: 'plumbing_fitting',
      objectId: params.fitting.id,
      message: `${params.fitting.type.replace(/_/g, ' ')} does not have a procedural 3D renderer.`,
    });
    group.add(createSphereMesh({ name: 'unsupported fitting marker', radius: radius * 1.5, position: [0, 0, 0], material, trackGeometry: params.trackGeometry }));
  } else if (params.fitting.type.includes('elbow') || params.fitting.type === 'closet_bend' || params.fitting.type === 'stub_out_elbow') {
    addElbow(group, params.fitting.type, radius, material, params.trackGeometry);
    if (params.fitting.type === 'drop_ear_elbow') {
      group.add(createBoxMesh({ name: 'drop ear mounting plate', size: [0.18, 0.02, 0.11], position: [0, -radius * 1.7, 0], material, trackGeometry: params.trackGeometry }));
    }
  } else if (params.fitting.type === 'tee' || params.fitting.type === 'sanitary_tee' || params.fitting.type === 'vent_tee') {
    addTee(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type === 'wye' || params.fitting.type === 'combo_wye_45') {
    addWye(group, radius, material, params.trackGeometry);
    if (params.fitting.type === 'combo_wye_45') {
      addElbow(group, 'elbow_45', radius, material, params.trackGeometry);
    }
  } else if (params.fitting.type === 'coupling' || params.fitting.type === 'repair_coupling') {
    addCoupling(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type === 'reducing_coupling' || params.fitting.type === 'transition_coupling') {
    addReducingCoupling(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type === 'cap' || params.fitting.type === 'plug') {
    addCap(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type.includes('cleanout')) {
    addCleanout(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type === 'p_trap') {
    addPTrap(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type === 'closet_flange') {
    addClosetFlange(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type === 'roof_vent_boot') {
    addRoofVentBoot(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type.includes('valve') || params.fitting.type === 'angle_stop') {
    addValve(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type.includes('sleeve')) {
    addSleeve(group, radius, material, params.trackGeometry);
  }

  markPlumbingObject3D({
    group,
    objectType: 'plumbing_fitting',
    objectId: params.fitting.id,
    selectionPriority: 82,
  });

  return { group, validationIssues };
}
