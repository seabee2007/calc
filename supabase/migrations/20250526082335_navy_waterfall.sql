/*
  # Add mix profile to projects table

  1. Changes
    - Add mix_profile column to projects table to track concrete mix profiles
    - Set default value to 'standard'
    - Add check constraint to ensure valid mix profile values
*/

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS mix_profile text DEFAULT 'standard';

-- Add check constraint to ensure valid mix profile values
ALTER TABLE projects
ADD CONSTRAINT projects_mix_profile_check
CHECK (mix_profile IN ('standard', 'rapid', 'slow'));

-- Set mix_profile to 'standard' for existing rows
UPDATE projects
SET mix_profile = 'standard'
WHERE mix_profile IS NULL;