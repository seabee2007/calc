import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  createDesignBuilderViewerSceneRegistry,
  markDesignBuilderSelectable,
  markDesignBuilderWallPickable,
  selectionPriorityForObjectType,
} from '../ui/DesignBuilderViewerSceneRegistry';

describe('DesignBuilderViewerSceneRegistry', () => {
  it('assigns stable selection priorities by design object type', () => {
    expect(selectionPriorityForObjectType('door_opening')).toBe(100);
    expect(selectionPriorityForObjectType('window_opening')).toBe(100);
    expect(selectionPriorityForObjectType('cmu_wall_system')).toBe(40);
    expect(selectionPriorityForObjectType('building_footprint')).toBe(20);
    expect(selectionPriorityForObjectType('steel_truss_system')).toBe(20);
    expect(selectionPriorityForObjectType('structural_frame_system')).toBe(1);
  });

  it('marks selectable objects and wall pickables with viewer metadata', () => {
    const selectable = new THREE.Group();
    markDesignBuilderSelectable({
      object: selectable,
      objectType: 'window_opening',
      openingId: 'window-1',
    });

    expect(selectable.userData).toMatchObject({
      selectable: true,
      designObjectType: 'window_opening',
      openingId: 'window-1',
      selectionPriority: 100,
    });

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    markDesignBuilderWallPickable({
      mesh,
      wallSegmentId: 'segment-1',
      lengthMeters: 4,
    });

    expect(mesh.userData).toMatchObject({
      isWallPickable: true,
      wallSegmentId: 'segment-1',
      lengthMeters: 4,
    });
  });

  it('registers root, selectable, and wall-pickable objects and resets them together', () => {
    const root = new THREE.Group();
    const selectableObjects: THREE.Object3D[] = [];
    const wallPickableObjects: THREE.Object3D[] = [];
    const registry = createDesignBuilderViewerSceneRegistry({
      root,
      selectableObjects,
      wallPickableObjects,
    });

    const selectable = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const pickable = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    registry.addSelectable(selectable, 'cmu_wall_system');
    registry.addWallPickable(pickable, { wallFace: 'north' });

    expect(root.children).toEqual([selectable, pickable]);
    expect(selectableObjects).toEqual([selectable]);
    expect(wallPickableObjects).toEqual([pickable]);
    expect(selectable.userData.selectionPriority).toBe(40);
    expect(pickable.userData.wallFace).toBe('north');

    registry.reset();

    expect(root.children).toHaveLength(0);
    expect(selectableObjects).toHaveLength(0);
    expect(wallPickableObjects).toHaveLength(0);
  });

  it('skips invalid runtime objects before they reach Three.js add()', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = new THREE.Group();
    const rootAddSpy = vi.spyOn(root, 'add');
    const selectableObjects: THREE.Object3D[] = [];
    const wallPickableObjects: THREE.Object3D[] = [];
    const registry = createDesignBuilderViewerSceneRegistry({
      root,
      selectableObjects,
      wallPickableObjects,
    });

    const invalid = undefined as unknown as THREE.Object3D;

    registry.addRootObject(invalid);
    registry.addSelectable(invalid, 'cmu_wall_system');
    registry.addWallPickable(invalid as THREE.Mesh, { wallFace: 'north' });
    registry.registerSelectable(invalid);
    registry.registerSelectables([invalid]);

    expect(root.children).toHaveLength(0);
    expect(selectableObjects).toHaveLength(0);
    expect(wallPickableObjects).toHaveLength(0);
    expect(rootAddSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    rootAddSpy.mockRestore();
  });
});
