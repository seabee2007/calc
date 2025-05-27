/*
  # Fix calculations table structure

  1. Changes
    - Drop and recreate calculations table with proper constraints
    - Add CHECK constraint for calculation types
    - Ensure proper foreign key references
    - Maintain RLS policies and indexes
*/

-- Drop and recreate calculations table with all constraints
DROP TABLE IF EXISTS calculations;

CREATE TABLE calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  type text NOT NULL,
  dimensions jsonb NOT NULL,
  result jsonb NOT NULL,
  weather jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT calculations_project_id_fkey 
    FOREIGN KEY (project_id) 
    REFERENCES projects(id) 
    ON DELETE CASCADE,
  CONSTRAINT valid_calculation_type 
    CHECK (type IN ('slab', 'footer', 'column', 'sidewalk', 'thickened_edge_slab'))
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