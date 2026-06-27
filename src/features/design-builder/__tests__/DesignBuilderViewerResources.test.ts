import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createDesignBuilderViewerResources } from '../ui/DesignBuilderViewerResources';

describe('DesignBuilderViewerResources', () => {
  it('tracks geometries and materials and disposes them on reset', () => {
    const resources = createDesignBuilderViewerResources();
    const geometry = resources.trackGeometry(new THREE.BoxGeometry(1, 1, 1));
    const material = resources.trackMaterial(new THREE.MeshBasicMaterial());
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');

    expect(resources.trackedGeometryCount()).toBe(1);
    expect(resources.trackedMaterialCount()).toBe(1);

    resources.resetTrackedResources();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(resources.trackedGeometryCount()).toBe(0);
    expect(resources.trackedMaterialCount()).toBe(0);
  });

  it('creates standard selected and unselected mesh materials', () => {
    const resources = createDesignBuilderViewerResources();
    const selected = resources.makeMaterial(0xff0000, true);
    const normal = resources.makeMaterial(0x00ff00, false, { opacity: 0.5 });

    expect(selected.color.getHex()).toBe(0x22d3ee);
    expect(selected.transparent).toBe(true);
    expect(selected.opacity).toBeCloseTo(0.92, 6);
    expect(selected.emissive.getHex()).toBe(0x0e7490);
    expect(normal.color.getHex()).toBe(0x00ff00);
    expect(normal.opacity).toBeCloseTo(0.5, 6);
    expect(resources.trackedMaterialCount()).toBe(2);

    resources.disposeTrackedResources();
  });

  it('tracks and clears ghost materials from meshes and line segments', () => {
    const resources = createDesignBuilderViewerResources();
    const ghostRoot = new THREE.Group();
    const group = new THREE.Group();
    const meshMaterial = new THREE.MeshBasicMaterial();
    const lineMaterial = new THREE.LineBasicMaterial();
    const meshDispose = vi.spyOn(meshMaterial, 'dispose');
    const lineDispose = vi.spyOn(lineMaterial, 'dispose');
    group.add(
      new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), meshMaterial),
      new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial),
    );
    ghostRoot.add(group);

    resources.trackGhostMaterialsFrom(group);
    expect(resources.ghostMaterialCount()).toBe(2);

    resources.clearGhostRoot(ghostRoot);

    expect(meshDispose).toHaveBeenCalledTimes(1);
    expect(lineDispose).toHaveBeenCalledTimes(1);
    expect(resources.ghostMaterialCount()).toBe(0);
    expect(ghostRoot.children).toHaveLength(0);
  });
});
