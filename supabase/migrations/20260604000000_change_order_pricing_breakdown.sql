-- Change order indirect cost fields (fees, permits, overhead, profit)
ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS fees_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permits_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overhead_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overhead_percent numeric NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS profit_percent numeric NOT NULL DEFAULT 8;
