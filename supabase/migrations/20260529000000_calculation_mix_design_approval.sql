-- Per-placement mix design approval (one row per concrete calculation / pour)
ALTER TABLE public.calculations
  ADD COLUMN IF NOT EXISTS mix_design_approval jsonb;

COMMENT ON COLUMN public.calculations.mix_design_approval IS
  'Mix Design Advisor completion snapshot for this placement takeoff';
