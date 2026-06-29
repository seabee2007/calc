import * as THREE from 'three';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import type { PlasterOpening } from '../domain/infillPlaster';
import type { CmuBlockInstance, CmuLayoutResult } from '../geometry/designGeometry';
import { buildMortarJointMeshes } from '../rendering/materials/cmuMortarJointRender';
import type { MortarJointDiagnostics } from '../rendering/materials/cmuMortarJointInstances';
import {
  resolveCmuMaterial,
  resolvePlasterFinishMaterial,
} from '../rendering/materials/designMaterialLibrary';
import type { DesignObjectType } from '../types';
import {
  blockColor,
  buildCmuBlockInstanceSceneGroup,
  buildInfillPlasterSceneGroup,
  buildInfillWallProxySceneGroup,
  resolveVisibleCmuBlockInstances,
} from './DesignBuilderWallScene';
import type { DesignBuilderViewerRebuildState } from './DesignBuilderViewerRebuildState';
import { selectionPriorityForObjectType } from './DesignBuilderViewerSceneRegistry';

type TrackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => T;
type TrackMaterial = <T extends THREE.Material>(material: T) => T;
type MakeMaterial = (
  color: number,
  selected: boolean,
  options?: THREE.MeshStandardMaterialParameters,
) => THREE.MeshStandardMaterial;

export type DesignBuilderViewerCmuInfillState = Pick<
  DesignBuilderViewerRebuildState,
  | 'currentGeometry'
  | 'currentWall'
  | 'currentSlab'
  | 'currentSelectedObjectType'
  | 'currentVisualStyle'
  | 'currentRoofDisplayMode'
  | 'currentRoofLayerVisibility'
  | 'usePreviewMaterials'
  | 'frameSelected'
  | 'cmuSelected'
  | 'cmuCutawayActive'
  | 'cmuOpacity'
  | 'cmuMaterialOptions'
>;

export interface DesignBuilderViewerCmuMortarScene {
  group: THREE.Group;
  diagnostics: MortarJointDiagnostics | null;
}

export interface DesignBuilderViewerCmuInfillScene {
  groups: THREE.Group[];
  selectableObjects: THREE.Object3D[];
  mortarDiagnostics: MortarJointDiagnostics | null;
}

const FRAME_SELECTION_CMU_CONTEXT_OPACITY = 0.32;
const FRAME_SELECTION_PLASTER_CONTEXT_OPACITY = 0.28;

export function buildDesignBuilderViewerCmuMortarScene(params: {
  blocks: readonly CmuBlockInstance[];
  wall: DesignBuilderViewerCmuInfillState['currentWall'];
  slabTopMeters: number;
  visualStyle: DesignBuilderViewerCmuInfillState['currentVisualStyle'];
  cmuCutawayActive: boolean;
  cmuOpacity: number;
  debugMode: boolean;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
}): DesignBuilderViewerCmuMortarScene {
  const group = new THREE.Group();
  group.name = 'cmuMortarJointRoot';
  if (params.blocks.length === 0) {
    return { group, diagnostics: null };
  }
  const moduleConfig = resolveCmuModuleConfig(params.wall);
  const mortarMaterialOptions = {
    visualStyle: params.visualStyle,
    selected: false,
    ...(params.cmuCutawayActive ? { transparent: true as const, opacity: params.cmuOpacity } : {}),
  };
  const { group: mortarGroup, diagnostics } = buildMortarJointMeshes({
    blocks: params.blocks,
    mortarJointMeters: moduleConfig.mortarJointMeters,
    defaultBlockDepthMeters: params.wall.blockDepthMeters ?? params.wall.wallThicknessMeters,
    defaultBlockHeightMeters: moduleConfig.actualHeightMeters ?? moduleConfig.moduleHeightMeters,
    slabTopMeters: params.slabTopMeters,
    materialOptions: mortarMaterialOptions,
    debugMode: params.debugMode,
    trackGeometry: params.trackGeometry,
    trackMaterial: params.trackMaterial,
  });
  if (mortarGroup.children.length > 0) group.add(mortarGroup);
  return { group, diagnostics };
}

function markSelectableGroup(params: {
  group: THREE.Group;
  objectType: DesignObjectType;
  selectableObjects: THREE.Object3D[];
}): void {
  const priority = selectionPriorityForObjectType(params.objectType);
  params.group.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
      child.userData.selectable = true;
      child.userData.designObjectType = params.objectType;
      child.userData.selectionPriority = priority;
      params.selectableObjects.push(child);
    }
  });
}

export function buildDesignBuilderViewerCmuInfillScene(params: {
  state: DesignBuilderViewerCmuInfillState;
  cmuLayout: CmuLayoutResult;
  showCmuInfill: boolean;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
  makeMaterial: MakeMaterial;
}): DesignBuilderViewerCmuInfillScene {
  const state = params.state;
  const geometry = state.currentGeometry;
  const groups: THREE.Group[] = [];
  const selectableObjects: THREE.Object3D[] = [];
  if (!geometry) {
    return { groups, selectableObjects, mortarDiagnostics: null };
  }

  const blockInstances = resolveVisibleCmuBlockInstances({
    showCmuInfill: params.showCmuInfill,
    showIndividualBlocks: state.currentWall.showIndividualBlocks,
    roofDisplayMode: state.currentRoofDisplayMode,
    roofLayerVisibility: state.currentRoofLayerVisibility,
    blockInstances: geometry.wallCmuLayout.blocks,
  });
  const fadeCmuForFrameSelection = state.frameSelected && !state.cmuSelected;
  const effectiveCmuOpacity = fadeCmuForFrameSelection
    ? FRAME_SELECTION_CMU_CONTEXT_OPACITY
    : state.cmuOpacity;
  const effectiveCmuMaterialOptions = fadeCmuForFrameSelection
    ? {
        ...state.cmuMaterialOptions,
        selected: false,
        transparent: true as const,
        opacity: effectiveCmuOpacity,
      }
    : state.cmuMaterialOptions;

  const mortarScene = buildDesignBuilderViewerCmuMortarScene({
    blocks: blockInstances,
    wall: state.currentWall,
    slabTopMeters: state.currentSlab.slabThicknessMeters,
    visualStyle: state.currentVisualStyle,
    cmuCutawayActive: state.cmuCutawayActive || fadeCmuForFrameSelection,
    cmuOpacity: effectiveCmuOpacity,
    debugMode: false,
    trackGeometry: params.trackGeometry,
    trackMaterial: params.trackMaterial,
  });
  if (mortarScene.group.children.length > 0) groups.push(mortarScene.group);

  if (blockInstances.length > 0) {
    const blockModule = resolveCmuModuleConfig(state.currentWall);
    const blockHeightMeters = blockModule.actualHeightMeters ?? blockModule.moduleHeightMeters;
    const cmuBlockGroup = buildCmuBlockInstanceSceneGroup({
      blockInstances,
      blockHeightMeters,
      defaultBlockDepthMeters: state.currentWall.blockDepthMeters,
      slabTopMeters: state.currentSlab.slabThicknessMeters,
      createMaterial: (blockType) =>
        state.usePreviewMaterials
          ? resolveCmuMaterial(effectiveCmuMaterialOptions, params.trackMaterial)
          : params.makeMaterial(blockColor(blockType), state.cmuSelected, {
              transparent: effectiveCmuOpacity < 1,
              opacity: effectiveCmuOpacity,
              ...(fadeCmuForFrameSelection ? { depthWrite: false } : {}),
            }),
      trackGeometry: params.trackGeometry,
    });
    markSelectableGroup({
      group: cmuBlockGroup,
      objectType: 'cmu_wall_system',
      selectableObjects,
    });
    groups.push(cmuBlockGroup);
  }

  if (params.showCmuInfill && !state.currentWall.showIndividualBlocks) {
    const wallMaterial = params.makeMaterial(
      0xd1d5db,
      state.currentSelectedObjectType === 'cmu_wall_system',
      {
        transparent: true,
        opacity: effectiveCmuOpacity,
        ...(fadeCmuForFrameSelection ? { depthWrite: false } : {}),
      },
    );
    const infillWallProxyGroup = buildInfillWallProxySceneGroup({
      wallSegments: geometry.wallSegments,
      segmentFrames: params.cmuLayout.segmentFrames,
      resolvedInfillPanelBounds: geometry.resolvedInfillPanelBounds,
      openings: params.cmuLayout.roughOpenings as PlasterOpening[],
      slabTopMeters: state.currentSlab.slabThicknessMeters,
      material: wallMaterial,
      trackGeometry: params.trackGeometry,
    });
    markSelectableGroup({
      group: infillWallProxyGroup,
      objectType: 'cmu_wall_system',
      selectableObjects,
    });
    if (infillWallProxyGroup.children.length > 0) groups.push(infillWallProxyGroup);
  }

  if (params.showCmuInfill) {
    const fadePlasterForCmuSelection = state.cmuSelected || fadeCmuForFrameSelection;
    const exteriorSegmentIds = new Set(
      (geometry.resolvedFootprint?.orderedPerimeterSegments ?? []).map(
        (segment) => segment.segmentId,
      ),
    );
    const plasterGroup = buildInfillPlasterSceneGroup({
      infillSystem: geometry.infillSystem,
      panelBounds: geometry.resolvedInfillPanelBounds ?? [],
      openings: params.cmuLayout.roughOpenings as PlasterOpening[],
      wallThicknessMeters: state.currentWall.wallThicknessMeters,
      exteriorSegmentIds,
      slabTopMeters: state.currentSlab.slabThicknessMeters,
      createMaterial: (finish) =>
        state.usePreviewMaterials
          ? resolvePlasterFinishMaterial(
              {
                visualStyle: state.currentVisualStyle,
                selected: state.currentSelectedObjectType === 'cmu_infill_system',
                ...(fadePlasterForCmuSelection
                  ? { transparent: true, opacity: FRAME_SELECTION_PLASTER_CONTEXT_OPACITY }
                  : {}),
                plasterFinish: finish,
              },
              params.trackMaterial,
            )
          : params.makeMaterial(
              finish === 'smooth' ? 0xded8cf : 0xd8d1c5,
              state.currentSelectedObjectType === 'cmu_infill_system',
              {
                side: THREE.DoubleSide,
                ...(fadePlasterForCmuSelection
                  ? {
                      transparent: true,
                      opacity: FRAME_SELECTION_PLASTER_CONTEXT_OPACITY,
                      depthWrite: false,
                    }
                  : {}),
              },
            ),
      trackGeometry: params.trackGeometry,
    });
    markSelectableGroup({
      group: plasterGroup,
      objectType: 'cmu_infill_system',
      selectableObjects,
    });
    if (plasterGroup.children.length > 0) groups.push(plasterGroup);
  }

  return {
    groups,
    selectableObjects,
    mortarDiagnostics: mortarScene.diagnostics,
  };
}
