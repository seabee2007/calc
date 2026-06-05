/*
  Estimating Engine - Phase 1C Core Schema
  Safe/idempotent migration.

  Creates:
  - estimates
  - estimate_versions
  - estimate_line_items

  Notes:
  - Additive only.
  - Does not alter existing app tables.
  - Uses idempotent policy creation because CREATE POLICY has no IF NOT EXISTS.
  - estimate_versions and estimate_line_items are append-only through RLS:
    SELECT + INSERT only, no UPDATE/DELETE policies.
*/

-- ---------------------------------------------------------------------------
-- Table 1: estimates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Project Estimate',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'sent', 'accepted', 'rejected', 'superseded')),
  current_version_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estimates_project_updated_idx
  ON estimates(project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS estimates_project_status_idx
  ON estimates(project_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS estimates_id_project_uidx
  ON estimates(id, project_id);

-- ---------------------------------------------------------------------------
-- Table 2: estimate_versions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estimate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  version_name text NOT NULL,
  estimate_type text NOT NULL DEFAULT 'detailed'
    CHECK (estimate_type IN ('quick_feasibility', 'budget', 'detailed', 'bid')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'sent', 'accepted', 'rejected', 'superseded')),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS estimate_versions_estimate_version_uidx
  ON estimate_versions(estimate_id, version_number);

CREATE INDEX IF NOT EXISTS estimate_versions_project_created_idx
  ON estimate_versions(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS estimate_versions_estimate_version_idx
  ON estimate_versions(estimate_id, version_number);

CREATE UNIQUE INDEX IF NOT EXISTS estimate_versions_id_project_uidx
  ON estimate_versions(id, project_id);

-- Same-project protection:
-- Prevent an estimate_version from pointing to an estimate in a different project.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'estimate_versions_estimate_project_fkey'
      AND conrelid = 'estimate_versions'::regclass
  ) THEN
    ALTER TABLE estimate_versions
      ADD CONSTRAINT estimate_versions_estimate_project_fkey
      FOREIGN KEY (estimate_id, project_id)
      REFERENCES estimates(id, project_id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Add estimates.current_version_id FK only after estimate_versions exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'estimates_current_version_id_fkey'
      AND conrelid = 'estimates'::regclass
  ) THEN
    ALTER TABLE estimates
      ADD CONSTRAINT estimates_current_version_id_fkey
      FOREIGN KEY (current_version_id)
      REFERENCES estimate_versions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Table 3: estimate_line_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estimate_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_version_id uuid NOT NULL REFERENCES estimate_versions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_line_item_id uuid REFERENCES estimate_line_items(id) ON DELETE CASCADE,
  line_type text NOT NULL DEFAULT 'task'
    CHECK (
      line_type IN (
        'division',
        'scope',
        'assembly',
        'task',
        'material',
        'equipment',
        'subcontractor',
        'indirect'
      )
    ),
  csi_division text,
  csi_section text,
  scope_name text,
  title text NOT NULL,
  description text,
  trade text,
  activity text,
  quantity numeric NOT NULL DEFAULT 0,
  unit text,
  production_rate numeric NOT NULL DEFAULT 0,
  production_rate_type text
    CHECK (
      production_rate_type IS NULL
      OR production_rate_type IN (
        'units_per_labor_hour',
        'units_per_labor_day',
        'labor_hours_per_unit',
        'units_per_crew_day'
      )
    ),
  crew_size numeric NOT NULL DEFAULT 0,
  hours_per_day numeric NOT NULL DEFAULT 8,
  labor_rate numeric NOT NULL DEFAULT 0,
  burden_percent numeric NOT NULL DEFAULT 0,
  overhead_percent numeric NOT NULL DEFAULT 0,
  profit_percent numeric NOT NULL DEFAULT 0,
  contingency_percent numeric NOT NULL DEFAULT 0,
  tax_percent numeric NOT NULL DEFAULT 0,
  waste_percent numeric NOT NULL DEFAULT 0,
  difficulty_factor numeric NOT NULL DEFAULT 1,
  location_factor numeric NOT NULL DEFAULT 1,
  material_cost numeric NOT NULL DEFAULT 0,
  equipment_cost numeric NOT NULL DEFAULT 0,
  subcontractor_cost numeric NOT NULL DEFAULT 0,
  indirect_cost numeric NOT NULL DEFAULT 0,
  calculated_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule_enabled boolean NOT NULL DEFAULT true,
  weather_sensitive boolean NOT NULL DEFAULT false,
  inspection_required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estimate_line_items_version_position_idx
  ON estimate_line_items(estimate_version_id, position);

CREATE INDEX IF NOT EXISTS estimate_line_items_project_division_idx
  ON estimate_line_items(project_id, csi_division);

CREATE INDEX IF NOT EXISTS estimate_line_items_project_section_idx
  ON estimate_line_items(project_id, csi_section);

CREATE INDEX IF NOT EXISTS estimate_line_items_parent_idx
  ON estimate_line_items(parent_line_item_id);

-- Same-project protection:
-- Prevent a line item from pointing to an estimate_version in a different project.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'estimate_line_items_version_project_fkey'
      AND conrelid = 'estimate_line_items'::regclass
  ) THEN
    ALTER TABLE estimate_line_items
      ADD CONSTRAINT estimate_line_items_version_project_fkey
      FOREIGN KEY (estimate_version_id, project_id)
      REFERENCES estimate_versions(id, project_id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;

-- estimates: project access SELECT, owner INSERT/UPDATE/DELETE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimates'
      AND policyname = 'Project members can view estimates'
  ) THEN
    CREATE POLICY "Project members can view estimates"
      ON estimates
      FOR SELECT
      TO authenticated
      USING (public.can_access_project(project_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimates'
      AND policyname = 'Project owners insert estimates'
  ) THEN
    CREATE POLICY "Project owners insert estimates"
      ON estimates
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_project_owner(project_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimates'
      AND policyname = 'Project owners update estimates'
  ) THEN
    CREATE POLICY "Project owners update estimates"
      ON estimates
      FOR UPDATE
      TO authenticated
      USING (public.is_project_owner(project_id))
      WITH CHECK (public.is_project_owner(project_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimates'
      AND policyname = 'Project owners delete estimates'
  ) THEN
    CREATE POLICY "Project owners delete estimates"
      ON estimates
      FOR DELETE
      TO authenticated
      USING (public.is_project_owner(project_id));
  END IF;
END $$;

-- estimate_versions: append-only, SELECT + INSERT only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimate_versions'
      AND policyname = 'Project members can view estimate versions'
  ) THEN
    CREATE POLICY "Project members can view estimate versions"
      ON estimate_versions
      FOR SELECT
      TO authenticated
      USING (public.can_access_project(project_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimate_versions'
      AND policyname = 'Project owners insert estimate versions'
  ) THEN
    CREATE POLICY "Project owners insert estimate versions"
      ON estimate_versions
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_project_owner(project_id));
  END IF;
END $$;

-- estimate_line_items: append-only, SELECT + INSERT only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimate_line_items'
      AND policyname = 'Project members can view estimate line items'
  ) THEN
    CREATE POLICY "Project members can view estimate line items"
      ON estimate_line_items
      FOR SELECT
      TO authenticated
      USING (public.can_access_project(project_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'estimate_line_items'
      AND policyname = 'Project owners insert estimate line items'
  ) THEN
    CREATE POLICY "Project owners insert estimate line items"
      ON estimate_line_items
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_project_owner(project_id));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_estimates_updated_at'
      AND tgrelid = 'estimates'::regclass
  ) THEN
    CREATE TRIGGER update_estimates_updated_at
      BEFORE UPDATE ON estimates
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;