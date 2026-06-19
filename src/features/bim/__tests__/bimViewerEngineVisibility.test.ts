import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildSceneObjectRegistry,
  getVisibleRaycastTargets,
  isolateRegisteredObject,
  setRegisteredObjectVisibility,
  showAllRegisteredObjects,
} from '../viewer/bimViewerEngine';

function makeScene() {
  const root = new THREE.Group();
  root.name = 'Root';
  const concrete = new THREE.MeshStandardMaterial({ name: 'Concrete' });
  const wood = new THREE.MeshStandardMaterial({ name: 'Wood' });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), concrete);
  slab.name = 'Slab';
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), concrete);
  wall.name = 'Wall';
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wood);
  deck.name = 'Deck';
  root.add(slab, wall, deck);
  return { root, slab, wall, deck };
}

describe('BIM viewer scene visibility registry', () => {
  it('builds stable object and material registries from scene meshes', () => {
    const { root } = makeScene();
    const registry = buildSceneObjectRegistry(root);

    expect(registry.objectRegistryById.size).toBe(3);
    expect(registry.materialRegistryByName.get('Concrete')).toHaveLength(2);
    expect([...registry.visibilityState.values()]).toEqual([true, true, true]);
  });

  it('object tree visibility toggle updates the real mesh visible property', () => {
    const { root, slab } = makeScene();
    const registry = buildSceneObjectRegistry(root);
    const slabId = String(slab.userData.bimExternalId);

    expect(setRegisteredObjectVisibility(registry, slabId, false)).toBe(true);
    expect(slab.visible).toBe(false);
    expect(registry.visibilityState.get(slabId)).toBe(false);

    expect(setRegisteredObjectVisibility(registry, slabId, true)).toBe(true);
    expect(slab.visible).toBe(true);
  });

  it('material-level visibility updates all meshes using that material', () => {
    const { root, slab, wall, deck } = makeScene();
    const registry = buildSceneObjectRegistry(root);

    expect(setRegisteredObjectVisibility(registry, 'material:Concrete', false)).toBe(true);
    expect(slab.visible).toBe(false);
    expect(wall.visible).toBe(false);
    expect(deck.visible).toBe(true);
  });

  it('isolate hides non-selected meshes and show all restores every mesh', () => {
    const { root, slab, wall, deck } = makeScene();
    const registry = buildSceneObjectRegistry(root);
    const wallId = String(wall.userData.bimExternalId);

    isolateRegisteredObject(registry, wallId);
    expect(slab.visible).toBe(false);
    expect(wall.visible).toBe(true);
    expect(deck.visible).toBe(false);

    showAllRegisteredObjects(registry);
    expect(slab.visible).toBe(true);
    expect(wall.visible).toBe(true);
    expect(deck.visible).toBe(true);
  });

  it('hidden meshes are excluded from raycast targets', () => {
    const { root, slab } = makeScene();
    const registry = buildSceneObjectRegistry(root);
    const slabId = String(slab.userData.bimExternalId);

    setRegisteredObjectVisibility(registry, slabId, false);

    expect(getVisibleRaycastTargets(registry)).not.toContain(slab);
    expect(getVisibleRaycastTargets(registry)).toHaveLength(2);
  });
});
