/*
  Production-rate assignment audit fields for construction activity line items.
  Safe/idempotent migration.
*/

ALTER TABLE project_activity_line_items
  ADD COLUMN IF NOT EXISTS production_rate_assignment_status text,
  ADD COLUMN IF NOT EXISTS production_rate_match_confidence numeric,
  ADD COLUMN IF NOT EXISTS production_rate_match_reason text,
  ADD COLUMN IF NOT EXISTS manual_production_rate_reason text,
  ADD COLUMN IF NOT EXISTS manual_production_rate_source_note text;

COMMENT ON COLUMN project_activity_line_items.production_rate_assignment_status IS
  'unassigned | auto_matched | verified_rate | manual_override | review_required | excluded';

COMMENT ON COLUMN project_activity_line_items.production_rate_match_confidence IS
  'Deterministic matcher confidence captured when a production rate was assigned.';

COMMENT ON COLUMN project_activity_line_items.production_rate_match_reason IS
  'Human-readable reason for the matched or verified production-rate assignment.';

COMMENT ON COLUMN project_activity_line_items.manual_production_rate_reason IS
  'Required user reason when a line item uses a manual MH/unit override.';

COMMENT ON COLUMN project_activity_line_items.manual_production_rate_source_note IS
  'Required user source note when a line item uses a manual MH/unit override.';

NOTIFY pgrst, 'reload schema';
