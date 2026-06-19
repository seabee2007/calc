-- Arden BIM Takeoff MVP: model metadata, parsed objects, and takeoff-to-estimate links.
-- Private storage bucket `bim-models` with signed-URL access at read time.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bim_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  estimate_id uuid NULL REFERENCES public.estimates(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  original_file_name text NOT NULL,
  original_file_type text NOT NULL,
  viewer_file_type text NULL,
  storage_path text NOT NULL,
  file_size bigint NULL,
  status text NOT NULL DEFAULT 'uploaded',
  processing_status text NOT NULL DEFAULT 'uploaded',
  unsupported_reason text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bim_models_project_id_idx ON public.bim_models(project_id);
CREATE INDEX IF NOT EXISTS bim_models_estimate_id_idx ON public.bim_models(estimate_id);

ALTER TABLE public.bim_models ADD COLUMN IF NOT EXISTS original_file_name text;
ALTER TABLE public.bim_models ADD COLUMN IF NOT EXISTS original_file_type text;
ALTER TABLE public.bim_models ADD COLUMN IF NOT EXISTS viewer_file_type text NULL;
ALTER TABLE public.bim_models ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'uploaded';
ALTER TABLE public.bim_models ADD COLUMN IF NOT EXISTS unsupported_reason text NULL;

UPDATE public.bim_models
SET
  original_file_name = COALESCE(original_file_name, file_name),
  original_file_type = COALESCE(original_file_type, file_type),
  viewer_file_type = COALESCE(viewer_file_type, CASE WHEN file_type = 'glb' THEN 'glb' ELSE NULL END),
  processing_status = COALESCE(processing_status, status);

ALTER TABLE public.bim_models ALTER COLUMN original_file_name SET NOT NULL;
ALTER TABLE public.bim_models ALTER COLUMN original_file_type SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.bim_model_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.bim_models(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  external_object_id text NOT NULL,
  name text NULL,
  object_type text NULL,
  category text NULL,
  material text NULL,
  level text NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  geometry_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  takeoff_status text NOT NULL DEFAULT 'unmapped',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_id, external_object_id)
);

CREATE INDEX IF NOT EXISTS bim_model_objects_model_id_idx ON public.bim_model_objects(model_id);
CREATE INDEX IF NOT EXISTS bim_model_objects_project_id_idx ON public.bim_model_objects(project_id);

CREATE TABLE IF NOT EXISTS public.bim_takeoff_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  estimate_id uuid NULL REFERENCES public.estimates(id) ON DELETE SET NULL,
  model_id uuid NOT NULL REFERENCES public.bim_models(id) ON DELETE CASCADE,
  object_id uuid NULL REFERENCES public.bim_model_objects(id) ON DELETE SET NULL,
  division_code text NULL,
  activity_code text NULL,
  estimate_line_id uuid NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  source text NOT NULL,
  confidence text NOT NULL DEFAULT 'manual',
  notes text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bim_takeoff_items_project_id_idx ON public.bim_takeoff_items(project_id);
CREATE INDEX IF NOT EXISTS bim_takeoff_items_estimate_id_idx ON public.bim_takeoff_items(estimate_id);
CREATE INDEX IF NOT EXISTS bim_takeoff_items_model_id_idx ON public.bim_takeoff_items(model_id);
CREATE INDEX IF NOT EXISTS bim_takeoff_items_object_id_idx ON public.bim_takeoff_items(object_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.bim_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bim_model_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bim_takeoff_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members view bim models" ON public.bim_models;
CREATE POLICY "Project members view bim models"
  ON public.bim_models FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS "Project owners insert bim models" ON public.bim_models;
CREATE POLICY "Project owners insert bim models"
  ON public.bim_models FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_owner(project_id)
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "Project owners update bim models" ON public.bim_models;
CREATE POLICY "Project owners update bim models"
  ON public.bim_models FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project owners delete bim models" ON public.bim_models;
CREATE POLICY "Project owners delete bim models"
  ON public.bim_models FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project members view bim model objects" ON public.bim_model_objects;
CREATE POLICY "Project members view bim model objects"
  ON public.bim_model_objects FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS "Project owners insert bim model objects" ON public.bim_model_objects;
CREATE POLICY "Project owners insert bim model objects"
  ON public.bim_model_objects FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_owner(project_id)
    AND EXISTS (
      SELECT 1 FROM public.bim_models m
      WHERE m.id = model_id AND public.is_project_owner(m.project_id)
    )
  );

DROP POLICY IF EXISTS "Project owners update bim model objects" ON public.bim_model_objects;
CREATE POLICY "Project owners update bim model objects"
  ON public.bim_model_objects FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project owners delete bim model objects" ON public.bim_model_objects;
CREATE POLICY "Project owners delete bim model objects"
  ON public.bim_model_objects FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project members view bim takeoff items" ON public.bim_takeoff_items;
CREATE POLICY "Project members view bim takeoff items"
  ON public.bim_takeoff_items FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

DROP POLICY IF EXISTS "Project owners insert bim takeoff items" ON public.bim_takeoff_items;
CREATE POLICY "Project owners insert bim takeoff items"
  ON public.bim_takeoff_items FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project owners update bim takeoff items" ON public.bim_takeoff_items;
CREATE POLICY "Project owners update bim takeoff items"
  ON public.bim_takeoff_items FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "Project owners delete bim takeoff items" ON public.bim_takeoff_items;
CREATE POLICY "Project owners delete bim takeoff items"
  ON public.bim_takeoff_items FOR DELETE TO authenticated
  USING (public.is_project_owner(project_id));

-- ---------------------------------------------------------------------------
-- Private storage bucket for BIM model files
-- Path convention: {userId}/{projectId}/{modelId}/{timestamp}-{filename}
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bim-models',
  'bim-models',
  false,
  104857600,
  ARRAY['model/gltf-binary', 'model/gltf+json', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Project members read bim model files" ON storage.objects;
CREATE POLICY "Project members read bim model files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'bim-models'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Authenticated users upload bim model files" ON storage.objects;
CREATE POLICY "Authenticated users upload bim model files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bim-models'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own bim model files" ON storage.objects;
CREATE POLICY "Users update own bim model files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'bim-models'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own bim model files" ON storage.objects;
CREATE POLICY "Users delete own bim model files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'bim-models'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

NOTIFY pgrst, 'reload schema';
