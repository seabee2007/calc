/*
  # Add Foreign Key Constraint for Projects and Calculations

  1. Changes
    - Drop existing foreign key constraint if it exists
    - Add proper foreign key constraint between projects and calculations tables
    - Ensure ON DELETE CASCADE behavior is maintained

  2. Security
    - No changes to existing RLS policies
*/

-- Drop any existing constraint to avoid conflicts
ALTER TABLE public.calculations 
DROP CONSTRAINT IF EXISTS calculations_project_id_fkey;

-- Add proper foreign key constraint
ALTER TABLE public.calculations
ADD CONSTRAINT calculations_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE CASCADE;