import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  addFixtureToPlumbingSystem,
  addCmuSepticTankToPlumbingSystem,
  addRunToPlumbingSystem,
  buildPlumbingLegend,
  commonFittingsForPipe,
  createCmuSepticTank,
  createCmuSepticTankNodes,
  createOrReplaceFixtureRoughInAssembly,
  createDefaultPlumbingSystem,
  defaultPipeScheduleForMaterial,
  defaultStockLengthForPipe,
  generatePlumbingFittingTakeoff,
  generatePlumbingPipeTakeoff,
  getRenderableSolvedPlumbingFittings,
  formatPlumbingRunLabel,
  normalizePlumbingSystem,
  solvePlumbingModel,
  validatePlumbingSystem,
  type PlumbingNode,
  type PlumbingRun,
} from '../plumbing';
import { buildPlumbingFixtureSchedule } from '../plumbing/plumbingDefaults';
import { createEmptyWallLayout } from '../domain/wallLayoutRules';
import DesignBuilderPlanCanvas from '../ui/DesignBuilderPlanCanvas';
import { hitTestPlumbingSystem } from '../plumbing/canvas2d/plumbingHitTesting';

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

  it('generates model-backed WC rough-ins and counts riser pipe and fittings in takeoff', () => {
    const withFixture = addFixtureToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      fixtureType: 'toilet',
      position: { x: 0, y: 0, z: 0 },
      idSeed: 'rough-wc',
    });
    const mainNodes: PlumbingNode[] = [
      { id: 'main-a', kind: 'building_drain_exit', system: 'sanitary', position: { x: -2, y: -0.4, z: 0.12 }, label: 'A' },
      { id: 'main-b', kind: 'building_drain_exit', system: 'sanitary', position: { x: 2, y: -0.4, z: 0.12 }, label: 'B' },
    ];
    const mainRun: PlumbingRun = {
      id: 'main-run',
      system: 'sanitary',
      startNodeId: 'main-a',
      endNodeId: 'main-b',
      path: [mainNodes[0]!.position, mainNodes[1]!.position],
      diameterInches: 3,
      material: 'pvc',
      schedule: 'SCH 40',
      stockLengthFt: 10,
      stockLengthPreset: '10ft',
      stockLengthKind: 'stick',
      slopeInPerFt: 0.25,
      elevationMode: 'under_slab',
      labelVisible: true,
    };
    const result = createOrReplaceFixtureRoughInAssembly({
      system: { ...withFixture, nodes: [...withFixture.nodes, ...mainNodes], runs: [mainRun] },
      fixtureId: withFixture.fixtures[0]!.id,
      mainRunId: mainRun.id,
      tapPoint: { x: 0, y: -0.4, z: 0.12 },
      segmentIndex: 1,
    });

    expect(result.roughIn).toBeTruthy();
    expect(result.system.roughIns).toHaveLength(1);
    expect(result.system.runs.some((run) => run.id === result.roughIn!.riserRunId && run.elevationMode === 'vertical')).toBe(true);
    expect(result.system.fittings.some((fitting) => fitting.type === 'closet_flange')).toBe(true);
    expect(result.system.fittings.some((fitting) => fitting.type === 'closet_bend')).toBe(true);
    expect(generatePlumbingPipeTakeoff(result.system).some((row) => row.system === 'sanitary' && row.totalLengthFt > 0)).toBe(true);
    expect(generatePlumbingFittingTakeoff(result.system).some((row) => row.type === 'closet_flange' && row.count === 1)).toBe(true);

    const normalized = normalizePlumbingSystem(result.system);
    expect(normalized.roughIns[0]).toMatchObject({
      id: result.roughIn!.id,
      riserRunId: result.roughIn!.riserRunId,
      fittingIds: result.roughIn!.fittingIds,
    });
  });

  it('generates lavatory and floor drain rough-in trap fittings', () => {
    const withLav = addFixtureToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      fixtureType: 'lavatory',
      position: { x: 0, y: 0, z: 0 },
      idSeed: 'rough-lav',
    });
    const withDrain = addFixtureToPlumbingSystem({
      system: withLav,
      fixtureType: 'floor_drain',
      position: { x: 1, y: 0, z: 0 },
      idSeed: 'rough-fd',
    });
    const mainNodes: PlumbingNode[] = [
      { id: 'main-a', kind: 'building_drain_exit', system: 'sanitary', position: { x: -2, y: -0.4, z: 0 }, label: 'A' },
      { id: 'main-b', kind: 'building_drain_exit', system: 'sanitary', position: { x: 3, y: -0.4, z: 0 }, label: 'B' },
    ];
    const mainRun: PlumbingRun = {
      id: 'main-run',
      system: 'sanitary',
      startNodeId: 'main-a',
      endNodeId: 'main-b',
      path: [mainNodes[0]!.position, mainNodes[1]!.position],
      diameterInches: 3,
      material: 'pvc',
      schedule: 'SCH 40',
      stockLengthFt: 10,
      stockLengthPreset: '10ft',
      stockLengthKind: 'stick',
      slopeInPerFt: 0.25,
      elevationMode: 'under_slab',
      labelVisible: true,
    };
    const baseSystem = { ...withDrain, nodes: [...withDrain.nodes, ...mainNodes], runs: [mainRun] };
    const lav = createOrReplaceFixtureRoughInAssembly({
      system: baseSystem,
      fixtureId: withDrain.fixtures[0]!.id,
      mainRunId: mainRun.id,
      tapPoint: { x: -0.5, y: -0.4, z: 0 },
      segmentIndex: 1,
    });
    const lavTapFitting = lav.system.fittings.find((fitting) => fitting.id === lav.roughIn?.fittingIds[0]);
    const lavWyeTakeoff = generatePlumbingFittingTakeoff(lav.system).find((row) => row.type === 'wye');
    const drain = createOrReplaceFixtureRoughInAssembly({
      system: lav.system,
      fixtureId: withDrain.fixtures[1]!.id,
      mainRunId: mainRun.id,
      tapPoint: { x: 1.5, y: -0.4, z: 0 },
      segmentIndex: 1,
    });

    expect(lavTapFitting).toMatchObject({
      type: 'wye',
      diameterInches: 3,
      secondaryDiameterInches: 1.5,
    });
    expect(lavWyeTakeoff).toMatchObject({
      type: 'wye',
      diameterInches: 3,
      secondaryDiameterInches: 1.5,
      description: '3" x 3" x 1.5" sanitary wye',
      count: 1,
    });
    expect(lav.system.fittings.some((fitting) => fitting.type === 'tee' || fitting.type === 'sanitary_tee')).toBe(false);
    expect(drain.system.fittings.some((fitting) => fitting.type === 'p_trap')).toBe(true);
    expect(drain.system.fittings.some((fitting) => fitting.type === 'trap_adapter')).toBe(true);
    expect(drain.system.fittings.some((fitting) => fitting.type === 'floor_drain_body')).toBe(true);
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

  it('auto-generates couplers from pipe stick length and counts them in fitting takeoff', () => {
    const nodes: PlumbingNode[] = [
      {
        id: 'stick-start',
        kind: 'fixture_connection',
        system: 'sanitary',
        position: { x: 0, y: -0.4, z: 0 },
        label: 'Start',
      },
      {
        id: 'stick-end',
        kind: 'fixture_connection',
        system: 'sanitary',
        position: { x: 34 * 0.3048, y: -0.4, z: 0 },
        label: 'End',
      },
    ];
    const system = addRunToPlumbingSystem({
      system: { ...createDefaultPlumbingSystem(), nodes },
      systemType: 'sanitary',
      startNodeId: 'stick-start',
      endNodeId: 'stick-end',
      diameterInches: 4,
      material: 'pvc',
      stockLengthFt: 10,
      stockLengthPreset: 'custom',
      stockLengthKind: 'stick',
      slopeInPerFt: 0.125,
    });
    const run = system.runs[0]!;
    const couplers = system.fittings.filter((fitting) => fitting.type === 'coupling');
    const couplerNodeXs = system.nodes
      .filter((node) => node.label === 'Pipe coupling')
      .map((node) => node.position.x);

    expect(couplers).toHaveLength(3);
    expect(run.path).toHaveLength(2);
    expect(couplerNodeXs[0]).toBeCloseTo(10 * 0.3048, 6);
    expect(couplerNodeXs[1]).toBeCloseTo(20 * 0.3048, 6);
    expect(couplerNodeXs[2]).toBeCloseTo(30 * 0.3048, 6);
    expect(generatePlumbingFittingTakeoff(system).some((row) => row.type === 'coupling' && row.count === 3)).toBe(true);
  });

  it('moves near-end couplers back so the final pipe piece is at least four inches', () => {
    const runLengthFt = 10 + 2 / 12;
    const nodes: PlumbingNode[] = [
      {
        id: 'stub-start',
        kind: 'fixture_connection',
        system: 'sanitary',
        position: { x: 0, y: -0.4, z: 0 },
        label: 'Start',
      },
      {
        id: 'stub-end',
        kind: 'fixture_connection',
        system: 'sanitary',
        position: { x: runLengthFt * 0.3048, y: -0.4, z: 0 },
        label: 'End',
      },
    ];
    const system = addRunToPlumbingSystem({
      system: { ...createDefaultPlumbingSystem(), nodes },
      systemType: 'sanitary',
      startNodeId: 'stub-start',
      endNodeId: 'stub-end',
      diameterInches: 4,
      material: 'pvc',
      stockLengthFt: 10,
      stockLengthPreset: 'custom',
      stockLengthKind: 'stick',
      slopeInPerFt: 0.125,
    });
    const couplerNode = system.nodes.find((node) => node.label === 'Pipe coupling');
    const takeoff = generatePlumbingPipeTakeoff(system).find((row) => row.material === 'pvc' && row.diameterInches === 4);
    const fittingTakeoff = generatePlumbingFittingTakeoff(system).find((row) => row.type === 'coupling');

    expect(system.fittings.filter((fitting) => fitting.type === 'coupling')).toHaveLength(1);
    expect(couplerNode?.position.x).toBeCloseTo((9 + 10 / 12) * 0.3048, 6);
    expect(takeoff?.stockCount).toBe(2);
    expect(takeoff?.pipePieces).toHaveLength(2);
    expect(takeoff?.pipePieces[0]?.lengthFt).toBeCloseTo(9 + 10 / 12, 2);
    expect(takeoff?.pipePieces[1]?.lengthFt).toBeCloseTo(4 / 12, 2);
    expect(fittingTakeoff?.count).toBe(1);
  });

  it('solves raw D-box entries to an inlet port stub instead of the box center', () => {
    const sourceNode: PlumbingNode = {
      id: 'dbox-source',
      kind: 'building_drain_exit',
      system: 'sanitary',
      position: { x: 0, y: -0.4, z: 0.6 },
      label: 'Building drain',
    };
    const dboxNode: PlumbingNode = {
      id: 'dbox-node',
      kind: 'distribution_box',
      system: 'sanitary',
      position: { x: 2, y: -0.4, z: 0 },
      equipmentId: 'dbox-equipment',
      label: 'D-Box',
    };
    const run: PlumbingRun = {
      id: 'raw-to-dbox',
      system: 'sanitary',
      startNodeId: sourceNode.id,
      endNodeId: dboxNode.id,
      path: [sourceNode.position, dboxNode.position],
      diameterInches: 4,
      material: 'pvc',
      schedule: 'SCH 40',
      stockLengthFt: 10,
      stockLengthPreset: '10ft',
      stockLengthKind: 'stick',
      slopeInPerFt: 0.125,
      elevationMode: 'under_slab',
      labelVisible: true,
    };
    const septicNode: PlumbingNode = {
      id: 'septic-inlet',
      kind: 'septic_inlet',
      system: 'sanitary',
      position: { x: 4, y: -0.45, z: 0 },
      label: 'Septic inlet',
    };
    const outletRun: PlumbingRun = {
      ...run,
      id: 'dbox-to-septic',
      startNodeId: dboxNode.id,
      endNodeId: septicNode.id,
      path: [dboxNode.position, septicNode.position],
    };
    const solved = solvePlumbingModel({
      ...createDefaultPlumbingSystem(),
      nodes: [sourceNode, dboxNode, septicNode],
      runs: [run, outletRun],
      equipment: [{
        id: 'dbox-equipment',
        equipmentType: 'distribution_box',
        label: 'D-Box',
        position: dboxNode.position,
        rotationRadians: 0,
        connectionNodeIds: [dboxNode.id],
      }],
    });

    const stub = solved.pipePieces.find((piece) => piece.id === `${run.id}:dbox-inlet-stub`)!;
    const outlet = solved.pipePieces.find((piece) => piece.sourceRunId === outletRun.id && piece.startRole === 'd-box-outlet')!;
    const fitting = solved.fittings.find((item) => item.id === `${run.id}:dbox-inlet-fitting`)!;
    const equipmentConnection = solved.equipment.find((item) => item.equipmentId === 'dbox-equipment' && item.portId === 'inlet')!;
    const outletConnection = solved.equipment.find((item) => item.equipmentId === 'dbox-equipment' && item.portId === 'outlet')!;

    expect(stub).toBeTruthy();
    expect(outlet).toBeTruthy();
    expect(fitting).toBeTruthy();
    expect(stub.endRole).toBe('d-box-inlet');
    expect(outlet.start.x).toBeCloseTo(dboxNode.position.x + 0.24, 6);
    expect(outlet.start.z).toBeCloseTo(dboxNode.position.z, 6);
    expect(stub.end.x).toBeCloseTo(dboxNode.position.x - 0.24, 6);
    expect(stub.end.z).toBeCloseTo(dboxNode.position.z, 6);
    expect(stub.end.x).not.toBeCloseTo(dboxNode.position.x, 6);
    expect(equipmentConnection.position).toMatchObject(stub.end);
    expect(outletConnection.position).toMatchObject(outlet.start);
    expect(fitting.connectedPipePieceIds).toContain(stub.id);
    expect(solved.fittings.some((item) =>
      item.id.startsWith(`${run.id}:coupler`) &&
      item.connectedPipePieceIds.includes(stub.id))).toBe(false);
  });

  it('keeps manual couplings while ignoring legacy auto couplers in solved takeoff', () => {
    const nodes: PlumbingNode[] = [
      { id: 'manual-start', kind: 'fixture_connection', system: 'sanitary', position: { x: 0, y: -0.4, z: 0 }, label: 'Start' },
      { id: 'manual-end', kind: 'fixture_connection', system: 'sanitary', position: { x: 6 * 0.3048, y: -0.4, z: 0 }, label: 'End' },
      { id: 'manual-coupling-node', kind: 'fitting', system: 'sanitary', position: { x: 3 * 0.3048, y: -0.4, z: 0 }, label: 'Manual coupling' },
    ];
    const run: PlumbingRun = {
      id: 'manual-coupling-run',
      system: 'sanitary',
      startNodeId: 'manual-start',
      endNodeId: 'manual-end',
      path: [nodes[0]!.position, nodes[1]!.position],
      diameterInches: 4,
      material: 'pvc',
      schedule: 'SCH 40',
      stockLengthFt: 10,
      stockLengthPreset: '10ft',
      stockLengthKind: 'stick',
      slopeInPerFt: 0.125,
      elevationMode: 'under_slab',
      labelVisible: true,
    };
    const system = {
      ...createDefaultPlumbingSystem(),
      nodes,
      runs: [run],
      fittings: [
        {
          id: 'manual-coupling',
          type: 'coupling' as const,
          system: 'sanitary' as const,
          nodeId: 'manual-coupling-node',
          connectedRunIds: [run.id],
          diameterInches: 4,
          material: 'pvc' as const,
          schedule: 'SCH 40' as const,
          rotationRad: 0,
          elevationMode: 'under_slab' as const,
          labelVisible: true,
          isAutoGenerated: false,
        },
        {
          id: 'legacy-auto-coupling',
          type: 'coupling' as const,
          system: 'sanitary' as const,
          nodeId: 'manual-coupling-node',
          connectedRunIds: [run.id],
          diameterInches: 4,
          material: 'pvc' as const,
          schedule: 'SCH 40' as const,
          rotationRad: 0,
          elevationMode: 'under_slab' as const,
          labelVisible: true,
          isAutoGenerated: true,
        },
      ],
    };

    const solved = solvePlumbingModel(system);
    const fittingTakeoff = generatePlumbingFittingTakeoff(system, solved).find((row) => row.type === 'coupling');

    expect(solved.fittings.some((fitting) => fitting.sourceFittingId === 'manual-coupling')).toBe(true);
    expect(solved.fittings.some((fitting) => fitting.sourceFittingId === 'legacy-auto-coupling')).toBe(false);
    expect(solved.consumedPersistedFittingIds.has('manual-coupling')).toBe(true);
    expect(solved.consumedPersistedFittingIds.has('legacy-auto-coupling')).toBe(true);
    expect(fittingTakeoff?.count).toBe(1);
  });

  it('filters floating solved couplings out of renderable solved fittings', () => {
    const solved = {
      pipePieces: [
        {
          id: 'piece-a',
          sourceRunId: 'run-a',
          sourceSegmentIndex: 1,
          start: { x: 0, y: -0.4, z: 0 },
          end: { x: 1, y: -0.4, z: 0 },
          startRole: 'raw-run-start' as const,
          endRole: 'coupler' as const,
          diameterInches: 4,
          material: 'pvc' as const,
          schedule: 'SCH 40' as const,
          slopeInPerFt: 0.125,
          elevationMode: 'under_slab' as const,
          lengthFt: 3.28,
        },
        {
          id: 'piece-b',
          sourceRunId: 'run-a',
          sourceSegmentIndex: 1,
          start: { x: 1.4, y: -0.4, z: 0 },
          end: { x: 2.4, y: -0.4, z: 0 },
          startRole: 'coupler' as const,
          endRole: 'raw-run-end' as const,
          diameterInches: 4,
          material: 'pvc' as const,
          schedule: 'SCH 40' as const,
          slopeInPerFt: 0.125,
          elevationMode: 'under_slab' as const,
          lengthFt: 3.28,
        },
      ],
      fittings: [
        {
          id: 'floating-coupling',
          sourceRunId: 'run-a',
          type: 'coupling' as const,
          system: 'sanitary' as const,
          position: { x: 1.2, y: -0.4, z: 0 },
          diameterInches: 4,
          material: 'pvc' as const,
          schedule: 'SCH 40' as const,
          ports: [],
          connectedPipePieceIds: ['piece-a', 'piece-b'],
          isAutoSolved: true,
        },
      ],
      fixtures: [],
      equipment: [],
      validationIssues: [],
      consumedPersistedFittingIds: new Set<string>(),
    };

    expect(getRenderableSolvedPlumbingFittings(solved).map((fitting) => fitting.id)).not.toContain('floating-coupling');
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

  it('flags pipe through a plinth beam but allows below-grade CMU penetrations', () => {
    const nodes: PlumbingNode[] = [
      { id: 'a', kind: 'building_drain_exit', system: 'sanitary', position: { x: -1, y: 0.12, z: 0 }, label: 'A' },
      { id: 'b', kind: 'building_drain_exit', system: 'sanitary', position: { x: 1, y: 0.12, z: 0 }, label: 'B' },
      { id: 'c', kind: 'building_drain_exit', system: 'sanitary', position: { x: -1, y: -0.45, z: 0.4 }, label: 'C' },
      { id: 'd', kind: 'building_drain_exit', system: 'sanitary', position: { x: 1, y: -0.45, z: 0.4 }, label: 'D' },
    ];
    const throughBeam: PlumbingRun = {
      id: 'through-plinth',
      system: 'sanitary',
      startNodeId: 'a',
      endNodeId: 'b',
      path: [nodes[0]!.position, nodes[1]!.position],
      diameterInches: 3,
      material: 'pvc',
      schedule: 'SCH 40',
      stockLengthFt: 10,
      stockLengthPreset: '10ft',
      stockLengthKind: 'stick',
      slopeInPerFt: 0.125,
      elevationMode: 'user_defined',
      labelVisible: true,
    };
    const belowGrade: PlumbingRun = {
      ...throughBeam,
      id: 'below-cmu',
      startNodeId: 'c',
      endNodeId: 'd',
      path: [nodes[2]!.position, nodes[3]!.position],
    };
    const context = {
      beams: [{
        id: 'plinth-a',
        startPoint: { x: -2, y: 0, z: 0 },
        endPoint: { x: 2, y: 0, z: 0 },
        widthMeters: 0.24,
        kind: 'plinth_beam',
        baseElevationMeters: 0,
        topElevationMeters: 0.3,
      }],
    };

    const throughIssues = validatePlumbingSystem({ ...createDefaultPlumbingSystem(), nodes, runs: [throughBeam] }, context);
    const belowIssues = validatePlumbingSystem({ ...createDefaultPlumbingSystem(), nodes, runs: [belowGrade] }, context);

    expect(throughIssues.map((issue) => issue.code)).toContain('pipe_crosses_plinth_beam');
    expect(belowIssues.map((issue) => issue.code)).not.toContain('pipe_crosses_plinth_beam');
  });

  it('requires septic tank inlet routing through one distribution box line', () => {
    const tank = createCmuSepticTank({ centerX: 8, centerZ: 0, idSeed: 'direct-septic' });
    const septicNodes = createCmuSepticTankNodes(tank);
    const inlet = septicNodes.find((node) => node.kind === 'septic_inlet')!;
    const drainNode: PlumbingNode = {
      id: 'building-drain',
      kind: 'building_drain_exit',
      system: 'sanitary',
      position: { x: 0, y: inlet.position.y + 0.12, z: 0 },
      label: 'Building drain',
    };
    const directRun: PlumbingRun = {
      id: 'direct-to-septic',
      system: 'sanitary',
      startNodeId: drainNode.id,
      endNodeId: inlet.id,
      path: [drainNode.position, inlet.position],
      diameterInches: 4,
      material: 'pvc',
      schedule: 'SCH 40',
      stockLengthFt: 10,
      stockLengthPreset: '10ft',
      stockLengthKind: 'stick',
      slopeInPerFt: 0.125,
      elevationMode: 'under_slab',
      labelVisible: true,
    };
    const directCodes = validatePlumbingSystem({
      ...createDefaultPlumbingSystem(),
      septicTanks: [tank],
      nodes: [drainNode, ...septicNodes],
      runs: [directRun],
    }).map((issue) => issue.code);

    const withDistributionBox = addCmuSepticTankToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      centerX: 8,
      centerZ: 0,
      idSeed: 'with-dbox',
    }).system;
    const dboxCodes = validatePlumbingSystem(withDistributionBox).map((issue) => issue.code);

    expect(directCodes).toContain('septic_direct_connection_without_distribution_box');
    expect(dboxCodes).toContain('distribution_box_missing_drain_inlet');
    expect(dboxCodes).not.toEqual(expect.arrayContaining([
      'septic_missing_distribution_box',
      'septic_direct_connection_without_distribution_box',
      'septic_multiple_inlet_lines',
    ]));
  });

  it('validates a connected fixture drain path through the distribution box to septic', () => {
    const base = createDefaultPlumbingSystem();
    const upstreamNode: PlumbingNode = {
      id: 'building-drain',
      kind: 'building_drain_exit',
      system: 'sanitary',
      position: { x: 0, y: -0.4, z: 0 },
      label: 'Building drain',
    };
    const withSeptic = addCmuSepticTankToPlumbingSystem({
      system: { ...base, nodes: [upstreamNode] },
      centerX: 8,
      centerZ: 0,
      idSeed: 'validated-dbox',
    }).system;
    const codes = validatePlumbingSystem(withSeptic).map((issue) => issue.code);

    expect(codes).not.toEqual(expect.arrayContaining([
      'distribution_box_missing_drain_inlet',
      'distribution_box_missing_septic_outlet',
      'septic_missing_distribution_box',
      'septic_direct_connection_without_distribution_box',
      'septic_multiple_inlet_lines',
      'sanitary_drain_path_slope_below_ipc',
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

  it('renders and hit-tests 2D rough-in markers from model data', () => {
    const withFixture = addFixtureToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      fixtureType: 'toilet',
      position: { x: 0, y: 0, z: 0 },
      idSeed: 'rough-marker',
    });
    const mainNodes: PlumbingNode[] = [
      { id: 'main-a', kind: 'building_drain_exit', system: 'sanitary', position: { x: -2, y: -0.4, z: 0.12 }, label: 'A' },
      { id: 'main-b', kind: 'building_drain_exit', system: 'sanitary', position: { x: 2, y: -0.4, z: 0.12 }, label: 'B' },
    ];
    const mainRun: PlumbingRun = {
      id: 'main-run',
      system: 'sanitary',
      startNodeId: 'main-a',
      endNodeId: 'main-b',
      path: [mainNodes[0]!.position, mainNodes[1]!.position],
      diameterInches: 3,
      material: 'pvc',
      schedule: 'SCH 40',
      stockLengthFt: 10,
      stockLengthPreset: '10ft',
      stockLengthKind: 'stick',
      slopeInPerFt: 0.25,
      elevationMode: 'under_slab',
      labelVisible: true,
    };
    const result = createOrReplaceFixtureRoughInAssembly({
      system: { ...withFixture, nodes: [...withFixture.nodes, ...mainNodes], runs: [mainRun] },
      fixtureId: withFixture.fixtures[0]!.id,
      mainRunId: mainRun.id,
      tapPoint: { x: 0, y: -0.4, z: 0.12 },
      segmentIndex: 1,
    });
    const { container } = render(
      <DesignBuilderPlanCanvas
        layout={createEmptyWallLayout()}
        toolMode="select"
        active2DView="plumbing-plan"
        viewport={{ centerX: 0, centerZ: 0, zoom: 100 }}
        plumbingSystem={result.system}
        onInteraction={() => undefined}
      />,
    );

    expect(container.querySelector(`[data-plumbing-rough-in-id="${result.roughIn!.id}"]`)).toBeTruthy();
    expect(container.querySelector(`[data-plumbing-run-id="${result.roughIn!.riserRunId}"]`)).toBeNull();
    expect(hitTestPlumbingSystem({
      system: result.system,
      point: result.system.nodes.find((node) => node.id === result.roughIn!.riserTopNodeId)!.position,
      toleranceMeters: 0.15,
    })).toEqual({ kind: 'rough-in', id: result.roughIn!.id });
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
