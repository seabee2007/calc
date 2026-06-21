/*
  Secure employee portal entitlement resolver — uses auth.uid() server-side so
  employees inherit employer subscription/seat without reading owner billing rows via RLS.
*/

CREATE OR REPLACE FUNCTION internal_default_included_field_seats(p_plan_id text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_plan_id
    WHEN 'starter' THEN 1
    WHEN 'professional' THEN 5
    WHEN 'business' THEN 15
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION internal_plan_has_employee_portal(p_plan_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_plan_id IN ('starter', 'professional', 'business');
$$;

CREATE OR REPLACE FUNCTION internal_resolve_effective_plan(p_plan_id text, p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status IN ('active', 'trialing') THEN COALESCE(NULLIF(trim(p_plan_id), ''), 'starter')
    ELSE 'free'
  END;
$$;

CREATE OR REPLACE FUNCTION repair_employee_membership_from_invites()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_profile profiles%ROWTYPE;
  v_invite employee_invites%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('repaired', false, 'reason', 'not_authenticated');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('repaired', false, 'reason', 'no_email');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;

  IF FOUND AND v_profile.employer_id IS NOT NULL AND v_profile.role IN ('employee', 'foreman', 'project_manager') THEN
    RETURN jsonb_build_object('repaired', false, 'reason', 'already_linked');
  END IF;

  SELECT * INTO v_invite
  FROM employee_invites
  WHERE lower(trim(email)) = lower(trim(v_email))
    AND accepted_at IS NOT NULL
    AND (revoked_at IS NULL AND status <> 'revoked')
  ORDER BY accepted_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('repaired', false, 'reason', 'no_accepted_invite');
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
    'repaired', true,
    'reason', 'linked_from_accepted_invite',
    'invitationId', v_invite.id,
    'workspaceId', v_invite.employer_id,
    'membershipId', v_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_employee_portal_access(p_attempt_repair boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_profile profiles%ROWTYPE;
  v_workspace_id uuid;
  v_repaired jsonb := NULL;
  v_subscription subscriptions%ROWTYPE;
  v_plan_id text;
  v_seat_limit integer;
  v_team_index integer;
  v_has_accepted_invite boolean;
  v_employer_exists boolean;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'no_accepted_membership',
      'workspaceId', NULL,
      'employerPlanId', NULL,
      'employeeMembershipId', NULL,
      'seatAssigned', false,
      'repaired', false
    );
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  IF p_attempt_repair THEN
    v_repaired := repair_employee_membership_from_invites();
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;

  IF NOT FOUND OR v_profile.employer_id IS NULL OR v_profile.role NOT IN ('employee', 'foreman', 'project_manager') THEN
    IF EXISTS (
      SELECT 1
      FROM employee_invites
      WHERE lower(trim(email)) = lower(trim(v_email))
        AND accepted_at IS NOT NULL
    ) THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'invite_acceptance_incomplete',
        'workspaceId', NULL,
        'employerPlanId', NULL,
        'employeeMembershipId', NULL,
        'seatAssigned', false,
        'repaired', COALESCE((v_repaired->>'repaired')::boolean, false)
      );
    END IF;

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'no_accepted_membership',
      'workspaceId', NULL,
      'employerPlanId', NULL,
      'employeeMembershipId', NULL,
      'seatAssigned', false,
      'repaired', COALESCE((v_repaired->>'repaired')::boolean, false)
    );
  END IF;

  v_workspace_id := v_profile.employer_id;

  SELECT EXISTS (
    SELECT 1
    FROM employee_invites
    WHERE employer_id = v_workspace_id
      AND lower(trim(email)) = lower(trim(v_email))
      AND accepted_at IS NOT NULL
      AND (revoked_at IS NULL AND status <> 'revoked')
  ) INTO v_has_accepted_invite;

  IF NOT v_has_accepted_invite THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'no_accepted_membership',
      'workspaceId', v_workspace_id,
      'employerPlanId', NULL,
      'employeeMembershipId', v_user_id,
      'seatAssigned', false,
      'repaired', COALESCE((v_repaired->>'repaired')::boolean, false)
    );
  END IF;

  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = v_workspace_id)
  INTO v_employer_exists;

  IF NOT v_employer_exists THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'workspace_not_found',
      'workspaceId', v_workspace_id,
      'employerPlanId', NULL,
      'employeeMembershipId', v_user_id,
      'seatAssigned', false,
      'repaired', COALESCE((v_repaired->>'repaired')::boolean, false)
    );
  END IF;

  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = v_workspace_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'employer_subscription_not_found',
      'workspaceId', v_workspace_id,
      'employerPlanId', NULL,
      'employeeMembershipId', v_user_id,
      'seatAssigned', false,
      'repaired', COALESCE((v_repaired->>'repaired')::boolean, false)
    );
  END IF;

  v_plan_id := internal_resolve_effective_plan(v_subscription.plan_id, v_subscription.status);

  IF NOT internal_plan_has_employee_portal(v_plan_id) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'field_portal_not_in_employer_plan',
      'workspaceId', v_workspace_id,
      'employerPlanId', v_plan_id,
      'employeeMembershipId', v_user_id,
      'seatAssigned', false,
      'repaired', COALESCE((v_repaired->>'repaired')::boolean, false)
    );
  END IF;

  v_seat_limit := COALESCE(
    v_subscription.included_field_seats,
    internal_default_included_field_seats(v_plan_id)
  );

  SELECT team.idx INTO v_team_index
  FROM (
    SELECT
      p.id,
      (ROW_NUMBER() OVER (ORDER BY p.created_at ASC, p.id ASC) - 1)::integer AS idx
    FROM profiles p
    WHERE p.employer_id = v_workspace_id
  ) AS team
  WHERE team.id = v_user_id;

  IF v_team_index IS NULL OR (v_seat_limit >= 0 AND v_team_index >= v_seat_limit) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'seat_limit_reached',
      'workspaceId', v_workspace_id,
      'employerPlanId', v_plan_id,
      'employeeMembershipId', v_user_id,
      'seatAssigned', false,
      'repaired', COALESCE((v_repaired->>'repaired')::boolean, false)
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'allowed',
    'workspaceId', v_workspace_id,
    'employerPlanId', v_plan_id,
    'employeeMembershipId', v_user_id,
    'seatAssigned', true,
    'repaired', COALESCE((v_repaired->>'repaired')::boolean, false)
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
    'outcome', 'accepted',
    'invitationId', v_invite.id,
    'employeeUserId', v_user_id,
    'workspaceId', v_invite.employer_id,
    'membershipId', v_user_id,
    'role', v_invite.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION repair_employee_membership_from_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_portal_access(boolean) TO authenticated;

COMMENT ON FUNCTION get_employee_portal_access(boolean) IS
  'Resolves employee field portal access from accepted membership, employer workspace subscription, and included field seats.';
COMMENT ON FUNCTION repair_employee_membership_from_invites() IS
  'Repairs incomplete employee profile linkage from an already-accepted invite matching auth email.';
