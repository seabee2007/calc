import { describe, expect, it } from 'vitest';
import {
  getDesignComponentDefinition,
  groupDesignComponentDefinitions,
  listDesignComponentDefinitionsForView,
} from '../domain/designComponentRegistry';
import {
  buildPlacedComponent,
  componentPlacementReducer,
  createIdleComponentPlacementState,
  resolveElevationHelperMeasurements,
  resolvePlanHelperMeasurements,
  snapComponentPlanPoint,
} from '../domain/designComponentPlacement';
import {
  buildDesignRenderModel,
  coordinateLabelForElevationFace,
  elevationStationForPoint,
} from '../domain/designRenderModel';
import { createEmptyWallLayout } from '../domain/wallLayoutRules';

describe('Design component registry and placement', () => {
  it('groups initial components by division and filters by supported view', () => {
    const groups = groupDesignComponentDefinitions();
    expect(groups.map((group) => group.division)).toEqual(['Structure', 'Openings']);
    expect(groups.find((group) => group.division === 'Structure')?.definitions.map((item) => item.type)).toContain('column');
    expect(listDesignComponentDefinitionsForView('plan').map((item) => item.type)).toEqual(
      expect.arrayContaining(['column', 'slab', 'door', 'window']),
    );
    expect(listDesignComponentDefinitionsForView('plan').map((item) => item.type)).not.toContain('footer');
    expect(listDesignComponentDefinitionsForView('elevation').map((item) => item.type)).toContain('footer');
  });

  it('tracks component selection, preview, parameter edits, placement, and cancellation', () => {
    let state = createIdleComponentPlacementState('plan');
    state = componentPlacementReducer(state, {
      type: 'select_component',
      componentType: 'column',
      activeView: 'plan',
    });

    expect(state.status).toBe('component-selected');
    expect(state.activeComponentDefinition?.displayName).toBe('Column');
    expect(state.draftComponentParameters.widthMeters).toBe(0.3);

    state = componentPlacementReducer(state, {
      type: 'update_parameters',
      parameters: { widthMeters: 0.45 },
    });
    expect(state.draftComponentParameters.widthMeters).toBe(0.45);

    state = componentPlacementReducer(state, {
      type: 'preview',
      activeView: 'plan',
      cursor: { xMeters: 1.12, zMeters: 2.25 },
      snap: { xMeters: 1.1, zMeters: 2.3 },
      helperMeasurements: [{ id: 'cursor', label: 'Cursor', value: 'X 1.10 m / Y 2.30 m' }],
    });
    expect(state.status).toBe('previewing');
    expect(state.placementPreview?.viewPlacement.plan?.xMeters).toBe(1.1);
    expect(state.helperMeasurements).toHaveLength(1);

    const component = buildPlacedComponent({
      type: 'column',
      activeView: 'plan',
      parameters: state.draftComponentParameters,
      position: { xMeters: 1.1, zMeters: 2.3 },
      now: '2026-06-27T00:00:00.000Z',
    });
    state = componentPlacementReducer(state, { type: 'placed', component });
    expect(state.status).toBe('component-selected');
    expect(state.placementPreview).toBeNull();
    expect(state.snapPosition).toBeNull();

    state = componentPlacementReducer(state, { type: 'cancel' });
    expect(state.status).toBe('cancelled');
    expect(state.activeComponentType).toBeNull();
  });

  it('builds derived placement data for elevation components', () => {
    const definition = getDesignComponentDefinition('window');
    const component = buildPlacedComponent({
      type: 'window',
      activeView: 'elevation',
      parameters: { ...definition.defaultParameters, sillHeightMeters: 1, heightMeters: 1.2 },
      position: { xMeters: 2, zMeters: 1 },
      elevationFace: 'south',
      now: '2026-06-27T00:00:00.000Z',
    });

    expect(component.viewPlacement.elevation).toEqual({ face: 'south', xMeters: 2, zMeters: 1 });
    expect(component.references?.elevationFace).toBe('south');
    expect(component.derived.headHeightMeters).toBeCloseTo(2.2, 6);
  });

  it('snaps component points and returns concise helper measurements', () => {
    expect(
      snapComponentPlanPoint({
        point: { xMeters: 1.26, zMeters: 2.74 },
        snapMode: 'grid',
        snapSpacingMeters: 0.5,
      }),
    ).toEqual({ xMeters: 1.5, zMeters: 2.5 });

    const layout = { ...createEmptyWallLayout(), gridSpacingMeters: 0.5 };
    const planMeasurements = resolvePlanHelperMeasurements({
      position: { xMeters: 1.26, zMeters: 2.74 },
      snapPosition: { xMeters: 1.5, zMeters: 2.5 },
      layout,
      columns: [
        {
          id: 'col-1',
          name: 'Column',
          kind: 'rc_column',
          position: { x: 1.5, z: 2 },
          widthMeters: 0.3,
          depthMeters: 0.3,
          heightMeters: 3,
          baseElevationMeters: 0,
          topElevationMeters: 3,
          source: 'user',
        },
      ],
    });
    expect(planMeasurements.map((measurement) => measurement.id)).toEqual(['cursor', 'grid-offset', 'nearest-column']);

    const elevationMeasurements = resolveElevationHelperMeasurements({
      position: { xMeters: 1.2, zMeters: 0.9 },
      snapPosition: { xMeters: 1.2, zMeters: 0.9 },
      elevationView: { face: 'north' },
      componentType: 'window',
      parameters: { sillHeightMeters: 0.9, heightMeters: 1.2 },
    });
    expect(elevationMeasurements.map((measurement) => measurement.id)).toContain('head-height');
  });

  it('normalizes plan-placed RC columns into shared render-model coordinates', () => {
    const column = buildPlacedComponent({
      type: 'column',
      activeView: 'plan',
      parameters: {
        widthMeters: 0.35,
        depthMeters: 0.4,
        heightMeters: 3.2,
        baseElevationMeters: 0.1,
        autoFooter: true,
        footerWidthMeters: 0.9,
        footerLengthMeters: 1,
        footerBottomElevationMeters: -0.55,
        footerTopElevationMeters: -0.25,
      },
      position: { xMeters: 2.5, zMeters: 1.75 },
      now: '2026-06-27T00:00:00.000Z',
    });

    const model = buildDesignRenderModel({ placedComponents: [column] });
    expect(model.rcComponents).toHaveLength(1);
    expect(model.rcComponents[0]).toMatchObject({
      id: column.id,
      type: 'column',
      category: 'structure',
      system: 'reinforced-concrete',
      position: { x: 2.5, y: 0.1, z: 1.75 },
      dimensions: { width: 0.35, depth: 0.4, height: 3.2 },
      elevations: { base: 0.1, top: 3.3 },
    });
    expect(model.rcComponents[0]?.footer).toMatchObject({
      widthMeters: 0.9,
      lengthMeters: 1,
      bottomElevationMeters: -0.55,
      topElevationMeters: -0.25,
    });
  });

  it('projects shared RC render-model coordinates into elevation faces', () => {
    const point = { x: 3.25, z: 1.5 };
    expect(elevationStationForPoint('north', point)).toBe(3.25);
    expect(elevationStationForPoint('south', point)).toBe(3.25);
    expect(elevationStationForPoint('east', point)).toBe(1.5);
    expect(elevationStationForPoint('west', point)).toBe(1.5);
    expect(coordinateLabelForElevationFace('north')).toBe('X / Z');
    expect(coordinateLabelForElevationFace('east')).toBe('Y / Z');
  });
});
