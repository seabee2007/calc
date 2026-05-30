-- Manual project estimates (labor / material / equipment line items) for workflow step 2
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS custom_estimates jsonb NOT NULL DEFAULT '{"laborItems":[],"materialItems":[],"equipmentItems":[]}'::jsonb;
