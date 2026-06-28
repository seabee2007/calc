import * as THREE from 'three';
import type { PlumbingEquipment, PlumbingEquipmentType } from '../plumbingTypes';
import {
  addLocalPipe,
  applyPlanRotation,
  createBoxMesh,
  createCylinderMesh,
  createSphereMesh,
  markPlumbingObject3D,
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
  'building_drain_exit',
]);

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
