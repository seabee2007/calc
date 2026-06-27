import * as THREE from 'three';
import { TOP_OF_PLINTH_BEAM_Y } from '../domain/foundationElevations';
import { buildDesignRenderModel } from '../domain/designRenderModel';
import { buildSupplementalRcComponentSceneGroup } from './DesignBuilderSupplementalStructureScene';
import {
  collectStructuralFrameSelectables,
  resolveRcConcreteMaterial,
  resolveRcPlasterMaterial,
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
  const supplementalPlaster = state.currentGeometry?.infillSystem?.plaster;
  const useSupplementalPlasterFinish =
    state.currentFoundationViewMode !== 'structural_frame_only' &&
    Boolean(supplementalPlaster?.enabled);
  const supplementalPlasterFinish = supplementalPlaster?.finish ?? 'textured';
  const supplementalPlinthTopElevationMeters =
    state.currentGeometry?.frameSystem?.beams.find((beam) => beam.kind === 'plinth_beam')
      ?.topElevationMeters ?? TOP_OF_PLINTH_BEAM_Y;
  const resolveSupplementalPlasterMaterial = (selected: boolean) =>
    resolveRcPlasterMaterial({ ...materialContext, selected }, {
      plasterFinish: supplementalPlasterFinish,
    });

  const group = buildSupplementalRcComponentSceneGroup({
    renderModel: supplementalRenderModel,
    slabTopMeters: state.currentSlab.slabThicknessMeters,
    useSupplementalPlasterFinish,
    supplementalPlinthTopElevationMeters,
    materials: {
      structural: structuralMaterial,
      footing: footingMaterial,
      beam: beamMaterial,
      createPlaster: () => resolveSupplementalPlasterMaterial(state.frameSelected),
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
