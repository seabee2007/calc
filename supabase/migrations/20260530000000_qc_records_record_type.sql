/*
  # QC Records — record type and JSON payload

  Adds record_type and record_data for fresh concrete vs break test records.
  Legacy columns (temperature, humidity, slump, air_content, cylinders_made) are retained.
*/

ALTER TABLE qc_records ADD COLUMN IF NOT EXISTS record_type text DEFAULT 'fresh_test';
ALTER TABLE qc_records ADD COLUMN IF NOT EXISTS record_data jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS qc_records_record_type_idx ON qc_records(record_type);
