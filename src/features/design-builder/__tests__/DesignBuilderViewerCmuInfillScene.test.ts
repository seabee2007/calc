import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOF_LAYER_VISIBILITY } from '../domain/roofSystemDefaults';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import type {
  CmuBlockInstance,
  CmuLayoutResult,
  DesignGeometryResult,
} from '../geometry/designGeometry';
import {
  buildDesignBuilderViewerCmuInfillScene,
  buildDesignBuilderViewerCmuMortarScene,
  type DesignBuilderViewerCmuInfillState,
} from '../ui/DesignBuilderViewerCmuInfillScene';
import { createDesignBuilderViewerResources } from '../ui/DesignBuilderViewerResources';

function cmuBlock(partial: Partial<CmuBlockInstance>): CmuBlockInstance {
  return {
    id: partial.id ?? 'block-1',
    face: 'north',
    segmentId: 'segment-1',
    course: 0,
    blockType: 'full',
    x: 0,
    y: 0.1,
    z: 0,
    rotationY: 0,
    lengthMeters: 0.4,
    actualLengthMeters: 0.4,
    heightMeters: 0.2,
    physicalHeightMeters: 0.2,
    depthMeters: 0.15,
    startAlongMeters: 0,
    endAlongMeters: 0.4,
    ...partial,
  };
}

function cmuLayout(blocks: CmuBlockInstance[]): CmuLayoutResult {
  return {
    blocks,
    unitPlacements: [],
    roughOpenings: [],
    segmentFrames: [],
  } as CmuLayoutResult;
}

function geometryResult(blocks: CmuBlockInstance[]): DesignGeometryResult {
  return {
    sourcePath: 'layout_graph',
    wallSegments: [],
    blockInstances: blocks,
    cornerCourseLayouts: [],
    exteriorFootprint: [],
    resolvedFootprint: null,
    boundaryViolations: [],
    blockCount: blocks.length,
    bondPattern: 'running_bond',
    wallCmuLayout: cmuLayout(blocks),
  } as DesignGeometryResult;
}

function cmuInfillState(
  partial: Partial<DesignBuilderViewerCmuInfillState> = {},
): DesignBuilderViewerCmuInfillState {
  const preset = createFiveBySixCmuBuildingPreset();
  const blocks = [
    cmuBlock({ id: 'wall-block' }),
    cmuBlock({ id: 'gable-block', source: 'gable_end_solver' }),
  ];
  return {
    currentGeometry: geometryResult(blocks),
    currentWall: {
      ...preset.wall,
      showIndividualBlocks: true,
    },
    currentSlab: preset.slab,
    currentSelectedObjectType: null,
    currentVisualStyle: 'technical',
    currentRoofDisplayMode: 'full_roof',
    currentRoofLayerVisibility: DEFAULT_ROOF_LAYER_VISIBILITY,
    usePreviewMaterials: false,
    cmuSelected: false,
    cmuCutawayActive: false,
    cmuOpacity: 0.9,
    cmuMaterialOptions: {
      visualStyle: 'technical',
      selected: false,
    },
    ...partial,
  };
}

function instancedMeshCount(object: THREE.Object3D): number {
  let count = 0;
  object.traverse((child) => {
    if (child instanceof THREE.InstancedMesh) count += child.count;
  });
  return count;
}

describe('DesignBuilderViewerCmuInfillScene', () => {
  it('renders only gable-end CMU blocks when wall infill is hidden but gable masonry is visible', () => {
    const resources = createDesignBuilderViewerResources();
    const state = cmuInfillState();

    const scene = buildDesignBuilderViewerCmuInfillScene({
      state,
      cmuLayout: state.currentGeometry!.wallCmuLayout,
      showCmuInfill: false,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    const blockGroup = scene.groups.find((group) => group.name === 'cmuBlockInstanceGroup');
    expect(blockGroup).toBeDefined();
    expect(instancedMeshCount(blockGroup!)).toBe(1);
    expect(scene.selectableObjects).toHaveLength(1);
    expect(scene.selectableObjects[0]!.userData.designObjectType).toBe('cmu_wall_system');
    expect(scene.selectableObjects[0]!.userData.selectionPriority).toBe(40);

    resources.disposeTrackedResources();
  });

  it('hides gable-end CMU blocks when the gable layer is off', () => {
    const resources = createDesignBuilderViewerResources();
    const state = cmuInfillState({
      currentRoofLayerVisibility: {
        ...DEFAULT_ROOF_LAYER_VISIBILITY,
        gableEndCmu: false,
      },
    });

    const scene = buildDesignBuilderViewerCmuInfillScene({
      state,
      cmuLayout: state.currentGeometry!.wallCmuLayout,
      showCmuInfill: false,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    expect(scene.groups.find((group) => group.name === 'cmuBlockInstanceGroup')).toBeUndefined();
    expect(scene.selectableObjects).toHaveLength(0);
    expect(scene.mortarDiagnostics).toBeNull();
  });

  it('builds mortar as a reusable scene group without mutating a root group', () => {
    const resources = createDesignBuilderViewerResources();
    const preset = createFiveBySixCmuBuildingPreset();
    const root = new THREE.Group();

    const mortar = buildDesignBuilderViewerCmuMortarScene({
      blocks: [cmuBlock({ id: 'wall-block' })],
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      visualStyle: 'technical',
      cmuCutawayActive: false,
      cmuOpacity: 0.9,
      debugMode: false,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
    });

    expect(root.children).toHaveLength(0);
    expect(mortar.group.name).toBe('cmuMortarJointRoot');
    expect(mortar.group.children.length).toBeGreaterThan(0);
    expect(mortar.diagnostics).not.toBeNull();

    resources.disposeTrackedResources();
  });
});
