import * as THREE from 'three';
import type { PlumbingMaterial, PlumbingRunSystem } from '../plumbingTypes';
import type { TrackMaterial } from './plumbingThreeUtils';

export type PlumbingThreeMaterials = {
  coldWater: THREE.MeshStandardMaterial;
  hotWater: THREE.MeshStandardMaterial;
  sanitary: THREE.MeshStandardMaterial;
  vent: THREE.MeshStandardMaterial;
  fixture: THREE.MeshStandardMaterial;
  fixtureAccent: THREE.MeshStandardMaterial;
  equipment: THREE.MeshStandardMaterial;
  fitting: THREE.MeshStandardMaterial;
  sleeve: THREE.MeshStandardMaterial;
  warning: THREE.MeshStandardMaterial;
  selected: THREE.MeshStandardMaterial;
  label: THREE.SpriteMaterial;
};

function standardMaterial(
  trackMaterial: TrackMaterial | undefined,
  params: THREE.MeshStandardMaterialParameters,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.72,
    metalness: 0.04,
    ...params,
  });
  return trackMaterial?.(material) ?? material;
}

export function createPlumbingThreeMaterials(
  trackMaterial?: TrackMaterial,
): PlumbingThreeMaterials {
  return {
    coldWater: standardMaterial(trackMaterial, { color: 0x0284c7 }),
    hotWater: standardMaterial(trackMaterial, { color: 0xea580c }),
    sanitary: standardMaterial(trackMaterial, { color: 0x111827 }),
    vent: standardMaterial(trackMaterial, { color: 0x7c3aed }),
    fixture: standardMaterial(trackMaterial, { color: 0xf8fafc }),
    fixtureAccent: standardMaterial(trackMaterial, { color: 0x94a3b8 }),
    equipment: standardMaterial(trackMaterial, { color: 0x334155 }),
    fitting: standardMaterial(trackMaterial, { color: 0x0f172a }),
    sleeve: standardMaterial(trackMaterial, {
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
    }),
    warning: standardMaterial(trackMaterial, {
      color: 0xf59e0b,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.15,
    }),
    selected: standardMaterial(trackMaterial, {
      color: 0x22d3ee,
      emissive: 0x0e7490,
      emissiveIntensity: 0.24,
      transparent: true,
      opacity: 0.94,
    }),
    label: trackMaterial?.(
      new THREE.SpriteMaterial({
        transparent: true,
        depthWrite: false,
      }),
    ) ?? new THREE.SpriteMaterial({ transparent: true, depthWrite: false }),
  };
}

export function materialForPlumbingRunSystem(
  system: PlumbingRunSystem,
  materials: PlumbingThreeMaterials,
): THREE.Material {
  switch (system) {
    case 'cold_water':
      return materials.coldWater;
    case 'hot_water':
      return materials.hotWater;
    case 'sanitary':
      return materials.sanitary;
    case 'vent':
      return materials.vent;
    default:
      return materials.fitting;
  }
}

export function colorForPlumbingMaterial(material: PlumbingMaterial): number {
  switch (material) {
    case 'pvc':
      return 0xf8fafc;
    case 'abs':
      return 0x111827;
    case 'pex':
      return 0x0ea5e9;
    case 'cpvc':
      return 0xfbbf24;
    case 'copper':
      return 0xb45309;
    case 'cast_iron':
      return 0x334155;
    default:
      return 0x64748b;
  }
}
