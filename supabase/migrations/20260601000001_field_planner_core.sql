/*
  Field Planner — boards, buckets, tasks, comments, checklist, assignments
*/

CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id AND user_id = auth.uid()
  );
$$;

CREATE TABLE IF NOT EXISTS employee_project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role text DEFAULT 'employee',
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, project_id)
);

CREATE INDEX IF NOT EXISTS employee_project_assignments_employee_idx
  ON employee_project_assignments(employee_id);
CREATE INDEX IF NOT EXISTS employee_project_assignments_project_idx
  ON employee_project_assignments(project_id);

ALTER TABLE employee_project_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage project assignments"
  ON employee_project_assignments FOR ALL TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY "Employees view own assignments"
  ON employee_project_assignments FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_project_employee(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employee_project_assignments
    WHERE project_id = p_project_id AND employee_id = auth.uid()
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
    OR public.is_project_employee(p_project_id);
$$;

CREATE OR REPLACE FUNCTION public.is_employer_of(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND employer_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_employee(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_employer_of(uuid) TO authenticated;

-- Employees can read projects they are assigned to
CREATE POLICY "Employees can view assigned projects"
  ON projects FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT project_id FROM employee_project_assignments
      WHERE employee_id = auth.uid()
    )
  );

-- Planner boards
CREATE TABLE IF NOT EXISTS planner_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Field Planner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planner_boards_project_id_idx ON planner_boards(project_id);
CREATE INDEX IF NOT EXISTS planner_boards_owner_id_idx ON planner_boards(owner_id);

ALTER TABLE planner_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view boards"
  ON planner_boards FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY "Owners manage boards"
  ON planner_boards FOR ALL TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

-- Buckets
CREATE TABLE IF NOT EXISTS planner_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES planner_boards(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planner_buckets_board_position_idx
  ON planner_buckets(board_id, position);

ALTER TABLE planner_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view buckets"
  ON planner_buckets FOR SELECT TO authenticated
  USING (
    board_id IN (
      SELECT id FROM planner_boards b
      WHERE public.can_access_project(b.project_id)
    )
  );

CREATE POLICY "Owners manage buckets"
  ON planner_buckets FOR ALL TO authenticated
  USING (
    board_id IN (
      SELECT id FROM planner_boards b
      WHERE public.is_project_owner(b.project_id)
    )
  )
  WITH CHECK (
    board_id IN (
      SELECT id FROM planner_boards b
      WHERE public.is_project_owner(b.project_id)
    )
  );

-- Tasks
CREATE TABLE IF NOT EXISTS planner_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES planner_boards(id) ON DELETE CASCADE,
  bucket_id uuid NOT NULL REFERENCES planner_buckets(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Not Started'
    CHECK (status IN ('Not Started', 'In Progress', 'Submitted', 'Needs Revision', 'Approved', 'Completed')),
  priority text NOT NULL DEFAULT 'Normal'
    CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
  start_date date,
  due_date date,
  position integer NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planner_tasks_board_idx ON planner_tasks(board_id);
CREATE INDEX IF NOT EXISTS planner_tasks_bucket_position_idx ON planner_tasks(bucket_id, position);
CREATE INDEX IF NOT EXISTS planner_tasks_project_idx ON planner_tasks(project_id);
CREATE INDEX IF NOT EXISTS planner_tasks_assigned_idx ON planner_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS planner_tasks_status_idx ON planner_tasks(status);

ALTER TABLE planner_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view tasks"
  ON planner_tasks FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY "Owners manage tasks"
  ON planner_tasks FOR ALL TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE POLICY "Assigned employees update their tasks"
  ON planner_tasks FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    AND public.is_project_employee(project_id)
  )
  WITH CHECK (
    assigned_to = auth.uid()
    AND public.is_project_employee(project_id)
  );

-- Comments
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES planner_tasks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  is_owner_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_comments_task_idx ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS task_comments_project_idx ON task_comments(project_id);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members view comments"
  ON task_comments FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY "Project members add comments"
  ON task_comments FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_project(project_id)
    AND user_id = auth.uid()
  );

CREATE POLICY "Users delete own comments"
  ON task_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Checklist items
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES planner_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_checklist_items_task_idx ON task_checklist_items(task_id, position);

ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View checklist via task access"
  ON task_checklist_items FOR SELECT TO authenticated
  USING (
    task_id IN (
      SELECT t.id FROM planner_tasks t
      WHERE public.can_access_project(t.project_id)
    )
  );

CREATE POLICY "Manage checklist on accessible tasks"
  ON task_checklist_items FOR ALL TO authenticated
  USING (
    task_id IN (
      SELECT t.id FROM planner_tasks t
      WHERE public.can_access_project(t.project_id)
    )
  )
  WITH CHECK (
    task_id IN (
      SELECT t.id FROM planner_tasks t
      WHERE public.can_access_project(t.project_id)
    )
  );
