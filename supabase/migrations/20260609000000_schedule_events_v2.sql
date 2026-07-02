/*
  Schedule events v2 — priority, expanded types, photos, activity, comments
  Future sync: ICS export → Google Calendar → Outlook → Microsoft Teams (Graph)

  If schedule_events was never created (skipped 20260608000000), this migration
  creates the full table first, then applies v2 constraint/column updates.
*/

-- ---------------------------------------------------------------------------
-- Base table (only when missing — e.g. v2 run without 20260608000000)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES planner_tasks(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  event_type text NOT NULL DEFAULT 'general_task',
  status text NOT NULL DEFAULT 'scheduled',
  priority text NOT NULL DEFAULT 'medium',
  start_date date NOT NULL,
  end_date date,
  start_time time,
  end_time time,
  trade text,
  crew text,
  location text,
  assigned_to jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  activity_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  comments jsonb NOT NULL DEFAULT '[]'::jsonb,
  weather_risk text,
  milestone_key text,
  sync_metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_events_project_idx ON schedule_events(project_id);
CREATE INDEX IF NOT EXISTS schedule_events_project_start_idx ON schedule_events(project_id, start_date);
CREATE INDEX IF NOT EXISTS schedule_events_status_idx ON schedule_events(status);
CREATE INDEX IF NOT EXISTS schedule_events_event_type_idx ON schedule_events(event_type);
CREATE INDEX IF NOT EXISTS schedule_events_start_date_idx ON schedule_events(start_date);

ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'schedule_events'
      AND policyname = 'Project members view schedule events'
  ) THEN
    CREATE POLICY "Project members view schedule events"
      ON schedule_events FOR SELECT TO authenticated
      USING (public.can_access_project(project_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'schedule_events'
      AND policyname = 'Project members create schedule events'
  ) THEN
    CREATE POLICY "Project members create schedule events"
      ON schedule_events FOR INSERT TO authenticated
      WITH CHECK (
        public.can_access_project(project_id)
        AND created_by = auth.uid()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'schedule_events'
      AND policyname = 'Owners manage schedule events'
  ) THEN
    CREATE POLICY "Owners manage schedule events"
      ON schedule_events FOR UPDATE TO authenticated
      USING (public.is_project_owner(project_id))
      WITH CHECK (public.is_project_owner(project_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'schedule_events'
      AND policyname = 'Owners delete schedule events'
  ) THEN
    CREATE POLICY "Owners delete schedule events"
      ON schedule_events FOR DELETE TO authenticated
      USING (public.is_project_owner(project_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'schedule_events'
      AND policyname = 'Creators update own schedule events'
  ) THEN
    CREATE POLICY "Creators update own schedule events"
      ON schedule_events FOR UPDATE TO authenticated
      USING (created_by = auth.uid() AND public.is_project_employee(project_id))
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- v2 columns (when table existed from 20260608000000 only)
-- ---------------------------------------------------------------------------
ALTER TABLE schedule_events
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS related_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS activity_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS comments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill priority for rows created before NOT NULL default applied
UPDATE schedule_events SET priority = 'medium' WHERE priority IS NULL;

ALTER TABLE schedule_events DROP CONSTRAINT IF EXISTS schedule_events_priority_check;
ALTER TABLE schedule_events ADD CONSTRAINT schedule_events_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE schedule_events DROP CONSTRAINT IF EXISTS schedule_events_event_type_check;
ALTER TABLE schedule_events ADD CONSTRAINT schedule_events_event_type_check
  CHECK (event_type IN (
    'bid_due_date',
    'proposal_due',
    'client_meeting',
    'contract_award',
    'site_visit',
    'preconstruction_meeting',
    'mobilization',
    'crew_work_day',
    'material_delivery',
    'equipment_delivery',
    'inspection',
    'subcontractor_meeting',
    'weather_delay',
    'change_order_deadline',
    'permit_deadline',
    'submittal_due',
    'rfi_due',
    'punch_list',
    'closeout',
    'warranty_follow_up',
    'general_task'
  ));

ALTER TABLE schedule_events DROP CONSTRAINT IF EXISTS schedule_events_status_check;
ALTER TABLE schedule_events ADD CONSTRAINT schedule_events_status_check
  CHECK (status IN (
    'scheduled',
    'in_progress',
    'completed',
    'delayed',
    'cancelled',
    'needs_attention'
  ));

ALTER TABLE schedule_events DROP CONSTRAINT IF EXISTS schedule_events_weather_risk_check;
ALTER TABLE schedule_events ADD CONSTRAINT schedule_events_weather_risk_check
  CHECK (weather_risk IS NULL OR weather_risk IN ('low', 'medium', 'high'));

ALTER TABLE schedule_events DROP CONSTRAINT IF EXISTS schedule_events_milestone_key_check;
ALTER TABLE schedule_events ADD CONSTRAINT schedule_events_milestone_key_check
  CHECK (milestone_key IS NULL OR milestone_key IN (
    'bid_due',
    'contract_award',
    'notice_to_proceed',
    'mobilization',
    'material_delivery',
    'start_work',
    'inspection',
    'substantial_completion',
    'punch_list',
    'closeout',
    'warranty',
    'warranty_end'
  ));

CREATE INDEX IF NOT EXISTS schedule_events_priority_idx ON schedule_events(priority);
