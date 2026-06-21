/*
  Prevent removed employees from being re-linked on login via sync/repair/accept flows.
  Also revoke all workspace invites (pending + accepted) when removing an employee.
*/

CREATE OR REPLACE FUNCTION internal_is_employee_removed_from_workspace(
  p_workspace_id uuid,
  p_employee_user_id uuid,
  p_email text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM employee_workspace_removals ewr
    WHERE ewr.workspace_id = p_workspace_id
      AND (
        ewr.employee_user_id = p_employee_user_id
        OR lower(trim(ewr.employee_email)) = lower(trim(p_email))
      )
  );
$$;

CREATE OR REPLACE FUNCTION remove_employee_from_workspace(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_workspace_id uuid;
  v_target profiles%ROWTYPE;
  v_email text;
  v_invite employee_invites%ROWTYPE;
  v_invites_revoked integer := 0;
  v_assignments_removed integer := 0;
  v_team_count integer := 0;
  v_pending_count integer := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_employee_id IS NULL OR p_employee_id = v_caller_id THEN
    RAISE EXCEPTION 'Invalid employee';
  END IF;

  v_workspace_id := internal_resolve_workspace_for_caller();
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Only workspace owners and admins can remove employees';
  END IF;

  SELECT * INTO v_target
  FROM profiles
  WHERE id = p_employee_id
    AND employer_id = v_workspace_id
    AND role IN ('employee', 'foreman', 'project_manager');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found in this workspace';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_employee_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Employee account not found';
  END IF;

  WITH revoked AS (
    UPDATE employee_invites
    SET status = 'revoked',
        revoked_at = now(),
        revoked_by = v_caller_id
    WHERE employer_id = v_workspace_id
      AND lower(trim(email)) = lower(trim(v_email))
      AND revoked_at IS NULL
      AND status <> 'revoked'
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO v_invites_revoked FROM revoked;

  SELECT * INTO v_invite
  FROM employee_invites
  WHERE employer_id = v_workspace_id
    AND lower(trim(email)) = lower(trim(v_email))
    AND accepted_at IS NOT NULL
  ORDER BY accepted_at DESC
  LIMIT 1;

  WITH deleted AS (
    DELETE FROM employee_project_assignments epa
    WHERE epa.employee_id = p_employee_id
      AND epa.project_id IN (
        SELECT p.id FROM projects p WHERE p.user_id = v_workspace_id
      )
    RETURNING epa.id
  )
  SELECT COUNT(*)::integer INTO v_assignments_removed FROM deleted;

  UPDATE profiles
  SET employer_id = NULL,
      updated_at = now()
  WHERE id = p_employee_id;

  INSERT INTO employee_workspace_removals (
    workspace_id,
    employee_user_id,
    employee_email,
    removed_by,
    status,
    reason,
    assignments_removed,
    invite_id
  )
  VALUES (
    v_workspace_id,
    p_employee_id,
    v_email,
    v_caller_id,
    'removed',
    'owner_removed',
    v_assignments_removed,
    v_invite.id
  );

  SELECT COUNT(*)::integer INTO v_team_count
  FROM profiles
  WHERE employer_id = v_workspace_id;

  SELECT COUNT(*)::integer INTO v_pending_count
  FROM employee_invites
  WHERE employer_id = v_workspace_id
    AND status = 'pending'
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now();

  RETURN jsonb_build_object(
    'ok', true,
    'employeeId', p_employee_id,
    'workspaceId', v_workspace_id,
    'assignmentsRemoved', v_assignments_removed,
    'invitesRevoked', v_invites_revoked,
    'teamMemberCount', v_team_count,
    'pendingInviteCount', v_pending_count,
    'seatReleased', true
  );
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
    AND revoked_at IS NULL
    AND status <> 'revoked'
  ORDER BY accepted_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('repaired', false, 'reason', 'no_accepted_invite');
  END IF;

  IF internal_is_employee_removed_from_workspace(v_invite.employer_id, v_user_id, v_email) THEN
    RETURN jsonb_build_object('repaired', false, 'reason', 'membership_removed');
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

  RETURN jsonb_build_object(
    'repaired', true,
    'reason', 'linked_from_accepted_invite',
    'invitationId', v_invite.id,
    'workspaceId', v_invite.employer_id,
    'membershipId', v_user_id
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
      AND revoked_at IS NULL
      AND status <> 'revoked'
    ORDER BY accepted_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_invite');
  END IF;

  IF internal_is_employee_removed_from_workspace(v_invite.employer_id, v_user_id, v_email) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'membership_removed');
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF v_invite.revoked_at IS NOT NULL OR v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'This invitation has been revoked. Contact the company administrator for a new invitation.';
  END IF;

  IF internal_is_employee_removed_from_workspace(v_invite.employer_id, v_user_id, v_email) THEN
    RAISE EXCEPTION 'Your access to this company workspace has been removed. Contact the account owner for a new invitation.';
  END IF;

  IF v_invite.accepted_at IS NOT NULL OR v_invite.status = 'accepted' THEN
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

COMMENT ON FUNCTION internal_is_employee_removed_from_workspace(uuid, uuid, text) IS
  'Returns true when an employee was explicitly removed from a workspace and must not be re-linked automatically.';

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
  v_has_revoked_membership boolean;
  v_employer_exists boolean;
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

  SELECT EXISTS (
    SELECT 1
    FROM employee_invites
    WHERE lower(trim(email)) = lower(trim(v_email))
      AND accepted_at IS NOT NULL
      AND (revoked_at IS NOT NULL OR status = 'revoked')
  ) INTO v_has_revoked_membership;

  IF EXISTS (
    SELECT 1 FROM employee_workspace_removals ewr
    WHERE ewr.employee_user_id = v_user_id
       OR lower(trim(ewr.employee_email)) = lower(trim(v_email))
  ) THEN
    v_has_revoked_membership := true;
  END IF;

  IF p_attempt_repair THEN
    v_repaired := repair_employee_membership_from_invites();
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;

  IF FOUND
    AND v_profile.employer_id IS NOT NULL
    AND internal_is_employee_removed_from_workspace(v_profile.employer_id, v_user_id, v_email)
  THEN
    UPDATE profiles
    SET employer_id = NULL, updated_at = now()
    WHERE id = v_user_id;
    v_profile.employer_id := NULL;
    v_has_revoked_membership := true;
  END IF;

  IF NOT FOUND OR v_profile.employer_id IS NULL OR v_profile.role NOT IN ('employee', 'foreman', 'project_manager') THEN
    IF v_has_revoked_membership THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'membership_removed',
        'workspaceId', NULL,
        'employerPlanId', NULL,
        'employeeMembershipId', v_user_id,
        'seatAssigned', false,
        'repaired', COALESCE((v_repaired->>'repaired')::boolean, false)
      );
    END IF;

    IF EXISTS (
      SELECT 1
      FROM employee_invites
      WHERE lower(trim(email)) = lower(trim(v_email))
        AND accepted_at IS NOT NULL
        AND (revoked_at IS NULL AND status <> 'revoked')
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
    IF v_has_revoked_membership OR internal_is_employee_removed_from_workspace(v_workspace_id, v_user_id, v_email) THEN
      UPDATE profiles SET employer_id = NULL, updated_at = now() WHERE id = v_user_id;
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'membership_removed',
        'workspaceId', v_workspace_id,
        'employerPlanId', NULL,
        'employeeMembershipId', v_user_id,
        'seatAssigned', false,
        'repaired', COALESCE((v_repaired->>'repaired')::boolean, false)
      );
    END IF;

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
