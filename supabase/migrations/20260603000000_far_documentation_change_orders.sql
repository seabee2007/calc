/*
  FAR documentation fields + Change Orders workflow
*/

-- FAR documentation columns
ALTER TABLE field_adjustment_requests
  ADD COLUMN IF NOT EXISTS potential_cost_impact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS potential_schedule_impact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recommended_action text,
  ADD COLUMN IF NOT EXISTS requires_change_order boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS impact_safety boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS impact_quality boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS change_order_id uuid;

-- Migrate legacy status label
UPDATE field_adjustment_requests
SET status = 'Convert to Change Order'
WHERE status = 'Requires Change Order';

ALTER TABLE field_adjustment_requests DROP CONSTRAINT IF EXISTS field_adjustment_requests_status_check;
ALTER TABLE field_adjustment_requests ADD CONSTRAINT field_adjustment_requests_status_check
  CHECK (status IN (
    'Pending',
    'Needs More Information',
    'Approved',
    'Rejected',
    'Convert to Change Order'
  ));

-- Project contract / change order rollup
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS base_contract_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_change_order_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_contract_value numeric NOT NULL DEFAULT 0;

-- Change orders
CREATE TABLE IF NOT EXISTS change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_far_id uuid REFERENCES field_adjustment_requests(id) ON DELETE SET NULL,
  linked_rfi_id uuid REFERENCES rfi_requests(id) ON DELETE SET NULL,
  linked_task_id uuid REFERENCES planner_tasks(id) ON DELETE SET NULL,
  display_number text,
  title text NOT NULL,
  scope_description text NOT NULL DEFAULT '',
  reason_for_change text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  labor_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  material_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  equipment_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  markup_percent numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  schedule_impact text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined', 'void')),
  public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  sent_at timestamptz,
  viewed_at timestamptz,
  opened_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  document_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS change_orders_project_idx ON change_orders(project_id);
CREATE INDEX IF NOT EXISTS change_orders_status_idx ON change_orders(status);
CREATE INDEX IF NOT EXISTS change_orders_public_token_idx ON change_orders(public_token);
CREATE INDEX IF NOT EXISTS change_orders_linked_far_idx ON change_orders(linked_far_id);

ALTER TABLE field_adjustment_requests
  ADD CONSTRAINT field_adjustment_requests_change_order_id_fkey
  FOREIGN KEY (change_order_id) REFERENCES change_orders(id) ON DELETE SET NULL;

ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members view change orders"
  ON change_orders FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY "Project owners manage change orders"
  ON change_orders FOR ALL TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

-- Per-project CO display number
CREATE OR REPLACE FUNCTION public.set_change_order_display_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  seq int;
BEGIN
  IF NEW.display_number IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) + 1 INTO seq
  FROM change_orders
  WHERE project_id = NEW.project_id;
  NEW.display_number := 'CO-' || lpad(seq::text, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS change_order_display_number_trigger ON change_orders;
CREATE TRIGGER change_order_display_number_trigger
  BEFORE INSERT ON change_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_change_order_display_number();

-- Public token access
CREATE OR REPLACE FUNCTION public.get_change_order_by_public_token(p_token uuid)
RETURNS change_orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT *
  FROM change_orders
  WHERE public_token = p_token
    AND status <> 'draft'
    AND status <> 'void'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.apply_accepted_change_order_to_project(p_co_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  co change_orders;
  base_val numeric;
BEGIN
  SELECT * INTO co FROM change_orders WHERE id = p_co_id;
  IF NOT FOUND OR co.status <> 'accepted' THEN
    RETURN;
  END IF;

  SELECT COALESCE(base_contract_value, 0) INTO base_val FROM projects WHERE id = co.project_id;

  UPDATE projects
  SET
    approved_change_order_total = COALESCE((
      SELECT SUM(total) FROM change_orders
      WHERE project_id = co.project_id AND status = 'accepted'
    ), 0),
    current_contract_value = base_val + COALESCE((
      SELECT SUM(total) FROM change_orders
      WHERE project_id = co.project_id AND status = 'accepted'
    ), 0),
    updated_at = now()
  WHERE id = co.project_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_change_order_client_action(
  p_token uuid,
  p_action text
)
RETURNS change_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row change_orders;
  now_ts timestamptz := now();
BEGIN
  SELECT * INTO row FROM change_orders WHERE public_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'change_order_not_found';
  END IF;

  IF row.status = 'draft' OR row.status = 'void' THEN
    RAISE EXCEPTION 'change_order_not_available';
  END IF;

  IF p_action = 'viewed' AND row.viewed_at IS NULL THEN
    UPDATE change_orders
    SET status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
        viewed_at = now_ts,
        updated_at = now_ts
    WHERE id = row.id
    RETURNING * INTO row;
  ELSIF p_action = 'opened' THEN
    UPDATE change_orders
    SET status = CASE
          WHEN status IN ('sent', 'viewed') THEN 'viewed'
          ELSE status
        END,
        opened_at = COALESCE(opened_at, now_ts),
        viewed_at = COALESCE(viewed_at, now_ts),
        updated_at = now_ts
    WHERE id = row.id
    RETURNING * INTO row;
  ELSIF p_action = 'accepted' AND row.status NOT IN ('accepted', 'declined') THEN
    UPDATE change_orders
    SET status = 'accepted', accepted_at = now_ts, updated_at = now_ts
    WHERE id = row.id
    RETURNING * INTO row;
    PERFORM public.apply_accepted_change_order_to_project(row.id);
  ELSIF p_action = 'declined' AND row.status NOT IN ('accepted', 'declined') THEN
    UPDATE change_orders
    SET status = 'declined', declined_at = now_ts, updated_at = now_ts
    WHERE id = row.id
    RETURNING * INTO row;
  END IF;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_change_order_by_public_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_change_order_client_action(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_accepted_change_order_to_project(uuid) TO authenticated;
