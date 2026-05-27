/*
  Proposal tracking + financial dashboard fields
*/

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS material_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS public_token uuid DEFAULT gen_random_uuid();

ALTER TABLE proposals
  DROP CONSTRAINT IF EXISTS proposals_status_check;

ALTER TABLE proposals
  ADD CONSTRAINT proposals_status_check CHECK (
    status IN (
      'draft',
      'sent',
      'viewed',
      'opened',
      'accepted',
      'declined',
      'deposit_paid',
      'scheduled'
    )
  );

CREATE INDEX IF NOT EXISTS proposals_status_idx ON proposals(status);
CREATE INDEX IF NOT EXISTS proposals_public_token_idx ON proposals(public_token);
CREATE INDEX IF NOT EXISTS proposals_created_at_idx ON proposals(created_at);

-- Ensure existing rows have tokens
UPDATE proposals SET public_token = gen_random_uuid() WHERE public_token IS NULL;

-- Public client access via token (SECURITY DEFINER — no broad anon table access)
CREATE OR REPLACE FUNCTION public.get_proposal_by_public_token(p_token uuid)
RETURNS proposals
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT *
  FROM proposals
  WHERE public_token = p_token
    AND status <> 'draft'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.record_proposal_client_action(
  p_token uuid,
  p_action text
)
RETURNS proposals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row proposals;
  now_ts timestamptz := now();
BEGIN
  SELECT * INTO row FROM proposals WHERE public_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposal_not_found';
  END IF;

  IF row.status = 'draft' THEN
    RAISE EXCEPTION 'proposal_not_available';
  END IF;

  IF p_action = 'viewed' AND row.viewed_at IS NULL THEN
    UPDATE proposals
    SET status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
        viewed_at = now_ts
    WHERE id = row.id
    RETURNING * INTO row;
  ELSIF p_action = 'opened' THEN
    UPDATE proposals
    SET status = CASE
          WHEN status IN ('sent', 'viewed') THEN 'opened'
          ELSE status
        END,
        opened_at = COALESCE(opened_at, now_ts),
        viewed_at = COALESCE(viewed_at, now_ts)
    WHERE id = row.id
    RETURNING * INTO row;
  ELSIF p_action = 'accepted' AND row.status NOT IN ('accepted', 'declined') THEN
    UPDATE proposals
    SET status = 'accepted', accepted_at = now_ts
    WHERE id = row.id
    RETURNING * INTO row;
  ELSIF p_action = 'declined' AND row.status NOT IN ('accepted', 'declined') THEN
    UPDATE proposals
    SET status = 'declined', declined_at = now_ts
    WHERE id = row.id
    RETURNING * INTO row;
  END IF;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_proposal_by_public_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_proposal_client_action(uuid, text) TO anon, authenticated;
