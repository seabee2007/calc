ALTER TABLE public.design_quantity_items
  ADD COLUMN IF NOT EXISTS estimate_activity_id uuid NULL REFERENCES public.project_construction_activities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS material_resource_id uuid NULL REFERENCES public.project_activity_material_resources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS equipment_resource_id uuid NULL REFERENCES public.project_activity_equipment_resources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_destination text NULL,
  ADD COLUMN IF NOT EXISTS import_status text NULL,
  ADD COLUMN IF NOT EXISTS scope_package_key text NULL,
  ADD COLUMN IF NOT EXISTS import_review_reason text NULL;

CREATE INDEX IF NOT EXISTS design_quantity_items_estimate_activity_id_idx
  ON public.design_quantity_items(estimate_activity_id);

CREATE INDEX IF NOT EXISTS design_quantity_items_scope_package_key_idx
  ON public.design_quantity_items(scope_package_key);
