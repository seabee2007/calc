import { supabase } from '../lib/supabase';
import type { PilotSurveyFormValues, PilotSurveyResponse } from '../types/pilotSurvey';
import { EMPTY_PILOT_SURVEY } from '../types/pilotSurvey';

function mapRow(row: Record<string, unknown>): PilotSurveyResponse {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userEmail: (row.user_email as string) ?? null,
    workRole: (row.work_role as string) ?? '',
    currentTools: (row.current_tools as string) ?? '',
    testedProjectType: (row.tested_project_type as string) ?? '',
    firstImpression: (row.first_impression as string) ?? '',
    professionalTrustRating: (row.professional_trust_rating as string) ?? '',
    initialConfusion: (row.initial_confusion as string) ?? '',
    easyToFind: (row.easy_to_find as string) ?? '',
    hardestFeatureToFind: (row.hardest_feature_to_find as string) ?? '',
    workflowMakesSense: (row.workflow_makes_sense as string) ?? '',
    workflowConfusingParts: (row.workflow_confusing_parts as string) ?? '',
    easyToReadNavigate: (row.easy_to_read_navigate as string) ?? '',
    crowdedOrUnfinishedScreen: (row.crowded_or_unfinished_screen as string) ?? '',
    bestScreenOrFeature: (row.best_screen_or_feature as string) ?? '',
    needsImprovementScreenOrFeature: (row.needs_improvement_screen_or_feature as string) ?? '',
    mostUsefulFeature: (row.most_useful_feature as string) ?? '',
    confusingOrNotUsefulFeature: (row.confusing_or_not_useful_feature as string) ?? '',
    missingExpectedFeature: (row.missing_expected_feature as string) ?? '',
    savesTimeRating: (row.saves_time_rating as string) ?? '',
    bugsOrWrongInfo: (row.bugs_or_wrong_info as string) ?? '',
    fixFirst: (row.fix_first as string) ?? '',
    topThreeLiked: (row.top_three_liked as string) ?? '',
    topThreeNeedsWork: (row.top_three_needs_work as string) ?? '',
    willingToTestNextVersion: (row.willing_to_test_next_version as string) ?? '',
    finalComments: (row.final_comments as string) ?? '',
    submittedAt: row.submitted_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toDbRow(userId: string, userEmail: string | null, payload: PilotSurveyFormValues) {
  return {
    user_id: userId,
    user_email: userEmail,
    work_role: payload.workRole || null,
    current_tools: payload.currentTools || null,
    tested_project_type: payload.testedProjectType || null,
    first_impression: payload.firstImpression || null,
    professional_trust_rating: payload.professionalTrustRating || null,
    initial_confusion: payload.initialConfusion || null,
    easy_to_find: payload.easyToFind || null,
    hardest_feature_to_find: payload.hardestFeatureToFind || null,
    workflow_makes_sense: payload.workflowMakesSense || null,
    workflow_confusing_parts: payload.workflowConfusingParts || null,
    easy_to_read_navigate: payload.easyToReadNavigate || null,
    crowded_or_unfinished_screen: payload.crowdedOrUnfinishedScreen || null,
    best_screen_or_feature: payload.bestScreenOrFeature || null,
    needs_improvement_screen_or_feature: payload.needsImprovementScreenOrFeature || null,
    most_useful_feature: payload.mostUsefulFeature || null,
    confusing_or_not_useful_feature: payload.confusingOrNotUsefulFeature || null,
    missing_expected_feature: payload.missingExpectedFeature || null,
    saves_time_rating: payload.savesTimeRating || null,
    bugs_or_wrong_info: payload.bugsOrWrongInfo || null,
    fix_first: payload.fixFirst || null,
    top_three_liked: payload.topThreeLiked || null,
    top_three_needs_work: payload.topThreeNeedsWork || null,
    willing_to_test_next_version: payload.willingToTestNextVersion || null,
    final_comments: payload.finalComments || null,
    submitted_at: new Date().toISOString(),
  };
}

export function formValuesFromResponse(response: PilotSurveyResponse): PilotSurveyFormValues {
  return {
    workRole: response.workRole,
    currentTools: response.currentTools,
    testedProjectType: response.testedProjectType,
    firstImpression: response.firstImpression,
    professionalTrustRating: response.professionalTrustRating,
    initialConfusion: response.initialConfusion,
    easyToFind: response.easyToFind,
    hardestFeatureToFind: response.hardestFeatureToFind,
    workflowMakesSense: response.workflowMakesSense,
    workflowConfusingParts: response.workflowConfusingParts,
    easyToReadNavigate: response.easyToReadNavigate,
    crowdedOrUnfinishedScreen: response.crowdedOrUnfinishedScreen,
    bestScreenOrFeature: response.bestScreenOrFeature,
    needsImprovementScreenOrFeature: response.needsImprovementScreenOrFeature,
    mostUsefulFeature: response.mostUsefulFeature,
    confusingOrNotUsefulFeature: response.confusingOrNotUsefulFeature,
    missingExpectedFeature: response.missingExpectedFeature,
    savesTimeRating: response.savesTimeRating,
    bugsOrWrongInfo: response.bugsOrWrongInfo,
    fixFirst: response.fixFirst,
    topThreeLiked: response.topThreeLiked,
    topThreeNeedsWork: response.topThreeNeedsWork,
    willingToTestNextVersion: response.willingToTestNextVersion,
    finalComments: response.finalComments,
  };
}

export async function getMyPilotSurveyResponse(): Promise<PilotSurveyResponse | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('pilot_survey_responses')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function upsertMyPilotSurveyResponse(
  payload: PilotSurveyFormValues,
): Promise<PilotSurveyResponse> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error('Not authenticated');

  const row = toDbRow(user.id, user.email ?? null, payload);

  const { data, error } = await supabase
    .from('pilot_survey_responses')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export { EMPTY_PILOT_SURVEY };
