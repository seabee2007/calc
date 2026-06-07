/*
  Master-driven activity identity + runtime id.

  Adds dedicated, nullable columns to estimate_line_items so an activity's identity
  (master code, instance, display code, classification) and schedule logic round-trip
  through the database instead of being regenerated from add order on every load.

  All columns are nullable / defaulted so existing rows and inserts remain valid
  (fully backward compatible; append-only RLS is unaffected).
*/

ALTER TABLE estimate_line_items
  ADD COLUMN IF NOT EXISTS activity_code text,
  ADD COLUMN IF NOT EXISTS master_activity_code text,
  ADD COLUMN IF NOT EXISTS activity_instance integer,
  ADD COLUMN IF NOT EXISTS display_code text,
  ADD COLUMN IF NOT EXISTS is_custom_activity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activity_type text
    CHECK (
      activity_type IS NULL
      OR activity_type IN (
        'work',
        'inspection',
        'milestone',
        'curing_lag',
        'procurement_lead_time',
        'testing'
      )
    ),
  ADD COLUMN IF NOT EXISTS sequencing_category text,
  ADD COLUMN IF NOT EXISTS logic_anchor text,
  ADD COLUMN IF NOT EXISTS work_package_code text,
  ADD COLUMN IF NOT EXISTS division_code text,
  ADD COLUMN IF NOT EXISTS division_name text,
  ADD COLUMN IF NOT EXISTS predecessor_activity_code text,
  ADD COLUMN IF NOT EXISTS relationship_type text
    CHECK (
      relationship_type IS NULL
      OR relationship_type IN ('FS', 'SS', 'FF', 'SF')
    ),
  ADD COLUMN IF NOT EXISTS lag_days numeric;

CREATE INDEX IF NOT EXISTS estimate_line_items_activity_code_idx
  ON estimate_line_items(estimate_version_id, activity_code);

CREATE INDEX IF NOT EXISTS estimate_line_items_master_activity_code_idx
  ON estimate_line_items(master_activity_code);
