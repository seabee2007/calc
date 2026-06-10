-- Estimate type workflow: eight canonical types, scheduling flag, mode config.

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS scheduling_enabled boolean,
  ADD COLUMN IF NOT EXISTS estimate_mode_config jsonb,
  ADD COLUMN IF NOT EXISTS pricing_mode text,
  ADD COLUMN IF NOT EXISTS estimate_type_label text;

-- Normalize legacy estimate types before tightening the check constraint.
UPDATE estimates
SET estimate_type = 'quick'
WHERE estimate_type = 'quick_feasibility';

UPDATE estimates
SET estimate_type = 'conceptual'
WHERE estimate_type = 'budget';

ALTER TABLE estimates
  DROP CONSTRAINT IF EXISTS estimates_estimate_type_check;

ALTER TABLE estimates
  ADD CONSTRAINT estimates_estimate_type_check
  CHECK (
    estimate_type IS NULL OR
    estimate_type IN (
      'quick',
      'conceptual',
      'detailed',
      'bid',
      'change_order',
      'unit_price',
      'self_perform_labor',
      'subcontractor_quote',
      -- legacy values kept for safety during rollout
      'quick_feasibility',
      'budget'
    )
  );

-- Default scheduling by canonical estimate type.
UPDATE estimates
SET scheduling_enabled = true
WHERE scheduling_enabled IS NULL
  AND estimate_type IN ('detailed', 'bid', 'self_perform_labor');

UPDATE estimates
SET scheduling_enabled = false
WHERE scheduling_enabled IS NULL;

-- Keep estimate_versions compatible with new canonical types.
ALTER TABLE estimate_versions
  DROP CONSTRAINT IF EXISTS estimate_versions_estimate_type_check;

ALTER TABLE estimate_versions
  ADD CONSTRAINT estimate_versions_estimate_type_check
  CHECK (
    estimate_type IN (
      'quick',
      'conceptual',
      'detailed',
      'bid',
      'change_order',
      'unit_price',
      'self_perform_labor',
      'subcontractor_quote',
      'quick_feasibility',
      'budget'
    )
  );

UPDATE estimate_versions
SET estimate_type = 'quick'
WHERE estimate_type = 'quick_feasibility';

UPDATE estimate_versions
SET estimate_type = 'conceptual'
WHERE estimate_type = 'budget';
