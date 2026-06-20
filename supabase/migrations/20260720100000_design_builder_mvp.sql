-- Arden Design Builder MVP: parametric construction objects and generated quantities.
-- Source of truth is parameter JSON; generated Three.js geometry is derived.

CREATE TABLE IF NOT EXISTS public.design_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  estimate_id uuid NULL REFERENCES public.estimates(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit_system text NOT NULL DEFAULT 'metric',
  model_type text NOT NULL DEFAULT 'cmu_building',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS design_models_project_id_idx ON public.design_models(project_id);
CREATE INDEX IF NOT EXISTS design_models_estimate_id_idx ON public.design_models(estimate_id);

CREATE TABLE IF NOT EXISTS public.design_model_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_model_id uuid NOT NULL REFERENCES public.design_models(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  object_type text NOT NULL,
  name text NOT NULL,
  parent_object_id uuid NULL REFERENCES public.design_model_objects(id) ON DELETE CASCADE,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  quantity_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimate_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  geometry_cache jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS design_model_objects_model_id_idx ON public.design_model_objects(design_model_id);
CREATE INDEX IF NOT EXISTS design_model_objects_project_id_idx ON public.design_model_objects(project_id);
CREATE INDEX IF NOT EXISTS design_model_objects_parent_object_id_idx ON public.design_model_objects(parent_object_id);

CREATE TABLE IF NOT EXISTS public.design_quantity_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_model_id uuid NOT NULL REFERENCES public.design_models(id) ON DELETE CASCADE,
  design_object_id uuid NOT NULL REFERENCES public.design_model_objects(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  estimate_id uuid NULL REFERENCES public.estimates(id) ON DELETE SET NULL,
  estimate_line_id uuid NULL,
  quantity_type text NOT NULL,
  description text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  formula text NOT NULL,
  source text NOT NULL DEFAULT 'parametric_design_builder',
  confidence text NOT NULL DEFAULT 'calculated_from_parameters',
  parameter_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS design_quantity_items_model_id_idx ON public.design_quantity_items(design_model_id);
CREATE INDEX IF NOT EXISTS design_quantity_items_object_id_idx ON public.design_quantity_items(design_object_id);
CREATE INDEX IF NOT EXISTS design_quantity_items_project_id_idx ON public.design_quantity_items(project_id);
CREATE INDEX IF NOT EXISTS design_quantity_items_estimate_id_idx ON public.design_quantity_items(estimate_id);

ALTER TABLE public.design_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_model_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_quantity_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members view design models" ON public.design_models;
CREATE POLICY "Project members view design models"
  ON public.design_models FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS "Project owners insert design models" ON public.design_models;
CREATE POLICY "Project owners insert design models"
  ON public.design_models FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_owner(project_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Project owners update design models" ON public.design_models;
CREATE POLICY "Project owners update design models"
  ON public.design_models FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project owners delete design models" ON public.design_models;
CREATE POLICY "Project owners delete design models"
  ON public.design_models FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project members view design model objects" ON public.design_model_objects;
CREATE POLICY "Project members view design model objects"
  ON public.design_model_objects FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS "Project owners insert design model objects" ON public.design_model_objects;
CREATE POLICY "Project owners insert design model objects"
  ON public.design_model_objects FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_owner(project_id)
    AND EXISTS (
      SELECT 1 FROM public.design_models m
      WHERE m.id = design_model_id AND public.is_project_owner(m.project_id)
    )
  );

DROP POLICY IF EXISTS "Project owners update design model objects" ON public.design_model_objects;
CREATE POLICY "Project owners update design model objects"
  ON public.design_model_objects FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project owners delete design model objects" ON public.design_model_objects;
CREATE POLICY "Project owners delete design model objects"
  ON public.design_model_objects FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project members view design quantity items" ON public.design_quantity_items;
CREATE POLICY "Project members view design quantity items"
  ON public.design_quantity_items FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS "Project owners insert design quantity items" ON public.design_quantity_items;
CREATE POLICY "Project owners insert design quantity items"
  ON public.design_quantity_items FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project owners update design quantity items" ON public.design_quantity_items;
CREATE POLICY "Project owners update design quantity items"
  ON public.design_quantity_items FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project owners delete design quantity items" ON public.design_quantity_items;
CREATE POLICY "Project owners delete design quantity items"
  ON public.design_quantity_items FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

NOTIFY pgrst, 'reload schema';
