/*
  # Add QC Records Table

  1. New Tables
    - `qc_records`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key)
      - `date` (date)
      - `temperature` (numeric)
      - `humidity` (numeric)
      - `slump` (numeric)
      - `air_content` (numeric)
      - `cylinders_made` (integer)
      - `notes` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS qc_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  temperature numeric NOT NULL,
  humidity numeric NOT NULL,
  slump numeric NOT NULL,
  air_content numeric NOT NULL,
  cylinders_made integer NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE qc_records ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage QC records for their projects"
  ON qc_records
  FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS qc_records_project_id_idx 
ON qc_records(project_id);