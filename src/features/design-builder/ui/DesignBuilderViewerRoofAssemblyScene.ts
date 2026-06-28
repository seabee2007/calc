import * as THREE from 'three';
import { DEFAULT_ROOF_LAYER_VISIBILITY } from '../domain/roofSystemDefaults';
import { buildSegmentFrameMap } from '../domain/openingPlacementResolver';
import {
  createCorrugatedMetalMaterial,
  createRakedConcreteCapMaterial,
  createRidgeCapMaterial,
  createSteelTrussMaterials,
} from '../geometry/roofRenderingGeometry';
import {
  resolveCastConcreteMaterial,
  resolveFasciaTrimMaterial,
  resolveRoofCladdingUvOptions,
  resolveRoofMetalMaterial,
  resolveSoffitTrimMaterial,
  resolveStructuralSteelMaterial,
} from '../rendering/materials/designMaterialLibrary';
import type { DesignObjectType, RoofDisplayMode, RoofLayerVisibility } from '../types';
import {
  buildFasciaSceneGroup,
  buildGableRidgeGuideSceneGroup,
  buildHipFramingSceneGroup,
  buildPurlinSceneGroups,
  buildRakedCapSceneGroup,
  buildRidgeCapSceneGroup,
  buildRoofCladdingSceneGroup,
  buildSoffitSceneGroup,
  buildSteelTrussSceneGroups,
} from './DesignBuilderRoofScene';
import type { DesignBuilderViewerRebuildState } from './DesignBuilderViewerRebuildState';
import { selectionPriorityForObjectType } from './DesignBuilderViewerSceneRegistry';

type TrackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => T;
type TrackMaterial = <T extends THREE.Material>(material: T) => T;
type MakeMaterial = (
  color: number,
  selected: boolean,
  options?: THREE.MeshStandardMaterialParameters,
) => THREE.MeshStandardMaterial;

export interface DesignBuilderRoofAssemblyVisibility {
  showRoofCladding: boolean;
  showRoofFraming: boolean;
  showSteelTrusses: boolean;
  showPurlins: boolean;
  showRidgeCap: boolean;
  showFascia: boolean;
  showSoffit: boolean;
  showGableMasonry: boolean;
  showRakedCap: boolean;
}

export type DesignBuilderViewerRoofAssemblyState = Pick<
  DesignBuilderViewerRebuildState,
  | 'currentGeometry'
  | 'currentSlab'
  | 'currentVisualStyle'
  | 'currentRoofSystem'
  | 'currentRoofDisplayMode'
  | 'currentRoofLayerVisibility'
  | 'currentShowRoofFramingGuides'
  | 'usePreviewMaterials'
  | 'roofSelected'
  | 'gableSelected'
>;

export interface DesignBuilderViewerRoofAssemblyScene {
  groups: THREE.Group[];
  selectableObjects: THREE.Object3D[];
}

export function resolveDesignBuilderRoofAssemblyVisibility(params: {
  roofDisplayMode: RoofDisplayMode;
  roofLayerVisibility: RoofLayerVisibility;
}): DesignBuilderRoofAssemblyVisibility {
  const displayMode = params.roofDisplayMode;
  const layerVisibility = params.roofLayerVisibility;
  const claddingDisplayActive =
    displayMode === 'full_roof' ||
    displayMode === 'roof_cladding_only' ||
    displayMode === 'foundation_frame_roof';
  const showRoofFraming =
    displayMode === 'full_roof' ||
    displayMode === 'steel_framing_only' ||
    displayMode === 'foundation_frame_roof';
  const showGableMasonry =
    (displayMode === 'full_roof' ||
      displayMode === 'gable_masonry_only' ||
      displayMode === 'foundation_frame_roof') &&
    (layerVisibility.gableEndCmu || layerVisibility.rakedConcreteCap);

  return {
    showRoofCladding: claddingDisplayActive && layerVisibility.roofCladding,
    showRoofFraming,
    showSteelTrusses: showRoofFraming && layerVisibility.steelTrusses,
    showPurlins: showRoofFraming && layerVisibility.purlins,
    showRidgeCap: claddingDisplayActive && layerVisibility.ridgeCap,
    showFascia: claddingDisplayActive && layerVisibility.fascia,
    showSoffit:
      claddingDisplayActive &&
      (layerVisibility.soffit ?? DEFAULT_ROOF_LAYER_VISIBILITY.soffit),
    showGableMasonry,
    showRakedCap: showGableMasonry && layerVisibility.rakedConcreteCap,
  };
}

export function buildDesignBuilderViewerRoofAssemblyScene(params: {
  state: DesignBuilderViewerRoofAssemblyState;
  trackGeometry: TrackGeometry;
  trackMaterial: TrackMaterial;
  makeMaterial: MakeMaterial;
}): DesignBuilderViewerRoofAssemblyScene {
  const state = params.state;
  const geometry = state.currentGeometry;
  const roofSystem = state.currentRoofSystem;
  const resolvedRoof = geometry?.resolvedRoofSystem;
  const groups: THREE.Group[] = [];
  const selectableObjects: THREE.Object3D[] = [];
  if (!geometry || !resolvedRoof?.supported || !roofSystem?.enabled) {
    return { groups, selectableObjects };
  }

  const visibility = resolveDesignBuilderRoofAssemblyVisibility({
    roofDisplayMode: state.currentRoofDisplayMode,
    roofLayerVisibility: state.currentRoofLayerVisibility,
  });
  const roofSegmentFrames = geometry.wallCmuLayout?.segmentFrames ?? [];
  const roofFrameById = buildSegmentFrameMap(roofSegmentFrames);
  const roofCladdingGroup = new THREE.Group();
  roofCladdingGroup.name = 'roofCladdingGroup';
  const trussChordGroup = new THREE.Group();
  trussChordGroup.name = 'trussChordGroup';
  const trussWebGroup = new THREE.Group();
  trussWebGroup.name = 'trussWebGroup';
  const purlinGroup = new THREE.Group();
  purlinGroup.name = 'purlinGroup';
  const basePlateGroup = new THREE.Group();
  basePlateGroup.name = 'basePlateGroup';
  const anchorBoltGroup = new THREE.Group();
  anchorBoltGroup.name = 'anchorBoltGroup';
  const rakedCapGroup = new THREE.Group();
  rakedCapGroup.name = 'rakedCapGroup';
  const ridgeCapGroup = new THREE.Group();
  ridgeCapGroup.name = 'ridgeCapGroup';
  const fasciaGroup = new THREE.Group();
  fasciaGroup.name = 'fasciaGroup';
  const soffitGroup = new THREE.Group();
  soffitGroup.name = 'soffitGroup';
  const framingGuideGroup = new THREE.Group();
  framingGuideGroup.name = 'framingGuideGroup';

  const corrugatedEnabled = roofSystem.corrugatedMetal.enabled;
  const debugGuides = import.meta.env.DEV && state.currentShowRoofFramingGuides;

  if (visibility.showRoofCladding) {
    const roofUsesMeterUvGeometry = state.usePreviewMaterials && !debugGuides;
    const roofCladdingUvOptions = roofUsesMeterUvGeometry ? resolveRoofCladdingUvOptions() : null;
    const roofMaterial = debugGuides
      ? new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.72, roughness: 0.38 })
      : state.usePreviewMaterials
        ? resolveRoofMetalMaterial(
            { visualStyle: state.currentVisualStyle, selected: state.roofSelected },
            params.trackMaterial,
          )
        : corrugatedEnabled
          ? createCorrugatedMetalMaterial()
          : params.makeMaterial(0x64748b, state.roofSelected, {
              roughness: 0.75,
              opacity: 0.92,
            });
    roofMaterial.side = THREE.DoubleSide;
    roofMaterial.needsUpdate = true;
    if (debugGuides || !state.usePreviewMaterials) {
      params.trackMaterial(roofMaterial);
    }
    roofCladdingGroup.add(
      ...buildRoofCladdingSceneGroup({
        resolvedRoof,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        material: roofMaterial,
        useMeterUvGeometry: roofUsesMeterUvGeometry,
        corrugationRepeatPerMeter: roofCladdingUvOptions?.corrugationRepeatPerMeter,
        swapCorrugationAxis: roofCladdingUvOptions?.swapCorrugationAxis,
        trackGeometry: params.trackGeometry,
      }).children,
    );
  }

  const hasResolvedSteelTrusses =
    roofSystem.steelTrusses.enabled && resolvedRoof.trussPlacements.length > 0;

  if (visibility.showSteelTrusses && hasResolvedSteelTrusses) {
    const steelMaterials =
      state.usePreviewMaterials && !debugGuides
        ? {
            chord: resolveStructuralSteelMaterial(
              { visualStyle: state.currentVisualStyle, selected: state.roofSelected },
              params.trackMaterial,
            ),
            web: resolveStructuralSteelMaterial(
              { visualStyle: state.currentVisualStyle, selected: state.roofSelected },
              params.trackMaterial,
            ),
            plate: resolveStructuralSteelMaterial(
              { visualStyle: state.currentVisualStyle, selected: state.roofSelected },
              params.trackMaterial,
            ),
            bolt: resolveStructuralSteelMaterial(
              { visualStyle: state.currentVisualStyle, selected: state.roofSelected },
              params.trackMaterial,
            ),
            purlin: resolveStructuralSteelMaterial(
              { visualStyle: state.currentVisualStyle, selected: state.roofSelected },
              params.trackMaterial,
            ),
          }
        : createSteelTrussMaterials();
    if (!state.usePreviewMaterials || debugGuides) {
      params.trackMaterial(steelMaterials.chord);
      params.trackMaterial(steelMaterials.web);
      params.trackMaterial(steelMaterials.plate);
      params.trackMaterial(steelMaterials.bolt);
    }
    const basePlateMaterial = debugGuides
      ? new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.5, roughness: 0.45 })
      : steelMaterials.plate;
    if (debugGuides) {
      params.trackMaterial(basePlateMaterial);
    }
    const trussGroups = buildSteelTrussSceneGroups({
      resolvedRoof,
      roofSystem,
      slabTopMeters: state.currentSlab.slabThicknessMeters,
      materials: {
        chord: steelMaterials.chord,
        web: steelMaterials.web,
        plate: basePlateMaterial,
        bolt: steelMaterials.bolt,
      },
      debugGuides,
      trackGeometry: params.trackGeometry,
      trackMaterial: params.trackMaterial,
    });
    trussChordGroup.add(...trussGroups.trussChordGroup.children);
    trussWebGroup.add(...trussGroups.trussWebGroup.children);
    basePlateGroup.add(...trussGroups.basePlateGroup.children);
    anchorBoltGroup.add(...trussGroups.anchorBoltGroup.children);
    framingGuideGroup.add(...trussGroups.framingGuideGroup.children);
  }

  if (visibility.showRoofFraming && resolvedRoof.roofType === 'hip') {
    const hipMaterial =
      state.usePreviewMaterials && !debugGuides
        ? resolveStructuralSteelMaterial(
            { visualStyle: state.currentVisualStyle, selected: state.roofSelected },
            params.trackMaterial,
          )
        : new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.78, roughness: 0.32 });
    if (!state.usePreviewMaterials || debugGuides) {
      params.trackMaterial(hipMaterial);
    }
    trussChordGroup.add(
      ...buildHipFramingSceneGroup({
        resolvedRoof,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        material: hipMaterial,
        trackGeometry: params.trackGeometry,
      }).children,
    );
  }

  if (visibility.showPurlins && roofSystem.purlins.enabled) {
    const steelMaterials = state.usePreviewMaterials && !debugGuides ? null : createSteelTrussMaterials();
    const purlinMaterial = debugGuides
      ? new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.5, roughness: 0.45 })
      : state.usePreviewMaterials
        ? resolveStructuralSteelMaterial(
            { visualStyle: state.currentVisualStyle, selected: state.roofSelected },
            params.trackMaterial,
          )
        : steelMaterials!.purlin;
    if (debugGuides || !state.usePreviewMaterials) {
      params.trackMaterial(purlinMaterial);
    }
    const purlinGroups = buildPurlinSceneGroups({
      resolvedRoof,
      slabTopMeters: state.currentSlab.slabThicknessMeters,
      material: purlinMaterial,
      debugContactGuides: debugGuides,
      trackGeometry: params.trackGeometry,
      trackMaterial: params.trackMaterial,
    });
    purlinGroup.add(...purlinGroups.purlinGroup.children);
    framingGuideGroup.add(...purlinGroups.framingGuideGroup.children);
  }

  if (
    visibility.showRidgeCap &&
    corrugatedEnabled &&
    (resolvedRoof.ridgeCapPlacements.length > 0 || resolvedRoof.ridgeCapPlacement)
  ) {
    const ridgeCapMaterial = debugGuides
      ? new THREE.MeshStandardMaterial({ color: 0x14b8a6, metalness: 0.5, roughness: 0.45 })
      : state.usePreviewMaterials
        ? resolveRoofMetalMaterial(
            { visualStyle: state.currentVisualStyle, selected: state.roofSelected },
            params.trackMaterial,
          )
        : createRidgeCapMaterial();
    if (debugGuides || !state.usePreviewMaterials) {
      params.trackMaterial(ridgeCapMaterial);
    }
    ridgeCapGroup.add(
      ...buildRidgeCapSceneGroup({
        resolvedRoof,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        material: ridgeCapMaterial,
        trackGeometry: params.trackGeometry,
      }).children,
    );
  }

  if (visibility.showFascia && roofSystem.fascia.enabled && resolvedRoof.fasciaPlacements.length > 0) {
    const fasciaMaterial = debugGuides
      ? new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.5, roughness: 0.45 })
      : state.usePreviewMaterials
        ? resolveFasciaTrimMaterial(
            { visualStyle: state.currentVisualStyle, selected: state.roofSelected },
            params.trackMaterial,
          )
        : createRidgeCapMaterial();
    fasciaMaterial.side = THREE.DoubleSide;
    fasciaMaterial.needsUpdate = true;
    if (debugGuides || !state.usePreviewMaterials) {
      params.trackMaterial(fasciaMaterial);
    }
    fasciaGroup.add(
      ...buildFasciaSceneGroup({
        resolvedRoof,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        material: fasciaMaterial,
        trackGeometry: params.trackGeometry,
      }).children,
    );
  }

  if (visibility.showSoffit && roofSystem.soffit.enabled && resolvedRoof.soffitPlacements.length > 0) {
    const soffitMaterial = debugGuides
      ? new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.45, roughness: 0.5 })
      : state.usePreviewMaterials
        ? resolveSoffitTrimMaterial(
            { visualStyle: state.currentVisualStyle, selected: state.roofSelected },
            params.trackMaterial,
          )
        : createRidgeCapMaterial();
    soffitMaterial.side = THREE.DoubleSide;
    soffitMaterial.needsUpdate = true;
    if (debugGuides || !state.usePreviewMaterials) {
      params.trackMaterial(soffitMaterial);
    }
    soffitGroup.add(
      ...buildSoffitSceneGroup({
        resolvedRoof,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        material: soffitMaterial,
        trackGeometry: params.trackGeometry,
      }).children,
    );
  }

  if (
    debugGuides &&
    resolvedRoof.roofType === 'gable' &&
    resolvedRoof.structuralRidgeStart &&
    resolvedRoof.structuralRidgeEnd &&
    resolvedRoof.claddingRidgeStart &&
    resolvedRoof.claddingRidgeEnd
  ) {
    framingGuideGroup.add(
      ...buildGableRidgeGuideSceneGroup({
        resolvedRoof,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        trackGeometry: params.trackGeometry,
        trackMaterial: params.trackMaterial,
      }).children,
    );
  }

  if (
    roofSystem.gable.rakedConcreteCapEnabled &&
    visibility.showRakedCap &&
    geometry.rakedCapPlacements?.length
  ) {
    const capMaterial = state.usePreviewMaterials
      ? resolveCastConcreteMaterial(
          { visualStyle: state.currentVisualStyle, selected: state.gableSelected, role: 'structural' },
          params.trackMaterial,
        )
      : createRakedConcreteCapMaterial(state.gableSelected);
    capMaterial.side = THREE.DoubleSide;
    capMaterial.needsUpdate = true;
    if (!state.usePreviewMaterials) {
      params.trackMaterial(capMaterial);
    }
    rakedCapGroup.add(
      ...buildRakedCapSceneGroup({
        placements: geometry.rakedCapPlacements,
        frameBySegmentId: roofFrameById,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        material: capMaterial,
        trackGeometry: params.trackGeometry,
      }).children,
    );
  }

  for (const group of [
    roofCladdingGroup,
    ridgeCapGroup,
    fasciaGroup,
    soffitGroup,
    trussChordGroup,
    trussWebGroup,
    purlinGroup,
    basePlateGroup,
    anchorBoltGroup,
    rakedCapGroup,
    framingGuideGroup,
  ]) {
    if (group.children.length === 0) continue;
    const roofObjectType: DesignObjectType =
      group === rakedCapGroup ? 'gable_end_system' : 'gable_roof_system';
    const roofSelectionPriority = selectionPriorityForObjectType(roofObjectType);
    group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
        child.userData.selectable = true;
        child.userData.designObjectType = roofObjectType;
        child.userData.selectionPriority = roofSelectionPriority;
        selectableObjects.push(child);
      }
    });
    groups.push(group);
  }

  return { groups, selectableObjects };
}
