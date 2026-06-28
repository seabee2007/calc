import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { resolveDesignBuilderGeometryPipeline } from '../application/designBuilderGeometryPipeline';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { syncPresetFromLayout } from '../domain/layoutWallAdapter';
import {
  createDefaultRoofSystemSettings,
  DEFAULT_ROOF_LAYER_VISIBILITY,
  normalizeRoofSystemSettings,
} from '../domain/roofSystemDefaults';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import type { DesignGeometryResult } from '../geometry/designGeometry';
import type { RoofLayerVisibility, RoofSystemSettings } from '../types';
import {
  buildDesignBuilderViewerRoofAssemblyScene,
  resolveDesignBuilderRoofAssemblyVisibility,
  type DesignBuilderViewerRoofAssemblyState,
} from '../ui/DesignBuilderViewerRoofAssemblyScene';
import { createDesignBuilderViewerResources } from '../ui/DesignBuilderViewerResources';

function gableRoofSystem(): RoofSystemSettings {
  const defaults = createDefaultRoofSystemSettings();
  return normalizeRoofSystemSettings({
    ...defaults,
    roofType: 'gable',
    ridgeDirection: 'along_longest_axis',
    eaveOverhangMeters: 0.3,
    gableEndOverhangMeters: 0.3,
    corrugatedMetal: {
      ...defaults.corrugatedMetal,
      enabled: true,
    },
    purlins: {
      ...defaults.purlins,
      enabled: true,
    },
    steelTrusses: {
      ...defaults.steelTrusses,
      enabled: true,
    },
  });
}

function sceneGeometry(): {
  geometry: DesignGeometryResult;
  roofSystem: RoofSystemSettings;
  preset: ReturnType<typeof createFiveBySixCmuBuildingPreset>;
} {
  const template = createFiveBySixCmuBuildingPreset();
  const layout = createOutsideFaceRectangleLayout({
    lengthMeters: 8,
    widthMeters: 5,
    wallHeightMeters: 2.8,
    wallThicknessMeters: 0.2,
  });
  const synced = syncPresetFromLayout(
    {
      ...template,
      wall: {
        ...template.wall,
        openings: [],
      },
      wallLayout: layout,
    },
    layout,
  );
  const preset = applyAutoFrameLayout(synced);
  const roofSystem = gableRoofSystem();
  return {
    geometry: resolveDesignBuilderGeometryPipeline({
      wallLayout: preset.wallLayout,
      effectiveWall: preset.wall,
      resolvedPreset: {
        ...preset,
        buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
      },
      footprintClosed: true,
      activeRoofSystem: roofSystem,
    }).designGeometryResult,
    roofSystem,
    preset,
  };
}

function roofLayerVisibility(
  partial: Partial<RoofLayerVisibility> = {},
): RoofLayerVisibility {
  return {
    ...DEFAULT_ROOF_LAYER_VISIBILITY,
    roofCladding: false,
    steelTrusses: false,
    purlins: false,
    ridgeCap: false,
    fascia: false,
    soffit: false,
    gableEndCmu: false,
    rakedConcreteCap: false,
    ...partial,
  };
}

function roofAssemblyState(
  partial: Partial<DesignBuilderViewerRoofAssemblyState> = {},
): DesignBuilderViewerRoofAssemblyState {
  const { geometry, roofSystem, preset } = sceneGeometry();
  return {
    currentGeometry: geometry,
    currentSlab: preset.slab,
    currentVisualStyle: 'technical',
    currentRoofSystem: roofSystem,
    currentRoofDisplayMode: 'roof_cladding_only',
    currentRoofLayerVisibility: roofLayerVisibility({ roofCladding: true }),
    currentShowRoofFramingGuides: false,
    usePreviewMaterials: false,
    roofSelected: false,
    gableSelected: false,
    ...partial,
  };
}

function meshCount(object: THREE.Object3D): number {
  let count = 0;
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) count += 1;
  });
  return count;
}

function resolvedFramingSignature(geometry: DesignGeometryResult): string {
  const roof = geometry.resolvedRoofSystem!;
  return JSON.stringify({
    trusses: roof.trussPlacements.map((truss) => ({
      stationMeters: truss.stationMeters,
      bearingLeft: truss.bearingLeft,
      bearingRight: truss.bearingRight,
      apex: truss.apex,
      members: truss.members.map((member) => ({
        memberKind: member.memberKind,
        start: member.start,
        end: member.end,
      })),
    })),
    purlins: roof.purlinPlacements.map((purlin) => ({
      slopePlaneId: purlin.slopePlaneId,
      rowIndex: purlin.rowIndex,
      start: purlin.start,
      end: purlin.end,
    })),
  });
}

describe('DesignBuilderViewerRoofAssemblyScene', () => {
  it('resolves roof visibility by display mode and layer toggles', () => {
    expect(
      resolveDesignBuilderRoofAssemblyVisibility({
        roofDisplayMode: 'roof_cladding_only',
        roofLayerVisibility: roofLayerVisibility({
          roofCladding: true,
          ridgeCap: true,
          fascia: true,
          soffit: true,
          steelTrusses: true,
          purlins: true,
        }),
      }),
    ).toMatchObject({
      showRoofCladding: true,
      showRidgeCap: true,
      showFascia: true,
      showSoffit: true,
      showRoofFraming: false,
      showSteelTrusses: false,
      showPurlins: false,
    });

    expect(
      resolveDesignBuilderRoofAssemblyVisibility({
        roofDisplayMode: 'steel_framing_only',
        roofLayerVisibility: roofLayerVisibility({
          steelTrusses: true,
          purlins: true,
          roofCladding: true,
        }),
      }),
    ).toMatchObject({
      showRoofCladding: false,
      showRoofFraming: true,
      showSteelTrusses: true,
      showPurlins: true,
    });

    expect(
      resolveDesignBuilderRoofAssemblyVisibility({
        roofDisplayMode: 'gable_masonry_only',
        roofLayerVisibility: roofLayerVisibility({
          gableEndCmu: true,
          rakedConcreteCap: true,
        }),
      }),
    ).toMatchObject({
      showGableMasonry: true,
      showRakedCap: true,
      showRoofCladding: false,
      showRoofFraming: false,
    });
  });

  it('builds selectable roof cladding groups from resolved roof geometry', () => {
    const resources = createDesignBuilderViewerResources();
    const scene = buildDesignBuilderViewerRoofAssemblyScene({
      state: roofAssemblyState(),
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    expect(scene.groups.map((group) => group.name)).toEqual(['roofCladdingGroup']);
    expect(meshCount(scene.groups[0]!)).toBeGreaterThan(0);
    expect(scene.selectableObjects).toHaveLength(meshCount(scene.groups[0]!));
    expect(resources.trackedGeometryCount()).toBeGreaterThan(0);
    expect(resources.trackedMaterialCount()).toBe(1);
    for (const selectable of scene.selectableObjects) {
      expect(selectable.userData.selectable).toBe(true);
      expect(selectable.userData.designObjectType).toBe('gable_roof_system');
      expect(selectable.userData.selectionPriority).toBe(20);
    }

    resources.disposeTrackedResources();
  });

  it('does not mutate resolved trusses or purlins when roof cladding visibility changes', () => {
    const resources = createDesignBuilderViewerResources();
    const state = roofAssemblyState({
      currentRoofDisplayMode: 'roof_cladding_only',
      currentRoofLayerVisibility: roofLayerVisibility({
        roofCladding: true,
      }),
    });
    const before = resolvedFramingSignature(state.currentGeometry!);

    buildDesignBuilderViewerRoofAssemblyScene({
      state: {
        ...state,
        currentRoofLayerVisibility: {
          ...state.currentRoofLayerVisibility,
          roofCladding: false,
        },
      },
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });
    expect(resolvedFramingSignature(state.currentGeometry!)).toBe(before);

    buildDesignBuilderViewerRoofAssemblyScene({
      state,
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });
    expect(resolvedFramingSignature(state.currentGeometry!)).toBe(before);

    resources.disposeTrackedResources();
  });

  it('returns an empty scene when the roof system is disabled or unsupported', () => {
    const resources = createDesignBuilderViewerResources();
    const enabledState = roofAssemblyState();

    const disabled = buildDesignBuilderViewerRoofAssemblyScene({
      state: {
        ...enabledState,
        currentRoofSystem: {
          ...enabledState.currentRoofSystem!,
          enabled: false,
        },
      },
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });
    const unsupported = buildDesignBuilderViewerRoofAssemblyScene({
      state: {
        ...enabledState,
        currentGeometry: {
          ...enabledState.currentGeometry!,
          resolvedRoofSystem: {
            ...enabledState.currentGeometry!.resolvedRoofSystem!,
            supported: false,
          },
        },
      },
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    expect(disabled.groups).toHaveLength(0);
    expect(disabled.selectableObjects).toHaveLength(0);
    expect(unsupported.groups).toHaveLength(0);
    expect(unsupported.selectableObjects).toHaveLength(0);
  });
});
