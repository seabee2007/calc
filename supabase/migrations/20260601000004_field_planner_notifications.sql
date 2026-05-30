/*
  Field Planner — in-app notifications (Phase 4)
*/

CREATE TABLE IF NOT EXISTS field_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES planner_tasks(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  href text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS field_notifications_user_unread_idx
  ON field_notifications(user_id, is_read, created_at DESC);

ALTER TABLE field_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notifications"
  ON field_notifications FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
