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
