/*
  Employee invite acceptance — invitees cannot read employee_invites via RLS today.
  Use SECURITY DEFINER RPCs for token validation and profile linking.
*/

CREATE OR REPLACE FUNCTION get_employee_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite employee_invites%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_invite
  FROM employee_invites
  WHERE token = trim(p_token)
    AND accepted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('expired', true, 'email', v_invite.email);
  END IF;

  RETURN jsonb_build_object(
    'email', v_invite.email,
    'role', v_invite.role,
    'expired', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION accept_employee_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_invite employee_invites%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User email not found';
  END IF;

  SELECT * INTO v_invite
  FROM employee_invites
  WHERE token = trim(p_token)
    AND accepted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or already accepted';
  END IF;

  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  IF lower(trim(v_invite.email)) <> lower(trim(v_email)) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  INSERT INTO profiles (id, role, employer_id, display_name)
  VALUES (
    v_user_id,
    v_invite.role,
    v_invite.employer_id,
    split_part(v_email, '@', 1)
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    employer_id = EXCLUDED.employer_id,
    updated_at = now();

  UPDATE employee_invites
  SET accepted_at = now()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'role', v_invite.role,
    'employer_id', v_invite.employer_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_employee_invite_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION accept_employee_invite(text) TO authenticated;

COMMENT ON FUNCTION get_employee_invite_by_token(text) IS
  'Public invite preview by secret token (signup prefill).';
COMMENT ON FUNCTION accept_employee_invite(text) IS
  'Links authenticated user to employer from pending invite token.';
