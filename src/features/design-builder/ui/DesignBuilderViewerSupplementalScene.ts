import * as THREE from 'three';
import { buildDesignRenderModel } from '../domain/designRenderModel';
import { buildSupplementalRcComponentSceneGroup } from './DesignBuilderSupplementalStructureScene';
import {
  collectStructuralFrameSelectables,
  resolveRcConcreteMaterial,
  type MakeMaterial,
  type TrackGeometry,
  type TrackMaterial,
} from './DesignBuilderViewerRcScene';
import type { DesignBuilderViewerRebuildState } from './DesignBuilderViewerRebuildState';

export type DesignBuilderViewerSupplementalState = Pick<
  DesignBuilderViewerRebuildState,
  | 'currentDesignRenderModel'
  | 'currentPlacedComponents'
  | 'currentLayoutBounds'
  | 'currentGeometry'
  | 'currentSlab'
  | 'currentFoundationViewMode'
  | 'currentVisualStyle'
  | 'usePreviewMaterials'
  | 'frameSelected'
>;

export interface DesignBuilderViewerSupplementalScene {
  group: THREE.Group;
  selectableObjects: THREE.Object3D[];
}

export function buildDesignBuilderViewerSupplementalScene(params: {
  state: DesignBuilderViewerSupplementalState;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
  makeMaterial: MakeMaterial;
}): DesignBuilderViewerSupplementalScene {
  const state = params.state;
  const supplementalRenderModel =
    state.currentDesignRenderModel ??
    buildDesignRenderModel({
      placedComponents: state.currentPlacedComponents,
      layoutBounds: state.currentLayoutBounds,
    });
  const selectableObjects: THREE.Object3D[] = [];
  if (supplementalRenderModel.rcComponents.length === 0) {
    return { group: new THREE.Group(), selectableObjects };
  }

  const materialContext = {
    visualStyle: state.currentVisualStyle,
    selected: state.frameSelected,
    usePreviewMaterials: state.usePreviewMaterials,
    trackMaterial: params.trackMaterial,
    makeMaterial: params.makeMaterial,
  };
  const structuralMaterial = resolveRcConcreteMaterial(materialContext, {
    role: 'structural',
    technicalColor: 0xcbd5e1,
    technicalOptions: {
        roughness: 0.82,
    },
  });
  const footingMaterial = resolveRcConcreteMaterial(materialContext, {
    role: 'structural',
    technicalColor: 0x78716c,
    technicalOptions: {
        roughness: 0.9,
    },
  });
  const beamMaterial = resolveRcConcreteMaterial(materialContext, {
    role: 'beam',
    technicalColor: 0x94a3b8,
    technicalOptions: {
        roughness: 0.82,
    },
  });
  const group = buildSupplementalRcComponentSceneGroup({
    renderModel: supplementalRenderModel,
    slabTopMeters: state.currentSlab.slabThicknessMeters,
    useSupplementalPlasterFinish: false,
    supplementalPlinthTopElevationMeters: 0,
    materials: {
      structural: structuralMaterial,
      footing: footingMaterial,
      beam: beamMaterial,
      createPlaster: () => structuralMaterial,
    },
    trackGeometry: params.trackGeometry,
  });

  if (group.children.length === 0) {
    return { group, selectableObjects };
  }

  return {
    group,
    selectableObjects: collectStructuralFrameSelectables({
      group,
      preserveExistingPriority: true,
    }),
  };
}
