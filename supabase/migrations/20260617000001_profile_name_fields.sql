-- Add first_name, last_name, business_address, and legal agreement tracking to profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS agreement_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS agreement_version text;

-- Backfill display_name from first+last where both were set via a prior migration (no-op for existing rows)
-- existing display_name values are preserved; new signups will have first+last set directly.
