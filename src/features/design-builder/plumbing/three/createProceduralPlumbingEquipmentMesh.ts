import * as THREE from 'three';
import type { PlumbingEquipment, PlumbingEquipmentType } from '../plumbingTypes';
import {
  addLocalPipe,
  applyPlanRotation,
  createBoxMesh,
  createCylinderMesh,
  createSphereMesh,
  diameterInchesToVisualRadiusMeters,
  markPlumbingObject3D,
  type ConnectorPort,
  type Plumbing3DPlacementMode,
  type TrackGeometry,
} from './plumbingThreeUtils';
import type { PlumbingElevationDefaults } from './plumbingElevationResolver';
import type { PlumbingThreeMaterials } from './plumbingThreeMaterials';

export const SUPPORTED_PROCEDURAL_PLUMBING_EQUIPMENT_TYPES = new Set<PlumbingEquipmentType>([
  'cleanout',
  'shutoff_valve',
  'waste_stack',
  'vent_stack',
  'combined_stack',
  'roof_vent_termination',
  'meter',
  'main_service_point',
  'distribution_box',
  'building_drain_exit',
]);

const BURIED_PORT_ALIGNED_EQUIPMENT_TYPES = new Set<PlumbingEquipmentType>([
  'distribution_box',
]);

export function plumbingEquipment3DPlacementMode(type: PlumbingEquipmentType): Plumbing3DPlacementMode {
  if (BURIED_PORT_ALIGNED_EQUIPMENT_TYPES.has(type)) return 'buried-port-aligned';
  if (type === 'roof_vent_termination') return 'ceiling-mounted';
  if (type === 'shutoff_valve' || type === 'meter' || type === 'main_service_point') return 'wall-mounted';
  if (type === 'cleanout' || type === 'building_drain_exit') return 'pipe-centerline-aligned';
  return 'pipe-centerline-aligned';
}

export function createProceduralPlumbingEquipmentMesh(params: {
  equipment: PlumbingEquipment;
  position: { x: number; y: number; z: number };
  elevationDefaults: PlumbingElevationDefaults;
  materials: PlumbingThreeMaterials;
  selected?: boolean;
  trackGeometry?: TrackGeometry;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = `plumbing_equipment:${params.equipment.id}`;
  group.position.set(params.position.x, params.position.y, params.position.z);
  applyPlanRotation(group, params.equipment.rotationRadians);
  group.userData.equipmentType = params.equipment.equipmentType;
  group.userData.placementMode = plumbingEquipment3DPlacementMode(params.equipment.equipmentType);
  const material = params.selected ? params.materials.selected : params.materials.equipment;

  if (params.equipment.equipmentType === 'cleanout') {
    group.add(createCylinderMesh({ name: 'equipment cleanout disk', radiusTop: 0.12, height: 0.025, position: [0, 0.02, 0], material, trackGeometry: params.trackGeometry }));
    group.add(createBoxMesh({ name: 'equipment cleanout square marker', size: [0.16, 0.018, 0.16], position: [0, 0.055, 0], material, trackGeometry: params.trackGeometry }));
  } else if (params.equipment.equipmentType === 'shutoff_valve') {
    addLocalPipe({ group, name: 'equipment valve pipe', start: [-0.18, 0, 0], end: [0.18, 0, 0], radius: 0.022, material: params.materials.coldWater, trackGeometry: params.trackGeometry });
    group.add(createBoxMesh({ name: 'equipment valve body', size: [0.12, 0.1, 0.1], position: [0, 0, 0], material, trackGeometry: params.trackGeometry }));
    group.add(createBoxMesh({ name: 'equipment valve handle', size: [0.22, 0.018, 0.04], position: [0, 0.1, 0], material, trackGeometry: params.trackGeometry }));
  } else if (params.equipment.equipmentType.includes('stack')) {
    const height = params.elevationDefaults.roofElevationM + params.elevationDefaults.ventThroughRoofExtensionM - params.elevationDefaults.slabTopElevationM;
    group.add(createCylinderMesh({ name: 'equipment stack riser', radiusTop: 0.045, height, position: [0, height / 2, 0], material: params.materials.vent, trackGeometry: params.trackGeometry }));
  } else if (params.equipment.equipmentType === 'roof_vent_termination') {
    group.add(createCylinderMesh({ name: 'equipment roof vent termination', radiusTop: 0.04, height: 0.35, position: [0, 0.17, 0], material: params.materials.vent, trackGeometry: params.trackGeometry }));
    group.add(createCylinderMesh({ name: 'equipment roof vent cap', radiusTop: 0.07, height: 0.025, position: [0, 0.36, 0], material, trackGeometry: params.trackGeometry }));
  } else if (params.equipment.equipmentType === 'meter' || params.equipment.equipmentType === 'main_service_point') {
    group.add(createBoxMesh({ name: 'equipment service box', size: [0.22, 0.18, 0.12], position: [0, 0.12, 0], material, trackGeometry: params.trackGeometry }));
    group.add(createSphereMesh({ name: 'equipment service connection marker', radius: 0.04, position: [0, 0.24, 0], material: params.materials.coldWater, trackGeometry: params.trackGeometry }));
  } else if (params.equipment.equipmentType === 'distribution_box') {
    const boxLength = 0.48;
    const boxHeight = 0.28;
    const boxWidth = 0.38;
    const pipeDiameterM = 4 * 0.0254;
    const pipeRadius = diameterInchesToVisualRadiusMeters(4);
    const ports: ConnectorPort[] = [
      {
        id: 'pipe_centerline',
        localPosition: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        diameter: pipeDiameterM,
      },
      {
        id: 'inlet',
        localPosition: new THREE.Vector3(-boxLength / 2, 0, 0),
        direction: new THREE.Vector3(-1, 0, 0),
        diameter: pipeDiameterM,
      },
      {
        id: 'outlet',
        localPosition: new THREE.Vector3(boxLength / 2, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        diameter: pipeDiameterM,
      },
    ];
    group.userData.ports = ports;
    group.add(createBoxMesh({ name: 'equipment distribution box body', size: [boxLength, boxHeight, boxWidth], position: [0, -0.02, 0], material, trackGeometry: params.trackGeometry }));
    group.add(createBoxMesh({ name: 'equipment distribution box lid', size: [0.54, 0.05, 0.44], position: [0, 0.15, 0], material: params.materials.sanitaryFitting, trackGeometry: params.trackGeometry }));
    addLocalPipe({ group, name: 'equipment distribution box inlet', start: [-0.38, 0, 0], end: [-0.18, 0, 0], radius: pipeRadius, material: params.materials.sanitary, trackGeometry: params.trackGeometry });
    addLocalPipe({ group, name: 'equipment distribution box outlet', start: [0.18, 0, 0], end: [0.38, 0, 0], radius: pipeRadius, material: params.materials.sanitary, trackGeometry: params.trackGeometry });
  } else if (params.equipment.equipmentType === 'building_drain_exit') {
    addLocalPipe({ group, name: 'equipment building drain exit pipe', start: [-0.25, 0, 0], end: [0.25, 0, 0], radius: 0.055, material: params.materials.sanitary, trackGeometry: params.trackGeometry });
    group.add(createBoxMesh({ name: 'equipment building drain exit marker', size: [0.16, 0.08, 0.16], position: [0, 0.08, 0], material, trackGeometry: params.trackGeometry }));
  }

  markPlumbingObject3D({
    group,
    objectType: 'plumbing_equipment',
    objectId: params.equipment.id,
    selectionPriority: 84,
  });

  return group;
}
