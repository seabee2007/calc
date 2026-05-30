/*
  Client project portals — secure token links for client-facing progress views.
*/

CREATE TABLE IF NOT EXISTS client_portals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contractor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_email text NOT NULL,
  token text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_portals_project_id_idx ON client_portals(project_id);
CREATE INDEX IF NOT EXISTS client_portals_token_idx ON client_portals(token);
CREATE INDEX IF NOT EXISTS client_portals_contractor_user_id_idx ON client_portals(contractor_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS client_portals_one_active_per_project_idx
  ON client_portals(project_id)
  WHERE is_active = true;

ALTER TABLE client_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors manage own client portals"
  ON client_portals
  FOR ALL
  TO authenticated
  USING (contractor_user_id = auth.uid())
  WITH CHECK (contractor_user_id = auth.uid());

COMMENT ON TABLE client_portals IS
  'Token-based client dashboard access. Public reads go through the client-project-portal edge function only.';
