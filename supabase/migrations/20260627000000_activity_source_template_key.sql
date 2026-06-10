-- ═══════════════════════════════════════════════════════════════════════════
-- Add source_template_key to project_construction_activities
--
-- Problem:
--   activity_template_id is a FK to construction_activity_templates(id).
--   Activities created from the local TypeScript registry have string keys
--   like "slab-on-grade" that do not exist in that DB table, causing FK
--   violations on insert.
--
-- Solution:
--   Introduce source_template_key (text, no FK) to store the local registry
--   key.  activity_template_id remains nullable and is only populated when
--   the activity was created from a real DB template row (future seeded data).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE project_construction_activities
  ADD COLUMN IF NOT EXISTS source_template_key text;

COMMENT ON COLUMN project_construction_activities.source_template_key IS
  'Local TypeScript registry key (e.g. "slab-on-grade"). '
  'Null when the activity was created from a real DB template row. '
  'Distinct from activity_template_id which is a FK to construction_activity_templates.';
