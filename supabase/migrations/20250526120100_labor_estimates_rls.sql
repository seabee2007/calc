-- If labor_estimates was created without RLS (earlier migration), apply policies now.
ALTER TABLE labor_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage labor estimates for their projects" ON labor_estimates;

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
