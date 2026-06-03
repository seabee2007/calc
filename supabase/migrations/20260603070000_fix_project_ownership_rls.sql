/*
  # Fix project ownership, RLS, and mix profile values

  1. Auth/user ownership
    - Keep the existing public.users table.
    - Backfill public.users from auth.users.
    - Add an auth.users trigger to keep public.users in sync.
    - Add projects.user_id DEFAULT auth.uid() as a database safety fallback.

  2. Project RLS
    - Replace the broad projects policy with explicit select/insert/update/delete policies.
    - Ensure inserts and updates can only write rows owned by the authenticated user.

  3. Mix profile values
    - Replace the stale mix_profile constraint values with the app's canonical values:
      standard, highEarly, highStrength, rapidSet.
*/

-- Keep public.users synchronized with Supabase Auth users without deleting the custom table.
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_public_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  synced_email text;
BEGIN
  synced_email := COALESCE(NEW.email, NEW.id::text || '@unknown.local');

  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, synced_email, COALESCE(NEW.created_at, now()))
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- A legacy public.users row may already own this email under a different id.
    -- Do not block auth user creation/update; leave reconciliation to a targeted data cleanup.
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_auth_user_to_public_users ON auth.users;

CREATE TRIGGER sync_auth_user_to_public_users
AFTER INSERT OR UPDATE OF email
ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_auth_user_to_public_users();

-- Backfill public.users for existing authenticated users.
INSERT INTO public.users (id, email, created_at)
SELECT
  auth_users.id,
  COALESCE(auth_users.email, auth_users.id::text || '@unknown.local') AS email,
  COALESCE(auth_users.created_at, now()) AS created_at
FROM auth.users AS auth_users
WHERE NOT EXISTS (
  SELECT 1
  FROM public.users AS public_users
  WHERE public_users.id = auth_users.id
    OR public_users.email = COALESCE(auth_users.email, auth_users.id::text || '@unknown.local')
)
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;

-- Use the authenticated user's id as the default project owner for new rows.
ALTER TABLE public.projects
ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Align persisted mix profile values with the app's canonical MixProfileType union.
ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_mix_profile_check;

UPDATE public.projects
SET mix_profile = CASE
  WHEN mix_profile = 'rapid' THEN 'rapidSet'
  WHEN mix_profile = 'slow' THEN 'highStrength'
  WHEN mix_profile IN ('standard', 'highEarly', 'highStrength', 'rapidSet') THEN mix_profile
  ELSE 'standard'
END
WHERE mix_profile IS NULL
  OR mix_profile NOT IN ('standard', 'highEarly', 'highStrength', 'rapidSet');

ALTER TABLE public.projects
ALTER COLUMN mix_profile SET DEFAULT 'standard';

ALTER TABLE public.projects
ADD CONSTRAINT projects_mix_profile_check
CHECK (mix_profile IN ('standard', 'highEarly', 'highStrength', 'rapidSet'));

-- Replace the broad project policy with explicit ownership policies.
DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can read own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

CREATE POLICY "Users can read own projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own projects"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own projects"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own projects"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
