import * as THREE from 'three';
import { resolveSceneGridLayout, type DesignLayoutBounds } from '../domain/designLayoutBounds';
import { resolveSiteGroundMaterial } from '../rendering/materials/designMaterialLibrary';
import type { DesignVisualStyle } from '../types';

const DEFAULT_SITE_GROUND_Y_METERS = -0.004;
const GROUND_EXCLUSION_EXPAND_METERS = 0.03;

type SiteGroundPoint = { x: number; z: number };

function expandedGroundExclusionPolygon(
  polygon: readonly SiteGroundPoint[],
): SiteGroundPoint[] {
  const center = polygon.reduce(
    (sum, point) => ({ x: sum.x + point.x, z: sum.z + point.z }),
    { x: 0, z: 0 },
  );
  center.x /= polygon.length;
  center.z /= polygon.length;

  return polygon.map((point) => {
    const dx = point.x - center.x;
    const dz = point.z - center.z;
    const length = Math.hypot(dx, dz);
    if (length <= 0.0001) return point;
    return {
      x: point.x + (dx / length) * GROUND_EXCLUSION_EXPAND_METERS,
      z: point.z + (dz / length) * GROUND_EXCLUSION_EXPAND_METERS,
    };
  });
}

function createSiteGroundGeometry(params: {
  centerX: number;
  centerZ: number;
  gridSize: number;
  exclusionPolygon?: readonly SiteGroundPoint[] | null;
}): THREE.BufferGeometry {
  const exclusionPolygon = params.exclusionPolygon;
  if (!exclusionPolygon || exclusionPolygon.length < 3) {
    return new THREE.PlaneGeometry(params.gridSize, params.gridSize);
  }

  const halfSize = params.gridSize / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfSize, -halfSize);
  shape.lineTo(halfSize, -halfSize);
  shape.lineTo(halfSize, halfSize);
  shape.lineTo(-halfSize, halfSize);
  shape.closePath();

  const hole = new THREE.Path();
  expandedGroundExclusionPolygon(exclusionPolygon).forEach((point, index) => {
    const localX = point.x - params.centerX;
    const localZ = point.z - params.centerZ;
    if (index === 0) {
      hole.moveTo(localX, localZ);
    } else {
      hole.lineTo(localX, localZ);
    }
  });
  hole.closePath();
  shape.holes.push(hole);

  return new THREE.ShapeGeometry(shape);
}

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
  getGroundExclusionPolygon?: () => readonly SiteGroundPoint[] | null | undefined;
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
    createSiteGroundGeometry({
      centerX: initialGridLayout.centerX,
      centerZ: initialGridLayout.centerZ,
      gridSize: initialGridLayout.gridSize,
      exclusionPolygon: params.getGroundExclusionPolygon?.(),
    }),
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(
    initialGridLayout.centerX,
    DEFAULT_SITE_GROUND_Y_METERS,
    initialGridLayout.centerZ,
  );
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
    floorMesh.position.set(layout.centerX, DEFAULT_SITE_GROUND_Y_METERS, layout.centerZ);
    floorMesh.geometry.dispose();
    floorMesh.geometry = createSiteGroundGeometry({
      centerX: layout.centerX,
      centerZ: layout.centerZ,
      gridSize: layout.gridSize,
      exclusionPolygon: params.getGroundExclusionPolygon?.(),
    });
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
