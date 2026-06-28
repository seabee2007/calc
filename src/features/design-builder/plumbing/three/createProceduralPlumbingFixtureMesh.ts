import * as THREE from 'three';
import type { PlumbingFixture, PlumbingFixtureType } from '../plumbingTypes';
import {
  addLocalPipe,
  applyPlanRotation,
  createBoxMesh,
  createCylinderMesh,
  createSphereMesh,
  markPlumbingObject3D,
  placeObjectBaseAtY,
  type Plumbing3DValidationIssue,
  type TrackGeometry,
} from './plumbingThreeUtils';
import type { PlumbingThreeMaterials } from './plumbingThreeMaterials';

export const SUPPORTED_PROCEDURAL_PLUMBING_FIXTURE_TYPES = new Set<PlumbingFixtureType>([
  'toilet',
  'lavatory',
  'shower',
  'tub',
  'kitchen_sink',
  'laundry_box',
  'floor_drain',
  'hose_bib',
  'utility_sink',
  'water_heater',
]);

const FLOOR_MOUNTED_PROCEDURAL_PLUMBING_FIXTURE_TYPES = new Set<PlumbingFixtureType>([
  'toilet',
  'lavatory',
  'shower',
  'tub',
  'floor_drain',
  'utility_sink',
  'water_heater',
]);

export function isFloorMountedPlumbingFixtureType(type: PlumbingFixtureType): boolean {
  return FLOOR_MOUNTED_PROCEDURAL_PLUMBING_FIXTURE_TYPES.has(type);
}

function material(params: { selected?: boolean; materials: PlumbingThreeMaterials }, accent = false): THREE.Material {
  if (params.selected) return params.materials.selected;
  return accent ? params.materials.fixtureAccent : params.materials.fixture;
}

function addToilet(group: THREE.Group, materials: PlumbingThreeMaterials, selected: boolean | undefined, trackGeometry?: TrackGeometry): void {
  group.add(createBoxMesh({ name: 'WC base block', size: [0.34, 0.12, 0.42], position: [0, 0.06, 0.06], material: material({ selected, materials }), trackGeometry }));
  const bowl = createCylinderMesh({ name: 'WC bowl', radiusTop: 0.18, radiusBottom: 0.15, height: 0.18, position: [0, 0.22, 0.06], material: material({ selected, materials }), trackGeometry, radialSegments: 18 });
  bowl.scale.z = 1.28;
  group.add(bowl);
  group.add(createBoxMesh({ name: 'WC rear tank', size: [0.42, 0.28, 0.14], position: [0, 0.34, -0.25], material: material({ selected, materials }), trackGeometry }));
  group.add(createCylinderMesh({ name: 'WC sanitary outlet marker', radiusTop: 0.055, height: 0.025, position: [0, 0.018, 0.24], material: material({ selected, materials }, true), trackGeometry }));
}

function addLavatory(group: THREE.Group, materials: PlumbingThreeMaterials, selected: boolean | undefined, trackGeometry?: TrackGeometry): void {
  group.add(createBoxMesh({ name: 'lavatory counter', size: [0.58, 0.08, 0.46], position: [0, 0.82, 0], material: material({ selected, materials }), trackGeometry }));
  const basin = createCylinderMesh({ name: 'lavatory basin depression', radiusTop: 0.16, radiusBottom: 0.13, height: 0.035, position: [0, 0.87, 0.03], material: material({ selected, materials }, true), trackGeometry, radialSegments: 18 });
  basin.scale.z = 0.75;
  group.add(basin);
  group.add(createBoxMesh({ name: 'lavatory vanity box', size: [0.5, 0.72, 0.38], position: [0, 0.38, 0], material: material({ selected, materials }), trackGeometry }));
  group.add(createSphereMesh({ name: 'lavatory faucet marker', radius: 0.035, position: [0, 0.92, -0.12], material: material({ selected, materials }, true), trackGeometry }));
}

function addShower(group: THREE.Group, materials: PlumbingThreeMaterials, selected: boolean | undefined, trackGeometry?: TrackGeometry): void {
  group.add(createBoxMesh({ name: 'shower pan', size: [0.9, 0.06, 0.9], position: [0, 0.03, 0], material: material({ selected, materials }), trackGeometry }));
  group.add(createCylinderMesh({ name: 'shower drain disk', radiusTop: 0.055, height: 0.012, position: [0, 0.07, 0], material: material({ selected, materials }, true), trackGeometry }));
  addLocalPipe({ group, name: 'shower riser marker', start: [0.34, 0.2, -0.38], end: [0.34, 1.9, -0.38], radius: 0.014, material: material({ selected, materials }, true), trackGeometry });
  group.add(createSphereMesh({ name: 'shower head marker', radius: 0.035, position: [0.34, 1.88, -0.35], material: material({ selected, materials }, true), trackGeometry }));
}

function addTub(group: THREE.Group, materials: PlumbingThreeMaterials, selected: boolean | undefined, trackGeometry?: TrackGeometry): void {
  group.add(createBoxMesh({ name: 'tub shell', size: [0.78, 0.36, 1.54], position: [0, 0.18, 0], material: material({ selected, materials }), trackGeometry }));
  group.add(createBoxMesh({ name: 'tub inner basin', size: [0.62, 0.05, 1.22], position: [0, 0.38, 0.08], material: material({ selected, materials }, true), trackGeometry }));
  group.add(createCylinderMesh({ name: 'tub drain disk', radiusTop: 0.05, height: 0.012, position: [0, 0.405, 0.55], material: material({ selected, materials }, true), trackGeometry }));
  group.add(createSphereMesh({ name: 'tub faucet marker', radius: 0.04, position: [0, 0.48, -0.6], material: material({ selected, materials }, true), trackGeometry }));
}

function addKitchenSink(group: THREE.Group, materials: PlumbingThreeMaterials, selected: boolean | undefined, trackGeometry?: TrackGeometry): void {
  group.add(createBoxMesh({ name: 'kitchen sink counter', size: [0.92, 0.08, 0.58], position: [0, 0.9, 0], material: material({ selected, materials }), trackGeometry }));
  group.add(createBoxMesh({ name: 'kitchen sink left basin', size: [0.31, 0.05, 0.36], position: [-0.17, 0.94, 0.03], material: material({ selected, materials }, true), trackGeometry }));
  group.add(createBoxMesh({ name: 'kitchen sink right basin', size: [0.31, 0.05, 0.36], position: [0.17, 0.94, 0.03], material: material({ selected, materials }, true), trackGeometry }));
  group.add(createSphereMesh({ name: 'kitchen sink faucet marker', radius: 0.035, position: [0, 0.99, -0.18], material: material({ selected, materials }, true), trackGeometry }));
}

function addLaundryBox(group: THREE.Group, materials: PlumbingThreeMaterials, selected: boolean | undefined, trackGeometry?: TrackGeometry): void {
  group.add(createBoxMesh({ name: 'laundry recessed box', size: [0.46, 0.32, 0.08], position: [0, 1.15, -0.02], material: material({ selected, materials }), trackGeometry }));
  group.add(createSphereMesh({ name: 'laundry cold connection dot', radius: 0.025, position: [-0.11, 1.16, 0.04], material: materials.coldWater, trackGeometry }));
  group.add(createSphereMesh({ name: 'laundry hot connection dot', radius: 0.025, position: [0.11, 1.16, 0.04], material: materials.hotWater, trackGeometry }));
  addLocalPipe({ group, name: 'laundry drain standpipe stub', start: [0, 0.25, 0.04], end: [0, 1.0, 0.04], radius: 0.025, material: material({ selected, materials }, true), trackGeometry });
}

function addFloorDrain(group: THREE.Group, materials: PlumbingThreeMaterials, selected: boolean | undefined, trackGeometry?: TrackGeometry): void {
  group.add(createCylinderMesh({ name: 'floor drain disk', radiusTop: 0.11, height: 0.014, position: [0, 0.012, 0], material: material({ selected, materials }, true), trackGeometry, radialSegments: 24 }));
  group.add(createBoxMesh({ name: 'floor drain grate line horizontal', size: [0.18, 0.006, 0.012], position: [0, 0.023, 0], material: material({ selected, materials }), trackGeometry }));
  group.add(createBoxMesh({ name: 'floor drain grate line vertical', size: [0.012, 0.006, 0.18], position: [0, 0.024, 0], material: material({ selected, materials }), trackGeometry }));
}

function addHoseBib(group: THREE.Group, materials: PlumbingThreeMaterials, selected: boolean | undefined, trackGeometry?: TrackGeometry): void {
  addLocalPipe({ group, name: 'hose bib wall stub', start: [-0.13, 0.55, 0], end: [0.08, 0.55, 0], radius: 0.018, material: materials.coldWater, trackGeometry });
  group.add(createBoxMesh({ name: 'hose bib valve handle', size: [0.11, 0.018, 0.035], position: [0.08, 0.6, 0], material: material({ selected, materials }, true), trackGeometry }));
}

function addUtilitySink(group: THREE.Group, materials: PlumbingThreeMaterials, selected: boolean | undefined, trackGeometry?: TrackGeometry): void {
  group.add(createBoxMesh({ name: 'utility sink deep basin', size: [0.66, 0.32, 0.56], position: [0, 0.68, 0], material: material({ selected, materials }), trackGeometry }));
  group.add(createBoxMesh({ name: 'utility sink support box', size: [0.54, 0.55, 0.44], position: [0, 0.32, 0], material: material({ selected, materials }, true), trackGeometry }));
  group.add(createSphereMesh({ name: 'utility sink faucet marker', radius: 0.035, position: [0, 0.88, -0.2], material: material({ selected, materials }, true), trackGeometry }));
}

function addWaterHeater(group: THREE.Group, materials: PlumbingThreeMaterials, selected: boolean | undefined, trackGeometry?: TrackGeometry): void {
  group.add(createCylinderMesh({ name: 'water heater cylinder body', radiusTop: 0.28, height: 1.18, position: [0, 0.59, 0], material: material({ selected, materials }), trackGeometry, radialSegments: 24 }));
  group.add(createCylinderMesh({ name: 'water heater top cap', radiusTop: 0.28, height: 0.035, position: [0, 1.19, 0], material: material({ selected, materials }, true), trackGeometry, radialSegments: 24 }));
  group.add(createCylinderMesh({ name: 'water heater bottom cap', radiusTop: 0.28, height: 0.035, position: [0, 0.02, 0], material: material({ selected, materials }, true), trackGeometry, radialSegments: 24 }));
  group.add(createSphereMesh({ name: 'water heater cold inlet marker', radius: 0.03, position: [-0.12, 1.24, -0.05], material: materials.coldWater, trackGeometry }));
  group.add(createSphereMesh({ name: 'water heater hot outlet marker', radius: 0.03, position: [0.12, 1.24, -0.05], material: materials.hotWater, trackGeometry }));
  group.add(createSphereMesh({ name: 'water heater drain valve marker', radius: 0.025, position: [0.24, 0.18, 0], material: material({ selected, materials }, true), trackGeometry }));
}

export function createProceduralPlumbingFixtureMesh(params: {
  fixture: PlumbingFixture;
  position: { x: number; y: number; z: number };
  finishedFloorY?: number;
  baseClearanceM?: number;
  materials: PlumbingThreeMaterials;
  selected?: boolean;
  trackGeometry?: TrackGeometry;
}): { group: THREE.Group; validationIssues: Plumbing3DValidationIssue[] } {
  const group = new THREE.Group();
  group.name = `plumbing_fixture:${params.fixture.id}`;
  group.position.set(params.position.x, params.position.y, params.position.z);
  applyPlanRotation(group, params.fixture.rotationRadians);
  group.userData.fixtureType = params.fixture.fixtureType;
  const validationIssues: Plumbing3DValidationIssue[] = [];

  if (!SUPPORTED_PROCEDURAL_PLUMBING_FIXTURE_TYPES.has(params.fixture.fixtureType)) {
    validationIssues.push({
      code: 'fixture_missing_procedural_renderer',
      severity: 'warning',
      objectType: 'plumbing_fixture',
      objectId: params.fixture.id,
      message: `${params.fixture.fixtureType.replace(/_/g, ' ')} does not have a procedural 3D renderer.`,
    });
    group.add(createSphereMesh({ name: 'unsupported fixture marker', radius: 0.12, position: [0, 0.12, 0], material: params.materials.warning, trackGeometry: params.trackGeometry }));
  } else if (params.fixture.fixtureType === 'toilet') {
    addToilet(group, params.materials, params.selected, params.trackGeometry);
  } else if (params.fixture.fixtureType === 'lavatory') {
    addLavatory(group, params.materials, params.selected, params.trackGeometry);
  } else if (params.fixture.fixtureType === 'shower') {
    addShower(group, params.materials, params.selected, params.trackGeometry);
  } else if (params.fixture.fixtureType === 'tub') {
    addTub(group, params.materials, params.selected, params.trackGeometry);
  } else if (params.fixture.fixtureType === 'kitchen_sink') {
    addKitchenSink(group, params.materials, params.selected, params.trackGeometry);
  } else if (params.fixture.fixtureType === 'laundry_box') {
    addLaundryBox(group, params.materials, params.selected, params.trackGeometry);
  } else if (params.fixture.fixtureType === 'floor_drain') {
    addFloorDrain(group, params.materials, params.selected, params.trackGeometry);
  } else if (params.fixture.fixtureType === 'hose_bib') {
    addHoseBib(group, params.materials, params.selected, params.trackGeometry);
  } else if (params.fixture.fixtureType === 'utility_sink') {
    addUtilitySink(group, params.materials, params.selected, params.trackGeometry);
  } else if (params.fixture.fixtureType === 'water_heater') {
    addWaterHeater(group, params.materials, params.selected, params.trackGeometry);
  }

  if (isFloorMountedPlumbingFixtureType(params.fixture.fixtureType)) {
    const alignment = placeObjectBaseAtY(
      group,
      Number.isFinite(params.finishedFloorY) ? params.finishedFloorY! : params.position.y,
      params.baseClearanceM ?? 0.01,
    );
    if (alignment) {
      group.userData.fixtureBaseAlignment = alignment;
    }
  }

  markPlumbingObject3D({
    group,
    objectType: 'plumbing_fixture',
    objectId: params.fixture.id,
    selectionPriority: 86,
  });

  return { group, validationIssues };
}
