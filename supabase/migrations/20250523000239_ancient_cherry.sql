/*
  # Add waste factor to projects table

  1. Changes
    - Add waste_factor column to projects table with default value of 10
*/

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS waste_factor integer DEFAULT 10;