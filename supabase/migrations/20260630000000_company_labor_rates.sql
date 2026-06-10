/*
  Company Labor Rate Library — Labor Pricing System (Milestone 1A)
  Safe/idempotent migration.
*/

CREATE TABLE IF NOT EXISTS company_labor_rates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key             text NOT NULL,
  role_name            text NOT NULL,
  trade_category       text NOT NULL DEFAULT 'General',
  hourly_rate          numeric NOT NULL DEFAULT 0,
  burden_percent       numeric NOT NULL DEFAULT 0,
  fully_burdened_rate  numeric GENERATED ALWAYS AS
                         (ROUND(hourly_rate * (1 + burden_percent / 100.0), 4)) STORED,
  billing_rate         numeric NOT NULL DEFAULT 0,
  description          text,
  is_active            boolean NOT NULL DEFAULT true,
  is_default           boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_key)
);

CREATE INDEX IF NOT EXISTS company_labor_rates_user_active_idx
  ON company_labor_rates(user_id, is_active);

ALTER TABLE company_labor_rates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'company_labor_rates'
      AND policyname = 'Users manage their own company labor rates'
  ) THEN
    CREATE POLICY "Users manage their own company labor rates"
      ON company_labor_rates FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Seed starter roles for a user when none exist yet.
CREATE OR REPLACE FUNCTION public.seed_starter_company_labor_rates(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM company_labor_rates WHERE user_id = p_user_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO company_labor_rates (user_id, role_key, role_name, trade_category, is_default)
  VALUES
    (p_user_id, 'laborer',            'Laborer',           'General',    true),
    (p_user_id, 'carpenter',          'Carpenter',         'Carpentry',  false),
    (p_user_id, 'concrete_finisher',  'Concrete Finisher', 'Concrete',   false),
    (p_user_id, 'foreman',            'Foreman',           'General',    false),
    (p_user_id, 'equipment_operator', 'Equipment Operator','Equipment',  false),
    (p_user_id, 'plumber',            'Plumber',           'Plumbing',   false),
    (p_user_id, 'electrician',        'Electrician',       'Electrical', false),
    (p_user_id, 'hvac_technician',    'HVAC Technician',   'HVAC',       false),
    (p_user_id, 'mason',              'Mason',             'Masonry',    false),
    (p_user_id, 'painter',            'Painter',           'Finishes',   false),
    (p_user_id, 'roofer',             'Roofer',            'Roofing',    false),
    (p_user_id, 'drywall_installer',  'Drywall Installer', 'Finishes',   false),
    (p_user_id, 'general_trade',      'General Trade',     'General',    false);
END;
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column')
  AND NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_company_labor_rates_updated_at'
      AND tgrelid = 'company_labor_rates'::regclass
  ) THEN
    CREATE TRIGGER update_company_labor_rates_updated_at
      BEFORE UPDATE ON company_labor_rates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
