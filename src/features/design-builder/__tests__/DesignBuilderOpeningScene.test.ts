import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';
import {
  buildOpeningClosureWarningSceneGroup,
  buildOpeningSceneGroups,
} from '../ui/DesignBuilderOpeningScene';
import type { CmuWallSystemParameters } from '../types';

function makeMaterial(
  color: number,
  selected = false,
  options: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: selected ? 0x22d3ee : color,
    ...options,
  });
}

const wall = {
  lengthMeters: 6,
  widthMeters: 5,
  heightMeters: 2.8,
  wallThicknessMeters: 0.2,
  blockHeightMeters: 0.2,
  blockDepthMeters: 0.2,
  blockLengthMeters: 0.4,
  openings: [],
} as CmuWallSystemParameters;

describe('DesignBuilderOpeningScene', () => {
  it('builds opening groups and selectable metadata from generated CMU layout', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: preset.wall,
        openings: preset.wall.openings,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const selectedOpeningId = geometry.wallCmuLayout.roughOpenings[0]?.id;
    expect(selectedOpeningId).toBeTruthy();

    const scene = buildOpeningSceneGroups({
      cmuLayout: geometry.wallCmuLayout,
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      showGroutCells: true,
      showOpeningLayout: true,
      showClosureWarnings: false,
      selectedOpeningId,
      hoveredOpeningId: null,
      resolvedInfillPanelBounds: geometry.resolvedInfillPanelBounds,
      trackGeometry: (geometry) => geometry,
      makeMaterial,
    });

    expect(scene.frameGroup.children.length).toBe(geometry.wallCmuLayout.roughOpenings.length);
    expect(scene.lintelGroup.children.length).toBe(geometry.wallCmuLayout.lintels.length);
    expect(scene.roughOpeningGuideGroup.children.length).toBeGreaterThan(0);
    const openingSelectable = scene.selectableObjects.find(
      (object) => object.userData.openingId === selectedOpeningId,
    );
    expect(openingSelectable?.userData.selectable).toBe(true);
    expect(openingSelectable?.userData.selectionPriority).toBe(100);
    expect(['door_opening', 'window_opening']).toContain(openingSelectable?.userData.designObjectType);
    expect(
      scene.selectableObjects.some(
        (object) =>
          object.userData.designObjectType === 'cmu_wall_system' &&
          object.userData.selectionPriority === 40,
      ),
    ).toBe(true);
    if (geometry.wallCmuLayout.groutFillPlacements.length > 0) {
      expect(
        scene.selectableObjects.some(
          (object) =>
            object.userData.designObjectType === 'cmu_wall_system' &&
            object.userData.selectionPriority === 10,
        ),
      ).toBe(true);
    }
  });

  it('builds closure warning markers only for cut and grout fill closures', () => {
    const material = makeMaterial(0xf59e0b, true);
    const tracked: THREE.BufferGeometry[] = [];
    const { group, selectableObjects } = buildOpeningClosureWarningSceneGroup({
      cmuLayout: {
        openingCourseClosures: [
          {
            openingId: 'opening-1',
            wallFace: 'north',
            courseIndex: 1,
            courseBottom: 0.2,
            courseTop: 0.4,
            side: 'left',
            roughOpeningEdge: 2.25,
            nearestBlockEdge: 2.2,
            residualGap: 0.04,
            closureType: 'cut_block',
          },
          {
            openingId: 'opening-1',
            wallFace: 'east',
            courseIndex: 2,
            courseBottom: 0.4,
            courseTop: 0.6,
            side: 'right',
            roughOpeningEdge: 3.1,
            nearestBlockEdge: 3,
            residualGap: 0.08,
            closureType: 'grout_fill',
          },
          {
            openingId: 'opening-1',
            wallFace: 'south',
            courseIndex: 3,
            courseBottom: 0.6,
            courseTop: 0.8,
            side: 'left',
            roughOpeningEdge: 1,
            nearestBlockEdge: 1,
            residualGap: 0.01,
            closureType: 'shim_gap',
          },
        ],
      },
      wall,
      slabTopMeters: 0.12,
      material,
      trackGeometry: (geometry) => {
        tracked.push(geometry);
        return geometry;
      },
    });

    expect(group.name).toBe('openingClosureWarningGroup');
    expect(group.children).toHaveLength(2);
    expect(selectableObjects).toHaveLength(2);
    expect(tracked).toHaveLength(2);
    const northMarker = group.children[0] as THREE.Mesh;
    const eastMarker = group.children[1] as THREE.Mesh;
    expect(northMarker.position.x).toBeCloseTo(-0.75, 6);
    expect(northMarker.position.y).toBeCloseTo(0.42, 6);
    expect(northMarker.position.z).toBeCloseTo(-2.5, 6);
    expect(northMarker.userData.explicitHelperMarker).toBe(true);
    expect(northMarker.userData.selectionPriority).toBe(5);
    expect(eastMarker.position.x).toBeCloseTo(3, 6);
    expect(eastMarker.position.z).toBeCloseTo(0.6, 6);
    expect(eastMarker.rotation.y).toBeCloseTo(Math.PI / 2, 6);
  });
});
