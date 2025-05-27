/*
  # Add pour date to projects table

  1. Changes
    - Add pour_date column to projects table to track concrete pour dates
    - Add index for efficient date-based queries
*/

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS pour_date date;

-- Add index for date-based queries
CREATE INDEX IF NOT EXISTS projects_pour_date_idx 
ON projects(pour_date);