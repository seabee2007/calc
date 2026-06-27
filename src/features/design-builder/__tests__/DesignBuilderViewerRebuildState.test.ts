import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOF_LAYER_VISIBILITY } from '../domain/roofSystemDefaults';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import type { DesignGeometryResult } from '../geometry/designGeometry';
import {
  createDesignBuilderViewerRebuildState,
  type DesignBuilderViewerModelParams,
  resolveDesignBuilderViewerSceneSize,
} from '../ui/DesignBuilderViewerRebuildState';

function modelParams(
  partial: Partial<DesignBuilderViewerModelParams> = {},
): DesignBuilderViewerModelParams {
  const preset = createFiveBySixCmuBuildingPreset();
  return {
    modelLoaded: true,
    slab: preset.slab,
    wall: preset.wall,
    roof: preset.roof,
    truss: preset.truss,
    geometryResult: undefined,
    layoutBounds: null,
    placedComponents: [],
    designRenderModel: undefined,
    selectedObjectType: null,
    showOpeningLayout: false,
    showGroutCells: false,
    showClosureWarnings: false,
    showRoofReferencePerimeters: false,
    showRoofFramingGuides: false,
    foundationViewMode: 'full_model',
    visualStyle: 'technical',
    roofSystem: null,
    roofDisplayMode: 'full_roof',
    roofLayerVisibility: DEFAULT_ROOF_LAYER_VISIBILITY,
    ...partial,
  };
}

describe('DesignBuilderViewerRebuildState', () => {
  it('resolves scene size from wall, slab, and roof settings', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    expect(
      resolveDesignBuilderViewerSceneSize({
        wall: preset.wall,
        slab: preset.slab,
        roof: preset.roof,
        blankGeometryActive: false,
      }),
    ).toEqual({
      length: preset.wall.lengthMeters,
      width: preset.wall.widthMeters,
      height:
        preset.slab.slabThicknessMeters +
        preset.wall.heightMeters +
        (preset.roof.widthMeters / 2 + preset.roof.overhangMeters) *
          preset.roof.pitchRisePerRun,
    });

    expect(
      resolveDesignBuilderViewerSceneSize({
        wall: preset.wall,
        slab: preset.slab,
        roof: preset.roof,
        blankGeometryActive: true,
      }),
    ).toEqual({ length: 6, width: 6, height: 2 });
  });

  it('normalizes selected system flags and technical CMU material options', () => {
    const state = createDesignBuilderViewerRebuildState({
      modelParams: modelParams({
        selectedObjectType: 'cmu_wall_system',
        visualStyle: 'technical',
      }),
      previewMaterialsReady: true,
    });

    expect(state.usePreviewMaterials).toBe(false);
    expect(state.cmuSelected).toBe(true);
    expect(state.frameSelected).toBe(false);
    expect(state.roofSelected).toBe(false);
    expect(state.gableSelected).toBe(false);
    expect(state.cmuOpacity).toBeCloseTo(0.9, 6);
    expect(state.cmuMaterialOptions).toEqual({
      visualStyle: 'technical',
      selected: true,
    });
    expect(state.currentLayoutBounds).toBeNull();
  });

  it('enables preview materials and cutaway opacity when applicable', () => {
    const state = createDesignBuilderViewerRebuildState({
      modelParams: modelParams({
        selectedObjectType: 'structural_frame_system',
        visualStyle: 'material_preview',
        foundationViewMode: 'cutaway_below_grade',
      }),
      previewMaterialsReady: true,
    });

    expect(state.usePreviewMaterials).toBe(true);
    expect(state.frameSelected).toBe(true);
    expect(state.cmuCutawayActive).toBe(true);
    expect(state.cmuOpacity).toBeCloseTo(0.35, 6);
    expect(state.cmuMaterialOptions).toEqual({
      visualStyle: 'material_preview',
      selected: false,
      transparent: true,
      opacity: 0.35,
    });
  });

  it('keeps material preview active while texture packs are still loading', () => {
    const state = createDesignBuilderViewerRebuildState({
      modelParams: modelParams({
        visualStyle: 'material_preview',
      }),
      previewMaterialsReady: false,
    });

    expect(state.usePreviewMaterials).toBe(true);
    expect(state.cmuOpacity).toBeCloseTo(1, 6);
    expect(state.cmuMaterialOptions).toEqual({
      visualStyle: 'material_preview',
      selected: false,
    });
  });

  it('marks blank geometry and uses blank scene size', () => {
    const state = createDesignBuilderViewerRebuildState({
      modelParams: modelParams({
        geometryResult: { sourcePath: 'blank' } as DesignGeometryResult,
      }),
      previewMaterialsReady: false,
    });

    expect(state.blankGeometryActive).toBe(true);
    expect(state.sceneSize).toEqual({ length: 6, width: 6, height: 2 });
  });
});
