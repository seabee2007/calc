-- ═══════════════════════════════════════════════════════════════════════════
-- Line item production rate FK fix
--
-- Problem:
--   production_rate_id is NOT NULL + FK to production_rates(id).
--   Line items created from approved TypeScript seeds use local rate keys
--   (e.g. "03-11-13.65-0040") that are not seeded in Supabase, causing FK
--   violations on insert.
--
-- Solution:
--   Make production_rate_id nullable (only set when a real DB row exists).
--   Store the local/generated rate key and source snapshot on the line item.
--   Estimate math uses saved snapshot values (quantity, manHoursPerUnit), not FK.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE project_activity_line_items
  ALTER COLUMN production_rate_id DROP NOT NULL;

ALTER TABLE project_activity_line_items
  ADD COLUMN IF NOT EXISTS source_production_rate_key text,
  ADD COLUMN IF NOT EXISTS source_production_rate_label text,
  ADD COLUMN IF NOT EXISTS source_figure text,
  ADD COLUMN IF NOT EXISTS source_page text,
  ADD COLUMN IF NOT EXISTS source_pdf_page integer,
  ADD COLUMN IF NOT EXISTS source_document_code text;

COMMENT ON COLUMN project_activity_line_items.production_rate_id IS
  'FK to production_rates(id). NULL when the line item uses a local/generated rate not seeded in DB.';

COMMENT ON COLUMN project_activity_line_items.source_production_rate_key IS
  'Local/generated production rate key (e.g. "03-11-13.65-0040"). Snapshot identity for estimate traceability.';
