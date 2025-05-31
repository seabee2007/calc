-- Add missing columns to reinforcement_sets table for complete reinforcement data

ALTER TABLE reinforcement_sets 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS height_ft DECIMAL,
ADD COLUMN IF NOT EXISTS bar_size TEXT,
ADD COLUMN IF NOT EXISTS spacing_x_in DECIMAL,
ADD COLUMN IF NOT EXISTS spacing_y_in DECIMAL,
ADD COLUMN IF NOT EXISTS total_bars_x INTEGER,
ADD COLUMN IF NOT EXISTS total_bars_y INTEGER,
ADD COLUMN IF NOT EXISTS total_bars INTEGER,
ADD COLUMN IF NOT EXISTS total_linear_ft DECIMAL,
ADD COLUMN IF NOT EXISTS vertical_bars INTEGER,
ADD COLUMN IF NOT EXISTS tie_spacing DECIMAL,
ADD COLUMN IF NOT EXISTS fiber_dose DECIMAL,
ADD COLUMN IF NOT EXISTS fiber_total_lb DECIMAL,
ADD COLUMN IF NOT EXISTS fiber_bags INTEGER,
ADD COLUMN IF NOT EXISTS fiber_type TEXT,
ADD COLUMN IF NOT EXISTS mesh_sheets INTEGER,
ADD COLUMN IF NOT EXISTS mesh_sheet_size TEXT;

-- Create index on project_id for better query performance
CREATE INDEX IF NOT EXISTS idx_reinforcement_sets_project_id ON reinforcement_sets(project_id);

-- Update RLS policies to include project_id filtering
DROP POLICY IF EXISTS "Users can view their own reinforcement sets" ON reinforcement_sets;
CREATE POLICY "Users can view their own reinforcement sets" ON reinforcement_sets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own reinforcement sets" ON reinforcement_sets;  
CREATE POLICY "Users can insert their own reinforcement sets" ON reinforcement_sets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reinforcement sets" ON reinforcement_sets;
CREATE POLICY "Users can update their own reinforcement sets" ON reinforcement_sets
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reinforcement sets" ON reinforcement_sets;
CREATE POLICY "Users can delete their own reinforcement sets" ON reinforcement_sets
  FOR DELETE USING (auth.uid() = user_id); 