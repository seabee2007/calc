import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  addFixtureToPlumbingSystem,
  addRunToPlumbingSystem,
  buildPlumbingLegend,
  commonFittingsForPipe,
  createDefaultPlumbingSystem,
  defaultPipeScheduleForMaterial,
  defaultStockLengthForPipe,
  generatePlumbingFittingTakeoff,
  generatePlumbingPipeTakeoff,
  formatPlumbingRunLabel,
  normalizePlumbingSystem,
  validatePlumbingSystem,
} from '../plumbing';
import { buildPlumbingFixtureSchedule } from '../plumbing/plumbingDefaults';
import { createEmptyWallLayout } from '../domain/wallLayoutRules';
import DesignBuilderPlanCanvas from '../ui/DesignBuilderPlanCanvas';

describe('Design Builder plumbing plan', () => {
  it('rotates fixture connection nodes with the placed fixture', () => {
    const system = addFixtureToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      fixtureType: 'lavatory',
      position: { x: 2, y: 0, z: 3 },
      rotationRadians: Math.PI / 2,
      idSeed: 'rotated-lav',
    });

    const fixture = system.fixtures[0]!;
    const coldNodeId = fixture.connectionNodeIds.cold_water?.[0];
    const coldNode = system.nodes.find((node) => node.id === coldNodeId);

    expect(coldNode?.position.x).toBeCloseTo(2.08, 4);
    expect(coldNode?.position.z).toBeCloseTo(2.88, 4);
  });

  it('creates model-backed pipe runs with canonical path and generated labels', () => {
    const withLav = addFixtureToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      fixtureType: 'lavatory',
      position: { x: 0, y: 0, z: 0 },
      idSeed: 'lav',
    });
    const withSink = addFixtureToPlumbingSystem({
      system: withLav,
      fixtureType: 'kitchen_sink',
      position: { x: 4, y: 0, z: 0 },
      idSeed: 'sink',
    });
    const startNodeId = withSink.fixtures[0]!.connectionNodeIds.sanitary![0]!;
    const endNodeId = withSink.fixtures[1]!.connectionNodeIds.sanitary![0]!;

    const system = addRunToPlumbingSystem({
      system: withSink,
      systemType: 'sanitary',
      startNodeId,
      endNodeId,
      routePoints: [{ x: 2, y: 0, z: -1 }],
      diameterInches: 3,
      slopeInPerFt: 0.25,
      idSeed: 'ss',
    });

    expect(system.runs).toHaveLength(1);
    expect(system.runs[0]!.path).toHaveLength(3);
    expect(system.runs[0]!.path[1]).toMatchObject({ x: 2, z: -1 });
    expect(formatPlumbingRunLabel(system.runs[0]!)).toBe('3" SS @ 0.25"/FT');
  });

  it('applies and normalizes pipe schedule defaults by material', () => {
    expect(defaultPipeScheduleForMaterial('pvc')).toBe('SCH 40');
    expect(defaultPipeScheduleForMaterial('pex')).toBe('N/A');

    const normalized = normalizePlumbingSystem({
      ...createDefaultPlumbingSystem(),
      runs: [
        {
          id: 'old-pvc',
          system: 'sanitary',
          startNodeId: 'a',
          endNodeId: 'b',
          path: [],
          diameterInches: 3,
          material: 'pvc',
          elevationMode: 'under_slab',
          labelVisible: true,
        },
        {
          id: 'old-pex',
          system: 'cold_water',
          startNodeId: 'c',
          endNodeId: 'd',
          path: [],
          diameterInches: 0.75,
          material: 'pex',
          elevationMode: 'in_wall',
          labelVisible: true,
        },
      ],
    });

    expect(normalized.runs[0]?.schedule).toBe('SCH 40');
    expect(normalized.runs[1]?.schedule).toBe('N/A');
    expect(normalized.runs[0]).toMatchObject({ stockLengthFt: 10, stockLengthPreset: '10ft', stockLengthKind: 'stick' });
    expect(normalized.runs[1]).toMatchObject({ stockLengthFt: 100, stockLengthPreset: '100ft_coil', stockLengthKind: 'coil' });
  });

  it('defaults and exposes pipe stock lengths by material', () => {
    expect(defaultStockLengthForPipe({ material: 'pvc', system: 'sanitary' })).toMatchObject({
      stockLengthFt: 10,
      stockLengthPreset: '10ft',
      stockLengthKind: 'stick',
    });
    expect(defaultStockLengthForPipe({ material: 'pex', system: 'cold_water' })).toMatchObject({
      stockLengthFt: 100,
      stockLengthPreset: '100ft_coil',
      stockLengthKind: 'coil',
    });
    expect(defaultStockLengthForPipe({ material: 'cast_iron', system: 'sanitary' })).toMatchObject({
      stockLengthFt: 5,
      stockLengthPreset: '5ft',
      stockLengthKind: 'stick',
    });
  });

  it('filters common fittings by pipe system and material', () => {
    const sanitary = commonFittingsForPipe({ system: 'sanitary', material: 'pvc' }).map((fitting) => fitting.type);
    const water = commonFittingsForPipe({ system: 'cold_water', material: 'pex' }).map((fitting) => fitting.type);
    const vent = commonFittingsForPipe({ system: 'vent', material: 'pvc' }).map((fitting) => fitting.type);

    expect(sanitary).toEqual(expect.arrayContaining(['wye', 'sanitary_tee', 'elbow_90_long_sweep']));
    expect(water).toEqual(expect.arrayContaining(['tee', 'ball_valve', 'drop_ear_elbow', 'coupling']));
    expect(vent).toEqual(expect.arrayContaining(['vent_tee', 'roof_vent_boot']));
  });

  it('converts pipe run length to stock count and waste grouped by stock kind', () => {
    const withLav = addFixtureToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      fixtureType: 'lavatory',
      position: { x: 0, y: 0, z: 0 },
      idSeed: 'takeoff-lav',
    });
    const withSink = addFixtureToPlumbingSystem({
      system: withLav,
      fixtureType: 'kitchen_sink',
      position: { x: 3.048, y: 0, z: 0 },
      idSeed: 'takeoff-sink',
    });
    const system = addRunToPlumbingSystem({
      system: withSink,
      systemType: 'cold_water',
      startNodeId: withSink.fixtures[0]!.connectionNodeIds.cold_water![0]!,
      endNodeId: withSink.fixtures[1]!.connectionNodeIds.cold_water![0]!,
      material: 'pex',
      diameterInches: 0.5,
      stockLengthFt: 100,
      stockLengthPreset: '100ft_coil',
      stockLengthKind: 'coil',
    });

    const takeoff = generatePlumbingPipeTakeoff(system);
    expect(takeoff).toHaveLength(1);
    expect(takeoff[0]).toMatchObject({ material: 'pex', stockLengthFt: 100, stockLengthKind: 'coil', stockCount: 1 });
    expect(takeoff[0]!.totalLengthFt).toBeCloseTo(10, 0);
    expect(takeoff[0]!.wasteFt).toBeCloseTo(90, 0);
  });

  it('auto-generates fitting model objects at route bends and counts them in takeoff', () => {
    const withLav = addFixtureToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      fixtureType: 'lavatory',
      position: { x: 0, y: 0, z: 0 },
      idSeed: 'fit-lav',
    });
    const withSink = addFixtureToPlumbingSystem({
      system: withLav,
      fixtureType: 'kitchen_sink',
      position: { x: 2, y: 0, z: 2 },
      idSeed: 'fit-sink',
    });
    const system = addRunToPlumbingSystem({
      system: withSink,
      systemType: 'sanitary',
      startNodeId: withSink.fixtures[0]!.connectionNodeIds.sanitary![0]!,
      endNodeId: withSink.fixtures[1]!.connectionNodeIds.sanitary![0]!,
      routePoints: [{ x: 2, y: 0, z: 0 }],
      diameterInches: 3,
      material: 'pvc',
      slopeInPerFt: 0.25,
    });

    expect(system.fittings.some((fitting) => fitting.type === 'elbow_90_long_sweep' && fitting.isAutoGenerated)).toBe(true);
    expect(generatePlumbingFittingTakeoff(system).some((row) => row.type === 'elbow_90_long_sweep' && row.count === 1)).toBe(true);
  });

  it('validates fitting compatibility and stock length values', () => {
    const system = {
      ...createDefaultPlumbingSystem(),
      runs: [
        {
          id: 'bad-stock',
          system: 'sanitary' as const,
          startNodeId: 'a',
          endNodeId: 'b',
          path: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
          diameterInches: 3,
          material: 'pvc' as const,
          schedule: 'SCH 40' as const,
          stockLengthFt: 0,
          stockLengthPreset: 'custom' as const,
          stockLengthKind: 'custom' as const,
          slopeInPerFt: 0.25,
          elevationMode: 'under_slab' as const,
          labelVisible: true,
        },
      ],
      fittings: [
        {
          id: 'bad-fitting',
          type: 'ball_valve' as const,
          system: 'sanitary' as const,
          nodeId: 'a',
          connectedRunIds: ['bad-stock'],
          diameterInches: null,
          material: 'pvc' as const,
          schedule: 'SCH 40' as const,
          rotationRad: 0,
          elevationMode: 'under_slab' as const,
          labelVisible: true,
          isAutoGenerated: false,
        },
        {
          id: 'bad-material-fitting',
          type: 'wye' as const,
          system: 'sanitary' as const,
          nodeId: 'a',
          connectedRunIds: ['bad-stock'],
          diameterInches: 3,
          material: 'pex' as const,
          schedule: 'N/A' as const,
          rotationRad: 0,
          elevationMode: 'under_slab' as const,
          labelVisible: true,
          isAutoGenerated: false,
        },
      ],
    };

    const codes = validatePlumbingSystem(system).map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining([
      'invalid_stock_length',
      'invalid_fitting_for_system',
      'invalid_fitting_for_material',
      'fitting_missing_diameter',
    ]));
  });

  it('normalizes persisted fitting and stock length fields', () => {
    const normalized = normalizePlumbingSystem({
      ...createDefaultPlumbingSystem(),
      runs: [
        {
          id: 'persist-run',
          system: 'cold_water',
          startNodeId: 'node-a',
          endNodeId: 'node-b',
          path: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
          diameterInches: 0.5,
          material: 'pex',
          schedule: 'N/A',
          stockLengthFt: 300,
          stockLengthPreset: '300ft_coil',
          stockLengthKind: 'coil',
          elevationMode: 'in_wall',
          labelVisible: true,
        },
      ],
      fittings: [
        {
          id: 'persist-fitting',
          type: 'tee',
          system: 'cold_water',
          nodeId: 'node-a',
          connectedRunIds: ['persist-run'],
          diameterInches: 0.5,
          material: 'pex',
          schedule: 'N/A',
          rotationRad: 0.5,
          elevationMode: 'in_wall',
          labelVisible: false,
          isAutoGenerated: true,
        },
      ],
    });

    expect(normalized.runs[0]).toMatchObject({
      stockLengthFt: 300,
      stockLengthPreset: '300ft_coil',
      stockLengthKind: 'coil',
    });
    expect(normalized.fittings[0]).toMatchObject({
      type: 'tee',
      diameterInches: 0.5,
      material: 'pex',
      schedule: 'N/A',
      connectedRunIds: ['persist-run'],
      isAutoGenerated: true,
      labelVisible: false,
    });
  });

  it('generates fixture schedule and legend from actual plumbing model objects', () => {
    const system = addFixtureToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      fixtureType: 'hose_bib',
      position: { x: 1, y: 0, z: 1 },
      idSeed: 'hb',
    });

    const schedule = buildPlumbingFixtureSchedule(system);
    const legend = buildPlumbingLegend(system);

    expect(schedule).toHaveLength(1);
    expect(schedule[0]).toMatchObject({ mark: 'HB-1', coldWater: true, hotWater: false });
    expect(legend.map((item) => item.key)).toContain('cold_water');
  });

  it('validates missing run endpoints, missing sanitary slope, and foundation conflicts', () => {
    const withFixtures = addFixtureToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      fixtureType: 'floor_drain',
      position: { x: 0, y: 0, z: 0 },
      idSeed: 'fd',
    });
    const startNodeId = withFixtures.fixtures[0]!.connectionNodeIds.sanitary![0]!;
    const system = {
      ...withFixtures,
      runs: [
        {
          id: 'bad-run',
          system: 'sanitary' as const,
          startNodeId,
          endNodeId: 'missing-node',
          path: [{ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
          diameterInches: null,
          material: 'pvc' as const,
          elevationMode: 'under_slab' as const,
          labelVisible: true,
        },
      ],
    };

    const issues = validatePlumbingSystem(system, {
      isolatedFootings: [{ id: 'footing-a', position: { x: 0, z: 0 }, widthMeters: 0.5, lengthMeters: 0.5 }],
    });

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'run_missing_end_node',
      'run_missing_diameter',
      'sanitary_run_missing_slope',
      'pipe_crosses_foundation',
    ]));
  });

  it('renders plumbing walls as solid primary references and foundation as dashed gray overlay', () => {
    const layout = createEmptyWallLayout({
      nodes: [
        { id: 'node-a', x: 0, z: 0 },
        { id: 'node-b', x: 4, z: 0 },
      ],
      segments: [
        {
          id: 'segment-a',
          startNodeId: 'node-a',
          endNodeId: 'node-b',
          thicknessMeters: 0.2,
          heightMeters: 2.4,
          wallRole: 'exterior',
        },
      ],
    });
    const frameSystem = {
      kind: 'structural_frame_system' as const,
      buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill' as const,
      defaultColumnWidthMeters: 0.3,
      defaultColumnDepthMeters: 0.3,
      defaultGradeBeamWidthMeters: 0.2,
      defaultGradeBeamDepthMeters: 0.3,
      defaultRingBeamWidthMeters: 0.2,
      defaultRingBeamDepthMeters: 0.3,
      columns: [],
      beams: [{
        id: 'grade-beam-a',
        name: 'Grade Beam A',
        kind: 'grade_beam' as const,
        startColumnId: 'column-a',
        endColumnId: 'column-b',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 4, y: 0, z: 0 },
        widthMeters: 0.24,
        depthMeters: 0.3,
        baseElevationMeters: 0,
        topElevationMeters: 0.3,
        source: 'auto_frame_layout' as const,
      }],
    };

    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={layout}
        toolMode="select"
        active2DView="plumbing-plan"
        viewport={{ centerX: 2, centerZ: 0, zoom: 100 }}
        frameSystem={frameSystem}
        plumbingSystem={createDefaultPlumbingSystem()}
        onInteraction={() => undefined}
      />,
    );

    const wall = container.querySelector('[data-plumbing-wall-reference="true"]');
    const foundation = container.querySelector('[data-plumbing-foundation-overlay="true"]');

    expect(wall?.getAttribute('stroke')).toBe('#0f172a');
    expect(wall?.getAttribute('stroke-dasharray')).toBeNull();
    expect(foundation?.getAttribute('stroke')).toBe('#94a3b8');
    expect(foundation?.getAttribute('stroke-dasharray')).toBe('8 5');
  });

  it('renders legacy plumbing systems without a fittings collection', () => {
    const { fittings: _fittings, ...legacySystem } = createDefaultPlumbingSystem();

    expect(() => render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="select"
        active2DView="plumbing-plan"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        plumbingSystem={legacySystem as ReturnType<typeof createDefaultPlumbingSystem>}
        onInteraction={() => undefined}
      />,
    )).not.toThrow();
  });
});
