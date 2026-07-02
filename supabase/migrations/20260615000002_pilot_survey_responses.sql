/*
  Pilot program survey responses — one row per user, upsert on resubmit.
*/

CREATE TABLE IF NOT EXISTS public.pilot_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NULL,

  work_role text NULL,
  current_tools text NULL,
  tested_project_type text NULL,

  first_impression text NULL,
  professional_trust_rating text NULL,
  initial_confusion text NULL,

  easy_to_find text NULL,
  hardest_feature_to_find text NULL,
  workflow_makes_sense text NULL,
  workflow_confusing_parts text NULL,

  easy_to_read_navigate text NULL,
  crowded_or_unfinished_screen text NULL,
  best_screen_or_feature text NULL,
  needs_improvement_screen_or_feature text NULL,

  most_useful_feature text NULL,
  confusing_or_not_useful_feature text NULL,
  missing_expected_feature text NULL,
  saves_time_rating text NULL,

  bugs_or_wrong_info text NULL,
  fix_first text NULL,

  top_three_liked text NULL,
  top_three_needs_work text NULL,
  willing_to_test_next_version text NULL,
  final_comments text NULL,

  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pilot_survey_responses_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS pilot_survey_responses_user_id_idx
  ON public.pilot_survey_responses(user_id);

CREATE INDEX IF NOT EXISTS pilot_survey_responses_submitted_at_idx
  ON public.pilot_survey_responses(submitted_at DESC);

ALTER TABLE public.pilot_survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own survey response"
  ON public.pilot_survey_responses;

CREATE POLICY "Users can insert own survey response"
  ON public.pilot_survey_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own survey response"
  ON public.pilot_survey_responses;

CREATE POLICY "Users can read own survey response"
  ON public.pilot_survey_responses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own survey response"
  ON public.pilot_survey_responses;

CREATE POLICY "Users can update own survey response"
  ON public.pilot_survey_responses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_pilot_survey_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_pilot_survey_updated_at
  ON public.pilot_survey_responses;

CREATE TRIGGER set_pilot_survey_updated_at
BEFORE UPDATE ON public.pilot_survey_responses
FOR EACH ROW
EXECUTE FUNCTION public.set_pilot_survey_updated_at();

COMMENT ON TABLE public.pilot_survey_responses IS
  'Pilot program feedback — one response per authenticated user.';
