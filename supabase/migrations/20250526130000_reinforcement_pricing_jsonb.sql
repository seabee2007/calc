-- reinforcement_sets.pricing (jsonb) stores full rebar estimate snapshots.
-- Apply after 20250526120000 if pricing column already exists.

ALTER TABLE reinforcement_sets
  ADD COLUMN IF NOT EXISTS pricing jsonb;

COMMENT ON COLUMN reinforcement_sets.pricing IS
  'Rebar/material pricing snapshot: estimatedCost, catalog (rebarPricing2026), barSize, sticksRequired, costPerStick, subtotalBeforeRegional, regionalKey, regionalMultiplier, regionalLabel, lineItems[], notes';
