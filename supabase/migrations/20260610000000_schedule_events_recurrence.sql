/*
  Recurring schedule events — series master, instance exceptions, recurrence rules (JSON).
*/

ALTER TABLE schedule_events
  ADD COLUMN IF NOT EXISTS recurrence_rule jsonb,
  ADD COLUMN IF NOT EXISTS recurrence_series_id uuid REFERENCES schedule_events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recurrence_instance_date date,
  ADD COLUMN IF NOT EXISTS recurrence_exception_type text;

ALTER TABLE schedule_events DROP CONSTRAINT IF EXISTS schedule_events_recurrence_exception_type_check;
ALTER TABLE schedule_events ADD CONSTRAINT schedule_events_recurrence_exception_type_check
  CHECK (
    recurrence_exception_type IS NULL
    OR recurrence_exception_type IN ('deleted', 'modified')
  );

CREATE INDEX IF NOT EXISTS schedule_events_recurrence_series_idx
  ON schedule_events(recurrence_series_id)
  WHERE recurrence_series_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS schedule_events_recurrence_instance_idx
  ON schedule_events(recurrence_series_id, recurrence_instance_date)
  WHERE recurrence_instance_date IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS schedule_events_recurrence_instance_unique
  ON schedule_events(recurrence_series_id, recurrence_instance_date)
  WHERE recurrence_series_id IS NOT NULL AND recurrence_instance_date IS NOT NULL;
