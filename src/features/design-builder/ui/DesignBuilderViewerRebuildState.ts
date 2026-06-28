import type { DesignGeometryResult } from '../geometry/designGeometry';
import type {
  CmuWallSystemParameters,
  DesignObjectType,
  FoundationViewMode,
  GableRoofSystemParameters,
  PlacedDesignComponent,
  RoofDisplayMode,
  RoofLayerVisibility,
  RoofSystemSettings,
  SteelTrussSystemParameters,
  ThickenedEdgeSlabParameters,
  DesignVisualStyle,
} from '../types';
import type { PlumbingSelection, PlumbingSystem } from '../plumbing';
import type { Plumbing3DVisibility } from '../plumbing/three/plumbingThreeUtils';
import type { DesignLayoutBounds } from '../domain/designLayoutBounds';
import type { DesignRenderModel } from '../domain/designRenderModel';
import type { ResolveDesignMaterialOptions } from '../rendering/materials/designMaterialLibrary';

export interface DesignBuilderViewerModelParams {
  modelLoaded: boolean;
  slab: ThickenedEdgeSlabParameters;
  wall: CmuWallSystemParameters;
  roof: GableRoofSystemParameters;
  truss: SteelTrussSystemParameters;
  geometryResult?: DesignGeometryResult;
  layoutBounds?: DesignLayoutBounds | null;
  placedComponents?: readonly PlacedDesignComponent[];
  plumbingSystem?: PlumbingSystem;
  selectedPlumbingObject?: PlumbingSelection | null;
  plumbing3DVisibility?: Plumbing3DVisibility;
  selectedSepticTankId?: string | null;
  designRenderModel?: DesignRenderModel;
  selectedObjectType: DesignObjectType | null;
  showOpeningLayout: boolean;
  showGroutCells: boolean;
  showClosureWarnings: boolean;
  showRoofReferencePerimeters: boolean;
  showRoofFramingGuides: boolean;
  showRoofDebug: boolean;
  foundationViewMode: FoundationViewMode;
  visualStyle: DesignVisualStyle;
  roofSystem?: RoofSystemSettings | null;
  roofDisplayMode: RoofDisplayMode;
  roofLayerVisibility: RoofLayerVisibility;
}

export interface DesignBuilderViewerSceneSize {
  length: number;
  width: number;
  height: number;
}

export interface DesignBuilderViewerRebuildState {
  currentWall: CmuWallSystemParameters;
  currentSlab: ThickenedEdgeSlabParameters;
  currentRoof: GableRoofSystemParameters;
  currentTruss: SteelTrussSystemParameters;
  currentGeometry?: DesignGeometryResult;
  currentLayoutBounds: DesignLayoutBounds | null;
  currentPlacedComponents?: readonly PlacedDesignComponent[];
  currentPlumbingSystem?: PlumbingSystem;
  currentSelectedPlumbingObject?: PlumbingSelection | null;
  currentPlumbing3DVisibility?: Plumbing3DVisibility;
  currentSelectedSepticTankId?: string | null;
  currentDesignRenderModel?: DesignRenderModel;
  currentSelectedObjectType: DesignObjectType | null;
  currentShowOpeningLayout: boolean;
  currentShowGroutCells: boolean;
  currentShowClosureWarnings: boolean;
  currentShowRoofReferencePerimeters: boolean;
  currentShowRoofFramingGuides: boolean;
  currentShowRoofDebug: boolean;
  currentFoundationViewMode: FoundationViewMode;
  currentVisualStyle: DesignVisualStyle;
  currentRoofSystem?: RoofSystemSettings | null;
  currentRoofDisplayMode: RoofDisplayMode;
  currentRoofLayerVisibility: RoofLayerVisibility;
  usePreviewMaterials: boolean;
  frameSelected: boolean;
  cmuSelected: boolean;
  roofSelected: boolean;
  gableSelected: boolean;
  cmuCutawayActive: boolean;
  cmuOpacity: number;
  cmuMaterialOptions: ResolveDesignMaterialOptions;
  blankGeometryActive: boolean;
  sceneSize: DesignBuilderViewerSceneSize;
}

export function resolveDesignBuilderViewerSceneSize(params: {
  wall: CmuWallSystemParameters;
  slab: ThickenedEdgeSlabParameters;
  roof: GableRoofSystemParameters;
  blankGeometryActive: boolean;
}): DesignBuilderViewerSceneSize {
  if (params.blankGeometryActive) {
    return { length: 6, width: 6, height: 2 };
  }
  return {
    length: params.wall.lengthMeters,
    width: params.wall.widthMeters,
    height:
      params.slab.slabThicknessMeters +
      params.wall.heightMeters +
      (params.roof.widthMeters / 2 + params.roof.overhangMeters) *
        params.roof.pitchRisePerRun,
  };
}

export function createDesignBuilderViewerRebuildState(params: {
  modelParams: DesignBuilderViewerModelParams;
  previewMaterialsReady: boolean;
}): DesignBuilderViewerRebuildState {
  const modelParams = params.modelParams;
  const usePreviewMaterials = modelParams.visualStyle === 'material_preview';
  const frameSelected = modelParams.selectedObjectType === 'structural_frame_system';
  const cmuSelected = modelParams.selectedObjectType === 'cmu_wall_system';
  const roofSelected = modelParams.selectedObjectType === 'gable_roof_system';
  const gableSelected = modelParams.selectedObjectType === 'gable_end_system';
  const cmuCutawayActive = modelParams.foundationViewMode === 'cutaway_below_grade';
  const cmuOpacity = cmuCutawayActive ? 0.35 : usePreviewMaterials ? 1 : 0.9;
  const blankGeometryActive = modelParams.geometryResult?.sourcePath === 'blank';
  return {
    currentWall: modelParams.wall,
    currentSlab: modelParams.slab,
    currentRoof: modelParams.roof,
    currentTruss: modelParams.truss,
    currentGeometry: modelParams.geometryResult,
    currentLayoutBounds: modelParams.layoutBounds ?? null,
    currentPlacedComponents: modelParams.placedComponents,
    currentPlumbingSystem: modelParams.plumbingSystem,
    currentSelectedPlumbingObject: modelParams.selectedPlumbingObject ?? null,
    currentPlumbing3DVisibility: modelParams.plumbing3DVisibility,
    currentSelectedSepticTankId: modelParams.selectedSepticTankId ?? null,
    currentDesignRenderModel: modelParams.designRenderModel,
    currentSelectedObjectType: modelParams.selectedObjectType,
    currentShowOpeningLayout: modelParams.showOpeningLayout,
    currentShowGroutCells: modelParams.showGroutCells,
    currentShowClosureWarnings: modelParams.showClosureWarnings,
    currentShowRoofReferencePerimeters: modelParams.showRoofReferencePerimeters,
    currentShowRoofFramingGuides: modelParams.showRoofFramingGuides,
    currentShowRoofDebug: modelParams.showRoofDebug,
    currentFoundationViewMode: modelParams.foundationViewMode,
    currentVisualStyle: modelParams.visualStyle,
    currentRoofSystem: modelParams.roofSystem,
    currentRoofDisplayMode: modelParams.roofDisplayMode,
    currentRoofLayerVisibility: modelParams.roofLayerVisibility,
    usePreviewMaterials,
    frameSelected,
    cmuSelected,
    roofSelected,
    gableSelected,
    cmuCutawayActive,
    cmuOpacity,
    cmuMaterialOptions: {
      visualStyle: modelParams.visualStyle,
      selected: cmuSelected,
      ...(cmuCutawayActive ? { transparent: true, opacity: cmuOpacity } : {}),
    },
    blankGeometryActive,
    sceneSize: resolveDesignBuilderViewerSceneSize({
      wall: modelParams.wall,
      slab: modelParams.slab,
      roof: modelParams.roof,
      blankGeometryActive,
    }),
  };
}
