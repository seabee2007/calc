import * as THREE from 'three';

export interface DesignBuilderViewerResources {
  trackGeometry: <T extends THREE.BufferGeometry>(geometry: T) => T;
  trackMaterial: <T extends THREE.Material>(material: T) => T;
  makeMaterial: (
    color: number,
    selected: boolean,
    options?: THREE.MeshStandardMaterialParameters,
  ) => THREE.MeshStandardMaterial;
  resetTrackedResources: () => void;
  disposeTrackedResources: () => void;
  clearGhostRoot: (ghostRoot: THREE.Group) => void;
  trackGhostMaterialsFrom: (object: THREE.Object3D) => void;
  ghostMaterialCount: () => number;
  trackedGeometryCount: () => number;
  trackedMaterialCount: () => number;
}

function disposeMaterial(material: THREE.Material): void {
  material.dispose();
}

export function createDesignBuilderViewerResources(): DesignBuilderViewerResources {
  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];
  let ghostMaterials: THREE.Material[] = [];

  const trackGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometriesToDispose.push(geometry);
    return geometry;
  };

  const trackMaterial = <T extends THREE.Material>(material: T): T => {
    materialsToDispose.push(material);
    return material;
  };

  const makeMaterial = (
    color: number,
    selected: boolean,
    options: THREE.MeshStandardMaterialParameters = {},
  ): THREE.MeshStandardMaterial =>
    trackMaterial(
      new THREE.MeshStandardMaterial({
        color: selected ? 0x22d3ee : color,
        roughness: 0.78,
        metalness: 0.03,
        transparent: selected,
        opacity: selected ? 0.92 : 1,
        emissive: selected ? 0x0e7490 : 0x000000,
        emissiveIntensity: selected ? 0.22 : 0,
        ...options,
      }),
    );

  const resetTrackedResources = () => {
    geometriesToDispose.splice(0).forEach((geometry) => geometry.dispose());
    materialsToDispose.splice(0).forEach(disposeMaterial);
  };

  const disposeTrackedResources = () => {
    geometriesToDispose.forEach((geometry) => geometry.dispose());
    materialsToDispose.forEach(disposeMaterial);
    geometriesToDispose.length = 0;
    materialsToDispose.length = 0;
  };

  const clearGhostRoot = (ghostRoot: THREE.Group) => {
    ghostMaterials.forEach(disposeMaterial);
    ghostMaterials = [];
    ghostRoot.clear();
  };

  const trackGhostMaterialsFrom = (object: THREE.Object3D) => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        ghostMaterials.push(...(Array.isArray(child.material) ? child.material : [child.material]));
      }
    });
  };

  return {
    trackGeometry,
    trackMaterial,
    makeMaterial,
    resetTrackedResources,
    disposeTrackedResources,
    clearGhostRoot,
    trackGhostMaterialsFrom,
    ghostMaterialCount: () => ghostMaterials.length,
    trackedGeometryCount: () => geometriesToDispose.length,
    trackedMaterialCount: () => materialsToDispose.length,
  };
}
