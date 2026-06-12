-- Remember last proposal email recipient for follow-up defaults.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS last_sent_to text;

COMMENT ON COLUMN public.proposals.last_sent_to IS 'Last successful proposal email To address (intended recipient, not test-mode redirect).';
