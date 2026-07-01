import { beforeEach, describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  designBuilderSessionKey,
  useDesignBuilderSessionStore,
} from '../state/designBuilderStore';

describe('Design Builder session store', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useDesignBuilderSessionStore.setState({ sessions: {} });
  });

  it('preserves model, selection, preview, layout, and camera state by project estimate key', () => {
    const key = designBuilderSessionKey('project-1', 'estimate-1');
    const preset = createFiveBySixCmuBuildingPreset();

    useDesignBuilderSessionStore.getState().saveSession(key, {
      preset,
      selectedObjectType: 'door_opening',
      selectedOpeningId: preset.wall.openings[0]?.id ?? null,
      toolMode: 'move_opening',
      changedAfterCommit: true,
      viewMode: '2d',
      active2DView: 'elevation-view',
      elevationView: { face: 'east', cursorX: 2.5, cursorZ: 1.2 },
      placedComponents: [
        {
          id: 'component-column-1',
          type: 'column',
          division: 'Structure',
          category: 'structure',
          viewPlacement: { elevation: { face: 'east', xMeters: 2.5, zMeters: 0 } },
          parameters: { widthMeters: 0.3, depthMeters: 0.3, heightMeters: 3 },
          derived: { topElevationMeters: 3 },
          metadata: { createdAt: '2026-06-27T00:00:00.000Z', updatedAt: '2026-06-27T00:00:00.000Z' },
        },
      ],
      snapMode: 'cmu_module',
      objectTreeExpanded: { foundation: false, layout: false, masonry: true, structure: false, openings: false, roofGable: false, estimate: false },
      previewLines: [
        {
          id: 'cmu-total-grout',
          designModelId: 'model-1',
          designObjectId: 'wall-1',
          quantityType: 'cmu_total_grout',
          description: 'CMU grout fill total',
          quantity: 1,
          unit: 'CY',
          formula: 'total_grout = jamb_grout + lintel_grout + bond_beam_grout',
          parameterSnapshot: {},
          source: 'parametric_design_builder',
          confidence: 'calculated_from_parameters',
          divisionCode: '04',
          divisionName: 'Masonry',
        },
      ],
      leftPanelCollapsed: true,
      rightPanelCollapsed: false,
      viewerSize: { height: 640, rightPanelWidth: 380 },
      camera: { position: [1, 2, 3], target: [0, 1, 0] },
      dirty: true,
    });

    const session = useDesignBuilderSessionStore.getState().getSession(key);

    expect(session?.preset?.name).toBe('5m x 6m CMU Template');
    expect(session?.selectedObjectType).toBe('door_opening');
    expect(session?.selectedOpeningId).toBe(preset.wall.openings[0]?.id);
    expect(session?.toolMode).toBe('move_opening');
    expect(session?.viewMode).toBe('2d');
    expect(session?.active2DView).toBe('elevation-view');
    expect(session?.elevationView.face).toBe('east');
    expect(session?.placedComponents).toHaveLength(1);
    expect(session?.snapMode).toBe('cmu_module');
    expect(session?.objectTreeExpanded?.layout).toBe(false);
    expect(session?.objectTreeExpanded?.masonry).toBe(true);
    expect(session?.changedAfterCommit).toBe(true);
    expect(session?.previewLines).toHaveLength(1);
    expect(session?.leftPanelCollapsed).toBe(true);
    expect(session?.viewerSize?.height).toBe(640);
    expect(session?.camera?.position).toEqual([1, 2, 3]);
  });

  it('defaults object tree groups to collapsed', () => {
    const key = designBuilderSessionKey('project-1', 'estimate-1');

    useDesignBuilderSessionStore.getState().saveSession(key, {});

    expect(useDesignBuilderSessionStore.getState().getSession(key)?.active2DView).toBe('foundation-plan');
    expect(useDesignBuilderSessionStore.getState().getSession(key)?.objectTreeExpanded).toEqual({
      foundation: false,
      layout: false,
      masonry: false,
      structure: false,
      openings: false,
      roofGable: false,
      estimate: false,
    });
  });

  it('persists floor-plan as the active 2D view', () => {
    const key = designBuilderSessionKey('project-1', 'estimate-1');

    useDesignBuilderSessionStore.getState().saveSession(key, {
      viewMode: '2d',
      active2DView: 'floor-plan',
    });

    expect(useDesignBuilderSessionStore.getState().getSession(key)?.active2DView).toBe('floor-plan');
  });
});
