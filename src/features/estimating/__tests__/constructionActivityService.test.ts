import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import {
  DUPLICATE_ACTIVITY_CODE_MESSAGE,
  instantiateAndSaveManualActivity,
} from '../application/constructionActivityService';

const repositoryMocks = vi.hoisted(() => ({
  fetchProjectActivities: vi.fn(),
  fetchProjectLineItems: vi.fn(),
  deleteProjectActivity: vi.fn(),
  saveActivityBundle: vi.fn(),
}));

vi.mock('../infrastructure/activityRepository', () => repositoryMocks);

const duplicateCodeError =
  'duplicate key value violates unique constraint "idx_project_construction_activities_code_unique"';

function manualInput() {
  return {
    divisionCode: '03',
    divisionName: 'Concrete',
    lineItems: [
      {
        description: 'Place concrete',
        quantity: 10,
        unit: 'CYD',
        manHoursPerUnit: 0.5,
      },
    ],
    projectId: 'project-1',
    identity: {
      activityName: 'Slab on grade',
    },
    projectLaborRates: [],
  };
}

describe('constructionActivityService activity-code retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositoryMocks.fetchProjectActivities.mockResolvedValue({ data: [], error: null });
  });

  it('regenerates and retries once when Supabase reports a duplicate activity code', async () => {
    const attemptedCodes: string[] = [];
    repositoryMocks.saveActivityBundle
      .mockImplementationOnce((activity: ProjectConstructionActivity) => {
        attemptedCodes.push(activity.activityCode);
        return Promise.resolve({ data: null, error: duplicateCodeError });
      })
      .mockImplementationOnce((activity: ProjectConstructionActivity, lineItems) => {
        attemptedCodes.push(activity.activityCode);
        return Promise.resolve({
          data: {
            activity: { ...activity, id: 'saved-activity' },
            lineItems,
          },
          error: null,
        });
      });

    const result = await instantiateAndSaveManualActivity(manualInput());

    expect(result.error).toBeNull();
    expect(result.data?.activity.activityCode).toBe('03-02-01');
    expect(attemptedCodes).toEqual(['03-01-01', '03-02-01']);
    expect(repositoryMocks.saveActivityBundle).toHaveBeenCalledTimes(2);
  });

  it('returns a friendly message if duplicate-code retry also fails', async () => {
    repositoryMocks.saveActivityBundle.mockResolvedValue({ data: null, error: duplicateCodeError });

    const result = await instantiateAndSaveManualActivity(manualInput());

    expect(result.data).toBeNull();
    expect(result.error).toBe(DUPLICATE_ACTIVITY_CODE_MESSAGE);
    expect(result.error).not.toContain('idx_project_construction_activities_code_unique');
    expect(repositoryMocks.saveActivityBundle).toHaveBeenCalledTimes(2);
  });
});
