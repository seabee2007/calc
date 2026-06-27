import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createDesignBuilderViewerSceneEnvironment,
  isDesignBuilderDarkMode,
} from '../ui/DesignBuilderViewerSceneEnvironment';

describe('DesignBuilderViewerSceneEnvironment', () => {
  const bounds = {
    minX: -10,
    maxX: 20,
    minZ: -5,
    maxZ: 15,
    minY: 0,
    maxY: 4,
    center: { x: 5, y: 2, z: 5 },
    width: 30,
    depth: 20,
    height: 4,
  };

  it('creates grid and floor meshes, applies theme, and tracks ground materials', () => {
    const scene = new THREE.Scene();
    const trackedMaterials: THREE.Material[] = [];
    let visualStyle: 'technical' | 'material_preview' = 'technical';
    const environment = createDesignBuilderViewerSceneEnvironment({
      scene,
      initialBounds: null,
      getLayoutBounds: () => null,
      getVisualStyle: () => visualStyle,
      trackMaterial: (material) => {
        trackedMaterials.push(material);
      },
      isDarkMode: () => true,
    });

    expect(scene.children.some((child) => child instanceof THREE.GridHelper)).toBe(true);
    expect(scene.children).toContain(environment.floorMesh);
    environment.applyTheme();

    expect((scene.background as THREE.Color).getHex()).toBe(0x0f172a);
    expect(trackedMaterials.length).toBeGreaterThan(0);
    expect(environment.floorMesh.rotation.x).toBeCloseTo(-Math.PI / 2, 6);

    visualStyle = 'material_preview';
    environment.refreshSiteGroundMaterial();
    expect(trackedMaterials.length).toBeGreaterThan(1);

    environment.dispose();
  });

  it('updates grid and floor placement when framing bounds change', () => {
    const scene = new THREE.Scene();
    const environment = createDesignBuilderViewerSceneEnvironment({
      scene,
      initialBounds: null,
      getLayoutBounds: () => bounds,
      getVisualStyle: () => 'technical',
      trackMaterial: () => undefined,
      isDarkMode: () => false,
    });

    environment.applySceneFraming(bounds);

    expect(environment.floorMesh.position.x).toBeCloseTo(5, 6);
    expect(environment.floorMesh.position.z).toBeCloseTo(5, 6);
    expect((scene.background as THREE.Color).getHex()).toBe(0xf8fafc);

    environment.dispose();
  });

  it('reads dark mode from the document root', () => {
    document.documentElement.classList.remove('dark');
    expect(isDesignBuilderDarkMode()).toBe(false);
    document.documentElement.classList.add('dark');
    expect(isDesignBuilderDarkMode()).toBe(true);
    document.documentElement.classList.remove('dark');
  });
});
