import * as THREE from 'three';
import type { PlumbingFitting, PlumbingFittingType } from '../plumbingFittingTypes';
import type { PlumbingNode, PlumbingRun } from '../plumbingTypes';
import type { SolvedFittingPort, SolvedPlumbingFitting } from '../domain/plumbingModelSolver';
import type { ResolvedPlumbingRunPath } from './plumbingElevationResolver';
import {
  addLocalPipe,
  applyPlanRotation,
  createBoxMesh,
  createCylinderMesh,
  createSleeveAlongDirection,
  diameterInchesToVisualRadiusMeters,
  getBranchDirection,
  getConnectedRunDirections,
  getPrimaryRunDirection,
  markPlumbingObject3D,
  type Plumbing3DValidationIssue,
  type PlumbingFittingDirection,
  type TrackGeometry,
} from './plumbingThreeUtils';
import {
  materialForPlumbingFittingSystem,
  type PlumbingThreeMaterials,
} from './plumbingThreeMaterials';

export const SUPPORTED_PROCEDURAL_PLUMBING_FITTING_TYPES = new Set<PlumbingFittingType>([
  'elbow_90',
  'elbow_90_long_sweep',
  'elbow_45',
  'elbow_22_5',
  'elbow_11_25',
  'street_elbow_90',
  'street_elbow_45',
  'offset_bend',
  'tee',
  'reducing_tee',
  'sanitary_tee',
  'wye',
  'combo_wye_45',
  'coupling',
  'repair_coupling',
  'reducing_coupling',
  'transition_coupling',
  'male_adapter',
  'female_adapter',
  'trap_adapter',
  'cap',
  'plug',
  'cleanout_adapter',
  'cleanout_plug',
  'floor_cleanout',
  'yard_cleanout',
  'p_trap',
  'trap_arm',
  'closet_bend',
  'closet_flange',
  'floor_drain_body',
  'tub_drain',
  'vent_tee',
  'roof_vent_boot',
  'vent_cap',
  'ball_valve',
  'gate_valve',
  'check_valve',
  'stop_valve',
  'angle_stop',
  'drop_ear_elbow',
  'stub_out_elbow',
  'hose_bib_adapter',
  'pipe_sleeve',
  'footing_sleeve',
  'wall_sleeve',
]);

const X_AXIS = new THREE.Vector3(1, 0, 0);

function elbowAngle(type: PlumbingFittingType): number {
  if (type === 'elbow_45' || type === 'street_elbow_45') return Math.PI / 4;
  if (type === 'elbow_22_5') return Math.PI / 8;
  if (type === 'elbow_11_25') return Math.PI / 16;
  return Math.PI / 2;
}

function rotatedPlanDirection(direction: THREE.Vector3, radians: number): THREE.Vector3 {
  const normalized = direction.clone().normalize();
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return new THREE.Vector3(
    normalized.x * cos - normalized.z * sin,
    normalized.y,
    normalized.x * sin + normalized.z * cos,
  ).normalize();
}

function pipeDiameterMeters(diameterInches: number | null | undefined, fallbackRadius: number): number {
  return diameterInches != null && Number.isFinite(diameterInches) && diameterInches > 0
    ? diameterInches * 0.0254
    : fallbackRadius * 2;
}

function fittingLength(diameterInches: number | null | undefined, pipeRadius: number, multiplier = 3.5): number {
  return Math.max(pipeDiameterMeters(diameterInches, pipeRadius) * multiplier, 0.18);
}

function addSleeveBands(params: {
  group: THREE.Group;
  direction: THREE.Vector3;
  length: number;
  radius: number;
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
}): void {
  const direction = params.direction.clone().normalize();
  const bandLength = Math.min(0.035, params.length * 0.16);
  const offset = Math.max(0.02, params.length / 2 - bandLength / 2);
  [-offset, offset].forEach((distance) => {
    createSleeveAlongDirection({
      group: params.group,
      name: 'fitting end band',
      center: direction.clone().multiplyScalar(distance),
      direction,
      length: bandLength,
      radius: params.radius * 1.08,
      material: params.material,
      trackGeometry: params.trackGeometry,
      radialSegments: 14,
    });
  });
}

function addCenterlineSegment(params: {
  group: THREE.Group;
  name: string;
  direction: THREE.Vector3;
  length: number;
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
}): void {
  const direction = params.direction.clone();
  if (direction.lengthSq() <= 0.000001) direction.set(1, 0, 0);
  direction.normalize();
  const half = params.length / 2;
  const geometry = params.trackGeometry?.(
    new THREE.BufferGeometry().setFromPoints([
      direction.clone().multiplyScalar(-half),
      direction.clone().multiplyScalar(half),
    ]),
  ) ?? new THREE.BufferGeometry().setFromPoints([
    direction.clone().multiplyScalar(-half),
    direction.clone().multiplyScalar(half),
  ]);
  const line = new THREE.Line(geometry, params.material);
  line.name = params.name;
  params.group.add(line);
}

function addSelectionRing(params: {
  group: THREE.Group;
  radius: number;
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
}): void {
  const geometry = params.trackGeometry?.(
    new THREE.TorusGeometry(params.radius * 2.25, Math.max(0.006, params.radius * 0.08), 8, 32),
  ) ?? new THREE.TorusGeometry(params.radius * 2.25, Math.max(0.006, params.radius * 0.08), 8, 32);
  const ring = new THREE.Mesh(geometry, params.material);
  ring.name = 'fitting selection ring';
  ring.rotation.x = Math.PI / 2;
  params.group.add(ring);
}

function addCoupling(params: {
  group: THREE.Group;
  direction: THREE.Vector3;
  radius: number;
  length: number;
  material: THREE.Material;
  bandMaterial: THREE.Material;
  trackGeometry?: TrackGeometry;
}): void {
  createSleeveAlongDirection({
    group: params.group,
    name: 'coupling sleeve',
    center: new THREE.Vector3(),
    direction: params.direction,
    length: params.length,
    radius: params.radius,
    material: params.material,
    trackGeometry: params.trackGeometry,
  });
  addSleeveBands({
    group: params.group,
    direction: params.direction,
    length: params.length,
    radius: params.radius,
    material: params.bandMaterial,
    trackGeometry: params.trackGeometry,
  });
}

function addReducingCoupling(params: {
  group: THREE.Group;
  direction: THREE.Vector3;
  radius: number;
  length: number;
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
}): void {
  const geometry = params.trackGeometry?.(
    new THREE.CylinderGeometry(params.radius * 0.72, params.radius * 1.12, params.length, 14),
  ) ?? new THREE.CylinderGeometry(params.radius * 0.72, params.radius * 1.12, params.length, 14);
  const mesh = new THREE.Mesh(geometry, params.material);
  mesh.name = 'reducing coupling taper';
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), params.direction.clone().normalize());
  params.group.add(mesh);
}

function addElbow(params: {
  group: THREE.Group;
  type: PlumbingFittingType;
  incomingDirection: THREE.Vector3;
  outgoingDirection: THREE.Vector3;
  radius: number;
  length: number;
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
}): void {
  const leg = params.type === 'elbow_90_long_sweep' || params.type === 'closet_bend'
    ? Math.max(params.length * 0.78, 0.28)
    : Math.max(params.length * 0.58, 0.18);
  createSleeveAlongDirection({
    group: params.group,
    name: params.type === 'elbow_90_long_sweep' ? 'long sweep elbow inlet sleeve' : 'elbow inlet sleeve',
    center: params.incomingDirection.clone().normalize().multiplyScalar(leg / 2),
    direction: params.incomingDirection,
    length: leg,
    radius: params.radius,
    material: params.material,
    trackGeometry: params.trackGeometry,
  });
  createSleeveAlongDirection({
    group: params.group,
    name: params.type === 'elbow_90_long_sweep' ? 'long sweep elbow outlet sleeve' : 'elbow outlet sleeve',
    center: params.outgoingDirection.clone().normalize().multiplyScalar(leg / 2),
    direction: params.outgoingDirection,
    length: leg,
    radius: params.radius,
    material: params.material,
    trackGeometry: params.trackGeometry,
  });
  params.group.add(createBoxMesh({
    name: params.type === 'elbow_90_long_sweep' ? 'long sweep miter body' : 'elbow miter body',
    size: [params.radius * 2.2, params.radius * 2.2, params.radius * 2.2],
    position: [0, 0, 0],
    material: params.material,
    trackGeometry: params.trackGeometry,
  }));
}

function addDrainSweepFitting(params: {
  group: THREE.Group;
  type: PlumbingFittingType;
  verticalDirection: THREE.Vector3;
  drainDirection: THREE.Vector3;
  radius: number;
  pipeRadius: number;
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
}): void {
  const vertical = params.verticalDirection.clone();
  if (vertical.lengthSq() <= 0.000001) vertical.set(0, 1, 0);
  vertical.normalize();
  const drain = params.drainDirection.clone();
  if (drain.lengthSq() <= 0.000001) drain.set(1, 0, 0);
  drain.normalize();
  const sweepRadius = Math.max(params.pipeRadius * 6, 0.3);
  const start = vertical.clone().multiplyScalar(sweepRadius);
  const end = drain.clone().multiplyScalar(sweepRadius);
  const curve = new THREE.CatmullRomCurve3([
    start.clone(),
    start.clone().addScaledVector(vertical.clone().negate(), sweepRadius * 0.52),
    end.clone().addScaledVector(drain.clone().negate(), sweepRadius * 0.52),
    end.clone(),
  ]);
  const geometry = params.trackGeometry?.(
    new THREE.TubeGeometry(curve, 28, params.radius, 16, false),
  ) ?? new THREE.TubeGeometry(curve, 28, params.radius, 16, false);
  const sweep = new THREE.Mesh(geometry, params.material);
  sweep.name = params.type === 'closet_bend' ? 'closet bend sweep body' : 'long sweep drain bend body';
  params.group.add(sweep);
  createSleeveAlongDirection({
    group: params.group,
    name: params.type === 'closet_bend' ? 'closet bend riser socket' : 'long sweep riser socket',
    center: start.clone().addScaledVector(vertical, -Math.max(0.08, sweepRadius * 0.16)),
    direction: vertical,
    length: Math.max(0.16, sweepRadius * 0.32),
    radius: params.radius * 1.02,
    material: params.material,
    trackGeometry: params.trackGeometry,
    radialSegments: 16,
  });
  createSleeveAlongDirection({
    group: params.group,
    name: params.type === 'closet_bend' ? 'closet bend drain socket' : 'long sweep drain socket',
    center: end.clone().addScaledVector(drain, -Math.max(0.08, sweepRadius * 0.16)),
    direction: drain,
    length: Math.max(0.16, sweepRadius * 0.32),
    radius: params.radius * 1.02,
    material: params.material,
    trackGeometry: params.trackGeometry,
    radialSegments: 16,
  });
}

function addTee(params: {
  group: THREE.Group;
  mainDirection: THREE.Vector3;
  branchDirection: THREE.Vector3;
  radius: number;
  length: number;
  material: THREE.Material;
  bandMaterial: THREE.Material;
  trackGeometry?: TrackGeometry;
}): void {
  createSleeveAlongDirection({
    group: params.group,
    name: 'tee main sleeve',
    center: new THREE.Vector3(),
    direction: params.mainDirection,
    length: params.length,
    radius: params.radius,
    material: params.material,
    trackGeometry: params.trackGeometry,
  });
  createSleeveAlongDirection({
    group: params.group,
    name: 'tee branch sleeve',
    center: params.branchDirection.clone().normalize().multiplyScalar(params.length * 0.31),
    direction: params.branchDirection,
    length: params.length * 0.62,
    radius: params.radius,
    material: params.material,
    trackGeometry: params.trackGeometry,
  });
  addSleeveBands({
    group: params.group,
    direction: params.mainDirection,
    length: params.length,
    radius: params.radius,
    material: params.bandMaterial,
    trackGeometry: params.trackGeometry,
  });
}

function addWye(params: {
  group: THREE.Group;
  mainDirection: THREE.Vector3;
  branchDirection: THREE.Vector3;
  radius: number;
  branchRadius?: number;
  length: number;
  material: THREE.Material;
  bandMaterial: THREE.Material;
  trackGeometry?: TrackGeometry;
}): void {
  createSleeveAlongDirection({
    group: params.group,
    name: 'wye main sleeve',
    center: new THREE.Vector3(),
    direction: params.mainDirection,
    length: params.length,
    radius: params.radius,
    material: params.material,
    trackGeometry: params.trackGeometry,
  });
  createSleeveAlongDirection({
    group: params.group,
    name: 'wye angled branch sleeve',
    center: params.branchDirection.clone().normalize().multiplyScalar(params.length * 0.37),
    direction: params.branchDirection,
    length: params.length * 0.74,
    radius: params.branchRadius ?? params.radius,
    material: params.material,
    trackGeometry: params.trackGeometry,
  });
  addSleeveBands({
    group: params.group,
    direction: params.mainDirection,
    length: params.length,
    radius: params.radius,
    material: params.bandMaterial,
    trackGeometry: params.trackGeometry,
  });
}

function addCap(params: {
  group: THREE.Group;
  direction: THREE.Vector3;
  radius: number;
  length: number;
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
}): void {
  const capLength = Math.max(0.08, params.length * 0.42);
  const direction = params.direction.clone().normalize();
  createSleeveAlongDirection({
    group: params.group,
    name: 'cap body sleeve',
    center: direction.clone().multiplyScalar(-capLength / 4),
    direction,
    length: capLength,
    radius: params.radius,
    material: params.material,
    trackGeometry: params.trackGeometry,
  });
  const disk = createCylinderMesh({
    name: 'cap end disk',
    radiusTop: params.radius * 1.04,
    height: 0.028,
    position: [0, 0, 0],
    material: params.material,
    trackGeometry: params.trackGeometry,
  });
  disk.position.copy(direction.clone().multiplyScalar(capLength / 2));
  disk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  params.group.add(disk);
}

function addCleanout(params: {
  group: THREE.Group;
  direction: THREE.Vector3;
  radius: number;
  length: number;
  material: THREE.Material;
  trackGeometry?: TrackGeometry;
}): void {
  addCap(params);
  const cap = createCylinderMesh({
    name: 'cleanout raised cap',
    radiusTop: params.radius * 1.18,
    height: 0.05,
    position: [0, 0, 0],
    material: params.material,
    trackGeometry: params.trackGeometry,
  });
  cap.position.copy(params.direction.clone().normalize().multiplyScalar(params.length * 0.36))
    .add(new THREE.Vector3(0, params.radius * 1.5, 0));
  params.group.add(cap);
}

function addPTrap(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  addLocalPipe({ group, name: 'p-trap inlet sleeve', start: [-0.2, 0, 0], end: [-0.06, 0, 0], radius, material, trackGeometry });
  addLocalPipe({ group, name: 'p-trap drop sleeve', start: [-0.06, 0, 0], end: [-0.06, -0.16, 0], radius, material, trackGeometry });
  addLocalPipe({ group, name: 'p-trap return sleeve', start: [-0.06, -0.16, 0], end: [0.12, -0.16, 0], radius, material, trackGeometry });
  addLocalPipe({ group, name: 'p-trap outlet sleeve', start: [0.12, -0.16, 0], end: [0.22, 0, 0], radius, material, trackGeometry });
}

function addClosetFlange(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  const geometry = trackGeometry?.(new THREE.TorusGeometry(radius * 2.1, Math.max(0.012, radius * 0.28), 8, 24)) ??
    new THREE.TorusGeometry(radius * 2.1, Math.max(0.012, radius * 0.28), 8, 24);
  const ring = new THREE.Mesh(geometry, material);
  ring.name = 'closet flange ring';
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  group.add(createCylinderMesh({
    name: 'closet flange throat',
    radiusTop: radius,
    height: 0.08,
    position: [0, -0.04, 0],
    material,
    trackGeometry,
  }));
}

function addFloorDrainBody(group: THREE.Group, radius: number, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  group.add(createCylinderMesh({
    name: 'floor drain body',
    radiusTop: radius * 1.4,
    radiusBottom: radius,
    height: 0.08,
    position: [0, 0, 0],
    material,
    trackGeometry,
  }));
  const grate = createBoxMesh({
    name: 'floor drain grate',
    size: [radius * 3.2, 0.012, radius * 3.2],
    position: [0, 0.048, 0],
    material,
    trackGeometry,
  });
  group.add(grate);
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
  addLocalPipe({ group, name: 'valve pipe sleeve', start: [-0.2, 0, 0], end: [0.2, 0, 0], radius, material, trackGeometry });
  group.add(createBoxMesh({ name: 'valve body', size: [0.13, 0.11, 0.11], position: [0, 0, 0], material, trackGeometry }));
  group.add(createBoxMesh({ name: 'valve handle', size: [0.25, 0.018, 0.04], position: [0, 0.1, 0], material, trackGeometry }));
}

function addSleeve(group: THREE.Group, radius: number, length: number, direction: THREE.Vector3, material: THREE.Material, trackGeometry?: TrackGeometry): void {
  createSleeveAlongDirection({
    group,
    name: 'pipe sleeve transparent barrel',
    center: new THREE.Vector3(),
    direction,
    length: Math.max(0.28, length),
    radius: radius * 1.25,
    material,
    trackGeometry,
  });
}

function fittingDirections(params: {
  fitting: PlumbingFitting;
  runs?: readonly PlumbingRun[];
  nodes?: readonly PlumbingNode[];
  resolvedRunPaths?: readonly ResolvedPlumbingRunPath[];
  solvedDirections?: readonly PlumbingFittingDirection[];
  issues: Plumbing3DValidationIssue[];
}): PlumbingFittingDirection[] {
  if (params.solvedDirections && params.solvedDirections.length > 0) {
    return [...params.solvedDirections];
  }
  if (!params.runs || !params.nodes) return [];
  const directions = getConnectedRunDirections(
    params.fitting,
    params.runs,
    params.nodes,
    params.resolvedRunPaths,
  );
  if (params.fitting.connectedRunIds.length > 0 && directions.length === 0) {
    params.issues.push({
      code: 'fitting_direction_unresolved',
      severity: 'warning',
      objectType: 'plumbing_fitting',
      objectId: params.fitting.id,
      message: 'Fitting direction could not be resolved from connected runs.',
    });
  }
  return directions;
}

function vectorFromSolvedPort(port: SolvedFittingPort | undefined): THREE.Vector3 | null {
  if (!port) return null;
  const direction = new THREE.Vector3(port.direction.x, port.direction.y, port.direction.z);
  if (direction.lengthSq() <= 0.000001) return null;
  return direction.normalize();
}

function solvedWyeDirections(solvedPorts: readonly SolvedFittingPort[] | undefined): {
  mainDirection: THREE.Vector3 | null;
  branchDirection: THREE.Vector3 | null;
} {
  if (!solvedPorts || solvedPorts.length === 0) {
    return { mainDirection: null, branchDirection: null };
  }
  const runOut = vectorFromSolvedPort(solvedPorts.find((port) => port.id === 'run_out'));
  const runIn = vectorFromSolvedPort(solvedPorts.find((port) => port.id === 'run_in'));
  const branch = vectorFromSolvedPort(solvedPorts.find((port) => port.id === 'branch'));
  return {
    mainDirection: runOut ?? runIn,
    branchDirection: branch,
  };
}

export function createProceduralPlumbingFittingMesh(params: {
  fitting: PlumbingFitting;
  position: { x: number; y: number; z: number };
  materials: PlumbingThreeMaterials;
  selected?: boolean;
  trackGeometry?: TrackGeometry;
  runs?: readonly PlumbingRun[];
  nodes?: readonly PlumbingNode[];
  resolvedRunPaths?: readonly ResolvedPlumbingRunPath[];
  solvedDirections?: readonly PlumbingFittingDirection[];
  solvedPorts?: readonly SolvedFittingPort[];
  showCenterline?: boolean;
}): { group: THREE.Group; validationIssues: Plumbing3DValidationIssue[] } {
  const group = new THREE.Group();
  group.name = `plumbing_fitting:${params.fitting.id}`;
  group.position.set(params.position.x, params.position.y, params.position.z);
  group.userData.fittingType = params.fitting.type;

  const validationIssues: Plumbing3DValidationIssue[] = [];
  const directions = fittingDirections({
    fitting: params.fitting,
    runs: params.runs,
    nodes: params.nodes,
    resolvedRunPaths: params.resolvedRunPaths,
    solvedDirections: params.solvedDirections,
    issues: validationIssues,
  });
  if (directions.length === 0) applyPlanRotation(group, params.fitting.rotationRad);

  const pipeRadius = diameterInchesToVisualRadiusMeters(params.fitting.diameterInches);
  const radius = pipeRadius * 1.25;
  const branchRadius = params.fitting.secondaryDiameterInches != null && params.fitting.secondaryDiameterInches !== params.fitting.diameterInches
    ? diameterInchesToVisualRadiusMeters(params.fitting.secondaryDiameterInches) * 1.25
    : radius;
  const length = fittingLength(params.fitting.diameterInches, pipeRadius);
  const supported = SUPPORTED_PROCEDURAL_PLUMBING_FITTING_TYPES.has(params.fitting.type);
  const explicitWyeDirections = params.fitting.type === 'wye' || params.fitting.type === 'combo_wye_45'
    ? solvedWyeDirections(params.solvedPorts)
    : { mainDirection: null, branchDirection: null };
  const baseDirection = explicitWyeDirections.mainDirection ?? getPrimaryRunDirection(directions);
  const branchDirection = explicitWyeDirections.branchDirection ?? getBranchDirection(directions, baseDirection);
  const material = params.selected
    ? params.materials.selected
    : supported
      ? params.fitting.type.includes('sleeve')
        ? params.materials.sleeve
        : materialForPlumbingFittingSystem(params.fitting.system, params.materials)
      : params.materials.warning;
  const bandMaterial = params.selected ? params.materials.selected : params.materials.fittingBand;

  if (params.showCenterline) {
    const centerlineDirections = directions.length > 0
      ? directions.map((item) => item.direction)
      : [baseDirection];
    centerlineDirections.forEach((direction, index) => {
      addCenterlineSegment({
        group,
        name: index === 0 ? 'fitting centerline' : `fitting branch centerline ${index}`,
        direction,
        length: length * 1.08,
        material: params.materials.centerline,
        trackGeometry: params.trackGeometry,
      });
    });
  }

  if (!supported) {
    validationIssues.push({
      code: 'fitting_type_missing_procedural_renderer',
      severity: 'warning',
      objectType: 'plumbing_fitting',
      objectId: params.fitting.id,
      message: `${params.fitting.type.replace(/_/g, ' ')} does not have a procedural 3D renderer.`,
    });
    addSleeve(group, radius, length, baseDirection, material, params.trackGeometry);
  } else if (params.fitting.type === 'closet_bend') {
    const verticalDirection = directions.find((item) => Math.abs(item.direction.y) > 0.7)?.direction
      ?? new THREE.Vector3(0, 1, 0);
    const drainDirection = directions.find((item) => Math.abs(item.direction.y) <= 0.7)?.direction
      ?? baseDirection;
    addDrainSweepFitting({
      group,
      type: params.fitting.type,
      verticalDirection,
      drainDirection,
      radius,
      pipeRadius,
      material,
      trackGeometry: params.trackGeometry,
    });
  } else if (
    params.fitting.type.includes('elbow') ||
    params.fitting.type === 'stub_out_elbow' ||
    params.fitting.type === 'drop_ear_elbow' ||
    params.fitting.type === 'offset_bend'
  ) {
    const incomingDirection = directions[0]?.direction.clone().normalize() ?? baseDirection;
    const outgoingDirection =
      directions[1]?.direction.clone().normalize() ??
      rotatedPlanDirection(incomingDirection, elbowAngle(params.fitting.type));
    addElbow({
      group,
      type: params.fitting.type,
      incomingDirection,
      outgoingDirection,
      radius,
      length,
      material,
      trackGeometry: params.trackGeometry,
    });
    if (params.fitting.type === 'drop_ear_elbow') {
      group.add(createBoxMesh({
        name: 'drop ear mounting plate',
        size: [0.18, 0.02, 0.11],
        position: [0, -radius * 1.7, 0],
        material,
        trackGeometry: params.trackGeometry,
      }));
    }
  } else if (
    params.fitting.type === 'tee' ||
    params.fitting.type === 'reducing_tee' ||
    params.fitting.type === 'sanitary_tee' ||
    params.fitting.type === 'vent_tee'
  ) {
    addTee({ group, mainDirection: baseDirection, branchDirection, radius, length, material, bandMaterial, trackGeometry: params.trackGeometry });
  } else if (params.fitting.type === 'wye' || params.fitting.type === 'combo_wye_45') {
    const wyeBranch = directions.length > 0 ? branchDirection : rotatedPlanDirection(baseDirection, Math.PI / 4);
    addWye({
      group,
      mainDirection: baseDirection,
      branchDirection: wyeBranch,
      radius,
      branchRadius,
      length,
      material,
      bandMaterial,
      trackGeometry: params.trackGeometry,
    });
    if (params.fitting.type === 'combo_wye_45') {
      addElbow({
        group,
        type: 'elbow_45',
        incomingDirection: wyeBranch,
        outgoingDirection: rotatedPlanDirection(wyeBranch, Math.PI / 4),
        radius,
        length: length * 0.72,
        material,
        trackGeometry: params.trackGeometry,
      });
    }
  } else if (
    params.fitting.type === 'coupling' ||
    params.fitting.type === 'repair_coupling' ||
    params.fitting.type === 'male_adapter' ||
    params.fitting.type === 'female_adapter' ||
    params.fitting.type === 'trap_adapter' ||
    params.fitting.type === 'hose_bib_adapter' ||
    params.fitting.type === 'trap_arm'
  ) {
    addCoupling({ group, direction: baseDirection, radius, length, material, bandMaterial, trackGeometry: params.trackGeometry });
  } else if (params.fitting.type === 'reducing_coupling' || params.fitting.type === 'transition_coupling') {
    addReducingCoupling({ group, direction: baseDirection, radius, length, material, trackGeometry: params.trackGeometry });
  } else if (params.fitting.type === 'cap' || params.fitting.type === 'plug' || params.fitting.type === 'vent_cap') {
    addCap({ group, direction: baseDirection, radius, length, material, trackGeometry: params.trackGeometry });
  } else if (params.fitting.type.includes('cleanout')) {
    addCleanout({ group, direction: baseDirection, radius, length, material, trackGeometry: params.trackGeometry });
  } else if (params.fitting.type === 'p_trap') {
    addPTrap(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type === 'closet_flange') {
    addClosetFlange(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type === 'floor_drain_body' || params.fitting.type === 'tub_drain') {
    addFloorDrainBody(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type === 'roof_vent_boot') {
    addRoofVentBoot(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type.includes('valve') || params.fitting.type === 'angle_stop') {
    addValve(group, radius, material, params.trackGeometry);
  } else if (params.fitting.type.includes('sleeve')) {
    addSleeve(group, radius, length, baseDirection, material, params.trackGeometry);
  }

  if (params.selected) {
    addSelectionRing({
      group,
      radius,
      material: params.materials.selected,
      trackGeometry: params.trackGeometry,
    });
  }

  markPlumbingObject3D({
    group,
    objectType: 'plumbing_fitting',
    objectId: params.fitting.id,
    selectionPriority: 82,
  });

  return { group, validationIssues };
}

export function createProceduralSolvedPlumbingFittingMesh(params: {
  fitting: SolvedPlumbingFitting;
  materials: PlumbingThreeMaterials;
  selected?: boolean;
  trackGeometry?: TrackGeometry;
  showCenterline?: boolean;
}): { group: THREE.Group; validationIssues: Plumbing3DValidationIssue[] } {
  const fitting: PlumbingFitting = {
    id: params.fitting.sourceFittingId ?? params.fitting.id,
    type: params.fitting.type,
    system: params.fitting.system,
    nodeId: params.fitting.id,
    connectedRunIds: params.fitting.connectedPipePieceIds,
    diameterInches: params.fitting.diameterInches,
    secondaryDiameterInches: params.fitting.secondaryDiameterInches,
    material: params.fitting.material,
    schedule: params.fitting.schedule,
    rotationRad: 0,
    elevationMode: 'under_slab',
    labelVisible: true,
    isAutoGenerated: params.fitting.isAutoSolved,
  };
  const solvedDirections: PlumbingFittingDirection[] = params.fitting.ports.map((port, index) => ({
    runId: port.pipePieceId ?? `${params.fitting.id}:port:${index}`,
    direction: new THREE.Vector3(port.direction.x, port.direction.y, port.direction.z),
    center: new THREE.Vector3(port.center.x, port.center.y, port.center.z),
  }));
  const result = createProceduralPlumbingFittingMesh({
    fitting,
    position: params.fitting.position,
    materials: params.materials,
    selected: params.selected,
    trackGeometry: params.trackGeometry,
    solvedDirections,
    solvedPorts: params.fitting.ports,
    showCenterline: params.showCenterline,
  });
  result.group.userData.solvedFittingId = params.fitting.id;
  return result;
}
