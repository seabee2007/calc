/*
  # Fix foreign key constraint for calculations table

  1. Changes
    - Drop existing foreign key constraint if it exists
    - Add proper foreign key constraint from calculations.project_id to projects.id
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