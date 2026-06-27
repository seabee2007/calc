import { describe, expect, it } from "vitest";
import { resolveDesignBuilderGeometryPipeline } from "../application/designBuilderGeometryPipeline";
import { createDesignBuilderRoofDebugSnapshot } from "../domain/designBuilderRoofDebugSnapshot";
import { createFiveBySixCmuBuildingPreset } from "../domain/designBuilderPreset";
import { syncPresetFromLayout } from "../domain/layoutWallAdapter";
import {
  createDefaultRoofSystemSettings,
  DEFAULT_ROOF_LAYER_VISIBILITY,
  normalizeRoofSystemSettings,
} from "../domain/roofSystemDefaults";
import { applyAutoFrameLayout } from "../domain/structureActions";
import { createOutsideFaceRectangleLayout } from "../domain/wallLayoutRules";
import type { DesignBuilderPreset } from "../state/designBuilderStore";
import type { DesignGeometryResult } from "../geometry/designGeometry";
import type { RoofSystemSettings } from "../types";
import {
  buildDesignBuilderViewerCmuInfillScene,
  type DesignBuilderViewerCmuInfillState,
} from "../ui/DesignBuilderViewerCmuInfillScene";
import {
  buildDesignBuilderViewerRoofAssemblyScene,
  type DesignBuilderViewerRoofAssemblyState,
} from "../ui/DesignBuilderViewerRoofAssemblyScene";
import { createDesignBuilderViewerResources } from "../ui/DesignBuilderViewerResources";
import { createDesignBuilderViewerRoofRenderDebugSnapshot } from "../ui/DesignBuilderViewerRoofRenderDebugSnapshot";

type Scenario = {
  lengthMeters: number;
  widthMeters: number;
};

function gableRoofSystem(): RoofSystemSettings {
  const defaults = createDefaultRoofSystemSettings();
  return normalizeRoofSystemSettings({
    ...defaults,
    roofType: "gable",
    ridgeDirection: "along_longest_axis",
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
    gable: {
      ...defaults.gable,
      enabled: true,
      rakedConcreteCapEnabled: true,
    },
  });
}

function scenarioGeometry(
  scenario: Scenario = { lengthMeters: 8, widthMeters: 5 },
): {
  geometry: DesignGeometryResult;
  roofSystem: RoofSystemSettings;
  preset: DesignBuilderPreset;
} {
  const template = createFiveBySixCmuBuildingPreset();
  const layout = createOutsideFaceRectangleLayout({
    lengthMeters: scenario.lengthMeters,
    widthMeters: scenario.widthMeters,
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
        buildingSystemMode: "reinforced_concrete_frame_with_cmu_infill",
      },
      footprintClosed: true,
      activeRoofSystem: roofSystem,
    }).designGeometryResult,
    roofSystem,
    preset,
  };
}

function roofAssemblyState(params: {
  geometry: DesignGeometryResult;
  roofSystem: RoofSystemSettings;
  preset: DesignBuilderPreset;
}): DesignBuilderViewerRoofAssemblyState {
  return {
    currentGeometry: params.geometry,
    currentSlab: params.preset.slab,
    currentVisualStyle: "technical",
    currentRoofSystem: params.roofSystem,
    currentRoofDisplayMode: "full_roof",
    currentRoofLayerVisibility: DEFAULT_ROOF_LAYER_VISIBILITY,
    currentShowRoofFramingGuides: false,
    usePreviewMaterials: false,
    roofSelected: false,
    gableSelected: false,
  };
}

function cmuInfillState(params: {
  geometry: DesignGeometryResult;
  preset: DesignBuilderPreset;
}): DesignBuilderViewerCmuInfillState {
  return {
    currentGeometry: params.geometry,
    currentWall: {
      ...params.preset.wall,
      showIndividualBlocks: true,
    },
    currentSlab: params.preset.slab,
    currentSelectedObjectType: null,
    currentVisualStyle: "technical",
    currentRoofDisplayMode: "full_roof",
    currentRoofLayerVisibility: DEFAULT_ROOF_LAYER_VISIBILITY,
    usePreviewMaterials: false,
    cmuSelected: false,
    cmuCutawayActive: false,
    cmuOpacity: 0.9,
    cmuMaterialOptions: {
      visualStyle: "technical",
      selected: false,
    },
  };
}

describe("createDesignBuilderViewerRoofRenderDebugSnapshot", () => {
  it.each([
    { lengthMeters: 5, widthMeters: 8 },
    { lengthMeters: 15, widthMeters: 6 },
    { lengthMeters: 9.94, widthMeters: 18.91 },
    { lengthMeters: 18.91, widthMeters: 9.94 },
    { lengthMeters: 11.44, widthMeters: 15.33 },
    { lengthMeters: 15.33, widthMeters: 11.44 },
    { lengthMeters: 10.66, widthMeters: 18.59 },
    { lengthMeters: 18.59, widthMeters: 10.66 },
    { lengthMeters: 35, widthMeters: 6 },
    { lengthMeters: 6, widthMeters: 35 },
  ])(
    "confirms expected RC-frame roof components render for $lengthMeters x $widthMeters",
    (scenario) => {
      const { geometry, roofSystem, preset } = scenarioGeometry(scenario);
      const resources = createDesignBuilderViewerResources();
      const roofScene = buildDesignBuilderViewerRoofAssemblyScene({
        state: roofAssemblyState({ geometry, roofSystem, preset }),
        trackGeometry: resources.trackGeometry,
        trackMaterial: resources.trackMaterial,
        makeMaterial: resources.makeMaterial,
      });
      const cmuScene = buildDesignBuilderViewerCmuInfillScene({
        state: cmuInfillState({ geometry, preset }),
        cmuLayout: geometry.wallCmuLayout,
        showCmuInfill: false,
        trackGeometry: resources.trackGeometry,
        trackMaterial: resources.trackMaterial,
        makeMaterial: resources.makeMaterial,
      });
      const solverSnapshot = createDesignBuilderRoofDebugSnapshot({
        geometryResult: geometry,
        roofSystem,
        slabTopMeters: preset.slab.slabThicknessMeters,
      });

      const renderSnapshot = createDesignBuilderViewerRoofRenderDebugSnapshot({
        roofAssemblyScene: roofScene,
        cmuInfillScene: cmuScene,
        solverSnapshot,
      });

      expect(renderSnapshot.issues).toEqual([]);
      expect(renderSnapshot.components.roofCladding.rendered).toBe(true);
      expect(renderSnapshot.components.steelTrusses.rendered).toBe(true);
      expect(renderSnapshot.components.purlins.rendered).toBe(true);
      expect(renderSnapshot.components.gableEndCmu.rendered).toBe(true);
      expect(renderSnapshot.components.rakedCaps.rendered).toBe(true);
      expect(
        renderSnapshot.components.roofCladding.bounds?.minY,
      ).toBeGreaterThanOrEqual(
        (renderSnapshot.expectedRoofBeamWorldY ?? 0) - 0.1,
      );
      expect(
        renderSnapshot.components.roofCladding.bounds?.maxY,
      ).toBeLessThanOrEqual((renderSnapshot.expectedRoofPeakWorldY ?? 0) + 0.2);
      expect(renderSnapshot.components.gableEndCmu.instancedInstanceCount).toBe(
        solverSnapshot.gableEnd.cmuBlockCount,
      );
      expect(renderSnapshot.selectableCount).toBeGreaterThan(0);

      resources.disposeTrackedResources();
    },
  );

  it("reports when solver components are expected but the viewer did not build them", () => {
    const { geometry, roofSystem, preset } = scenarioGeometry();
    const resources = createDesignBuilderViewerResources();
    const roofScene = buildDesignBuilderViewerRoofAssemblyScene({
      state: {
        ...roofAssemblyState({ geometry, roofSystem, preset }),
        currentRoofDisplayMode: "roof_cladding_only",
        currentRoofLayerVisibility: {
          ...DEFAULT_ROOF_LAYER_VISIBILITY,
          steelTrusses: false,
          purlins: false,
          gableEndCmu: false,
          rakedConcreteCap: false,
        },
      },
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });
    const solverSnapshot = createDesignBuilderRoofDebugSnapshot({
      geometryResult: geometry,
      roofSystem,
      slabTopMeters: preset.slab.slabThicknessMeters,
    });

    const renderSnapshot = createDesignBuilderViewerRoofRenderDebugSnapshot({
      roofAssemblyScene: roofScene,
      solverSnapshot,
    });

    expect(renderSnapshot.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: "steelTrusses",
          code: "expected_component_not_rendered",
        }),
        expect.objectContaining({
          component: "purlins",
          code: "expected_component_not_rendered",
        }),
        expect.objectContaining({
          component: "gableEndCmu",
          code: "expected_component_not_rendered",
        }),
        expect.objectContaining({
          component: "rakedCaps",
          code: "expected_component_not_rendered",
        }),
      ]),
    );

    resources.disposeTrackedResources();
  });
});
