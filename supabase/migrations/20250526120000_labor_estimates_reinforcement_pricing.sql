-- Standalone labor estimates (Labor Calculator) per project
CREATE TABLE IF NOT EXISTS labor_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  label text DEFAULT 'Placement labor',
  volume_yd numeric,
  inputs jsonb NOT NULL DEFAULT '{}',
  labor_cost numeric NOT NULL DEFAULT 0,
  adjusted_labor_hours numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS labor_estimates_project_id_idx ON labor_estimates(project_id);

ALTER TABLE labor_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage labor estimates for their projects"
  ON labor_estimates
  FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE labor_estimates IS 'Crew & production labor estimate from Labor Calculator (proposal import)';
COMMENT ON COLUMN labor_estimates.inputs IS 'Crew/production form snapshot (crew size, rates, etc.)';

-- Optional pricing on reinforcement designs for proposal import
ALTER TABLE reinforcement_sets
  ADD COLUMN IF NOT EXISTS pricing jsonb;

COMMENT ON COLUMN reinforcement_sets.pricing IS
  'Optional { estimatedCost, notes } for proposal line items';
