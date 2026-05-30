/*
  Field Planner — profiles, employee invites, RLS helpers
*/

-- Profiles (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'admin', 'project_manager', 'foreman', 'employee', 'client')),
  employer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_employer_id_idx ON profiles(employer_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Employers can read team profiles"
  ON profiles FOR SELECT TO authenticated
  USING (employer_id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Employers can update team profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (employer_id = auth.uid())
  WITH CHECK (employer_id = auth.uid());

-- Pending employee invites
CREATE TABLE IF NOT EXISTS employee_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'employee'
    CHECK (role IN ('admin', 'project_manager', 'foreman', 'employee')),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employee_invites_employer_id_idx ON employee_invites(employer_id);
CREATE INDEX IF NOT EXISTS employee_invites_email_idx ON employee_invites(lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS employee_invites_pending_email_idx
  ON employee_invites(employer_id, lower(email))
  WHERE accepted_at IS NULL;

ALTER TABLE employee_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers manage own invites"
  ON employee_invites FOR ALL TO authenticated
  USING (employer_id = auth.uid())
  WITH CHECK (employer_id = auth.uid());

COMMENT ON TABLE profiles IS 'User roles for field planner — owner vs employee team members';
COMMENT ON TABLE employee_invites IS 'Pending email invites for employee accounts';
