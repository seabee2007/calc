/*
  Construction Activity Schema — Milestone 3
  Safe/idempotent migration.

  Creates 7 tables that form the Construction estimate hierarchy:

    1. production_rate_import_batches   — data governance / traceability
    2. production_rates                 — manual labor rates (global, read-only)
    3. construction_activity_templates  — NTRP activity templates (global)
    4. activity_line_item_templates     — child work elements per activity (global)
    5. project_construction_activities  — user's project instances of activities
    6. project_activity_line_items      — child line item instances
    7. pricing_library                  — labor/material/equipment unit costs
                                          (separated from production rates per plan)

  Notes:
  - Additive only — does not alter existing app tables.
  - Tables 1–4 (reference data) are readable by all authenticated users.
    Writes are service-role only (seeded by migration/CLI, not the app client).
  - Tables 5–6 (project data) use the existing can_access_project/is_project_owner helpers.
  - Table 7 (pricing) is readable by authenticated users; owners write their own entries.
  - Uses idempotent DO $$ blocks for policies.
*/

-- =============================================================================
-- Table 1: production_rate_import_batches
-- =============================================================================
CREATE TABLE IF NOT EXISTS production_rate_import_batches (
  id           text PRIMARY KEY,             -- e.g. 'batch-div03-2026-06'
  source_manual   text NOT NULL,             -- 'NTRP 4-04.2.3/TM 3-34.41/MCRP 3-40D.12'
  source_edition  text NOT NULL,             -- 'OCT 2021 Change 1 OCT 2022'
  imported_at     timestamptz NOT NULL DEFAULT now(),
  imported_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  reviewed_by     text,
  notes           text,
  checksum        text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Table 2: production_rates
-- =============================================================================
CREATE TABLE IF NOT EXISTS production_rates (
  id                            text PRIMARY KEY,  -- source-based: '03-15-05.96-0220'
  division_code                 text NOT NULL,
  division_name                 text NOT NULL,
  masterformat_code             text NOT NULL,
  work_element_line_number      text NOT NULL,
  description                   text NOT NULL,
  unit                          text NOT NULL,
  rate_type                     text NOT NULL
    CHECK (rate_type IN ('labor_production','equipment_production','weight_measure','material_quantity')),

  -- Rate values — only the applicable column is populated per rate_type:
  man_hours_per_unit            numeric,   -- required for labor_production
  equipment_hours_per_unit      numeric,   -- required for equipment_production
  quantity_per_unit             numeric,   -- required for weight_measure/material_quantity

  minimum_crew_size             integer,
  crew_composition              jsonb,     -- { builder: 2, laborer: 4, ... }

  source_manual                 text NOT NULL,
  source_edition                text NOT NULL,
  source_division               text,
  source_figure                 text,
  source_page                   text,
  source_pdf_page               integer,
  source_notes                  jsonb NOT NULL DEFAULT '[]',

  direct_labor_only             boolean NOT NULL DEFAULT true,
  military_adjusted             boolean NOT NULL DEFAULT false,
  civilian_conversion_multiplier numeric,

  tags                          jsonb NOT NULL DEFAULT '[]',
  applicable_activity_types     jsonb NOT NULL DEFAULT '[]',

  import_batch_id               text REFERENCES production_rate_import_batches(id),
  reviewed_by                   text,
  reviewed_at                   timestamptz,
  is_active                     boolean NOT NULL DEFAULT true,
  superseded_by_id              text,      -- soft FK; no CASCADE so history is preserved

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS production_rates_division_idx
  ON production_rates(division_code);

CREATE INDEX IF NOT EXISTS production_rates_masterformat_idx
  ON production_rates(masterformat_code);

CREATE INDEX IF NOT EXISTS production_rates_active_idx
  ON production_rates(is_active);

-- =============================================================================
-- Table 3: construction_activity_templates
-- =============================================================================
CREATE TABLE IF NOT EXISTS construction_activity_templates (
  id                          text PRIMARY KEY,
  division_id                 text NOT NULL,
  division_code               text NOT NULL,
  division_name               text NOT NULL,
  code                        text NOT NULL,
  name                        text NOT NULL,
  description                 text,
  schedule_enabled            boolean NOT NULL DEFAULT true,
  default_crew_size           integer NOT NULL DEFAULT 4,
  default_hours_per_day       numeric NOT NULL DEFAULT 8,
  default_production_factor   numeric NOT NULL DEFAULT 1,
  tags                        jsonb NOT NULL DEFAULT '[]',
  is_active                   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (division_code, code)
);

CREATE INDEX IF NOT EXISTS construction_activity_templates_division_idx
  ON construction_activity_templates(division_code);

-- =============================================================================
-- Table 4: activity_line_item_templates
-- =============================================================================
CREATE TABLE IF NOT EXISTS activity_line_item_templates (
  id                                  text PRIMARY KEY,
  construction_activity_template_id   text NOT NULL
    REFERENCES construction_activity_templates(id) ON DELETE CASCADE,
  production_rate_id                  text NOT NULL
    REFERENCES production_rates(id),
  name                                text NOT NULL,
  unit                                text NOT NULL,
  default_man_hours_per_unit          numeric NOT NULL DEFAULT 0,
  sort_order                          integer NOT NULL DEFAULT 0,
  is_required                         boolean NOT NULL DEFAULT true,
  is_active                           boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_line_item_templates_activity_idx
  ON activity_line_item_templates(construction_activity_template_id);

-- =============================================================================
-- Table 5: project_construction_activities
-- =============================================================================
CREATE TABLE IF NOT EXISTS project_construction_activities (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  estimate_id              uuid REFERENCES estimates(id) ON DELETE SET NULL,
  activity_template_id     text REFERENCES construction_activity_templates(id) ON DELETE SET NULL,

  division_code            text NOT NULL,
  division_name            text NOT NULL,
  activity_code            text NOT NULL,
  title                    text NOT NULL,
  description              text,

  schedule_enabled         boolean NOT NULL DEFAULT true,
  crew_size                integer NOT NULL DEFAULT 4,
  hours_per_day            numeric NOT NULL DEFAULT 8,
  production_factor        numeric NOT NULL DEFAULT 1,

  calculated_man_hours     numeric NOT NULL DEFAULT 0,
  calculated_man_days      numeric NOT NULL DEFAULT 0,
  calculated_duration_days integer NOT NULL DEFAULT 0,
  duration_days_override   integer,
  effective_duration_days  integer NOT NULL DEFAULT 0,

  total_labor_cost         numeric NOT NULL DEFAULT 0,
  total_material_cost      numeric NOT NULL DEFAULT 0,
  total_equipment_cost     numeric NOT NULL DEFAULT 0,
  total_subcontract_cost   numeric NOT NULL DEFAULT 0,
  total_cost               numeric NOT NULL DEFAULT 0,

  warnings                 jsonb NOT NULL DEFAULT '[]',
  sort_order               integer NOT NULL DEFAULT 0,

  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_construction_activities_project_idx
  ON project_construction_activities(project_id, sort_order);

CREATE INDEX IF NOT EXISTS project_construction_activities_estimate_idx
  ON project_construction_activities(estimate_id)
  WHERE estimate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_construction_activities_division_idx
  ON project_construction_activities(project_id, division_code);

-- =============================================================================
-- Table 6: project_activity_line_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS project_activity_line_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_activity_id      uuid NOT NULL
    REFERENCES project_construction_activities(id) ON DELETE CASCADE,
  project_id               uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  production_rate_id       text NOT NULL REFERENCES production_rates(id),

  name                     text NOT NULL,
  description              text,
  quantity                 numeric NOT NULL DEFAULT 0,
  unit                     text NOT NULL,
  man_hours_per_unit       numeric NOT NULL DEFAULT 0,
  production_factor        numeric NOT NULL DEFAULT 1,
  calculated_man_hours     numeric NOT NULL DEFAULT 0,

  labor_cost               numeric NOT NULL DEFAULT 0,
  material_cost            numeric NOT NULL DEFAULT 0,
  equipment_cost           numeric NOT NULL DEFAULT 0,
  subcontract_cost         numeric NOT NULL DEFAULT 0,
  total_cost               numeric NOT NULL DEFAULT 0,

  sort_order               integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_activity_line_items_activity_idx
  ON project_activity_line_items(project_activity_id, sort_order);

CREATE INDEX IF NOT EXISTS project_activity_line_items_project_idx
  ON project_activity_line_items(project_id);

-- =============================================================================
-- Table 7: pricing_library
-- =============================================================================
CREATE TABLE IF NOT EXISTS pricing_library (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid,                           -- NULL = NTRP default/global
  item_type            text NOT NULL
    CHECK (item_type IN ('labor','material','equipment','subcontractor')),
  production_rate_id   text REFERENCES production_rates(id) ON DELETE SET NULL,
  description          text NOT NULL,
  unit                 text NOT NULL,
  unit_cost            numeric NOT NULL DEFAULT 0,
  currency             text NOT NULL DEFAULT 'USD',
  region               text,
  source               text,
  effective_date       date,
  expiry_date          date,
  notes                text,
  is_active            boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pricing_library_company_type_idx
  ON pricing_library(company_id, item_type);

CREATE INDEX IF NOT EXISTS pricing_library_production_rate_idx
  ON pricing_library(production_rate_id)
  WHERE production_rate_id IS NOT NULL;

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE production_rate_import_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_rates                ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_activity_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_line_item_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_construction_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity_line_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_library                 ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Reference tables (1–4): authenticated users can read; service role writes
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='production_rate_import_batches' AND policyname='Authenticated users can view import batches') THEN
    CREATE POLICY "Authenticated users can view import batches"
      ON production_rate_import_batches FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='production_rates' AND policyname='Authenticated users can view production rates') THEN
    CREATE POLICY "Authenticated users can view production rates"
      ON production_rates FOR SELECT TO authenticated USING (is_active = true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='construction_activity_templates' AND policyname='Authenticated users can view activity templates') THEN
    CREATE POLICY "Authenticated users can view activity templates"
      ON construction_activity_templates FOR SELECT TO authenticated USING (is_active = true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity_line_item_templates' AND policyname='Authenticated users can view line item templates') THEN
    CREATE POLICY "Authenticated users can view line item templates"
      ON activity_line_item_templates FOR SELECT TO authenticated USING (is_active = true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- project_construction_activities: project access SELECT, owner INSERT/UPDATE/DELETE
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_construction_activities' AND policyname='Project members can view construction activities') THEN
    CREATE POLICY "Project members can view construction activities"
      ON project_construction_activities FOR SELECT TO authenticated
      USING (public.can_access_project(project_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_construction_activities' AND policyname='Project owners insert construction activities') THEN
    CREATE POLICY "Project owners insert construction activities"
      ON project_construction_activities FOR INSERT TO authenticated
      WITH CHECK (public.is_project_owner(project_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_construction_activities' AND policyname='Project owners update construction activities') THEN
    CREATE POLICY "Project owners update construction activities"
      ON project_construction_activities FOR UPDATE TO authenticated
      USING (public.is_project_owner(project_id))
      WITH CHECK (public.is_project_owner(project_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_construction_activities' AND policyname='Project owners delete construction activities') THEN
    CREATE POLICY "Project owners delete construction activities"
      ON project_construction_activities FOR DELETE TO authenticated
      USING (public.is_project_owner(project_id));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- project_activity_line_items: same project-scoped rules
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_activity_line_items' AND policyname='Project members can view activity line items') THEN
    CREATE POLICY "Project members can view activity line items"
      ON project_activity_line_items FOR SELECT TO authenticated
      USING (public.can_access_project(project_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_activity_line_items' AND policyname='Project owners insert activity line items') THEN
    CREATE POLICY "Project owners insert activity line items"
      ON project_activity_line_items FOR INSERT TO authenticated
      WITH CHECK (public.is_project_owner(project_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_activity_line_items' AND policyname='Project owners update activity line items') THEN
    CREATE POLICY "Project owners update activity line items"
      ON project_activity_line_items FOR UPDATE TO authenticated
      USING (public.is_project_owner(project_id))
      WITH CHECK (public.is_project_owner(project_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_activity_line_items' AND policyname='Project owners delete activity line items') THEN
    CREATE POLICY "Project owners delete activity line items"
      ON project_activity_line_items FOR DELETE TO authenticated
      USING (public.is_project_owner(project_id));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- pricing_library: readable by all auth; writable per company ownership
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_library' AND policyname='Authenticated users can view pricing library') THEN
    CREATE POLICY "Authenticated users can view pricing library"
      ON pricing_library FOR SELECT TO authenticated
      USING (is_active = true AND (company_id IS NULL OR company_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_library' AND policyname='Users can insert their own pricing entries') THEN
    CREATE POLICY "Users can insert their own pricing entries"
      ON pricing_library FOR INSERT TO authenticated
      WITH CHECK (company_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_library' AND policyname='Users can update their own pricing entries') THEN
    CREATE POLICY "Users can update their own pricing entries"
      ON pricing_library FOR UPDATE TO authenticated
      USING (company_id = auth.uid())
      WITH CHECK (company_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_library' AND policyname='Users can delete their own pricing entries') THEN
    CREATE POLICY "Users can delete their own pricing entries"
      ON pricing_library FOR DELETE TO authenticated
      USING (company_id = auth.uid());
  END IF;
END $$;

-- =============================================================================
-- updated_at triggers (reuse existing trigger function)
-- =============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column')
  AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_production_rates_updated_at' AND tgrelid = 'production_rates'::regclass) THEN
    CREATE TRIGGER update_production_rates_updated_at
      BEFORE UPDATE ON production_rates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column')
  AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_construction_activity_templates_updated_at' AND tgrelid = 'construction_activity_templates'::regclass) THEN
    CREATE TRIGGER update_construction_activity_templates_updated_at
      BEFORE UPDATE ON construction_activity_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column')
  AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_project_construction_activities_updated_at' AND tgrelid = 'project_construction_activities'::regclass) THEN
    CREATE TRIGGER update_project_construction_activities_updated_at
      BEFORE UPDATE ON project_construction_activities
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column')
  AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pricing_library_updated_at' AND tgrelid = 'pricing_library'::regclass) THEN
    CREATE TRIGGER update_pricing_library_updated_at
      BEFORE UPDATE ON pricing_library
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
