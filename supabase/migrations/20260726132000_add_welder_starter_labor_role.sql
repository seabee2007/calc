/*
  Add Welder to starter company labor rates for on-site steel fabrication/welding work.
  Existing custom welder rows are preserved; reset starter defaults will refresh the row.
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
    (p_user_id, 'welder',             'Welder',                'Welding',    27.29, 30, 53.22, 'Starter commercial labor rate default.', true, false),
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

WITH existing_users AS (
  SELECT DISTINCT user_id
  FROM company_labor_rates
)
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
SELECT
  user_id,
  'welder',
  'Welder',
  'Welding',
  27.29,
  30,
  53.22,
  'Starter commercial labor rate default.',
  true,
  false
FROM existing_users
ON CONFLICT (user_id, role_key) DO NOTHING;
