/*
  Restore employee profile role/employer from pending or accepted invites.
  Used when field employees sign in without the invite token in the URL (e.g. OAuth).
*/

CREATE OR REPLACE FUNCTION sync_employee_profile_from_invites()
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
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_email');
  END IF;

  SELECT * INTO v_invite
  FROM employee_invites
  WHERE lower(trim(email)) = lower(trim(v_email))
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_invite
    FROM employee_invites
    WHERE lower(trim(email)) = lower(trim(v_email))
      AND accepted_at IS NOT NULL
    ORDER BY accepted_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_invite');
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

  IF v_invite.accepted_at IS NULL THEN
    UPDATE employee_invites
    SET accepted_at = now()
    WHERE id = v_invite.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'role', v_invite.role,
    'employer_id', v_invite.employer_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sync_employee_profile_from_invites() TO authenticated;

COMMENT ON FUNCTION sync_employee_profile_from_invites() IS
  'Links or repairs employee profile from pending or previously accepted invite for the signed-in email.';
