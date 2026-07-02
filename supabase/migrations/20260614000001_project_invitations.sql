/*
  Project client invitations and memberships.
  Token-based invite flow for client_viewer / client_collaborator roles.
*/

CREATE TABLE IF NOT EXISTS project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email text,
  invitee_name text,
  role text NOT NULL DEFAULT 'client_viewer'
    CHECK (role IN ('owner', 'admin', 'team_member', 'client_viewer', 'client_collaborator')),
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_invitations_project_id_idx ON project_invitations(project_id);
CREATE INDEX IF NOT EXISTS project_invitations_token_idx ON project_invitations(token);
CREATE INDEX IF NOT EXISTS project_invitations_invitee_email_idx ON project_invitations(lower(invitee_email));

CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'client_viewer'
    CHECK (role IN ('owner', 'admin', 'team_member', 'client_viewer', 'client_collaborator')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_project_id_idx ON project_members(project_id);
CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON project_members(user_id);

ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project owners manage invitations" ON public.project_invitations;

CREATE POLICY "Project owners manage invitations"
  ON project_invitations FOR ALL TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Invited users can view matching invitations" ON public.project_invitations;

CREATE POLICY "Invited users can view matching invitations"
  ON project_invitations FOR SELECT TO authenticated
  USING (
    invitee_email IS NOT NULL
    AND lower(trim(invitee_email)) = lower(trim((SELECT email FROM auth.users WHERE id = auth.uid())))
  );

DROP POLICY IF EXISTS "Project owners manage members" ON public.project_members;

CREATE POLICY "Project owners manage members"
  ON project_members FOR ALL TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Users can view own membership" ON public.project_members;

CREATE POLICY "Users can view own membership"
  ON project_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Client members can view projects" ON public.projects;

CREATE POLICY "Client members can view projects"
  ON projects FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.is_project_client_member(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_project_owner(p_project_id)
    OR public.is_project_employee(p_project_id)
    OR public.is_project_client_member(p_project_id);
$$;

GRANT EXECUTE ON FUNCTION public.is_project_client_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_project_invitation(
  p_project_id uuid,
  p_invitee_email text,
  p_invitee_name text,
  p_role text DEFAULT 'client_viewer'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_token text;
  v_role text := coalesce(nullif(trim(p_role), ''), 'client_viewer');
  v_invite project_invitations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_project_owner(p_project_id) THEN
    RAISE EXCEPTION 'Only the project owner can create invitations';
  END IF;

  IF v_role NOT IN ('client_viewer', 'client_collaborator') THEN
    RAISE EXCEPTION 'Invalid client invite role';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO project_invitations (
    project_id,
    invited_by,
    invitee_email,
    invitee_name,
    role,
    token
  )
  VALUES (
    p_project_id,
    v_user_id,
    nullif(lower(trim(coalesce(p_invitee_email, ''))), ''),
    nullif(trim(coalesce(p_invitee_name, '')), ''),
    v_role,
    v_token
  )
  RETURNING * INTO v_invite;

  RETURN jsonb_build_object(
    'token', v_invite.token,
    'project_id', v_invite.project_id,
    'role', v_invite.role,
    'expires_at', v_invite.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_project_invitation_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite project_invitations%ROWTYPE;
  v_project_name text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT pi.* INTO v_invite
  FROM project_invitations pi
  WHERE pi.token = trim(p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_invite.status = 'revoked' OR v_invite.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  IF v_invite.status = 'accepted' OR v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'accepted');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT p.name INTO v_project_name
  FROM projects p
  WHERE p.id = v_invite.project_id;

  RETURN jsonb_build_object(
    'status', 'pending',
    'project_id', v_invite.project_id,
    'project_name', coalesce(v_project_name, 'Project'),
    'role', v_invite.role,
    'invitee_email', v_invite.invitee_email,
    'invitee_name', v_invite.invitee_name,
    'expires_at', v_invite.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_project_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_invite project_invitations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User email not found';
  END IF;

  SELECT * INTO v_invite
  FROM project_invitations
  WHERE token = trim(p_token)
    AND status = 'pending'
    AND accepted_at IS NULL
    AND revoked_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or no longer active';
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE project_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = v_invite.id;
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  IF v_invite.invitee_email IS NOT NULL
    AND lower(trim(v_invite.invitee_email)) <> lower(trim(v_email)) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  INSERT INTO project_members (project_id, user_id, role, invited_by)
  VALUES (v_invite.project_id, v_user_id, v_invite.role, v_invite.invited_by)
  ON CONFLICT (project_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    invited_by = EXCLUDED.invited_by;

  UPDATE project_invitations
  SET
    status = 'accepted',
    accepted_by = v_user_id,
    accepted_at = now(),
    updated_at = now()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'project_id', v_invite.project_id,
    'role', v_invite.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project_invitation(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_invitation_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_project_invitation(text) TO authenticated;

COMMENT ON TABLE project_invitations IS 'Pending client invitations to projects via secure token links.';
COMMENT ON TABLE project_members IS 'Authenticated users with access to a project as client viewers/collaborators.';
COMMENT ON FUNCTION public.create_project_invitation(uuid, text, text, text) IS
  'Creates a pending client invitation for a project owned by auth.uid().';
COMMENT ON FUNCTION public.get_project_invitation_by_token(text) IS
  'Public-safe invite preview by secret token.';
COMMENT ON FUNCTION public.accept_project_invitation(text) IS
  'Accepts a pending project invitation for auth.uid().';
