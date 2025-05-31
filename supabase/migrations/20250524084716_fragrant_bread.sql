/*
  # Add foreign key constraint for calculations table

  1. Changes
    - Drop any existing foreign key constraint to avoid conflicts
    - Add proper foreign key constraint linking calculations.project_id to projects.id
    - Include ON DELETE CASCADE to automatically remove calculations when their project is deleted
*/

-- Drop any existing constraint
ALTER TABLE public.calculations
DROP CONSTRAINT IF EXISTS calculations_project_id_fkey;

-- Add proper foreign key constraint
ALTER TABLE public.calculations
ADD CONSTRAINT calculations_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE CASCADE;