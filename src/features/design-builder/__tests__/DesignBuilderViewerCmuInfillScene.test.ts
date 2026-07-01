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
import {
  CMU_GABLE_BLOCK_RENDER_ORDER,
  CMU_GABLE_FINISH_FACE_CLEARANCE_METERS,
  CMU_GABLE_MORTAR_RENDER_ORDER,
} from '../ui/DesignBuilderWallScene';
import { createDesignBuilderViewerCmuInfillRenderDebugSnapshot } from '../ui/DesignBuilderViewerCmuInfillRenderDebugSnapshot';
import { createDesignBuilderViewerResources } from '../ui/DesignBuilderViewerResources';
import {
  getDesignMaterialLibrary,
  resetDesignMaterialLibraryForTests,
} from '../rendering/materials/designMaterialLibrary';
import {
  CMU_TEXTURE_TILE_METERS,
  createTriplanarStandardMaterial,
  MORTAR_TEXTURE_TILE_METERS,
} from '../rendering/materials/createTriplanarStandardMaterial';

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
    frameSelected: false,
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

function firstInstancedMesh(object: THREE.Object3D): THREE.InstancedMesh | null {
  let mesh: THREE.InstancedMesh | null = null;
  object.traverse((child) => {
    if (!mesh && child instanceof THREE.InstancedMesh) mesh = child;
  });
  return mesh;
}

function findGroupByName(groups: readonly THREE.Group[], name: string): THREE.Group | null {
  let found: THREE.Group | null = null;
  groups.forEach((group) => {
    group.traverse((child) => {
      if (!found && child instanceof THREE.Group && child.name === name) {
        found = child;
      }
    });
  });
  return found;
}

function readInstancedScale(mesh: THREE.InstancedMesh, index = 0): THREE.Vector3 {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  return scale;
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
      frameSelected: false,
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

    const blockGroup = scene.groups.find((group) => group.name === 'cmuGableBlockInstanceGroup');
    expect(blockGroup).toBeDefined();
    expect(instancedMeshCount(blockGroup!)).toBe(1);
    expect(blockGroup!.renderOrder).toBe(CMU_GABLE_BLOCK_RENDER_ORDER);
    const gableMesh = firstInstancedMesh(blockGroup!);
    expect(gableMesh).toBeDefined();
    expect(gableMesh!.renderOrder).toBe(CMU_GABLE_BLOCK_RENDER_ORDER);
    expect(readInstancedScale(gableMesh!).z).toBeCloseTo(
      0.15 + CMU_GABLE_FINISH_FACE_CLEARANCE_METERS * 2,
      6,
    );
    const gableMaterial = gableMesh!.material as THREE.MeshStandardMaterial;
    expect(gableMaterial.polygonOffset).toBe(true);
    expect(gableMaterial.polygonOffsetFactor).toBeLessThan(0);
    expect(scene.selectableObjects).toHaveLength(1);
    expect(scene.selectableObjects[0]!.userData.designObjectType).toBe('cmu_wall_system');
    expect(scene.selectableObjects[0]!.userData.selectionPriority).toBe(40);

    resources.disposeTrackedResources();
  });

  it('keeps exposed below-grade, above-grade, gable CMU, and gable mortar on their assigned textured material families', () => {
    resetDesignMaterialLibraryForTests();
    const resources = createDesignBuilderViewerResources();
    const abovePanelBounds = {
      ...infillPanelBounds(),
      panelId: 'above-panel',
      hostSegmentId: 'wall-segment',
    };
    const belowPanelBounds = {
      ...infillPanelBounds(),
      panelId: 'below-panel',
      hostSegmentId: 'below-wall-segment',
      bottomElevationMeters: -0.8,
      topElevationMeters: 0,
      clearHeightMeters: 0.8,
    };
    const blocks = [
      cmuBlock({
        id: 'above-grade-block',
        source: 'rc_frame_infill',
        infillBand: 'above_grade',
        segmentId: 'wall-segment',
        startAlongMeters: 0,
        endAlongMeters: 0.4,
        y: 0.6,
      }),
      cmuBlock({
        id: 'below-grade-block',
        source: 'below_grade_rc_infill',
        infillBand: 'below_grade',
        segmentId: 'wall-segment',
        startAlongMeters: 0.4,
        endAlongMeters: 0.8,
        x: 0.4,
        y: -0.2,
      }),
      cmuBlock({
        id: 'gable-block-a',
        source: 'gable_end_solver',
        infillBand: 'gable',
        segmentId: 'gable-segment',
        startAlongMeters: 0,
        endAlongMeters: 0.4,
        x: 0,
        y: 2.6,
      }),
      cmuBlock({
        id: 'gable-block-b',
        source: 'gable_end_solver',
        infillBand: 'gable',
        segmentId: 'gable-segment',
        startAlongMeters: 0.4,
        endAlongMeters: 0.8,
        x: 0.4,
        y: 2.6,
      }),
    ];
    const state = cmuInfillState({
      currentVisualStyle: 'material_preview',
      usePreviewMaterials: true,
      currentGeometry: {
        ...geometryResult(blocks),
        infillSystem: {
          kind: 'cmu_infill_system',
          panels: [
            {
              id: abovePanelBounds.panelId,
              hostSegmentId: abovePanelBounds.hostSegmentId,
              infillZone: 'above_grade',
            },
            {
              id: belowPanelBounds.panelId,
              hostSegmentId: belowPanelBounds.hostSegmentId,
              infillZone: 'below_grade',
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
        resolvedInfillPanelBounds: [abovePanelBounds, belowPanelBounds],
        resolvedFootprint: {
          orderedPerimeterSegments: [
            { segmentId: abovePanelBounds.hostSegmentId },
            { segmentId: belowPanelBounds.hostSegmentId },
          ],
        },
      } as DesignGeometryResult,
      cmuMaterialOptions: {
        visualStyle: 'material_preview',
        selected: false,
      },
    });
    const sourceCmuColorMap = new THREE.Texture();
    const sourceCmuRoughnessMap = new THREE.Texture();
    const sourceColorMap = new THREE.Texture();
    const sourceNormalMap = new THREE.Texture();
    const sourceRoughnessMap = new THREE.Texture();
    const library = getDesignMaterialLibrary();
    library.cmuPreview = createTriplanarStandardMaterial({
      colorMap: sourceCmuColorMap,
      roughnessMap: sourceCmuRoughnessMap,
      textureScaleMeters: CMU_TEXTURE_TILE_METERS,
      baseColor: 0xffffff,
      paintColor: library.cmuPreview.color,
      paintStrength: 0.7,
      roughness: library.cmuPreview.roughness,
      metalness: library.cmuPreview.metalness,
    });
    library.mortarPreview = createTriplanarStandardMaterial({
      colorMap: sourceColorMap,
      roughnessMap: sourceRoughnessMap,
      textureScaleMeters: MORTAR_TEXTURE_TILE_METERS,
      baseColor: 0xffffff,
      paintColor: library.mortarPreview.color,
      paintStrength: 0.82,
      roughness: library.mortarPreview.roughness,
      metalness: library.mortarPreview.metalness,
    });
    library.mortarPreview.normalMap = sourceNormalMap;

    const scene = buildDesignBuilderViewerCmuInfillScene({
      state,
      cmuLayout: state.currentGeometry!.wallCmuLayout,
      showCmuInfill: true,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    const wallGroup = scene.groups.find((group) => group.name === 'cmuBlockInstanceGroup');
    const gableGroup = scene.groups.find((group) => group.name === 'cmuGableBlockInstanceGroup');
    expect(wallGroup).toBeDefined();
    expect(gableGroup).toBeDefined();
    expect(instancedMeshCount(wallGroup!)).toBe(2);
    expect(instancedMeshCount(gableGroup!)).toBe(2);

    const wallMaterial = firstInstancedMesh(wallGroup!)!.material as THREE.MeshStandardMaterial;
    const gableMaterial = firstInstancedMesh(gableGroup!)!.material as THREE.MeshStandardMaterial;
    expect(wallMaterial.color.getHex()).toBe(library.cmuPreview.color.getHex());
    expect(gableMaterial.color.getHex()).toBe(library.cmuPreview.color.getHex());
    expect(gableMaterial.map).toBe(library.cmuPreview.map);
    expect(gableMaterial.normalMap).toBe(library.cmuPreview.normalMap);
    expect(gableMaterial.roughnessMap).toBe(library.cmuPreview.roughnessMap);
    expect(wallMaterial.customProgramCacheKey()).toContain('triplanar');
    expect(gableMaterial).not.toBe(wallMaterial);
    expect(gableMaterial.customProgramCacheKey()).toBe(wallMaterial.customProgramCacheKey());
    expect(gableMaterial.userData.triplanarProjection).toEqual(
      wallMaterial.userData.triplanarProjection,
    );

    const plasterGroup = scene.groups.find((group) => group.name === 'plasterGroup');
    expect(plasterGroup).toBeDefined();
    expect(
      plasterGroup!.children.some((child) => child.name.includes('above-panel')),
    ).toBe(true);
    expect(
      plasterGroup!.children.some((child) => child.name.includes('below-panel')),
    ).toBe(false);
    const plasterMesh = plasterGroup!.children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh,
    );
    expect(plasterMesh).toBeDefined();
    const plasterMaterial = plasterMesh!.material as THREE.MeshStandardMaterial;
    expect(plasterMaterial.color.getHex()).toBe(
      library.plasterFinishTexturedPreview.color.getHex(),
    );
    expect(plasterMaterial.color.getHex()).not.toBe(library.cmuPreview.color.getHex());

    const normalMortarGroup = findGroupByName(scene.groups, 'mortarJointGroup');
    expect(normalMortarGroup).toBeDefined();
    const normalMortarMesh = firstInstancedMesh(normalMortarGroup!);
    expect(normalMortarMesh).toBeDefined();
    const normalMortarMaterial =
      normalMortarMesh!.material as THREE.MeshStandardMaterial;
    expect(normalMortarMaterial).toBe(library.mortarPreview);
    expect(normalMortarMaterial.customProgramCacheKey()).toContain('triplanar');

    const gableMortarGroup = findGroupByName(scene.groups, 'gableMortarJointGroup');
    expect(gableMortarGroup).toBeDefined();
    expect(gableMortarGroup!.renderOrder).toBe(CMU_GABLE_MORTAR_RENDER_ORDER);
    const gableMortarMesh = firstInstancedMesh(gableMortarGroup!);
    expect(gableMortarMesh).toBeDefined();
    const gableMortarMaterial =
      gableMortarMesh!.material as THREE.MeshStandardMaterial;
    expect(gableMortarMaterial.color.getHex()).toBe(library.mortarPreview.color.getHex());
    expect(gableMortarMaterial.map).toBe(library.mortarPreview.map);
    expect(gableMortarMaterial.normalMap).toBe(library.mortarPreview.normalMap);
    expect(gableMortarMaterial.roughnessMap).toBe(library.mortarPreview.roughnessMap);
    expect(gableMortarMaterial).not.toBe(normalMortarMaterial);
    expect(gableMortarMaterial.customProgramCacheKey()).toBe(
      normalMortarMaterial.customProgramCacheKey(),
    );
    expect(gableMortarMaterial.userData.triplanarProjection).toEqual(
      normalMortarMaterial.userData.triplanarProjection,
    );
    expect(gableMortarMaterial.polygonOffset).toBe(true);
    expect(gableMortarMaterial.depthWrite).toBe(false);
    expect(library.mortarPreview.map).toBe(sourceColorMap);
    expect(library.mortarPreview.normalMap).toBe(sourceNormalMap);
    expect(library.mortarPreview.roughnessMap).toBe(sourceRoughnessMap);

    resources.disposeTrackedResources();
    sourceCmuColorMap.dispose();
    sourceCmuRoughnessMap.dispose();
    sourceColorMap.dispose();
    sourceNormalMap.dispose();
    sourceRoughnessMap.dispose();
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

  it('renders gable CMU above plaster without disabling depth testing', () => {
    const resources = createDesignBuilderViewerResources();
    const gableBlocks = [
      cmuBlock({
        id: 'gable-a',
        source: 'gable_end_solver',
        segmentId: 'gable-segment',
        startAlongMeters: 0,
        endAlongMeters: 0.4,
        x: 0,
      }),
      cmuBlock({
        id: 'gable-b',
        source: 'gable_end_solver',
        segmentId: 'gable-segment',
        startAlongMeters: 0.4,
        endAlongMeters: 0.8,
        x: 0.4,
      }),
    ];
    const state = cmuInfillState({
      currentGeometry: geometryResult(gableBlocks),
    });

    const scene = buildDesignBuilderViewerCmuInfillScene({
      state,
      cmuLayout: state.currentGeometry!.wallCmuLayout,
      showCmuInfill: false,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    const gableGroup = scene.groups.find((group) => group.name === 'cmuGableBlockInstanceGroup');
    expect(gableGroup).toBeDefined();
    expect(gableGroup!.renderOrder).toBe(CMU_GABLE_BLOCK_RENDER_ORDER);

    const gableMesh = firstInstancedMesh(gableGroup!);
    expect(gableMesh).toBeDefined();
    expect((gableMesh!.material as THREE.Material).depthTest).toBe(true);
    expect((gableMesh!.material as THREE.Material).polygonOffset).toBe(true);
    expect(gableMesh!.renderOrder).toBe(CMU_GABLE_BLOCK_RENDER_ORDER);
    expect(readInstancedScale(gableMesh!).z).toBeCloseTo(
      0.15 + CMU_GABLE_FINISH_FACE_CLEARANCE_METERS * 2,
      6,
    );

    resources.disposeTrackedResources();
  });

  it('keeps gable CMU depth bias off regular infill CMU preview materials', () => {
    const resources = createDesignBuilderViewerResources();
    const state = cmuInfillState({
      usePreviewMaterials: true,
      currentVisualStyle: 'material_preview',
      currentGeometry: geometryResult([
        cmuBlock({ id: 'wall-block', source: 'rc_frame_infill' }),
        cmuBlock({ id: 'gable-block', source: 'gable_end_solver' }),
      ]),
    });

    const scene = buildDesignBuilderViewerCmuInfillScene({
      state,
      cmuLayout: state.currentGeometry!.wallCmuLayout,
      showCmuInfill: true,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    const wallGroup = scene.groups.find((group) => group.name === 'cmuBlockInstanceGroup');
    const gableGroup = scene.groups.find((group) => group.name === 'cmuGableBlockInstanceGroup');
    const wallMesh = wallGroup ? firstInstancedMesh(wallGroup) : null;
    const gableMesh = gableGroup ? firstInstancedMesh(gableGroup) : null;
    expect(wallMesh).toBeDefined();
    expect(gableMesh).toBeDefined();

    const wallMaterial = wallMesh!.material as THREE.MeshStandardMaterial;
    const gableMaterial = gableMesh!.material as THREE.MeshStandardMaterial;
    expect(wallMaterial).not.toBe(gableMaterial);
    expect(wallMaterial.polygonOffset).toBe(false);
    expect(gableMaterial.polygonOffset).toBe(true);
    expect(gableMaterial.polygonOffsetFactor).toBeLessThan(0);

    resources.disposeTrackedResources();
  });

  it('fades CMU and plaster context when the structural frame is selected', () => {
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
      frameSelected: true,
      cmuMaterialOptions: {
        visualStyle: 'material_preview',
        selected: false,
      },
    });

    const scene = buildDesignBuilderViewerCmuInfillScene({
      state,
      cmuLayout: state.currentGeometry!.wallCmuLayout,
      showCmuInfill: true,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    const blockGroup = scene.groups.find((group) => group.name === 'cmuBlockInstanceGroup');
    const plasterGroup = scene.groups.find((group) => group.name === 'plasterGroup');
    expect(blockGroup).toBeDefined();
    expect(plasterGroup).toBeDefined();

    const blockMesh = blockGroup!.children.find(
      (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
    );
    const plasterMesh = plasterGroup!.children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh,
    );
    expect(blockMesh).toBeDefined();
    expect(plasterMesh).toBeDefined();

    const blockMaterial = blockMesh!.material as THREE.MeshStandardMaterial;
    expect(blockMaterial.transparent).toBe(true);
    expect(blockMaterial.opacity).toBeCloseTo(0.32, 6);
    expect(blockMaterial.depthWrite).toBe(false);

    const plasterMaterial = plasterMesh!.material as THREE.MeshStandardMaterial;
    expect(plasterMaterial.transparent).toBe(true);
    expect(plasterMaterial.opacity).toBeCloseTo(0.28, 6);
    expect(plasterMaterial.depthWrite).toBe(false);

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
