/*
  # Truck ticket QC records

  Stores full delivery ticket + field QC data per project load.
  Syncs across devices via Supabase (phone, laptop, etc.).
*/

CREATE TABLE IF NOT EXISTS truck_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  ticket_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE truck_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage truck tickets for their projects"
  ON truck_tickets
  FOR ALL
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS truck_tickets_project_id_idx
  ON truck_tickets(project_id);

CREATE INDEX IF NOT EXISTS truck_tickets_record_date_idx
  ON truck_tickets(record_date DESC);
