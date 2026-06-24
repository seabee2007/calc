/*
  Update starter company labor rates with commercial default labor data.
  Keeps the RPC aligned with the application-side default seed path.
*/

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

  UPDATE company_labor_rates
  SET is_default = false
  WHERE user_id = p_user_id;

  INSERT INTO company_labor_rates (
    user_id,
    role_key,
    role_name,
    trade_category,
    hourly_rate,
    burden_percent,
    billing_rate,
    description,
    is_active,
    is_default
  )
  VALUES
    (p_user_id, 'foreman',            'Foreman / Supervisor', 'Supervision', 39.05, 30, 76.15, 'Starter commercial labor rate default.', true, false),
    (p_user_id, 'electrician',        'Electrician',           'Electrical', 32.44, 30, 63.26, 'Starter commercial labor rate default.', true, false),
    (p_user_id, 'plumber',            'Plumber',               'Plumbing',   31.81, 30, 62.03, 'Starter commercial labor rate default.', true, false),
    (p_user_id, 'equipment_operator', 'Equipment Operator',    'Equipment',  29.15, 30, 56.84, 'Starter commercial labor rate default.', true, false),
    (p_user_id, 'carpenter',          'Carpenter',             'Carpentry',  27.99, 30, 54.58, 'Starter commercial labor rate default.', true, false),
    (p_user_id, 'mason',              'Mason / Brickmason',    'Masonry',    27.91, 30, 54.42, 'Starter commercial labor rate default.', true, false),
    (p_user_id, 'drywall_installer',  'Drywall Installer',     'Drywall',    26.86, 30, 52.38, 'Starter commercial labor rate default.', true, false),
    (p_user_id, 'hvac_technician',    'HVAC Technician',       'HVAC',       26.54, 30, 51.75, 'Starter commercial labor rate default.', true, false),
    (p_user_id, 'concrete_finisher',  'Concrete Finisher',     'Concrete',   25.68, 30, 50.08, 'Starter commercial labor rate default.', true, false),
    (p_user_id, 'roofer',             'Roofer',                'Roofing',    25.12, 30, 48.98, 'Starter commercial labor rate default.', true, false),
    (p_user_id, 'painter',            'Painter',               'Painting',   23.94, 30, 46.68, 'Starter commercial labor rate default.', true, false),
    (p_user_id, 'laborer',            'Laborer (General)',     'General',    22.29, 30, 43.47, 'Starter commercial labor rate default.', true, true)
  ON CONFLICT (user_id, role_key)
  DO UPDATE SET
    role_name = EXCLUDED.role_name,
    trade_category = EXCLUDED.trade_category,
    hourly_rate = EXCLUDED.hourly_rate,
    burden_percent = EXCLUDED.burden_percent,
    billing_rate = EXCLUDED.billing_rate,
    description = EXCLUDED.description,
    is_active = true,
    is_default = EXCLUDED.is_default,
    updated_at = now();

  UPDATE company_labor_rates
  SET is_active = false,
      is_default = false,
      updated_at = now()
  WHERE user_id = p_user_id
    AND role_key IN ('general_trade', 'ironworker');
END;
$$;

DO $$
BEGIN
  WITH starter(role_key, role_name, trade_category, hourly_rate, burden_percent, billing_rate, is_default) AS (
    VALUES
      ('foreman',            'Foreman / Supervisor', 'Supervision', 39.05::numeric, 30::numeric, 76.15::numeric, false),
      ('electrician',        'Electrician',           'Electrical', 32.44::numeric, 30::numeric, 63.26::numeric, false),
      ('plumber',            'Plumber',               'Plumbing',   31.81::numeric, 30::numeric, 62.03::numeric, false),
      ('equipment_operator', 'Equipment Operator',    'Equipment',  29.15::numeric, 30::numeric, 56.84::numeric, false),
      ('carpenter',          'Carpenter',             'Carpentry',  27.99::numeric, 30::numeric, 54.58::numeric, false),
      ('mason',              'Mason / Brickmason',    'Masonry',    27.91::numeric, 30::numeric, 54.42::numeric, false),
      ('drywall_installer',  'Drywall Installer',     'Drywall',    26.86::numeric, 30::numeric, 52.38::numeric, false),
      ('hvac_technician',    'HVAC Technician',       'HVAC',       26.54::numeric, 30::numeric, 51.75::numeric, false),
      ('concrete_finisher',  'Concrete Finisher',     'Concrete',   25.68::numeric, 30::numeric, 50.08::numeric, false),
      ('roofer',             'Roofer',                'Roofing',    25.12::numeric, 30::numeric, 48.98::numeric, false),
      ('painter',            'Painter',               'Painting',   23.94::numeric, 30::numeric, 46.68::numeric, false),
      ('laborer',            'Laborer (General)',     'General',    22.29::numeric, 30::numeric, 43.47::numeric, true)
  ),
  impacted_users AS (
    SELECT DISTINCT clr.user_id
    FROM company_labor_rates clr
    JOIN starter ON starter.role_key = clr.role_key
    WHERE clr.hourly_rate = 0
      AND clr.burden_percent = 0
      AND clr.billing_rate = 0
  )
  UPDATE company_labor_rates clr
  SET is_default = false,
      updated_at = now()
  WHERE clr.user_id IN (SELECT user_id FROM impacted_users);

  WITH starter(role_key, role_name, trade_category, hourly_rate, burden_percent, billing_rate, is_default) AS (
    VALUES
      ('foreman',            'Foreman / Supervisor', 'Supervision', 39.05::numeric, 30::numeric, 76.15::numeric, false),
      ('electrician',        'Electrician',           'Electrical', 32.44::numeric, 30::numeric, 63.26::numeric, false),
      ('plumber',            'Plumber',               'Plumbing',   31.81::numeric, 30::numeric, 62.03::numeric, false),
      ('equipment_operator', 'Equipment Operator',    'Equipment',  29.15::numeric, 30::numeric, 56.84::numeric, false),
      ('carpenter',          'Carpenter',             'Carpentry',  27.99::numeric, 30::numeric, 54.58::numeric, false),
      ('mason',              'Mason / Brickmason',    'Masonry',    27.91::numeric, 30::numeric, 54.42::numeric, false),
      ('drywall_installer',  'Drywall Installer',     'Drywall',    26.86::numeric, 30::numeric, 52.38::numeric, false),
      ('hvac_technician',    'HVAC Technician',       'HVAC',       26.54::numeric, 30::numeric, 51.75::numeric, false),
      ('concrete_finisher',  'Concrete Finisher',     'Concrete',   25.68::numeric, 30::numeric, 50.08::numeric, false),
      ('roofer',             'Roofer',                'Roofing',    25.12::numeric, 30::numeric, 48.98::numeric, false),
      ('painter',            'Painter',               'Painting',   23.94::numeric, 30::numeric, 46.68::numeric, false),
      ('laborer',            'Laborer (General)',     'General',    22.29::numeric, 30::numeric, 43.47::numeric, true)
  )
  UPDATE company_labor_rates clr
  SET role_name = starter.role_name,
      trade_category = starter.trade_category,
      hourly_rate = starter.hourly_rate,
      burden_percent = starter.burden_percent,
      billing_rate = starter.billing_rate,
      description = 'Starter commercial labor rate default.',
      is_active = true,
      is_default = starter.is_default,
      updated_at = now()
  FROM starter
  WHERE clr.role_key = starter.role_key
    AND clr.hourly_rate = 0
    AND clr.burden_percent = 0
    AND clr.billing_rate = 0;

  UPDATE company_labor_rates
  SET is_active = false,
      is_default = false,
      updated_at = now()
  WHERE role_key IN ('general_trade', 'ironworker')
    AND hourly_rate = 0
    AND burden_percent = 0
    AND billing_rate = 0;
END;
$$;
