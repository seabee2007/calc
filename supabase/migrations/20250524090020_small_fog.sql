/*
  # Fix project-calculations relationship

  1. Changes
    - Drop all existing foreign key constraints
    - Re-create the foreign key with proper cascade behavior
    - Add indexes for better query performance
*/

-- First drop any existing constraints
ALTER TABLE public.calculations 
DROP CONSTRAINT IF EXISTS calculations_project_id_fkey;

-- Add proper foreign key constraint
ALTER TABLE public.calculations
ADD CONSTRAINT calculations_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE CASCADE;

-- Add index for better join performance
CREATE INDEX IF NOT EXISTS calculations_project_id_idx 
ON public.calculations(project_id);