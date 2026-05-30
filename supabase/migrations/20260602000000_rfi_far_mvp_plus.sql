/*
  RFI & Field Adjustment MVP+ — expanded schema, attachments, employee edit policies
*/

-- RFI columns
ALTER TABLE rfi_requests
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS drawing_reference text,
  ADD COLUMN IF NOT EXISTS spec_reference text,
  ADD COLUMN IF NOT EXISTS impact_schedule boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS impact_cost boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS impact_quality boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS impact_safety boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_number text;

-- Expand RFI status constraint
ALTER TABLE rfi_requests DROP CONSTRAINT IF EXISTS rfi_requests_status_check;
ALTER TABLE rfi_requests ADD CONSTRAINT rfi_requests_status_check
  CHECK (status IN (
    'Open',
    'Pending Response',
    'Answered',
    'Closed',
    'Rejected',
    'Need More Information'
  ));

-- Per-project RFI display number
CREATE OR REPLACE FUNCTION public.set_rfi_display_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  seq int;
BEGIN
  IF NEW.display_number IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) + 1 INTO seq
  FROM rfi_requests
  WHERE project_id = NEW.project_id;
  NEW.display_number := 'RFI-' || lpad(seq::text, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rfi_display_number_trigger ON rfi_requests;
CREATE TRIGGER rfi_display_number_trigger
  BEFORE INSERT ON rfi_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_rfi_display_number();

-- Backfill display numbers for existing rows
DO $$
DECLARE
  r record;
  seq int;
BEGIN
  FOR r IN
    SELECT id, project_id FROM rfi_requests WHERE display_number IS NULL ORDER BY created_at
  LOOP
    SELECT COUNT(*) INTO seq FROM rfi_requests
    WHERE project_id = r.project_id AND display_number IS NOT NULL;
    seq := seq + 1;
    UPDATE rfi_requests SET display_number = 'RFI-' || lpad(seq::text, 3, '0') WHERE id = r.id;
  END LOOP;
END;
$$;

-- Field adjustment columns
ALTER TABLE field_adjustment_requests
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS condition_description text,
  ADD COLUMN IF NOT EXISTS proposed_adjustment text,
  ADD COLUMN IF NOT EXISTS equipment_cost numeric,
  ADD COLUMN IF NOT EXISTS display_number text,
  ADD COLUMN IF NOT EXISTS converted_to_change_order boolean NOT NULL DEFAULT false;

UPDATE field_adjustment_requests
SET
  condition_description = COALESCE(condition_description, description),
  proposed_adjustment = COALESCE(proposed_adjustment, '')
WHERE condition_description IS NULL OR proposed_adjustment IS NULL;

ALTER TABLE field_adjustment_requests DROP CONSTRAINT IF EXISTS field_adjustment_requests_status_check;
ALTER TABLE field_adjustment_requests ADD CONSTRAINT field_adjustment_requests_status_check
  CHECK (status IN (
    'Pending',
    'Needs More Information',
    'Approved',
    'Rejected',
    'Requires Change Order'
  ));

-- Normalize legacy free-text reason values before enum CHECK
UPDATE field_adjustment_requests
SET reason = 'Existing Conditions'
WHERE reason IS NOT NULL AND lower(trim(reason)) IN ('existing condition', 'existing conditions');

UPDATE field_adjustment_requests
SET reason = 'Utility Conflict'
WHERE reason IS NOT NULL AND lower(trim(reason)) IN ('utility', 'utility conflict');

UPDATE field_adjustment_requests
SET reason = 'Safety Concern'
WHERE reason IS NOT NULL AND lower(trim(reason)) IN ('safety', 'safety concern');

UPDATE field_adjustment_requests
SET reason = 'Constructability Issue'
WHERE reason IS NOT NULL AND lower(trim(reason)) IN ('constructability', 'constructability issue');

UPDATE field_adjustment_requests
SET reason = 'Owner Request'
WHERE reason IS NOT NULL AND lower(trim(reason)) IN ('owner request', 'owner requests');

UPDATE field_adjustment_requests
SET reason = 'Other'
WHERE reason IS NOT NULL
  AND reason NOT IN (
    'Existing Conditions',
    'Utility Conflict',
    'Safety Concern',
    'Constructability Issue',
    'Material Availability',
    'Owner Request',
    'Other'
  );

ALTER TABLE field_adjustment_requests DROP CONSTRAINT IF EXISTS field_adjustment_requests_reason_check;
ALTER TABLE field_adjustment_requests ADD CONSTRAINT field_adjustment_requests_reason_check
  CHECK (
    reason IS NULL OR reason IN (
      'Existing Conditions',
      'Utility Conflict',
      'Safety Concern',
      'Constructability Issue',
      'Material Availability',
      'Owner Request',
      'Other'
    )
  );

-- Normalize legacy schedule_impact values before enum CHECK
UPDATE field_adjustment_requests
SET schedule_impact = 'None'
WHERE schedule_impact IS NOT NULL
  AND schedule_impact NOT IN (
    'None',
    'Less Than 1 Day',
    '1-3 Days',
    'More Than 3 Days'
  );

ALTER TABLE field_adjustment_requests DROP CONSTRAINT IF EXISTS field_adjustment_requests_schedule_impact_check;
ALTER TABLE field_adjustment_requests ADD CONSTRAINT field_adjustment_requests_schedule_impact_check
  CHECK (
    schedule_impact IS NULL OR schedule_impact IN (
      'None',
      'Less Than 1 Day',
      '1-3 Days',
      'More Than 3 Days'
    )
  );

CREATE OR REPLACE FUNCTION public.set_far_display_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  seq int;
BEGIN
  IF NEW.display_number IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) + 1 INTO seq
  FROM field_adjustment_requests
  WHERE project_id = NEW.project_id;
  NEW.display_number := 'FAR-' || lpad(seq::text, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS far_display_number_trigger ON field_adjustment_requests;
CREATE TRIGGER far_display_number_trigger
  BEFORE INSERT ON field_adjustment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_far_display_number();

DO $$
DECLARE
  r record;
  seq int;
BEGIN
  FOR r IN
    SELECT id, project_id FROM field_adjustment_requests WHERE display_number IS NULL ORDER BY created_at
  LOOP
    SELECT COUNT(*) INTO seq FROM field_adjustment_requests
    WHERE project_id = r.project_id AND display_number IS NOT NULL;
    seq := seq + 1;
    UPDATE field_adjustment_requests SET display_number = 'FAR-' || lpad(seq::text, 3, '0') WHERE id = r.id;
  END LOOP;
END;
$$;

-- Field record attachments (RFI or FAR)
CREATE TABLE IF NOT EXISTS field_record_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES planner_tasks(id) ON DELETE SET NULL,
  rfi_id uuid REFERENCES rfi_requests(id) ON DELETE CASCADE,
  adjustment_id uuid REFERENCES field_adjustment_requests(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  attachment_type text DEFAULT 'photo',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_record_attachments_one_parent CHECK (
    (rfi_id IS NOT NULL AND adjustment_id IS NULL)
    OR (rfi_id IS NULL AND adjustment_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS field_record_attachments_rfi_idx ON field_record_attachments(rfi_id);
CREATE INDEX IF NOT EXISTS field_record_attachments_adjustment_idx ON field_record_attachments(adjustment_id);
CREATE INDEX IF NOT EXISTS field_record_attachments_project_idx ON field_record_attachments(project_id);

ALTER TABLE field_record_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members view field record attachments"
  ON field_record_attachments FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY "Project members upload field record attachments"
  ON field_record_attachments FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_project(project_id)
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Uploaders delete own field record attachments"
  ON field_record_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "Owners delete field record attachments"
  ON field_record_attachments FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- Employee update own RFI before owner response
CREATE POLICY "Submitters update own open RFIs"
  ON rfi_requests FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid()
    AND responded_at IS NULL
    AND status IN ('Open', 'Pending Response', 'Need More Information')
  )
  WITH CHECK (
    submitted_by = auth.uid()
    AND responded_at IS NULL
  );

-- Employee update own FAR before owner review
CREATE POLICY "Submitters update own pending FARs"
  ON field_adjustment_requests FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid()
    AND approved_at IS NULL
    AND status IN ('Pending', 'Needs More Information')
  )
  WITH CHECK (
    submitted_by = auth.uid()
    AND approved_at IS NULL
  );
