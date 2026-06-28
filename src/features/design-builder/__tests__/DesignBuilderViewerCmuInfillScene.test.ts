import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { resolveDesignBuilderGeometryPipeline } from '../application/designBuilderGeometryPipeline';
import { createDesignBuilderRcFrameDebugSnapshot } from '../domain/designBuilderRcFrameDebugSnapshot';
import { DEFAULT_ROOF_LAYER_VISIBILITY } from '../domain/roofSystemDefaults';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import type { ResolvedInfillPanelBounds } from '../domain/infillPanelBoundsResolver';
import { syncPresetFromLayout } from '../domain/layoutWallAdapter';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
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
import { createDesignBuilderViewerCmuInfillRenderDebugSnapshot } from '../ui/DesignBuilderViewerCmuInfillRenderDebugSnapshot';
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

function infillPanelBounds(): ResolvedInfillPanelBounds {
  return {
    panelId: 'panel-1',
    hostSegmentId: 'segment-1',
    leftColumnId: 'column-left',
    rightColumnId: 'column-right',
    startStationMeters: 0,
    endStationMeters: 2,
    clearWidthMeters: 2,
    bottomElevationMeters: 0,
    topElevationMeters: 2.4,
    clearHeightMeters: 2.4,
    infillCenterlineInwardOffsetMeters: 0,
    hostWallCenterlineStart: { x: 0, y: 0, z: 0 },
    hostWallCenterlineEnd: { x: 2, y: 0, z: 0 },
    tangent: { x: 1, y: 0, z: 0 },
    outwardNormal: { x: 0, y: 0, z: -1 },
    inwardNormal: { x: 0, y: 0, z: 1 },
    leftSupportInsideFaceWorld: { x: 0, y: 0, z: 0 },
    rightSupportInsideFaceWorld: { x: 2, y: 0, z: 0 },
    leftSupportInsideFaceStation: 0,
    rightSupportInsideFaceStation: 2,
  };
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

function rcFrameGeometry(params: {
  lengthMeters: number;
  widthMeters: number;
}): {
  geometry: DesignGeometryResult;
  state: DesignBuilderViewerCmuInfillState;
} {
  const template = createFiveBySixCmuBuildingPreset();
  const layout = createOutsideFaceRectangleLayout({
    lengthMeters: params.lengthMeters,
    widthMeters: params.widthMeters,
    wallHeightMeters: 2.8,
    wallThicknessMeters: 0.2,
  });
  const synced = syncPresetFromLayout(
    {
      ...template,
      wall: {
        ...template.wall,
        openings: [],
        showIndividualBlocks: false,
      },
      wallLayout: layout,
    },
    layout,
  );
  const preset = applyAutoFrameLayout(synced);
  const geometry = resolveDesignBuilderGeometryPipeline({
    wallLayout: preset.wallLayout,
    effectiveWall: preset.wall,
    resolvedPreset: {
      ...preset,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
    },
    footprintClosed: true,
    activeRoofSystem: preset.roofSystem,
  }).designGeometryResult;

  return {
    geometry,
    state: {
      currentGeometry: geometry,
      currentWall: {
        ...preset.wall,
        showIndividualBlocks: false,
      },
      currentSlab: preset.slab,
      currentSelectedObjectType: null,
      currentVisualStyle: 'material_preview',
      currentRoofDisplayMode: 'full_roof',
      currentRoofLayerVisibility: DEFAULT_ROOF_LAYER_VISIBILITY,
      usePreviewMaterials: true,
      cmuSelected: false,
      cmuCutawayActive: false,
      cmuOpacity: 1,
      cmuMaterialOptions: {
        visualStyle: 'material_preview',
        selected: false,
      },
    },
  };
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

  it('renders plaster on CMU infill panels while individual block mode is active', () => {
    const resources = createDesignBuilderViewerResources();
    const bounds = infillPanelBounds();
    const state = cmuInfillState({
      currentGeometry: {
        ...geometryResult([cmuBlock({ id: 'wall-block' })]),
        infillSystem: {
          kind: 'cmu_infill_system',
          panels: [
            {
              id: bounds.panelId,
              hostSegmentId: bounds.hostSegmentId,
              infillZone: 'above_grade',
            },
          ],
          plaster: {
            enabled: true,
            finish: 'textured',
            profileLabel: '3-coat plaster',
            interiorEnabled: true,
            interiorFinish: 'smooth',
            interiorProfileLabel: '3-coat plaster',
          },
        },
        resolvedInfillPanelBounds: [bounds],
        resolvedFootprint: {
          orderedPerimeterSegments: [{ segmentId: bounds.hostSegmentId }],
        },
      } as DesignGeometryResult,
      currentVisualStyle: 'material_preview',
      usePreviewMaterials: true,
    });

    const scene = buildDesignBuilderViewerCmuInfillScene({
      state,
      cmuLayout: state.currentGeometry!.wallCmuLayout,
      showCmuInfill: true,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    expect(scene.groups.find((group) => group.name === 'cmuBlockInstanceGroup')).toBeDefined();
    expect(scene.groups.find((group) => group.name === 'infillWallProxyGroup')).toBeUndefined();
    expect(scene.groups.find((group) => group.name === 'plasterGroup')).toBeDefined();

    resources.disposeTrackedResources();
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

  it.each([
    { label: '15m x 6m', lengthMeters: 15, widthMeters: 6 },
    { label: '35m x 6m', lengthMeters: 35, widthMeters: 6 },
  ])(
    'renders solver-driven CMU infill wall and plaster proxy meshes for $label',
    ({ lengthMeters, widthMeters }) => {
      const resources = createDesignBuilderViewerResources();
      const { geometry, state } = rcFrameGeometry({ lengthMeters, widthMeters });
      const scene = buildDesignBuilderViewerCmuInfillScene({
        state,
        cmuLayout: geometry.wallCmuLayout,
        showCmuInfill: true,
        trackGeometry: resources.trackGeometry,
        trackMaterial: resources.trackMaterial,
        makeMaterial: resources.makeMaterial,
      });
      const rcFrameSnapshot = createDesignBuilderRcFrameDebugSnapshot({
        geometryResult: geometry,
        visualStyle: 'material_preview',
        usePreviewMaterials: true,
      });

      const renderSnapshot = createDesignBuilderViewerCmuInfillRenderDebugSnapshot({
        cmuInfillScene: scene,
        rcFrameSnapshot,
        showCmuInfill: true,
        showIndividualBlocks: false,
      });

      expect(rcFrameSnapshot.issues).toEqual([]);
      expect(renderSnapshot.issues).toEqual([]);
      expect(renderSnapshot.components.wallProxy.rendered).toBe(true);
      expect(renderSnapshot.components.wallProxy.meshCount).toBeGreaterThanOrEqual(
        rcFrameSnapshot.infillHealth.aboveGradePanelCount,
      );
      expect(renderSnapshot.components.plaster.rendered).toBe(true);
      expect(renderSnapshot.components.plaster.meshCount).toBeGreaterThanOrEqual(
        rcFrameSnapshot.infillHealth.aboveGradePanelsWithPlaster,
      );
      expect(renderSnapshot.selectableCount).toBeGreaterThan(0);

      resources.disposeTrackedResources();
    },
  );

  it('reports when solver-driven CMU infill wall proxies are missing from the viewer', () => {
    const { geometry } = rcFrameGeometry({ lengthMeters: 15, widthMeters: 6 });
    const rcFrameSnapshot = createDesignBuilderRcFrameDebugSnapshot({
      geometryResult: geometry,
    });

    const renderSnapshot = createDesignBuilderViewerCmuInfillRenderDebugSnapshot({
      cmuInfillScene: {
        groups: [],
        selectableObjects: [],
        mortarDiagnostics: null,
      },
      rcFrameSnapshot,
      showCmuInfill: true,
      showIndividualBlocks: false,
    });

    expect(renderSnapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: 'wallProxy',
          code: 'expected_component_not_rendered',
        }),
        expect.objectContaining({
          component: 'plaster',
          code: 'expected_component_not_rendered',
        }),
      ]),
    );
  });
});
