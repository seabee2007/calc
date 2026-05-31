-- Field safety tools: daily safety meetings and concrete inspection checklists

CREATE TABLE safety_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  project_name text,
  project_address text,
  meeting_date date,
  supervisor text,
  company_name text,
  weather text,
  work_activity text,
  toolbox_topic text,
  toolbox_content jsonb DEFAULT '{}'::jsonb,
  jha_rows jsonb DEFAULT '[]'::jsonb,
  attendees jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE concrete_inspection_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  project_name text,
  project_address text,
  inspection_date date,
  inspector text,
  contractor text,
  mix_design text,
  placement_type text,
  pour_area text,
  estimated_yards numeric,
  pre_pour_items jsonb DEFAULT '[]'::jsonb,
  during_placement_items jsonb DEFAULT '[]'::jsonb,
  post_placement_items jsonb DEFAULT '[]'::jsonb,
  notes text,
  inspector_signature text,
  contractor_signature text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX safety_meetings_user_date_idx ON safety_meetings (user_id, meeting_date DESC);
CREATE INDEX safety_meetings_project_idx ON safety_meetings (project_id) WHERE project_id IS NOT NULL;

CREATE INDEX concrete_inspection_checklists_user_date_idx
  ON concrete_inspection_checklists (user_id, inspection_date DESC);
CREATE INDEX concrete_inspection_checklists_project_idx
  ON concrete_inspection_checklists (project_id) WHERE project_id IS NOT NULL;

ALTER TABLE safety_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE concrete_inspection_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own safety meetings"
  ON safety_meetings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own concrete inspection checklists"
  ON concrete_inspection_checklists
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_field_tool_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER safety_meetings_updated_at
  BEFORE UPDATE ON safety_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_field_tool_updated_at();

CREATE TRIGGER concrete_inspection_checklists_updated_at
  BEFORE UPDATE ON concrete_inspection_checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.set_field_tool_updated_at();
