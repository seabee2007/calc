import { waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { useDesignBuilderSessionStore } from '../state/designBuilderStore';
import type { DesignModel } from '../types';

export const DEFAULT_TEST_DESIGN_MODEL: DesignModel = {
  id: 'model-1',
  projectId: 'project-1',
  estimateId: 'estimate-1',
  name: '5m x 6m CMU Template',
  unitSystem: 'metric',
  modelType: 'cmu_building',
  status: 'draft',
  createdBy: 'user-1',
  metadata: {},
  createdAt: '',
  updatedAt: '',
};

export function seedLoadedDesignBuilderTemplate(
  sessionKey = 'project-1:estimate-1',
  options?: { designModel?: DesignModel | null },
) {
  useDesignBuilderSessionStore.getState().saveSession(sessionKey, {
    preset: createFiveBySixCmuBuildingPreset(),
    layoutState: 'demo_loaded',
    designModel: options?.designModel ?? DEFAULT_TEST_DESIGN_MODEL,
  });
}

export async function waitForLoadedDesignBuilderTemplate(
  sessionKey = 'project-1:estimate-1',
) {
  await waitFor(() => {
    expect(
      useDesignBuilderSessionStore.getState().sessions[sessionKey]?.preset?.wallLayout?.segments.length,
    ).toBeGreaterThan(0);
  });
}
