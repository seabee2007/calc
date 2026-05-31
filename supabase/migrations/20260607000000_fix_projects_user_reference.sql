/*
  Fix projects.user_id foreign key (legacy public.users → auth.users)
  and ensure INSERT/UPDATE RLS checks match SELECT.
*/

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;

ALTER TABLE projects
  ADD CONSTRAINT projects_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users can manage own projects" ON projects;

CREATE POLICY "Users can manage own projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
