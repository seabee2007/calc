-- Standard pricing waterfall fields for change orders
ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS subcontractor_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS waste_factor_percent numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS waste_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS material_cost_base numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS material_cost_adjusted numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contingency_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contingency_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_system text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS tax_rate_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_application text NOT NULL DEFAULT 'materials_only',
  ADD COLUMN IF NOT EXISTS tax_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_margin_percent numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS gross_profit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_margin_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS markup_percent_reporting numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_with_overhead numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_estimated_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'standard'
    CHECK (pricing_model IN ('legacy', 'standard'));

COMMENT ON COLUMN change_orders.subcontractor_items IS 'Line items for subcontractor direct cost';
COMMENT ON COLUMN change_orders.pricing_model IS 'legacy = OH/profit on direct; standard = waste/contingency/tax/margin waterfall';
