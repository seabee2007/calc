import { describe, expect, it, vi } from 'vitest';
import { resetCurrentEstimateWorkspace } from '../application/currentEstimateService';

vi.mock('../infrastructure/activityRepository', () => ({
  deleteProjectConstructionActivities: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    })),
  },
}));

import { deleteProjectConstructionActivities } from '../infrastructure/activityRepository';

describe('resetCurrentEstimateWorkspace', () => {
  it('deletes construction activities before clearing the estimate row', async () => {
    const order: string[] = [];
    vi.mocked(deleteProjectConstructionActivities).mockImplementation(async () => {
      order.push('activities');
      return { data: null, error: null };
    });

    const result = await resetCurrentEstimateWorkspace('project-1');

    expect(result.error).toBeNull();
    expect(deleteProjectConstructionActivities).toHaveBeenCalledWith('project-1');
    expect(order).toEqual(['activities']);
  });

  it('returns an error when activity deletion fails', async () => {
    vi.mocked(deleteProjectConstructionActivities).mockResolvedValue({
      data: null,
      error: 'Could not delete activities',
    });

    const result = await resetCurrentEstimateWorkspace('project-1');

    expect(result.data).toBeNull();
    expect(result.error).toBe('Could not delete activities');
  });
});
