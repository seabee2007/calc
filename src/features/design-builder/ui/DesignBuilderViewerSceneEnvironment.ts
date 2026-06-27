import * as THREE from 'three';
import { resolveSceneGridLayout, type DesignLayoutBounds } from '../domain/designLayoutBounds';
import { resolveSiteGroundMaterial } from '../rendering/materials/designMaterialLibrary';
import type { DesignVisualStyle } from '../types';

export function isDesignBuilderDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

export interface DesignBuilderViewerSceneEnvironment {
  floorMesh: THREE.Mesh;
  applySceneFraming: (bounds: DesignLayoutBounds | null) => void;
  applyTheme: () => void;
  refreshSiteGroundMaterial: () => void;
  dispose: () => void;
}

export function createDesignBuilderViewerSceneEnvironment(params: {
  scene: THREE.Scene;
  initialBounds: DesignLayoutBounds | null;
  getLayoutBounds: () => DesignLayoutBounds | null;
  getVisualStyle: () => DesignVisualStyle;
  trackMaterial: (material: THREE.Material) => void;
  isDarkMode?: () => boolean;
}): DesignBuilderViewerSceneEnvironment {
  const isDarkMode = params.isDarkMode ?? isDesignBuilderDarkMode;
  const initialGridLayout = resolveSceneGridLayout(params.initialBounds);
  let grid = new THREE.GridHelper(
    initialGridLayout.gridSize,
    initialGridLayout.gridDivisions,
  );
  grid.position.set(initialGridLayout.centerX, 0, initialGridLayout.centerZ);
  params.scene.add(grid);

  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(initialGridLayout.gridSize, initialGridLayout.gridSize),
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(initialGridLayout.centerX, -0.004, initialGridLayout.centerZ);
  params.scene.add(floorMesh);

  let activeGridSize = initialGridLayout.gridSize;
  let activeGridDivisions = initialGridLayout.gridDivisions;

  const refreshSiteGroundMaterial = () => {
    const layout = resolveSceneGridLayout(params.getLayoutBounds());
    const material = resolveSiteGroundMaterial(
      {
        visualStyle: params.getVisualStyle(),
        selected: false,
        gridSizeMeters: layout.gridSize,
      },
      (nextMaterial) => {
        params.trackMaterial(nextMaterial);
      },
    );
    floorMesh.material = material;
  };

  const applyTheme = () => {
    const dark = isDarkMode();
    params.scene.background = new THREE.Color(dark ? 0x0f172a : 0xf8fafc);
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.opacity = dark ? 0.35 : 0.22;
    gridMaterial.transparent = true;
    refreshSiteGroundMaterial();
  };

  const applySceneFraming = (bounds: DesignLayoutBounds | null) => {
    const layout = resolveSceneGridLayout(bounds);
    if (
      Math.abs(activeGridSize - layout.gridSize) > 0.01 ||
      activeGridDivisions !== layout.gridDivisions
    ) {
      params.scene.remove(grid);
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      grid = new THREE.GridHelper(layout.gridSize, layout.gridDivisions);
      activeGridSize = layout.gridSize;
      activeGridDivisions = layout.gridDivisions;
      params.scene.add(grid);
      applyTheme();
    }
    grid.position.set(layout.centerX, 0, layout.centerZ);
    floorMesh.position.set(layout.centerX, -0.004, layout.centerZ);
    floorMesh.geometry.dispose();
    floorMesh.geometry = new THREE.PlaneGeometry(layout.gridSize, layout.gridSize);
    refreshSiteGroundMaterial();
  };

  const dispose = () => {
    params.scene.remove(grid, floorMesh);
    grid.geometry.dispose();
    (grid.material as THREE.Material).dispose();
    floorMesh.geometry.dispose();
    const floorMaterial = floorMesh.material;
    if (Array.isArray(floorMaterial)) {
      floorMaterial.forEach((material) => material.dispose());
    } else {
      floorMaterial.dispose();
    }
  };

  return {
    floorMesh,
    applySceneFraming,
    applyTheme,
    refreshSiteGroundMaterial,
    dispose,
  };
}
