-- Drop and recreate calculations table with correct references
DROP TABLE IF EXISTS calculations;

CREATE TABLE calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('slab', 'footer', 'column', 'sidewalk', 'thickened_edge_slab')),
  dimensions jsonb NOT NULL,
  result jsonb NOT NULL,
  weather jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create index for better join performance
CREATE INDEX IF NOT EXISTS calculations_project_id_idx 
ON calculations(project_id);

-- Enable RLS
ALTER TABLE calculations ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can manage calculations in their projects"
  ON calculations
  FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );