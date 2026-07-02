-- Multi-assignee support for planner tasks (junction table + RLS + backfill)

CREATE TABLE IF NOT EXISTS public.planner_task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.planner_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS planner_task_assignees_task_idx
  ON public.planner_task_assignees(task_id);

CREATE INDEX IF NOT EXISTS planner_task_assignees_user_idx
  ON public.planner_task_assignees(user_id);

INSERT INTO public.planner_task_assignees (task_id, user_id)
SELECT id, assigned_to
FROM public.planner_tasks
WHERE assigned_to IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

ALTER TABLE public.planner_task_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members view task assignees" ON public.planner_task_assignees;

CREATE POLICY "Project members view task assignees"
  ON public.planner_task_assignees FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.planner_tasks t
      WHERE t.id = task_id AND public.can_access_project(t.project_id)
    )
  );

DROP POLICY IF EXISTS "Owners manage task assignees" ON public.planner_task_assignees;

CREATE POLICY "Owners manage task assignees"
  ON public.planner_task_assignees FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.planner_tasks t
      WHERE t.id = task_id AND public.is_project_owner(t.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planner_tasks t
      WHERE t.id = task_id AND public.is_project_owner(t.project_id)
    )
  );

DROP POLICY IF EXISTS "Assigned employees update their tasks" ON public.planner_tasks;

CREATE POLICY "Assigned employees update their tasks"
  ON public.planner_tasks FOR UPDATE TO authenticated
  USING (
    public.is_project_employee(project_id)
    AND (
      assigned_to = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.planner_task_assignees a
        WHERE a.task_id = id AND a.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_project_employee(project_id)
    AND (
      assigned_to = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.planner_task_assignees a
        WHERE a.task_id = id AND a.user_id = auth.uid()
      )
    )
  );
