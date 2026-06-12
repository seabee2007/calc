-- Track client email touchpoints on proposals (follow-up, deposit request, check-in).
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS last_followed_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_deposit_request_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;
