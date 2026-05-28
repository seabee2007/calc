/*
  Link proposals to projects (CRM / workflow).

  Adds proposals.project_id so project next-actions can resolve proposal state
  without fuzzy title matching.
*/

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS proposals_project_id_idx ON proposals(project_id);

