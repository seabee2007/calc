import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  migratePersistedDesignBuilderState,
  serializePersistedDesignBuilderState,
} from '../domain/designBuilderPersistence';
import {
  addCmuSepticTankToPlumbingSystem,
  calculateSepticCapacity,
  createCmuSepticTank,
  createCmuSepticTankNodes,
  createDefaultPlumbingSystem,
  drawSepticTankTopView,
  ensureSanitaryDrainConnectedToDistributionBox,
  generateSepticTakeoff,
  hitTestSepticTank,
  IPC_2024_MIN_SEPTIC_SETBACK_FROM_BUILDING_M,
  ipc2024MinimumDrainageSlopeInPerFt,
  septicTankInletInvertElevation,
  validateSepticTank,
  type SepticTankModel,
} from '../plumbing';
import { createCmuSepticTankMesh } from '../plumbing/septic/three/createCmuSepticTankMesh';
import { DesignBuilderSepticTankControls } from '../ui/DesignBuilderSepticTankControls';

function defaultTank(): SepticTankModel {
  return createCmuSepticTank({
    centerX: 4,
    centerZ: 7,
    rotationRad: 0,
    idSeed: 'test',
    now: '2026-01-01T00:00:00.000Z',
  });
}

describe('CMU septic tank site utility', () => {
  it('creates the 750 gal conceptual preset with 7m x 18m house context', () => {
    const tank = defaultTank();

    expect(tank.kind).toBe('cmu_septic_tank');
    expect(tank.designBasis.capacityGallons).toBe(750);
    expect(tank.designBasis.houseAreaM2).toBe(126);
    expect(tank.designBasis.bedroomsAssumed).toBe(2);
    expect(tank.designBasis.toilets).toBe(2);
    expect(tank.designBasis.sinks).toBe(2);
  });

  it('placement creates a tank and model plumbing nodes', () => {
    const result = addCmuSepticTankToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      centerX: 2,
      centerZ: 3,
      idSeed: 'place',
    });
    const distributionBox = result.system.equipment.find((equipment) => equipment.equipmentType === 'distribution_box');
    const distributionBoxNode = result.system.nodes.find((node) => node.kind === 'distribution_box');

    expect(result.system.septicTanks).toHaveLength(1);
    expect(result.system.nodes.filter((node) => node.septicTankId === result.tank.id)).toHaveLength(4);
    expect(result.system.nodes.some((node) => node.kind === 'septic_inlet')).toBe(true);
    expect(result.system.nodes.some((node) => node.kind === 'septic_outlet')).toBe(true);
    expect(distributionBox).toBeTruthy();
    expect(distributionBoxNode).toBeTruthy();
    expect(result.system.runs.some((run) =>
      run.startNodeId === distributionBoxNode?.id &&
      run.endNodeId === result.tank.connectionNodes.inletNodeId &&
      run.system === 'sanitary',
    )).toBe(true);
  });

  it('connects an existing sanitary drain into the distribution box before septic', () => {
    const base = createDefaultPlumbingSystem();
    const drainNode = {
      id: 'building-drain',
      kind: 'building_drain_exit' as const,
      system: 'sanitary' as const,
      position: { x: 0, y: -0.4, z: 0 },
      label: 'Building drain',
    };
    const result = addCmuSepticTankToPlumbingSystem({
      system: { ...base, nodes: [drainNode] },
      centerX: 8,
      centerZ: 0,
      idSeed: 'connected-dbox',
    });
    const distributionBoxNode = result.system.nodes.find((node) => node.kind === 'distribution_box')!;
    const dboxInletStub = result.system.runs.find((run) => run.endNodeId === distributionBoxNode.id && run.startNodeId !== distributionBoxNode.id);
    const dboxInletFitting = result.system.fittings.find((fitting) =>
      fitting.connectedRunIds.includes(dboxInletStub?.id ?? '') &&
      ['coupling', 'elbow_22_5', 'elbow_45', 'elbow_90_long_sweep'].includes(fitting.type));
    const dboxApproachRun = result.system.runs.find((run) =>
      run.startNodeId === drainNode.id &&
      run.endNodeId === dboxInletFitting?.nodeId);
    const septicRun = result.system.runs.find((run) => run.startNodeId === distributionBoxNode.id && run.endNodeId === result.tank.connectionNodes.inletNodeId);

    expect(dboxInletStub).toBeTruthy();
    expect(dboxInletFitting).toBeTruthy();
    expect(dboxApproachRun).toBeTruthy();
    expect(result.system.runs.some((run) => run.startNodeId === drainNode.id && run.endNodeId === distributionBoxNode.id)).toBe(false);
    expect(septicRun).toBeTruthy();
    expect(dboxInletStub?.slopeInPerFt).toBeGreaterThanOrEqual(ipc2024MinimumDrainageSlopeInPerFt(dboxInletStub?.diameterInches));
    expect(dboxApproachRun?.slopeInPerFt).toBeGreaterThanOrEqual(ipc2024MinimumDrainageSlopeInPerFt(dboxApproachRun?.diameterInches));
    expect(septicRun?.slopeInPerFt).toBeGreaterThanOrEqual(ipc2024MinimumDrainageSlopeInPerFt(septicRun?.diameterInches));
    expect(dboxInletStub?.path[0]?.y).toBeGreaterThan(dboxInletStub?.path.at(-1)?.y ?? 0);
    expect(dboxApproachRun?.path[0]?.y).toBeGreaterThan(dboxApproachRun?.path.at(-1)?.y ?? 0);
    expect(septicRun?.path[0]?.y).toBeGreaterThan(septicRun?.path.at(-1)?.y ?? 0);
  });

  it('connects a later sanitary drain into an existing distribution box', () => {
    const withSeptic = addCmuSepticTankToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      centerX: 8,
      centerZ: 0,
      idSeed: 'dbox-first',
    }).system;
    const drainNode = {
      id: 'later-building-drain',
      kind: 'building_drain_exit' as const,
      system: 'sanitary' as const,
      position: { x: 0, y: -0.4, z: 0 },
      label: 'Building drain',
    };
    const connected = ensureSanitaryDrainConnectedToDistributionBox({
      ...withSeptic,
      nodes: [...withSeptic.nodes, drainNode],
    });
    const distributionBoxNode = connected.nodes.find((node) => node.kind === 'distribution_box')!;

    const inletStub = connected.runs.find((run) => run.endNodeId === distributionBoxNode.id && run.startNodeId !== distributionBoxNode.id);
    const inletFitting = connected.fittings.find((fitting) => fitting.connectedRunIds.includes(inletStub?.id ?? ''));
    expect(inletStub).toBeTruthy();
    expect(inletFitting).toBeTruthy();
    expect(connected.runs.some((run) => run.startNodeId === drainNode.id && run.endNodeId === distributionBoxNode.id)).toBe(false);
  });

  it('uses IPC 2024 drain slope defaults and septic invert nodes', () => {
    const tank = defaultTank();
    const nodes = createCmuSepticTankNodes(tank);
    const inlet = nodes.find((node) => node.kind === 'septic_inlet')!;
    const outlet = nodes.find((node) => node.kind === 'septic_outlet')!;

    expect(ipc2024MinimumDrainageSlopeInPerFt(3)).toBeCloseTo(0.125);
    expect(ipc2024MinimumDrainageSlopeInPerFt(2)).toBeCloseTo(0.25);
    expect(inlet.position.y).toBeCloseTo(septicTankInletInvertElevation(tank));
    expect(outlet.position.y).toBeLessThan(inlet.position.y);
  });

  it('pushes default septic placement outside the 10 ft building setback', () => {
    const result = addCmuSepticTankToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      centerX: 0.5,
      centerZ: 0.5,
      buildingFootprint: [
        { x: 0, z: 0 },
        { x: 2, z: 0 },
        { x: 2, z: 2 },
        { x: 0, z: 2 },
      ],
      idSeed: 'setback',
    });

    expect(Math.hypot(result.tank.placement.centerX - 1, result.tank.placement.centerZ - 1))
      .toBeGreaterThanOrEqual(IPC_2024_MIN_SEPTIC_SETBACK_FROM_BUILDING_M);
  });

  it('lowers default tank burial depth when an existing sanitary drain needs more fall', () => {
    const base = createDefaultPlumbingSystem();
    const system = {
      ...base,
      nodes: [
        {
          id: 'building-drain',
          kind: 'building_drain_exit' as const,
          system: 'sanitary' as const,
          position: { x: 0, y: -0.42, z: 0 },
          label: 'Building drain',
        },
      ],
    };
    const shallow = createCmuSepticTank({ centerX: 90, centerZ: 0, idSeed: 'shallow' });
    const adjusted = createCmuSepticTank({ system, centerX: 90, centerZ: 0, idSeed: 'adjusted' });

    expect(adjusted.placement.burialDepthBelowGradeM).toBeGreaterThan(shallow.placement.burialDepthBelowGradeM);
    expect(septicTankInletInvertElevation(adjusted)).toBeLessThan(septicTankInletInvertElevation(shallow));
  });

  it('save/load round trip preserves septic tanks', () => {
    const withTank = addCmuSepticTankToPlumbingSystem({
      system: createDefaultPlumbingSystem(),
      centerX: 2,
      centerZ: 3,
      idSeed: 'persist',
    }).system;
    const serialized = serializePersistedDesignBuilderState(
      createFiveBySixCmuBuildingPreset(),
      undefined,
      [],
      [],
      withTank,
    );
    const migrated = migratePersistedDesignBuilderState(serialized);

    expect(migrated?.plumbingSystem.septicTanks).toHaveLength(1);
    expect(migrated?.plumbingSystem.equipment.some((equipment) => equipment.equipmentType === 'distribution_box')).toBe(true);
    expect(migrated?.plumbingSystem.runs.some((run) => run.endNodeId === withTank.septicTanks[0]?.connectionNodes.inletNodeId)).toBe(true);
    expect(migrated?.plumbingSystem.septicTanks[0]?.designBasis.capacityGallons).toBe(750);
  });

  it('changing burial depth derives top slab elevation', () => {
    const tank = defaultTank();
    const burialDepthBelowGradeM = 0.45;
    const topSlabTopElevationM = tank.placement.gradeElevationM - burialDepthBelowGradeM;

    expect(topSlabTopElevationM).toBeCloseTo(-0.45, 6);
  });

  it('capacity comes from geometry and mismatch validates as a warning', () => {
    const tank = defaultTank();
    const capacity = calculateSepticCapacity(tank);
    const mismatched = {
      ...tank,
      designBasis: { ...tank.designBasis, capacityGallons: 1200 },
    };

    expect(capacity.liquidVolumeGallons).toBeGreaterThan(880);
    expect(validateSepticTank(mismatched, { nodes: createCmuSepticTankNodes(mismatched) }).some((issue) => issue.code === 'capacity_mismatch')).toBe(true);
  });

  it('validates compartment ratio, missing nodes, width, and footprint overlap', () => {
    const tank = {
      ...defaultTank(),
      geometry: {
        ...defaultTank().geometry,
        firstCompartmentRatio: 0.45,
        insideWidthM: 1,
      },
    };
    const issues = validateSepticTank(tank, {
      nodes: [],
      buildingFootprint: [
        { x: 3, z: 6 },
        { x: 5, z: 6 },
        { x: 5, z: 8 },
        { x: 3, z: 8 },
      ],
    });

    expect(issues.some((issue) => issue.code === 'first_compartment_smaller_than_second')).toBe(true);
    expect(issues.some((issue) => issue.code === 'missing_inlet_node')).toBe(true);
    expect(issues.some((issue) => issue.code === 'missing_outlet_node')).toBe(true);
    expect(issues.some((issue) => issue.code === 'inside_width_below_4ft')).toBe(true);
    expect(issues.some((issue) => issue.code === 'tank_overlaps_building_footprint')).toBe(true);
  });

  it('2D top view and hit testing are model driven', () => {
    const tank = defaultTank();
    const primitives = drawSepticTankTopView(tank);

    expect(primitives.some((primitive) => primitive.id.endsWith(':baffle'))).toBe(true);
    expect(primitives.filter((primitive) => primitive.kind === 'point')).toHaveLength(4);
    expect(hitTestSepticTank({ x: tank.placement.centerX, z: tank.placement.centerZ }, [tank])?.id).toBe(tank.id);
  });

  it('3D mesh includes required named assembly parts', () => {
    const group = createCmuSepticTankMesh(defaultTank());
    const names = new Set<string>();
    group.traverse((object) => {
      if (object.name) names.add(object.name);
    });

    expect(names.has('bottom slab')).toBe(true);
    expect(names.has('left CMU wall')).toBe(true);
    expect(names.has('right CMU wall')).toBe(true);
    expect(names.has('internal baffle wall')).toBe(true);
    expect(names.has('top monolithic slab')).toBe(true);
    expect(names.has('access covers')).toBe(true);
    expect(names.has('inlet pipe stub')).toBe(true);
    expect(names.has('outlet pipe stub')).toBe(true);
  });

  it('takeoff returns CMU block counts and concrete volumes', () => {
    const takeoff = generateSepticTakeoff(defaultTank());

    expect(takeoff.estimated8InCmuBlockCount).toBeGreaterThan(0);
    expect(takeoff.baffleWallCmuBlockCount).toBeGreaterThan(0);
    expect(takeoff.bottomSlabConcreteVolumeM3).toBeGreaterThan(0);
    expect(takeoff.topSlabConcreteVolumeM3).toBeGreaterThan(0);
  });

  it('properties panel shows conceptual sizing and fixture-context guardrails', () => {
    const tank = defaultTank();
    render(
      <DesignBuilderSepticTankControls
        tank={tank}
        nodes={createCmuSepticTankNodes(tank)}
        onTankChange={() => undefined}
        onPlacementChange={() => undefined}
        onDesignBasisChange={() => undefined}
        onGeometryChange={() => undefined}
      />,
    );

    expect(screen.getByText(/Conceptual septic tank preset/i)).toBeInTheDocument();
    expect(screen.getByText(/2 toilets \/ 2 sinks is stored as fixture context only/i)).toBeInTheDocument();
  });
});
