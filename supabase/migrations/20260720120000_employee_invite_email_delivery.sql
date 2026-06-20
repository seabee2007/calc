/*
  Track employee invite email delivery and allow revoked invites without blocking
  future invitations for the same employee.
*/

ALTER TABLE public.employee_invites
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sent', 'failed')),
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_last_error text,
  ADD COLUMN IF NOT EXISTS email_send_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.employee_invites
SET status = CASE
  WHEN accepted_at IS NOT NULL THEN 'accepted'
  WHEN revoked_at IS NOT NULL THEN 'revoked'
  WHEN expires_at < now() THEN 'expired'
  ELSE 'pending'
END
WHERE status IS NULL
   OR (accepted_at IS NOT NULL AND status <> 'accepted')
   OR (revoked_at IS NOT NULL AND status <> 'revoked')
   OR (accepted_at IS NULL AND revoked_at IS NULL AND expires_at < now() AND status = 'pending');

DROP INDEX IF EXISTS employee_invites_pending_email_idx;

CREATE UNIQUE INDEX IF NOT EXISTS employee_invites_pending_email_idx
  ON public.employee_invites(employer_id, lower(email))
  WHERE status = 'pending'
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS employee_invites_active_pending_seats_idx
  ON public.employee_invites(employer_id, expires_at)
  WHERE status = 'pending'
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION increment_employee_invite_send_count(p_invite_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE employee_invites
  SET email_send_count = COALESCE(email_send_count, 0) + 1,
      email_last_attempt_at = now()
  WHERE id = p_invite_id;
$$;

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
  LIMIT 1;

  IF NOT FOUND OR v_invite.accepted_at IS NOT NULL OR v_invite.status = 'accepted' THEN
    RETURN NULL;
  END IF;

  IF v_invite.revoked_at IS NOT NULL OR v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('revoked', true, 'email', v_invite.email);
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('expired', true, 'email', v_invite.email);
  END IF;

  RETURN jsonb_build_object(
    'email', v_invite.email,
    'role', v_invite.role,
    'expired', false,
    'revoked', false
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
  LIMIT 1;

  IF NOT FOUND OR v_invite.accepted_at IS NOT NULL OR v_invite.status = 'accepted' THEN
    RAISE EXCEPTION 'Invite not found or already accepted';
  END IF;

  IF v_invite.revoked_at IS NOT NULL OR v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'This invitation has been revoked. Contact the company administrator for a new invitation.';
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
  SET accepted_at = now(),
      status = 'accepted'
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'role', v_invite.role,
    'employer_id', v_invite.employer_id
  );
END;
$$;

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
    AND status = 'pending'
    AND accepted_at IS NULL
    AND revoked_at IS NULL
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
    SET accepted_at = now(),
        status = 'accepted'
    WHERE id = v_invite.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'role', v_invite.role,
    'employer_id', v_invite.employer_id
  );
END;
$$;
