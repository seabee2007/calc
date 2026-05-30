/*
  Field Planner — attachments, field messages, storage bucket
*/

CREATE TABLE IF NOT EXISTS task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES planner_tasks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  attachment_type text DEFAULT 'photo',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_attachments_task_idx ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS task_attachments_project_idx ON task_attachments(project_id);

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members view attachments"
  ON task_attachments FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY "Project members upload attachments"
  ON task_attachments FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_project(project_id)
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Uploaders delete own attachments"
  ON task_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

CREATE TABLE IF NOT EXISTS field_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES planner_tasks(id) ON DELETE SET NULL,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  urgency text NOT NULL DEFAULT 'Normal'
    CHECK (urgency IN ('Low', 'Normal', 'High', 'Urgent')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS field_messages_project_idx ON field_messages(project_id);
CREATE INDEX IF NOT EXISTS field_messages_recipient_idx ON field_messages(recipient_id, is_read);

ALTER TABLE field_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members view messages"
  ON field_messages FOR SELECT TO authenticated
  USING (
    public.can_access_project(project_id)
    AND (recipient_id IS NULL OR recipient_id = auth.uid() OR sender_id = auth.uid())
  );

CREATE POLICY "Project members send messages"
  ON field_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_project(project_id)
    AND sender_id = auth.uid()
  );

CREATE POLICY "Recipients mark messages read"
  ON field_messages FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() OR public.is_project_owner(project_id))
  WITH CHECK (recipient_id = auth.uid() OR public.is_project_owner(project_id));

-- Storage bucket for field attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('field-attachments', 'field-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Field attachments public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'field-attachments');

CREATE POLICY "Authenticated users upload field attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'field-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own field attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'field-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
