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
import {
  addFixtureToPlumbingSystem,
  buildPlumbingFixtureSchedule,
  createDefaultPlumbingSystem,
} from '../plumbing';

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

  it('uses stored legacy truss spacing as canonical roof-system truss spacing on reload', () => {
    const preset = rcPreset();
    const staleMetadata = serializePersistedDesignBuilderState({
      ...preset,
      roofSystem: {
        ...preset.roofSystem,
        steelTrusses: {
          ...preset.roofSystem.steelTrusses,
          maxSpacingMeters: 2.4,
        },
      },
    });
    const objects: DesignModelObject[] = [
      {
        id: 'truss-1',
        designModelId: 'model-1',
        projectId: 'project-1',
        objectType: 'steel_truss_system',
        name: 'Steel Truss System',
        parentObjectId: null,
        parameters: { ...preset.truss, spacingMeters: 0.6 },
        quantitySummary: {},
        estimateMapping: {},
        geometryCache: null,
        createdAt: '',
        updatedAt: '',
      },
    ];

    const restored = presetFromStoredDesign({
      objects,
      persistedState: staleMetadata,
    });

    expect(restored.truss.spacingMeters).toBeCloseTo(0.6, 6);
    expect(restored.roofSystem.steelTrusses.maxSpacingMeters).toBeCloseTo(0.6, 6);
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
      openings: preset.wall.openings.map((opening) =>
        opening.type === 'window' ? { ...opening, sillHeightMeters: 1 } : opening,
      ),
      buildingSystemMode: preset.buildingSystemMode,
    };
    const migrated = migratePersistedDesignBuilderState(raw);
    expect(migrated?.schemaVersion).toBe(3);
    expect(migrated?.rcFrameFoundation.isolatedFootings.widthMeters).toBe(1.1);
    expect(migrated?.openings.find((opening) => opening.type === 'window')?.sillHeightMeters).toBeCloseTo(1.2, 6);
    expect(migrated?.placedComponents).toEqual([]);
    expect(migrated?.plumbingSystem.fixtures).toEqual([]);
    expect(migrated?.displayPreferences?.elevationView?.face).toBe('north');
  });

  it('maps legacy plan and elevation views into the current 2D drawing state', () => {
    const preset = rcPreset();
    const legacyElevationPayload = {
      rcFrameFoundation: preset.foundationSettings,
      roofSystem: preset.roofSystem,
      wallLayout: preset.wallLayout,
      openings: [],
      buildingSystemMode: preset.buildingSystemMode,
      displayPreferences: {
        activeView: 'elevation',
        elevationView: { face: 'west' },
      },
    } as unknown as Parameters<typeof migratePersistedDesignBuilderState>[0];
    const legacyPlanPayload = {
      rcFrameFoundation: preset.foundationSettings,
      roofSystem: preset.roofSystem,
      wallLayout: preset.wallLayout,
      openings: [],
      buildingSystemMode: preset.buildingSystemMode,
      displayPreferences: {
        activeView: 'plan',
      },
    } as unknown as Parameters<typeof migratePersistedDesignBuilderState>[0];
    const migratedElevation = migratePersistedDesignBuilderState(legacyElevationPayload);
    const migratedPlan = migratePersistedDesignBuilderState(legacyPlanPayload);

    expect(migratedElevation?.displayPreferences?.activeView).toBe('2d');
    expect(migratedElevation?.displayPreferences?.active2DView).toBe('elevation-view');
    expect(migratedElevation?.displayPreferences?.elevationView?.face).toBe('west');
    expect(migratedPlan?.displayPreferences?.activeView).toBe('2d');
    expect(migratedPlan?.displayPreferences?.active2DView).toBe('foundation-plan');
  });

  it('restores floor-plan and defaults invalid 2D drawing views to foundation', () => {
    const preset = rcPreset();
    const floorPlanPayload = {
      rcFrameFoundation: preset.foundationSettings,
      roofSystem: preset.roofSystem,
      wallLayout: preset.wallLayout,
      openings: [],
      buildingSystemMode: preset.buildingSystemMode,
      displayPreferences: {
        activeView: '2d',
        active2DView: 'floor-plan',
      },
    } as unknown as Parameters<typeof migratePersistedDesignBuilderState>[0];
    const invalidPayload = {
      ...floorPlanPayload,
      displayPreferences: {
        activeView: '2d',
        active2DView: 'bad-plan',
      },
    } as unknown as Parameters<typeof migratePersistedDesignBuilderState>[0];

    expect(migratePersistedDesignBuilderState(floorPlanPayload)?.displayPreferences?.active2DView).toBe('floor-plan');
    expect(migratePersistedDesignBuilderState(invalidPayload)?.displayPreferences?.active2DView).toBe('foundation-plan');
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
    const annotation = {
      id: 'dimension-1',
      type: 'dimension',
      viewType: 'foundation-plan',
      points: {
        start: { x: 0, z: 0 },
        end: { x: 4, z: 0 },
      },
      offsetPoint: { x: 2, z: -0.5 },
      dimensionKind: 'horizontal',
      measuredValue: 4,
      unit: 'm',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as const;
    const metadata = designModelMetadataWithPersistedState(model, preset, {
      activeView: '2d',
      active2DView: 'elevation-view',
      elevationView: { face: 'east' },
    }, [], [annotation]);
    const nested = metadata.designBuilderState as ReturnType<typeof serializePersistedDesignBuilderState>;
    expect(nested.schemaVersion).toBe(3);
    expect(nested.displayPreferences?.activeView).toBe('2d');
    expect(nested.displayPreferences?.active2DView).toBe('elevation-view');
    expect(nested.displayPreferences?.elevationView?.face).toBe('east');
    expect(nested.placedComponents).toEqual([]);
    expect(nested.annotations).toEqual([annotation]);
    expect(migratePersistedDesignBuilderState(nested)?.annotations).toEqual([annotation]);
    expect(nested.rcFrameFoundation).toBeDefined();
    expect(nested.roofSystem).toBeDefined();
    expect(nested.plumbingSystem).toBeDefined();
  });

  it('places plumbing fixtures as model objects with connection nodes', () => {
    const system = addFixtureToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      fixtureType: 'lavatory',
      position: { x: 2, y: 0, z: 3 },
      idSeed: 'test-lav',
    });

    expect(system.fixtures).toHaveLength(1);
    expect(system.nodes).toHaveLength(4);
    expect(system.fixtures[0]?.connectionNodeIds.cold_water).toHaveLength(1);
    expect(system.fixtures[0]?.connectionNodeIds.hot_water).toHaveLength(1);
    expect(system.fixtures[0]?.connectionNodeIds.sanitary).toHaveLength(1);
    expect(system.fixtures[0]?.connectionNodeIds.vent).toHaveLength(1);
    expect(system.nodes.every((node) => node.fixtureId === system.fixtures[0]?.id)).toBe(true);
  });

  it('generates fixture schedule rows from actual plumbing fixtures', () => {
    const withToilet = addFixtureToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      fixtureType: 'toilet',
      position: { x: 1, y: 0, z: 1 },
      idSeed: 'test-wc',
    });
    const withHoseBib = addFixtureToPlumbingSystem({
      system: withToilet,
      fixtureType: 'hose_bib',
      position: { x: 4, y: 0, z: 1 },
      idSeed: 'test-hb',
    });

    const schedule = buildPlumbingFixtureSchedule(withHoseBib);

    expect(schedule).toHaveLength(2);
    expect(schedule.find((row) => row.mark === 'WC-1')?.sanitary).toBe(true);
    expect(schedule.find((row) => row.mark === 'HB-1')?.coldWater).toBe(true);
    expect(schedule.find((row) => row.mark === 'HB-1')?.hotWater).toBe(false);
  });

  it('round trips plumbing system through persisted design metadata', () => {
    const preset = rcPreset();
    const plumbingSystem = addFixtureToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      fixtureType: 'kitchen_sink',
      position: { x: 2.5, y: 0, z: 1.5 },
      idSeed: 'test-ks',
    });
    const serialized = serializePersistedDesignBuilderState(
      preset,
      undefined,
      [],
      [],
      plumbingSystem,
    );
    const migrated = migratePersistedDesignBuilderState(serialized);

    expect(migrated?.plumbingSystem.fixtures).toHaveLength(1);
    expect(migrated?.plumbingSystem.nodes).toHaveLength(4);
    expect(migrated?.plumbingSystem.fixtures[0]?.mark).toBe('KS-1');
  });
});
