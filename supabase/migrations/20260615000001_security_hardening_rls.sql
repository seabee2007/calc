/*
  Security hardening — RLS and public-token response field minimization.

  Changes:
  1. Redact get_proposal_by_public_token — return client-safe fields only.
  2. Redact get_change_order_by_public_token — return client-safe fields only.
  3. Redact record_change_order_client_action return type to match.
  4. Fix client-safe error wording for proposal/change-order invalid tokens.
*/

-- ── Drop old RPC signatures before changing return types ───────────────────
-- PostgreSQL cannot CREATE OR REPLACE a function when the return type changes.

DROP FUNCTION IF EXISTS public.get_proposal_by_public_token(uuid);

DROP FUNCTION IF EXISTS public.get_change_order_by_public_token(uuid);

DROP FUNCTION IF EXISTS public.record_change_order_client_action(
  uuid,
  text,
  text,
  text
);

-- ── 2. get_proposal_by_public_token — redacted client-safe version ──────────
-- Replaces the prior version that returned the full proposals row (including
-- labor_cost, material_cost, gross_profit, gross_margin_percent, user_id).
-- Now returns only fields appropriate for a client-facing review page.

CREATE OR REPLACE FUNCTION public.get_proposal_by_public_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  p proposals;
BEGIN
  SELECT * INTO p
  FROM proposals
  WHERE public_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Only return tokens that have been explicitly sent (not draft-only).
  -- An unset sent_at means the proposal was never shared with a client.
  IF p.sent_at IS NULL THEN
    RETURN NULL;
  END IF;

  -- Return client-safe projection only.
  -- Internal cost fields (labor_cost, material_cost, gross_profit,
  -- gross_margin_percent), user_id, and importedEstimateSummary are excluded.
  RETURN jsonb_build_object(
    'id',            p.id,
    'title',         p.title,
    'status',        p.status,
    'total_amount',  p.total_amount,
    'sent_at',       p.sent_at,
    'viewed_at',     p.viewed_at,
    'accepted_at',   p.accepted_at,
    'declined_at',   p.declined_at,
    'paid_at',       p.paid_at,
    'paid_status',   p.paid_status,
    'deposit_amount', p.deposit_amount,
    'data', (
      -- Strip internal financial keys from the data JSONB before returning.
      -- The frontend reads scope, payment terms, line descriptions, etc. from data.
      p.data
        - 'importedEstimateSummary'
        - 'laborCost'
        - 'materialCost'
        - 'equipmentCost'
        - 'subcontractorCost'
        - 'grossProfit'
        - 'grossMarginPercent'
        - 'overheadPercent'
        - 'markupPercent'
        - 'profitPercent'
    )
  );
END;
$$;

-- ── 3. get_change_order_by_public_token — redacted client-safe version ──────
-- Replaces the prior version that returned the full change_orders row including
-- markup_percent, line-item unit costs, user_id, project_id.

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

  -- Return a client-safe projection only.
  -- markup_percent, labor_items unit costs, material_items unit costs,
  -- equipment_items, user_id, and project_id are excluded.
  RETURN jsonb_build_object(
    'change_order',
    jsonb_build_object(
      'id',                    co.id,
      'title',                 co.title,
      'status',                co.status,
      'total',                 co.total,
      'subtotal',              co.total,
      'scope_description',     co.scope_description,
      'reason_for_change',     co.reason_for_change,
      'terms',                 co.terms,
      'sent_at',               co.sent_at,
      'viewed_at',             co.viewed_at,
      'accepted_at',           co.accepted_at,
      'declined_at',           co.declined_at,
      'client_name',           co.client_name,
      'client_signature',      co.client_signature,
      'client_signed_at',      co.client_signed_at,
      'contractor_name',       co.contractor_name,
      'contractor_signature',  co.contractor_signature,
      'contractor_signed_at',  co.contractor_signed_at,
      'schedule_impact',       co.schedule_impact,
      'public_token',          co.public_token,
      'created_at',            co.created_at,
      'updated_at',            co.updated_at,
      -- Keep display-compatible arrays while stripping unit costs and margin data.
      'labor_items', COALESCE(
        (
          SELECT jsonb_agg(
            item - 'unit_cost' - 'unitPrice' - 'unit_price' - 'markup_amount'
          )
          FROM jsonb_array_elements(COALESCE(co.labor_items, '[]'::jsonb)) AS item
        ),
        '[]'::jsonb
      ),
      'material_items', COALESCE(
        (
          SELECT jsonb_agg(
            item - 'unit_cost' - 'unitPrice' - 'unit_price' - 'markup_amount'
          )
          FROM jsonb_array_elements(COALESCE(co.material_items, '[]'::jsonb)) AS item
        ),
        '[]'::jsonb
      ),
      'equipment_items', '[]'::jsonb,
      'subcontractor_items', '[]'::jsonb
    ),
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

-- ── 4. record_change_order_client_action — return client-safe jsonb ─────────
-- Replaces prior version that returned the full change_orders row.
-- Client only needs updated status/timestamp confirmation.

CREATE OR REPLACE FUNCTION public.record_change_order_client_action(
  p_token uuid,
  p_action text,
  p_client_name text DEFAULT NULL,
  p_client_signature text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  co change_orders;
  now_ts timestamptz := now();
BEGIN
  SELECT * INTO co
  FROM change_orders
  WHERE public_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'change_order_not_available';
  END IF;

  -- Verify the change order is in a state where client actions are allowed.
  IF co.status NOT IN ('sent', 'viewed') THEN
    RAISE EXCEPTION 'change_order_not_available';
  END IF;

  IF p_action = 'opened' THEN
    UPDATE change_orders
    SET status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
        viewed_at = COALESCE(viewed_at, now_ts),
        updated_at = now_ts
    WHERE id = co.id;

  ELSIF p_action = 'accepted' THEN
    IF p_client_name IS NULL OR length(trim(p_client_name)) = 0
       OR p_client_signature IS NULL OR length(trim(p_client_signature)) = 0 THEN
      RAISE EXCEPTION 'signature_required';
    END IF;
    UPDATE change_orders
    SET status = 'accepted',
        client_name = p_client_name,
        client_signature = p_client_signature,
        client_signed_at = now_ts,
        accepted_at = now_ts,
        viewed_at = COALESCE(viewed_at, now_ts),
        updated_at = now_ts
    WHERE id = co.id;

  ELSIF p_action = 'declined' THEN
    UPDATE change_orders
    SET status = 'declined',
        declined_at = now_ts,
        updated_at = now_ts
    WHERE id = co.id;
  END IF;

  -- Return updated client-safe data (calls the redacted RPC).
  RETURN public.get_change_order_by_public_token(p_token);
END;
$$;

-- ── RPC permissions ────────────────────────────────────────────────────────
-- Public token pages call these as anon users, but the functions are
-- SECURITY DEFINER and return only redacted client-safe fields.

GRANT EXECUTE ON FUNCTION public.get_proposal_by_public_token(uuid)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_change_order_by_public_token(uuid)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_change_order_client_action(uuid, text, text, text)
  TO anon, authenticated;
