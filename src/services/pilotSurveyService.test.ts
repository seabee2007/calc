import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  formValuesFromResponse,
  getMyPilotSurveyResponse,
  upsertMyPilotSurveyResponse,
} from './pilotSurveyService';
import { EMPTY_PILOT_SURVEY } from '../types/pilotSurvey';

const authUser = vi.hoisted(() => ({
  id: 'user-123',
  email: 'pilot@example.com',
}));

const supabaseMock = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => supabaseMock.getUser(),
    },
    from: (table: string) => supabaseMock.from(table),
  },
}));

describe('pilotSurveyService', () => {
  beforeEach(() => {
    supabaseMock.getUser.mockResolvedValue({
      data: { user: authUser },
      error: null,
    });
    supabaseMock.from.mockReset();
  });

  it('throws when user is not authenticated', async () => {
    supabaseMock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getMyPilotSurveyResponse()).rejects.toThrow('Not authenticated');
  });

  it('maps existing survey response from database row', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'survey-1',
        user_id: authUser.id,
        user_email: authUser.email,
        work_role: 'Estimator',
        current_tools: 'Spreadsheets',
        tested_project_type: 'Slab',
        first_impression: 'Clean',
        professional_trust_rating: 'Yes',
        initial_confusion: 'None',
        easy_to_find: 'Somewhat',
        hardest_feature_to_find: 'Schedule',
        workflow_makes_sense: 'Yes',
        workflow_confusing_parts: '',
        easy_to_read_navigate: 'Yes',
        crowded_or_unfinished_screen: '',
        best_screen_or_feature: 'Dashboard',
        needs_improvement_screen_or_feature: 'Settings',
        most_useful_feature: 'Estimates',
        confusing_or_not_useful_feature: '',
        missing_expected_feature: '',
        saves_time_rating: 'Maybe',
        bugs_or_wrong_info: '',
        fix_first: '',
        top_three_liked: 'UI',
        top_three_needs_work: 'Navigation',
        willing_to_test_next_version: 'Yes',
        final_comments: 'Great start',
        submitted_at: '2026-06-15T00:00:00.000Z',
        updated_at: '2026-06-15T00:00:00.000Z',
      },
      error: null,
    });

    supabaseMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    });

    const result = await getMyPilotSurveyResponse();
    expect(result?.workRole).toBe('Estimator');
    expect(formValuesFromResponse(result!)).toMatchObject({
      workRole: 'Estimator',
      currentTools: 'Spreadsheets',
      finalComments: 'Great start',
    });
  });

  it('upserts survey response with user_id conflict target', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'survey-1',
        user_id: authUser.id,
        user_email: authUser.email,
        work_role: 'Contractor',
        submitted_at: '2026-06-15T00:00:00.000Z',
        updated_at: '2026-06-15T00:00:00.000Z',
      },
      error: null,
    });

    const upsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });

    supabaseMock.from.mockReturnValue({ upsert });

    const result = await upsertMyPilotSurveyResponse({
      ...EMPTY_PILOT_SURVEY,
      workRole: 'Contractor',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: authUser.id,
        user_email: authUser.email,
        work_role: 'Contractor',
      }),
      { onConflict: 'user_id' },
    );
    expect(result.userId).toBe(authUser.id);
  });
});
