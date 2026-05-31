/*
  Field Planner — project schedule events (bid through closeout)
  sync_metadata reserved for future ICS / Outlook / Google Calendar / Teams integration
*/

CREATE TABLE IF NOT EXISTS schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES planner_tasks(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  event_type text NOT NULL DEFAULT 'general_task'
    CHECK (event_type IN (
      'bid_due_date',
      'site_visit',
      'preconstruction_meeting',
      'crew_work_day',
      'material_delivery',
      'inspection',
      'subcontractor_meeting',
      'weather_delay',
      'change_order_deadline',
      'punch_list',
      'warranty_follow_up',
      'general_task'
    )),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN (
      'scheduled',
      'in_progress',
      'completed',
      'delayed',
      'cancelled',
      'needs_attention'
    )),
  start_date date NOT NULL,
  end_date date,
  start_time time,
  end_time time,
  trade text,
  crew text,
  location text,
  assigned_to jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  weather_risk text CHECK (weather_risk IS NULL OR weather_risk IN ('low', 'medium', 'high')),
  milestone_key text CHECK (milestone_key IS NULL OR milestone_key IN (
    'bid_due',
    'notice_to_proceed',
    'mobilization',
    'material_delivery',
    'start_work',
    'inspection',
    'substantial_completion',
    'punch_list',
    'closeout',
    'warranty'
  )),
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

CREATE POLICY "Project members view schedule events"
  ON schedule_events FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY "Project members create schedule events"
  ON schedule_events FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_project(project_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Owners manage schedule events"
  ON schedule_events FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY "Owners delete schedule events"
  ON schedule_events FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

CREATE POLICY "Creators update own schedule events"
  ON schedule_events FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND public.is_project_employee(project_id))
  WITH CHECK (created_by = auth.uid());
