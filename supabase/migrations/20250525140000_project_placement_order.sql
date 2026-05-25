-- Placement order draft / status for pour planner (dashboard-ready JSON)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS placement_order jsonb;

COMMENT ON COLUMN projects.placement_order IS
  'Pour planner order draft: contact, status, call-sheet snapshot';
