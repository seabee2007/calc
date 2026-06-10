-- Project construction activity instance identity (location, drawing ref, unique codes).

ALTER TABLE project_construction_activities
  ADD COLUMN IF NOT EXISTS base_title text,
  ADD COLUMN IF NOT EXISTS instance_label text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS drawing_reference text,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS activity_sequence smallint,
  ADD COLUMN IF NOT EXISTS instance_sequence smallint;

COMMENT ON COLUMN project_construction_activities.base_title IS
  'Template/base activity title before instance suffix (e.g. Place Continuous Footing).';
COMMENT ON COLUMN project_construction_activities.instance_label IS
  'User label distinguishing repeated instances (e.g. F-1, Area C-2).';
COMMENT ON COLUMN project_construction_activities.activity_sequence IS
  'DD-AA segment of activity_code (work package within division).';
COMMENT ON COLUMN project_construction_activities.instance_sequence IS
  'DD-AA-II instance segment within template group.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_construction_activities_code_unique
  ON project_construction_activities (project_id, COALESCE(estimate_id, '00000000-0000-0000-0000-000000000000'::uuid), activity_code);
