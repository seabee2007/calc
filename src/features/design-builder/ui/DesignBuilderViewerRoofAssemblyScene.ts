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

function isObject3D(value: unknown): value is THREE.Object3D {
  return Boolean(value && typeof value === 'object' && (value as THREE.Object3D).isObject3D === true);
}

function addObject3D(parent: THREE.Object3D, child: unknown, label: string): void {
  if (!isObject3D(child)) {
    if (import.meta.env.DEV) {
      console.warn(`[DesignBuilderViewerRoofAssemblyScene] Skipped invalid Object3D: ${label}`, child);
    }
    return;
  }

  parent.add(child);
}

function addGroupChildren(parent: THREE.Object3D, source: THREE.Object3D, label: string): void {
  [...source.children].forEach((child, index) => {
    addObject3D(parent, child, `${label} child ${index}`);
  });
}

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
  | 'currentFoundationViewMode'
  | 'currentRoofLayerVisibility'
  | 'currentShowRoofFramingGuides'
  | 'usePreviewMaterials'
  | 'roofSelected'
  | 'trussSelected'
  | 'gableSelected'
  | 'frameSelected'
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

  const effectiveRoofDisplayMode =
    state.currentFoundationViewMode === 'structural_frame_only'
      ? 'steel_framing_only'
      : state.currentRoofDisplayMode;
  const visibility = resolveDesignBuilderRoofAssemblyVisibility({
    roofDisplayMode: effectiveRoofDisplayMode,
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
          ? createCorrugatedMetalMaterial(state.roofSelected)
          : params.makeMaterial(0x64748b, state.roofSelected, {
              roughness: 0.75,
              opacity: 0.92,
            });
    roofMaterial.side = THREE.DoubleSide;
    roofMaterial.needsUpdate = true;
    if (debugGuides || !state.usePreviewMaterials) {
      params.trackMaterial(roofMaterial);
    }
    addGroupChildren(
      roofCladdingGroup,
      buildRoofCladdingSceneGroup({
        resolvedRoof,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        material: roofMaterial,
        useMeterUvGeometry: roofUsesMeterUvGeometry,
        corrugationRepeatPerMeter: roofCladdingUvOptions?.corrugationRepeatPerMeter,
        swapCorrugationAxis: roofCladdingUvOptions?.swapCorrugationAxis,
        trackGeometry: params.trackGeometry,
      }),
      'roof cladding',
    );
  }

  const hasResolvedSteelTrusses =
    roofSystem.steelTrusses.enabled && resolvedRoof.trussPlacements.length > 0;

  if (visibility.showSteelTrusses && hasResolvedSteelTrusses) {
    const steelMaterials =
      state.usePreviewMaterials && !debugGuides
        ? {
            chord: resolveStructuralSteelMaterial(
              { visualStyle: state.currentVisualStyle, selected: state.trussSelected },
              params.trackMaterial,
            ),
            web: resolveStructuralSteelMaterial(
              { visualStyle: state.currentVisualStyle, selected: state.trussSelected },
              params.trackMaterial,
            ),
            plate: resolveStructuralSteelMaterial(
              { visualStyle: state.currentVisualStyle, selected: state.trussSelected },
              params.trackMaterial,
            ),
            bolt: resolveStructuralSteelMaterial(
              { visualStyle: state.currentVisualStyle, selected: state.trussSelected },
              params.trackMaterial,
            ),
            purlin: resolveStructuralSteelMaterial(
              { visualStyle: state.currentVisualStyle, selected: state.trussSelected },
              params.trackMaterial,
            ),
          }
        : createSteelTrussMaterials(state.trussSelected);
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
    addGroupChildren(trussChordGroup, trussGroups.trussChordGroup, 'truss chord');
    addGroupChildren(trussWebGroup, trussGroups.trussWebGroup, 'truss web');
    addGroupChildren(basePlateGroup, trussGroups.basePlateGroup, 'truss base plate');
    addGroupChildren(anchorBoltGroup, trussGroups.anchorBoltGroup, 'truss anchor bolt');
    addGroupChildren(framingGuideGroup, trussGroups.framingGuideGroup, 'truss framing guide');
  }

  if (visibility.showRoofFraming && resolvedRoof.roofType === 'hip') {
    const hipMaterial =
      state.usePreviewMaterials && !debugGuides
        ? resolveStructuralSteelMaterial(
            { visualStyle: state.currentVisualStyle, selected: state.trussSelected },
            params.trackMaterial,
          )
        : createSteelTrussMaterials(state.trussSelected).chord;
    if (!state.usePreviewMaterials || debugGuides) {
      params.trackMaterial(hipMaterial);
    }
    addGroupChildren(
      trussChordGroup,
      buildHipFramingSceneGroup({
        resolvedRoof,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        material: hipMaterial,
        trackGeometry: params.trackGeometry,
      }),
      'hip framing',
    );
  }

  if (visibility.showPurlins && roofSystem.purlins.enabled) {
    const steelMaterials = state.usePreviewMaterials && !debugGuides ? null : createSteelTrussMaterials(state.trussSelected);
    const purlinMaterial = debugGuides
      ? new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.5, roughness: 0.45 })
      : state.usePreviewMaterials
        ? resolveStructuralSteelMaterial(
            { visualStyle: state.currentVisualStyle, selected: state.trussSelected },
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
    addGroupChildren(purlinGroup, purlinGroups.purlinGroup, 'purlin');
    addGroupChildren(framingGuideGroup, purlinGroups.framingGuideGroup, 'purlin framing guide');
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
        : createRidgeCapMaterial(state.roofSelected);
    if (debugGuides || !state.usePreviewMaterials) {
      params.trackMaterial(ridgeCapMaterial);
    }
    addGroupChildren(
      ridgeCapGroup,
      buildRidgeCapSceneGroup({
        resolvedRoof,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        material: ridgeCapMaterial,
        trackGeometry: params.trackGeometry,
      }),
      'ridge cap',
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
        : createRidgeCapMaterial(state.roofSelected);
    fasciaMaterial.side = THREE.DoubleSide;
    fasciaMaterial.needsUpdate = true;
    if (debugGuides || !state.usePreviewMaterials) {
      params.trackMaterial(fasciaMaterial);
    }
    addGroupChildren(
      fasciaGroup,
      buildFasciaSceneGroup({
        resolvedRoof,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        material: fasciaMaterial,
        trackGeometry: params.trackGeometry,
      }),
      'fascia',
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
        : createRidgeCapMaterial(state.roofSelected);
    soffitMaterial.side = THREE.DoubleSide;
    soffitMaterial.needsUpdate = true;
    if (debugGuides || !state.usePreviewMaterials) {
      params.trackMaterial(soffitMaterial);
    }
    addGroupChildren(
      soffitGroup,
      buildSoffitSceneGroup({
        resolvedRoof,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        material: soffitMaterial,
        trackGeometry: params.trackGeometry,
      }),
      'soffit',
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
    addGroupChildren(
      framingGuideGroup,
      buildGableRidgeGuideSceneGroup({
        resolvedRoof,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        trackGeometry: params.trackGeometry,
        trackMaterial: params.trackMaterial,
      }),
      'gable ridge guide',
    );
  }

  if (
    roofSystem.gable.rakedConcreteCapEnabled &&
    visibility.showRakedCap &&
    geometry.rakedCapPlacements?.length
  ) {
    const rakedCapSelected = state.gableSelected || state.frameSelected;
    const capMaterial = state.usePreviewMaterials
      ? resolveCastConcreteMaterial(
          { visualStyle: state.currentVisualStyle, selected: rakedCapSelected, role: 'structural' },
          params.trackMaterial,
        )
      : createRakedConcreteCapMaterial(rakedCapSelected);
    capMaterial.side = THREE.DoubleSide;
    capMaterial.needsUpdate = true;
    if (!state.usePreviewMaterials) {
      params.trackMaterial(capMaterial);
    }
    addGroupChildren(
      rakedCapGroup,
      buildRakedCapSceneGroup({
        placements: geometry.rakedCapPlacements,
        frameBySegmentId: roofFrameById,
        slabTopMeters: state.currentSlab.slabThicknessMeters,
        material: capMaterial,
        trackGeometry: params.trackGeometry,
      }),
      'raked concrete cap',
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
      group === rakedCapGroup
        ? 'gable_end_system'
        : group === trussChordGroup ||
            group === trussWebGroup ||
            group === purlinGroup ||
            group === basePlateGroup ||
            group === anchorBoltGroup
          ? 'steel_truss_system'
          : 'gable_roof_system';
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
