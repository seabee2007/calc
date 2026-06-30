ALTER TABLE public.design_quantity_items
  ADD COLUMN IF NOT EXISTS preview_line_id text;

UPDATE public.design_quantity_items
SET preview_line_id = NULLIF(metadata->>'previewLineId', '')
WHERE preview_line_id IS NULL;

UPDATE public.design_quantity_items
SET preview_line_id = design_object_id::text || ':' || quantity_type
WHERE preview_line_id IS NULL;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY design_model_id, preview_line_id
      ORDER BY
        CASE WHEN import_status IS NOT NULL THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at DESC,
        id
    ) AS rn
  FROM public.design_quantity_items
  WHERE preview_line_id IS NOT NULL
)
UPDATE public.design_quantity_items d
SET preview_line_id = d.preview_line_id || ':legacy:' || d.id::text
FROM ranked r
WHERE d.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS public.design_quantity_items_model_preview_line_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS design_quantity_items_model_preview_line_uidx
  ON public.design_quantity_items(design_model_id, preview_line_id);

CREATE INDEX IF NOT EXISTS design_quantity_items_preview_line_idx
  ON public.design_quantity_items(preview_line_id)
  WHERE preview_line_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.design_quantity_import_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_quantity_item_id uuid NOT NULL REFERENCES public.design_quantity_items(id) ON DELETE CASCADE,
  design_model_id uuid NOT NULL REFERENCES public.design_models(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  estimate_id uuid NULL REFERENCES public.estimates(id) ON DELETE SET NULL,

  target_type text NOT NULL,
  target_id uuid NULL,
  project_activity_id uuid NULL REFERENCES public.project_construction_activities(id) ON DELETE SET NULL,

  usage_role text NOT NULL,
  destination text NOT NULL,
  scope_package_key text NOT NULL,
  activity_key text NULL,

  quantity numeric NOT NULL,
  unit text NOT NULL,
  formula text NOT NULL,
  derived boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  commit_batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT design_quantity_import_links_target_type_check
    CHECK (
      target_type IN (
        'project_activity',
        'project_activity_line_item',
        'project_activity_material_resource',
        'project_activity_equipment_resource',
        'reference',
        'excluded'
      )
    )
);

CREATE INDEX IF NOT EXISTS design_quantity_import_links_quantity_idx
  ON public.design_quantity_import_links(design_quantity_item_id);

CREATE INDEX IF NOT EXISTS design_quantity_import_links_activity_idx
  ON public.design_quantity_import_links(project_activity_id);

CREATE INDEX IF NOT EXISTS design_quantity_import_links_project_idx
  ON public.design_quantity_import_links(project_id);

CREATE INDEX IF NOT EXISTS design_quantity_import_links_activity_key_idx
  ON public.design_quantity_import_links(design_model_id, estimate_id, activity_key);

CREATE INDEX IF NOT EXISTS design_quantity_import_links_commit_batch_idx
  ON public.design_quantity_import_links(commit_batch_id);

ALTER TABLE public.design_quantity_import_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members view design quantity import links"
  ON public.design_quantity_import_links;

CREATE POLICY "Project members view design quantity import links"
  ON public.design_quantity_import_links
  FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS "Project owners insert design quantity import links"
  ON public.design_quantity_import_links;

CREATE POLICY "Project owners insert design quantity import links"
  ON public.design_quantity_import_links
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project owners update design quantity import links"
  ON public.design_quantity_import_links;

CREATE POLICY "Project owners update design quantity import links"
  ON public.design_quantity_import_links
  FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project owners delete design quantity import links"
  ON public.design_quantity_import_links;

CREATE POLICY "Project owners delete design quantity import links"
  ON public.design_quantity_import_links
  FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

ALTER TABLE public.design_quantity_import_links
  ADD COLUMN IF NOT EXISTS source_preview_line_id text,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by_commit_batch_id uuid,
  ADD COLUMN IF NOT EXISTS superseded_reason text;

UPDATE public.design_quantity_import_links
SET source_preview_line_id = NULLIF(metadata->>'sourcePreviewLineId', '')
WHERE source_preview_line_id IS NULL;

CREATE INDEX IF NOT EXISTS design_quantity_import_links_active_activity_key_idx
  ON public.design_quantity_import_links(design_model_id, project_id, estimate_id, activity_key)
  WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS design_quantity_import_links_active_source_preview_idx
  ON public.design_quantity_import_links(design_model_id, project_id, estimate_id, source_preview_line_id)
  WHERE superseded_at IS NULL
    AND source_preview_line_id IS NOT NULL;

ALTER TABLE public.project_activity_line_items
  ADD COLUMN IF NOT EXISTS source_provider text NULL,
  ADD COLUMN IF NOT EXISTS source_snapshot jsonb NULL;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  FOR v_constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.project_activity_line_items'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source_provider%'
  LOOP
    EXECUTE format('ALTER TABLE public.project_activity_line_items DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
  END LOOP;

  ALTER TABLE public.project_activity_line_items
    ADD CONSTRAINT project_activity_line_items_source_provider_check
    CHECK (
      source_provider IS NULL OR
      source_provider IN ('manual', 'company_library', 'arden_starter', 'arden_design_builder')
    );
END $$;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  FOR v_constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.project_activity_material_resources'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source_provider%'
  LOOP
    EXECUTE format('ALTER TABLE public.project_activity_material_resources DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
  END LOOP;

  ALTER TABLE public.project_activity_material_resources
    ADD CONSTRAINT project_activity_material_resources_source_provider_check
    CHECK (source_provider IN ('manual', 'company_library', 'arden_starter', 'arden_design_builder'));
END $$;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  FOR v_constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.project_activity_equipment_resources'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source_provider%'
  LOOP
    EXECUTE format('ALTER TABLE public.project_activity_equipment_resources DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
  END LOOP;

  ALTER TABLE public.project_activity_equipment_resources
    ADD CONSTRAINT project_activity_equipment_resources_source_provider_check
    CHECK (source_provider IN ('manual', 'company_library', 'arden_starter', 'arden_design_builder'));
END $$;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  FOR v_constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.company_cost_library_items'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source_provider%'
  LOOP
    EXECUTE format('ALTER TABLE public.company_cost_library_items DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
  END LOOP;

  ALTER TABLE public.company_cost_library_items
    ADD CONSTRAINT company_cost_library_items_source_provider_check
    CHECK (source_provider IN ('manual', 'company_library', 'arden_starter', 'arden_design_builder'));
END $$;

CREATE OR REPLACE FUNCTION public.finalize_design_builder_import_links(
  p_design_model_id uuid,
  p_project_id uuid,
  p_estimate_id uuid DEFAULT NULL,
  p_commit_batch_id uuid DEFAULT gen_random_uuid(),
  p_activity_keys text[] DEFAULT ARRAY[]::text[],
  p_source_preview_line_ids text[] DEFAULT ARRAY[]::text[],
  p_links jsonb DEFAULT '[]'::jsonb,
  p_quantity_updates jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_import_links jsonb := '[]'::jsonb;
  v_quantity_items jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_project_owner(p_project_id) THEN
    RAISE EXCEPTION 'Only project owners can finalize Design Builder imports';
  END IF;

  UPDATE public.design_quantity_import_links
  SET
    superseded_at = now(),
    superseded_by_commit_batch_id = p_commit_batch_id,
    superseded_reason = 'design_builder_recommit'
  WHERE design_model_id = p_design_model_id
    AND project_id = p_project_id
    AND (
      (p_estimate_id IS NULL AND estimate_id IS NULL) OR
      (p_estimate_id IS NOT NULL AND estimate_id = p_estimate_id)
    )
    AND superseded_at IS NULL
    AND (
      (array_length(p_activity_keys, 1) IS NOT NULL AND activity_key = ANY(p_activity_keys)) OR
      (
        array_length(p_source_preview_line_ids, 1) IS NOT NULL AND
        (
          source_preview_line_id = ANY(p_source_preview_line_ids) OR
          metadata->>'sourcePreviewLineId' = ANY(p_source_preview_line_ids)
        )
      )
    );

  WITH inserted AS (
    INSERT INTO public.design_quantity_import_links (
      design_quantity_item_id,
      design_model_id,
      project_id,
      estimate_id,
      target_type,
      target_id,
      project_activity_id,
      usage_role,
      destination,
      scope_package_key,
      activity_key,
      source_preview_line_id,
      quantity,
      unit,
      formula,
      derived,
      metadata,
      commit_batch_id,
      created_by
    )
    SELECT
      link.design_quantity_item_id,
      p_design_model_id,
      p_project_id,
      p_estimate_id,
      link.target_type,
      link.target_id,
      link.project_activity_id,
      link.usage_role,
      link.destination,
      link.scope_package_key,
      link.activity_key,
      link.source_preview_line_id,
      link.quantity,
      link.unit,
      link.formula,
      link.derived,
      COALESCE(link.metadata, '{}'::jsonb),
      p_commit_batch_id,
      v_user_id
    FROM jsonb_to_recordset(p_links) AS link(
      design_quantity_item_id uuid,
      target_type text,
      target_id uuid,
      project_activity_id uuid,
      usage_role text,
      destination text,
      scope_package_key text,
      activity_key text,
      source_preview_line_id text,
      quantity numeric,
      unit text,
      formula text,
      derived boolean,
      metadata jsonb
    )
    RETURNING *
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(inserted)), '[]'::jsonb)
  INTO v_import_links
  FROM inserted;

  WITH input_updates AS (
    SELECT *
    FROM jsonb_to_recordset(p_quantity_updates) AS update_row(
      design_quantity_item_id uuid,
      estimate_activity_id uuid,
      estimate_line_id uuid,
      material_resource_id uuid,
      equipment_resource_id uuid,
      import_destination text,
      import_status text,
      scope_package_key text,
      import_review_reason text
    )
  ),
  updated AS (
    UPDATE public.design_quantity_items item
    SET
      estimate_activity_id = input_updates.estimate_activity_id,
      estimate_line_id = input_updates.estimate_line_id,
      material_resource_id = input_updates.material_resource_id,
      equipment_resource_id = input_updates.equipment_resource_id,
      import_destination = input_updates.import_destination,
      import_status = input_updates.import_status,
      scope_package_key = input_updates.scope_package_key,
      import_review_reason = input_updates.import_review_reason,
      updated_at = now()
    FROM input_updates
    WHERE item.id = input_updates.design_quantity_item_id
      AND item.design_model_id = p_design_model_id
    RETURNING item.*
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(updated)), '[]'::jsonb)
  INTO v_quantity_items
  FROM updated;

  RETURN jsonb_build_object(
    'import_links', v_import_links,
    'quantity_items', v_quantity_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_design_builder_import_links(
  uuid,
  uuid,
  uuid,
  uuid,
  text[],
  text[],
  jsonb,
  jsonb
) TO authenticated;
