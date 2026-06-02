-- Public change order fetch: include client-safe project and company context (no schema changes).

DROP FUNCTION IF EXISTS public.get_change_order_by_public_token(uuid);

CREATE OR REPLACE FUNCTION public.get_change_order_by_public_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  co change_orders;
  proj projects;
  comp company_settings;
  owner_id uuid;
BEGIN
  SELECT * INTO co
  FROM change_orders
  WHERE public_token = p_token
    AND status NOT IN ('draft', 'void')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO proj FROM projects WHERE id = co.project_id;

  owner_id := COALESCE(proj.user_id, co.user_id);

  IF owner_id IS NOT NULL THEN
    SELECT * INTO comp FROM company_settings WHERE user_id = owner_id LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'change_order',
    to_jsonb(co),
    'project',
    CASE
      WHEN proj.id IS NOT NULL THEN
        jsonb_build_object(
          'name',
          proj.name,
          'jobsite_street',
          proj.jobsite_street,
          'jobsite_street2',
          proj.jobsite_street2,
          'jobsite_city',
          proj.jobsite_city,
          'jobsite_state',
          proj.jobsite_state,
          'jobsite_zip',
          proj.jobsite_zip,
          'client_info',
          COALESCE(proj.client_info, '{}'::jsonb),
          'base_contract_value',
          proj.base_contract_value,
          'approved_change_order_total',
          proj.approved_change_order_total,
          'current_contract_value',
          proj.current_contract_value
        )
      ELSE
        NULL
    END,
    'company',
    CASE
      WHEN comp.id IS NOT NULL THEN
        jsonb_build_object(
          'company_name',
          comp.company_name,
          'address',
          comp.address,
          'phone',
          comp.phone,
          'email',
          comp.email,
          'license_number',
          comp.license_number,
          'logo_url',
          comp.logo_url
        )
      ELSE
        NULL
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_change_order_by_public_token(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.get_change_order_by_public_token(uuid) IS
  'Returns change order row plus client-safe project/company snapshot for public signing pages.';
