-- Denormalized KPI fields for proposals (pricing params stay in data jsonb)
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS gross_profit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_margin_percent numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN proposals.gross_profit IS 'Proposal price minus cost with overhead (standard model)';
COMMENT ON COLUMN proposals.gross_margin_percent IS 'gross_profit / total_amount × 100';
