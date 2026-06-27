import * as THREE from 'three';
import type { DesignGeometryResult } from '../geometry/designGeometry';
import {
  resolveFloorGroutMaterial,
  resolveFloorThinsetMaterial,
  resolveFloorTileMaterial,
  resolveSoffitTrimMaterial,
  resolveStructuralSteelMaterial,
} from '../rendering/materials/designMaterialLibrary';
import {
  buildFloorTileSceneGroup,
  buildPlywoodCeilingSceneGroup,
  parsePlywoodColor,
} from './DesignBuilderInteriorFinishScene';
import type { DesignBuilderViewerRebuildState } from './DesignBuilderViewerRebuildState';

type TrackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => T;
type TrackMaterial = <T extends THREE.Material>(material: T) => T;
type MakeMaterial = (
  color: number,
  selected: boolean,
  options?: THREE.MeshStandardMaterialParameters,
) => THREE.MeshStandardMaterial;

export type DesignBuilderViewerInteriorFinishState = Omit<
  Pick<
    DesignBuilderViewerRebuildState,
    | 'currentGeometry'
    | 'currentSlab'
    | 'currentVisualStyle'
    | 'usePreviewMaterials'
    | 'frameSelected'
  >,
  'currentGeometry'
> & {
  currentGeometry: DesignGeometryResult;
};

export interface DesignBuilderViewerInteriorFinishScene {
  groups: THREE.Group[];
}

export function buildDesignBuilderViewerInteriorFinishScene(params: {
  state: DesignBuilderViewerInteriorFinishState;
  showCmuInfill: boolean;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
  makeMaterial: MakeMaterial;
}): DesignBuilderViewerInteriorFinishScene {
  const state = params.state;
  const geometry = state.currentGeometry;
  const interiorFloorSlab = geometry.interiorFloorSlab;
  const interiorFacePolygon = geometry.resolvedFootprint?.interiorFacePolygon;
  const groups: THREE.Group[] = [];

  if (!params.showCmuInfill || !interiorFloorSlab?.enabled || !interiorFacePolygon?.length) {
    return { groups };
  }

  const floorTileLayout = geometry.floorTileLayout;
  if (floorTileLayout?.enabled) {
    const thinsetMaterial = state.usePreviewMaterials
      ? resolveFloorThinsetMaterial(
          { visualStyle: state.currentVisualStyle, selected: state.frameSelected },
          params.trackMaterial,
        )
      : params.makeMaterial(0xc9b896, state.frameSelected, {
          roughness: 0.92,
        });
    const groutMaterial = state.usePreviewMaterials
      ? resolveFloorGroutMaterial(
          { visualStyle: state.currentVisualStyle, selected: state.frameSelected },
          params.trackMaterial,
        )
      : params.makeMaterial(0xf5f5f0, state.frameSelected, {
          roughness: 0.88,
        });
    const tileMaterial = state.usePreviewMaterials
      ? resolveFloorTileMaterial(
          {
            visualStyle: state.currentVisualStyle,
            selected: state.frameSelected,
            tileWidthMeters: floorTileLayout.tileWidthMeters,
            tileDepthMeters: floorTileLayout.tileDepthMeters,
          },
          params.trackMaterial,
        )
      : params.makeMaterial(0x9a9590, state.frameSelected, {
          roughness: 0.45,
        });
    const floorTileGroup = buildFloorTileSceneGroup({
      floorTileLayout,
      interiorFacePolygon,
      slabTopMeters: state.currentSlab.slabThicknessMeters,
      interiorFloorSlabTopElevationMeters: interiorFloorSlab.topElevationMeters,
      materials: {
        thinset: thinsetMaterial,
        grout: groutMaterial,
        tile: tileMaterial,
      },
      trackGeometry: params.trackGeometry,
    });
    if (floorTileGroup.children.length > 0) groups.push(floorTileGroup);
  }

  const plywoodCeilingLayout = geometry.plywoodCeilingLayout;
  if (plywoodCeilingLayout?.enabled) {
    const frameMaterial = state.usePreviewMaterials
      ? resolveStructuralSteelMaterial(
          { visualStyle: state.currentVisualStyle, selected: state.frameSelected },
          params.trackMaterial,
        )
      : params.makeMaterial(0x374151, state.frameSelected, {
          roughness: 0.55,
          metalness: 0.35,
        });
    const plywoodColor = parsePlywoodColor(plywoodCeilingLayout.plywoodColor);
    const plywoodMaterial = state.usePreviewMaterials
      ? resolveSoffitTrimMaterial(
          { visualStyle: state.currentVisualStyle, selected: state.frameSelected },
          params.trackMaterial,
        )
      : params.makeMaterial(plywoodColor, state.frameSelected, {
          roughness: 0.72,
          metalness: 0.02,
        });
    if (state.usePreviewMaterials) {
      plywoodMaterial.color.setHex(plywoodColor);
    }
    const plywoodCeilingGroup = buildPlywoodCeilingSceneGroup({
      plywoodCeilingLayout,
      slabTopMeters: state.currentSlab.slabThicknessMeters,
      materials: {
        frame: frameMaterial,
        plywood: plywoodMaterial,
      },
      trackGeometry: params.trackGeometry,
    });
    if (plywoodCeilingGroup.children.length > 0) groups.push(plywoodCeilingGroup);
  }

  return { groups };
}
