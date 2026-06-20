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
      viewMode: 'plan',
      snapMode: 'cmu_module',
      objectTreeExpanded: { layout: false, cmu: true },
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

    expect(session?.preset?.name).toBe('5m x 6m CMU Building Example');
    expect(session?.selectedObjectType).toBe('door_opening');
    expect(session?.selectedOpeningId).toBe(preset.wall.openings[0]?.id);
    expect(session?.toolMode).toBe('move_opening');
    expect(session?.viewMode).toBe('plan');
    expect(session?.snapMode).toBe('cmu_module');
    expect(session?.objectTreeExpanded?.layout).toBe(false);
    expect(session?.changedAfterCommit).toBe(true);
    expect(session?.previewLines).toHaveLength(1);
    expect(session?.leftPanelCollapsed).toBe(true);
    expect(session?.viewerSize?.height).toBe(640);
    expect(session?.camera?.position).toEqual([1, 2, 3]);
  });
});
