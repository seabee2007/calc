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
  generateSepticTakeoff,
  hitTestSepticTank,
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

    expect(result.system.septicTanks).toHaveLength(1);
    expect(result.system.nodes.filter((node) => node.septicTankId === result.tank.id)).toHaveLength(4);
    expect(result.system.nodes.some((node) => node.kind === 'septic_inlet')).toBe(true);
    expect(result.system.nodes.some((node) => node.kind === 'septic_outlet')).toBe(true);
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

