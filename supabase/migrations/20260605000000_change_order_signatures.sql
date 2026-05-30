-- Contractor / client signatures on change orders
ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS contractor_name text,
  ADD COLUMN IF NOT EXISTS contractor_signature text,
  ADD COLUMN IF NOT EXISTS contractor_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_signature text,
  ADD COLUMN IF NOT EXISTS client_signed_at timestamptz;

CREATE OR REPLACE FUNCTION public.record_change_order_client_action(
  p_token uuid,
  p_action text,
  p_client_name text DEFAULT NULL,
  p_client_signature text DEFAULT NULL
)
RETURNS change_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row change_orders;
  now_ts timestamptz := now();
BEGIN
  SELECT * INTO row FROM change_orders WHERE public_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'change_order_not_found';
  END IF;

  IF row.status = 'draft' OR row.status = 'void' THEN
    RAISE EXCEPTION 'change_order_not_available';
  END IF;

  IF p_action = 'viewed' AND row.viewed_at IS NULL THEN
    UPDATE change_orders
    SET status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
        viewed_at = now_ts,
        updated_at = now_ts
    WHERE id = row.id
    RETURNING * INTO row;
  ELSIF p_action = 'opened' THEN
    UPDATE change_orders
    SET status = CASE
          WHEN status IN ('sent', 'viewed') THEN 'viewed'
          ELSE status
        END,
        opened_at = COALESCE(opened_at, now_ts),
        viewed_at = COALESCE(viewed_at, now_ts),
        updated_at = now_ts
    WHERE id = row.id
    RETURNING * INTO row;
  ELSIF p_action = 'accepted' AND row.status NOT IN ('accepted', 'declined') THEN
    IF p_client_name IS NULL OR trim(p_client_name) = ''
       OR p_client_signature IS NULL OR trim(p_client_signature) = '' THEN
      RAISE EXCEPTION 'client_signature_required';
    END IF;
    UPDATE change_orders
    SET status = 'accepted',
        accepted_at = now_ts,
        client_name = trim(p_client_name),
        client_signature = p_client_signature,
        client_signed_at = now_ts,
        updated_at = now_ts
    WHERE id = row.id
    RETURNING * INTO row;
    PERFORM public.apply_accepted_change_order_to_project(row.id);
  ELSIF p_action = 'declined' AND row.status NOT IN ('accepted', 'declined') THEN
    UPDATE change_orders
    SET status = 'declined', declined_at = now_ts, updated_at = now_ts
    WHERE id = row.id
    RETURNING * INTO row;
  END IF;

  RETURN row;
END;
$$;
