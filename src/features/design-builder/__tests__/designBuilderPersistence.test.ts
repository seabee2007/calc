import { describe, expect, it } from 'vitest';
import { applyAutoFrameLayout, applyFrameFoundationDimensions } from '../domain/structureActions';
import { createBlankCmuBuildingPreset, createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { createDefaultRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import {
  designModelMetadataWithPersistedState,
  migratePersistedDesignBuilderState,
  persistenceStatusMessage,
  presetFromStoredDesign,
  readPersistedDesignBuilderState,
  resolveDesignBuilderPersistenceContext,
  saveStateLabel,
  serializePersistedDesignBuilderState,
  validateDesignBuilderPersistenceContext,
} from '../domain/designBuilderPersistence';
import type { DesignModel, DesignModelObject } from '../types';

function rcPreset() {
  return applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
}

function footingPreset(widthMeters: number, lengthMeters: number, thicknessMeters: number, dropMeters: number) {
  const preset = rcPreset();
  const foundation = {
    ...createDefaultRcFrameFoundationSettings(),
    isolatedFootings: {
      ...createDefaultRcFrameFoundationSettings().isolatedFootings,
      enabled: true,
      autoCreateAtStructuralColumns: true,
      widthMeters,
      lengthMeters,
      thicknessMeters,
      dropBelowPlinthBeamMeters: dropMeters,
    },
  };
  return applyFrameFoundationDimensions(preset, {
    foundation,
    roofSystem: createDefaultRoofSystemSettings(),
    autoGenerateFrameLayout: true,
  });
}

describe('designBuilderPersistence', () => {
  it('opens authenticated Detailed Estimate in project_bound mode', () => {
    const context = resolveDesignBuilderPersistenceContext({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      userId: 'user-1',
    });
    expect(context.mode).toBe('project_bound');
    expect(context.canPersist).toBe(true);
  });

  it('treats blank design inside a saved Detailed Estimate as saveable', () => {
    const context = resolveDesignBuilderPersistenceContext({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      userId: 'user-1',
    });
    const blankPreset = createBlankCmuBuildingPreset();
    const serialized = serializePersistedDesignBuilderState(blankPreset, {
      visualStyle: 'material_preview',
      materialSelections: {
        cmuMaterialId: 'concrete-025',
        mortarMaterialId: 'concrete-032',
        castConcreteMaterialId: 'concrete-044d',
        roofSheetMaterialId: 'corrugated-steel-009',
        structuralSteelMaterialId: 'painted-metal-004',
        roofSheetTintId: 'charcoal',
      },
    });
    expect(serialized.displayPreferences?.materialSelections?.cmuMaterialId).toBe('concrete-025');
    expect(context.canPersist).toBe(true);
    expect(serialized.openings).toEqual([]);
    expect(serialized.wallLayout.segments).toEqual([]);
  });

  it('never shows demo save copy in project_bound mode', () => {
    expect(persistenceStatusMessage('project_bound')).toBe('Design is linked to this Detailed Estimate.');
    expect(persistenceStatusMessage('project_bound')).not.toMatch(/sign in/i);
    expect(persistenceStatusMessage('project_bound')).not.toMatch(/load the example/i);
  });

  it('shows standalone guidance without implying project save support', () => {
    const message = persistenceStatusMessage('standalone_demo');
    expect(message).toMatch(/saved Detailed Estimate/i);
    expect(message).not.toMatch(/sign in/i);
    expect(message).not.toMatch(/load the example/i);
  });

  it('serializes canonical parametric state for save', () => {
    const preset = footingPreset(1.5, 1.6, 0.45, 0.55);
    const serialized = serializePersistedDesignBuilderState(preset);
    expect(serialized.rcFrameFoundation.isolatedFootings.widthMeters).toBe(1.5);
    expect(serialized.rcFrameFoundation.isolatedFootings.lengthMeters).toBe(1.6);
    expect(serialized.rcFrameFoundation.isolatedFootings.thicknessMeters).toBe(0.45);
    expect(serialized.rcFrameFoundation.isolatedFootings.dropBelowPlinthBeamMeters).toBe(0.55);
    expect(serialized.buildingSystemMode).toBe('reinforced_concrete_frame_with_cmu_infill');
  });

  it('reloads RC settings exactly from persisted metadata', () => {
    const preset = footingPreset(1.5, 1.6, 0.45, 0.55);
    const model: DesignModel = {
      id: 'model-1',
      projectId: 'project-1',
      estimateId: 'estimate-1',
      name: 'Saved design',
      unitSystem: 'metric',
      modelType: 'cmu_building',
      status: 'draft',
      createdBy: 'user-1',
      metadata: {
        designBuilderState: serializePersistedDesignBuilderState(preset),
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const restoredState = readPersistedDesignBuilderState(model);
    const restoredPreset = presetFromStoredDesign({
      objects: [],
      persistedState: restoredState,
      fallbackName: model.name,
    });
    expect(restoredPreset.foundationSettings.isolatedFootings.widthMeters).toBe(1.5);
    expect(restoredPreset.foundationSettings.isolatedFootings.lengthMeters).toBe(1.6);
    expect(restoredPreset.foundationSettings.isolatedFootings.thicknessMeters).toBe(0.45);
    expect(restoredPreset.foundationSettings.isolatedFootings.dropBelowPlinthBeamMeters).toBe(0.55);
    expect(restoredPreset.buildingSystemMode).toBe('reinforced_concrete_frame_with_cmu_infill');
  });

  it('merges stored objects with persisted RC metadata on reload', () => {
    const preset = footingPreset(1.4, 1.7, 0.4, 0.5);
    const objects: DesignModelObject[] = [
      {
        id: 'layout-1',
        designModelId: 'model-1',
        projectId: 'project-1',
        objectType: 'wall_layout',
        name: 'Wall Layout',
        parentObjectId: null,
        parameters: preset.wallLayout,
        quantitySummary: {},
        estimateMapping: {},
        geometryCache: null,
        createdAt: '',
        updatedAt: '',
      },
    ];
    const restored = presetFromStoredDesign({
      objects,
      persistedState: serializePersistedDesignBuilderState(preset),
    });
    expect(restored.wallLayout.segments.length).toBeGreaterThan(0);
    expect(restored.foundationSettings.isolatedFootings.widthMeters).toBe(1.4);
  });

  it('reports save state labels for dirty and saved flows', () => {
    expect(saveStateLabel('unsaved')).toBe('Unsaved changes');
    expect(saveStateLabel('saved')).toBe('Saved');
    expect(saveStateLabel('saving')).toBe('Saving…');
    expect(saveStateLabel('failed')).toBe('Save failed');
  });

  it('rejects save when persistence context is incomplete', () => {
    expect(() =>
      validateDesignBuilderPersistenceContext({
        projectId: 'project-1',
        estimateId: null,
        userId: 'user-1',
        workspaceId: null,
        canPersist: false,
        mode: 'standalone_demo',
      }),
    ).toThrow(/saved project estimate/i);
  });

  it('migrates older persisted payloads without schema version', () => {
    const preset = footingPreset(1.1, 1.3, 0.35, 0.42);
    const raw = {
      rcFrameFoundation: preset.foundationSettings,
      roofSystem: preset.roofSystem,
      wallLayout: preset.wallLayout,
      openings: preset.wall.openings,
      buildingSystemMode: preset.buildingSystemMode,
    };
    const migrated = migratePersistedDesignBuilderState(raw);
    expect(migrated?.schemaVersion).toBe(1);
    expect(migrated?.rcFrameFoundation.isolatedFootings.widthMeters).toBe(1.1);
  });

  it('writes persisted state into design model metadata', () => {
    const preset = rcPreset();
    const model: DesignModel = {
      id: 'model-1',
      projectId: 'project-1',
      estimateId: 'estimate-1',
      name: 'Saved design',
      unitSystem: 'metric',
      modelType: 'cmu_building',
      status: 'draft',
      createdBy: 'user-1',
      metadata: { source: 'parametric_design_builder' },
      createdAt: '',
      updatedAt: '',
    };
    const metadata = designModelMetadataWithPersistedState(model, preset, { activeView: '3d' });
    const nested = metadata.designBuilderState as ReturnType<typeof serializePersistedDesignBuilderState>;
    expect(nested.schemaVersion).toBe(1);
    expect(nested.displayPreferences?.activeView).toBe('3d');
    expect(nested.rcFrameFoundation).toBeDefined();
    expect(nested.roofSystem).toBeDefined();
  });
});
