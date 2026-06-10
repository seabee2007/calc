/*
  Activity line item labor pricing snapshots — Labor Pricing System (Milestone 1C)
  Safe/idempotent migration.
*/

ALTER TABLE project_activity_line_items
  ADD COLUMN IF NOT EXISTS labor_role_id uuid REFERENCES project_labor_rates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS labor_role_key text,
  ADD COLUMN IF NOT EXISTS labor_role_name text,
  ADD COLUMN IF NOT EXISTS trade_category text,
  ADD COLUMN IF NOT EXISTS hourly_rate_snapshot numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS burden_percent_snapshot numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fully_burdened_rate_snapshot numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_rate_snapshot numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_source text DEFAULT 'unset',
  ADD COLUMN IF NOT EXISTS pricing_snapshot_at timestamptz;

COMMENT ON COLUMN project_activity_line_items.pricing_source IS
  'project_rate | manual | unset';
