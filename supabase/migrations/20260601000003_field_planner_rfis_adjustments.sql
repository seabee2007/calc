/*
  Field Planner — RFIs, field adjustments, task links
*/

ALTER TABLE planner_tasks
  ADD COLUMN IF NOT EXISTS linked_calculation_id uuid REFERENCES calculations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_qc_record_id uuid REFERENCES qc_records(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS rfi_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES planner_tasks(id) ON DELETE SET NULL,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  question text NOT NULL,
  suggested_solution text,
  urgency text NOT NULL DEFAULT 'Normal'
    CHECK (urgency IN ('Low', 'Normal', 'High', 'Urgent')),
  status text NOT NULL DEFAULT 'Open'
    CHECK (status IN ('Open', 'Answered', 'Closed')),
  owner_response text,
  responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rfi_requests_project_idx ON rfi_requests(project_id);
CREATE INDEX IF NOT EXISTS rfi_requests_status_idx ON rfi_requests(status);

ALTER TABLE rfi_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members view RFIs"
  ON rfi_requests FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY "Project members create RFIs"
  ON rfi_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_project(project_id)
    AND submitted_by = auth.uid()
  );

CREATE POLICY "Owners manage RFIs"
  ON rfi_requests FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

CREATE TABLE IF NOT EXISTS field_adjustment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES planner_tasks(id) ON DELETE SET NULL,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  reason text,
  labor_impact numeric,
  material_impact numeric,
  schedule_impact text,
  estimated_cost numeric,
  status text NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  owner_response text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS field_adjustment_requests_project_idx ON field_adjustment_requests(project_id);
CREATE INDEX IF NOT EXISTS field_adjustment_requests_status_idx ON field_adjustment_requests(status);

ALTER TABLE field_adjustment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members view adjustments"
  ON field_adjustment_requests FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY "Project members create adjustments"
  ON field_adjustment_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_project(project_id)
    AND submitted_by = auth.uid()
  );

CREATE POLICY "Owners manage adjustments"
  ON field_adjustment_requests FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));
