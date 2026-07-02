-- Bootstrap reinforcement_sets and cut_list_items for fresh migration replay.
-- Production schema capture; SQL behavior unchanged.

CREATE TABLE IF NOT EXISTS public.reinforcement_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  project_name text,
  length_ft numeric,
  width_ft numeric,
  thickness_in numeric,
  height_ft numeric,
  cover_in numeric,
  reinforcement_type text,
  bar_size text,
  spacing_x_in numeric,
  spacing_y_in numeric,
  total_bars_x integer,
  total_bars_y integer,
  total_bars integer,
  total_linear_ft numeric,
  vertical_bars integer,
  tie_spacing numeric,
  fiber_dose numeric,
  fiber_total_lb numeric,
  fiber_bags numeric,
  fiber_type text,
  mesh_sheets numeric,
  mesh_sheet_size text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id),
  pricing jsonb
);

CREATE TABLE IF NOT EXISTS public.cut_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reinforcement_set_id uuid REFERENCES public.reinforcement_sets(id) ON DELETE CASCADE,
  length_ft numeric,
  quantity integer,
  direction text,
  bar_size text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reinforcement_sets_project_id
  ON public.reinforcement_sets (project_id);

CREATE INDEX IF NOT EXISTS reinforcement_sets_user_id_idx
  ON public.reinforcement_sets (user_id);

CREATE INDEX IF NOT EXISTS idx_cut_list_items_reinforcement_set_id
  ON public.cut_list_items (reinforcement_set_id);

ALTER TABLE public.reinforcement_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cut_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage reinforcement for own projects"
  ON public.reinforcement_sets;

CREATE POLICY "Users can manage reinforcement for own projects"
  ON public.reinforcement_sets
  FOR ALL
  USING (
    project_id IN (
      SELECT projects.id
      FROM projects
      WHERE projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT projects.id
      FROM projects
      WHERE projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage cut list items for own reinforcement"
  ON public.cut_list_items;

CREATE POLICY "Users can manage cut list items for own reinforcement"
  ON public.cut_list_items
  FOR ALL
  USING (
    reinforcement_set_id IN (
      SELECT rs.id
      FROM reinforcement_sets rs
      JOIN projects p ON p.id = rs.project_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    reinforcement_set_id IN (
      SELECT rs.id
      FROM reinforcement_sets rs
      JOIN projects p ON p.id = rs.project_id
      WHERE p.user_id = auth.uid()
    )
  );
