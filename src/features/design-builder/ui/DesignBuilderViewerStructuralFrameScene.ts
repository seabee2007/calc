import * as THREE from 'three';
import { normalizeCmuInfillSystem } from '../domain/infillPlaster';
import type { DesignGeometryResult } from '../geometry/designGeometry';
import { buildResolvedStructuralFrameSceneGroup } from './DesignBuilderStructuralScene';
import {
  collectStructuralFrameSelectables,
  resolveRcConcreteMaterial,
  resolveRcPlasterMaterial,
  type MakeMaterial,
  type TrackGeometry,
  type TrackMaterial,
} from './DesignBuilderViewerRcScene';
import type { DesignBuilderViewerRebuildState } from './DesignBuilderViewerRebuildState';

export type DesignBuilderViewerStructuralFrameState = Omit<
  Pick<
    DesignBuilderViewerRebuildState,
    | 'currentGeometry'
    | 'currentSlab'
    | 'currentVisualStyle'
    | 'usePreviewMaterials'
    | 'frameSelected'
    | 'belowGradeCutawayActive'
  >,
  'currentGeometry'
> & {
  currentGeometry: DesignGeometryResult;
};

export interface DesignBuilderViewerStructuralFrameScene {
  group: THREE.Group;
  selectableObjects: THREE.Object3D[];
}

export function buildDesignBuilderViewerStructuralFrameScene(params: {
  state: DesignBuilderViewerStructuralFrameState;
  showCmuInfill: boolean;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
  makeMaterial: MakeMaterial;
}): DesignBuilderViewerStructuralFrameScene {
  const state = params.state;
  const geometry = state.currentGeometry;
  const frameSystem = geometry.frameSystem;
  const plaster = geometry.infillSystem
    ? normalizeCmuInfillSystem(geometry.infillSystem).plaster
    : null;
  const useFramePlasterFinish = params.showCmuInfill && Boolean(plaster?.enabled || plaster?.interiorEnabled);
  const plasterFinish = plaster?.enabled ? plaster.finish : (plaster?.interiorFinish ?? 'textured');
  const materialContext = {
    visualStyle: state.currentVisualStyle,
    selected: state.frameSelected,
    usePreviewMaterials: state.usePreviewMaterials,
    trackMaterial: params.trackMaterial,
    makeMaterial: params.makeMaterial,
  };
  const resolveFramePlasterMaterial = (selected: boolean) =>
    resolveRcPlasterMaterial({ ...materialContext, selected }, { plasterFinish });
  const columnConcreteMaterial = resolveRcConcreteMaterial(materialContext, {
    role: 'structural',
    technicalColor: 0x9ca3af,
    technicalOptions: {
        roughness: 0.85,
    },
  });
  const interiorFloorSlab = geometry.interiorFloorSlab;
  const interiorFloorSlabFootprint = interiorFloorSlab?.footprintPolygon?.length
    ? interiorFloorSlab.footprintPolygon
    : geometry.resolvedFootprint?.interiorFacePolygon;
  const beamMaterial = frameSystem?.beams.length
    ? resolveRcConcreteMaterial(materialContext, {
        role: 'beam',
        technicalColor: 0x6b7280,
        technicalOptions: {
          roughness: 0.8,
        },
      })
    : columnConcreteMaterial;
  const plinthBeamMaterial = frameSystem?.beams.length
    ? resolveRcConcreteMaterial(materialContext, {
        role: 'beam',
        technicalColor: 0x57534e,
        technicalOptions: {
          roughness: 0.85,
        },
      })
    : columnConcreteMaterial;
  const tieBeamMaterial = frameSystem?.beams.length
    ? resolveRcConcreteMaterial(materialContext, {
        role: 'beam',
        technicalColor: 0x44403c,
        technicalOptions: {
          roughness: 0.85,
        },
      })
    : columnConcreteMaterial;
  const roofBeamMaterial = frameSystem?.beams.length
    ? resolveRcConcreteMaterial(materialContext, {
        role: 'beam',
        technicalColor: 0x6b7280,
        technicalOptions: {
          roughness: 0.8,
        },
      })
    : columnConcreteMaterial;
  const footingMaterial = geometry.isolatedFootings?.length
    ? resolveRcConcreteMaterial(materialContext, {
        role: 'structural',
        technicalColor: 0x78716c,
        technicalOptions: {
          roughness: 0.9,
        },
      })
    : columnConcreteMaterial;
  const interiorSlabMaterial =
    interiorFloorSlab?.enabled && interiorFloorSlabFootprint?.length
      ? resolveRcConcreteMaterial(materialContext, {
          role: 'structural',
          technicalColor: 0x78716c,
          technicalOptions: {
            roughness: 0.92,
            metalness: 0.02,
            ...(state.belowGradeCutawayActive
              ? {
                  transparent: true,
                  opacity: 0.32,
                  depthWrite: false,
                }
              : {}),
          },
          ...(state.belowGradeCutawayActive
            ? {
                transparent: true,
                opacity: 0.32,
              }
            : {}),
        })
      : columnConcreteMaterial;

  const group = buildResolvedStructuralFrameSceneGroup({
    frameSystem,
    isolatedFootings: geometry.isolatedFootings,
    wallFootings: geometry.wallFootings,
    interiorFloorSlab,
    interiorFacePolygon: interiorFloorSlabFootprint,
    slabTopMeters: state.currentSlab.slabThicknessMeters,
    useFramePlasterFinish,
    hideAbovePlinth: state.belowGradeCutawayActive,
    materials: {
      columnConcrete: columnConcreteMaterial,
      beam: beamMaterial,
      plinthBeam: plinthBeamMaterial,
      tieBeam: tieBeamMaterial,
      roofBeam: roofBeamMaterial,
      footing: footingMaterial,
      interiorSlab: interiorSlabMaterial,
      createPlaster: () => resolveFramePlasterMaterial(state.frameSelected),
    },
    trackGeometry: params.trackGeometry,
  });

  if (group.children.length === 0) {
    return { group, selectableObjects: [] };
  }

  return { group, selectableObjects: collectStructuralFrameSelectables({ group }) };
}
