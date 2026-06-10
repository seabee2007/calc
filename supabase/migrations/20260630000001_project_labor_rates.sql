/*
  Project Labor Rate Schedule — Labor Pricing System (Milestone 1B)
  Safe/idempotent migration.
*/

CREATE TABLE IF NOT EXISTS project_labor_rates (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_labor_rate_id  uuid REFERENCES company_labor_rates(id) ON DELETE SET NULL,
  role_key               text NOT NULL,
  role_name              text NOT NULL,
  trade_category         text NOT NULL DEFAULT 'General',
  hourly_rate            numeric NOT NULL DEFAULT 0,
  burden_percent         numeric NOT NULL DEFAULT 0,
  fully_burdened_rate    numeric GENERATED ALWAYS AS
                           (ROUND(hourly_rate * (1 + burden_percent / 100.0), 4)) STORED,
  billing_rate           numeric NOT NULL DEFAULT 0,
  description            text,
  is_active              boolean NOT NULL DEFAULT true,
  is_default             boolean NOT NULL DEFAULT false,
  is_override            boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, role_key)
);

CREATE INDEX IF NOT EXISTS project_labor_rates_project_active_idx
  ON project_labor_rates(project_id, is_active);

ALTER TABLE project_labor_rates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_labor_rates'
      AND policyname = 'Project members can view project labor rates'
  ) THEN
    CREATE POLICY "Project members can view project labor rates"
      ON project_labor_rates FOR SELECT TO authenticated
      USING (public.can_access_project(project_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_labor_rates'
      AND policyname = 'Project owners insert project labor rates'
  ) THEN
    CREATE POLICY "Project owners insert project labor rates"
      ON project_labor_rates FOR INSERT TO authenticated
      WITH CHECK (public.is_project_owner(project_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_labor_rates'
      AND policyname = 'Project owners update project labor rates'
  ) THEN
    CREATE POLICY "Project owners update project labor rates"
      ON project_labor_rates FOR UPDATE TO authenticated
      USING (public.is_project_owner(project_id))
      WITH CHECK (public.is_project_owner(project_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_labor_rates'
      AND policyname = 'Project owners delete project labor rates'
  ) THEN
    CREATE POLICY "Project owners delete project labor rates"
      ON project_labor_rates FOR DELETE TO authenticated
      USING (public.is_project_owner(project_id));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column')
  AND NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_project_labor_rates_updated_at'
      AND tgrelid = 'project_labor_rates'::regclass
  ) THEN
    CREATE TRIGGER update_project_labor_rates_updated_at
      BEFORE UPDATE ON project_labor_rates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
