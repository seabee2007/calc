/*
  Production rate source registry + library metadata extensions.
  Safe/idempotent additive migration.
*/

CREATE TABLE IF NOT EXISTS production_rate_sources (
  code              text PRIMARY KEY,
  title             text NOT NULL,
  full_citation     text NOT NULL,
  edition           text NOT NULL,
  chapter           text,
  notes             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO production_rate_sources (code, title, full_citation, edition, chapter, notes)
VALUES (
  'MCRP 3-40D.12',
  'Construction Estimating',
  'NTRP 4-04.2.3 / TM 3-34.41 / MCRP 3-40D.12',
  'October 2021, Change 1 October 2022',
  'Chapter 5',
  'Labor production figures are direct labor only. Rates are reference estimating data.'
)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  full_citation = EXCLUDED.full_citation,
  edition = EXCLUDED.edition,
  chapter = EXCLUDED.chapter,
  notes = EXCLUDED.notes,
  updated_at = now();

ALTER TABLE production_rates
  ADD COLUMN IF NOT EXISTS source_document_code text REFERENCES production_rate_sources(code),
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS activity_name text,
  ADD COLUMN IF NOT EXISTS figure_title text,
  ADD COLUMN IF NOT EXISTS fabricate_hours numeric,
  ADD COLUMN IF NOT EXISTS erect_strip_hours numeric,
  ADD COLUMN IF NOT EXISTS clean_move_hours numeric,
  ADD COLUMN IF NOT EXISTS figure_crew_notes jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS figure_notes jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS row_notes text,
  ADD COLUMN IF NOT EXISTS qa_status text NOT NULL DEFAULT 'approved'
    CHECK (qa_status IN ('raw','needs_review','reviewed','approved','rejected'));

CREATE INDEX IF NOT EXISTS production_rates_category_idx ON production_rates(category);
CREATE INDEX IF NOT EXISTS production_rates_activity_name_idx ON production_rates(activity_name);
CREATE INDEX IF NOT EXISTS production_rates_qa_status_idx ON production_rates(qa_status);

UPDATE production_rates
SET source_document_code = 'MCRP 3-40D.12',
    qa_status = 'approved'
WHERE source_document_code IS NULL;
