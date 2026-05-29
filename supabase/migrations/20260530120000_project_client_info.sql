/*
  Client / customer details on projects for proposal pre-fill.
*/

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_info jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN projects.client_info IS
  'Client name, company, contact, and billing/site address for proposal generation.';
