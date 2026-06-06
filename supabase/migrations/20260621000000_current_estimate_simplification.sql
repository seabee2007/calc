-- Simplified active estimator workflow: one current estimate row per project.
-- Version tables are intentionally left in place for compatibility/history.

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS estimate_type text,
  ADD COLUMN IF NOT EXISTS selected_divisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS assumptions jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'estimates_estimate_type_check'
      AND conrelid = 'estimates'::regclass
  ) THEN
    ALTER TABLE estimates
      ADD CONSTRAINT estimates_estimate_type_check
      CHECK (
        estimate_type IS NULL OR
        estimate_type IN ('quick_feasibility', 'budget', 'detailed', 'bid')
      );
  END IF;
END $$;

-- Keep one active estimate per project going forward. If legacy duplicates
-- already exist, mark older rows superseded so the unique index can be created.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY project_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM estimates
  WHERE status <> 'superseded'
)
UPDATE estimates e
SET status = 'superseded'
FROM ranked r
WHERE e.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS estimates_project_id_current_unique_idx
  ON estimates(project_id)
  WHERE status <> 'superseded';
