ALTER TABLE public.design_quantity_items
  ADD COLUMN IF NOT EXISTS preview_line_id text;

UPDATE public.design_quantity_items
SET preview_line_id = NULLIF(metadata->>'previewLineId', '')
WHERE preview_line_id IS NULL OR preview_line_id = '';

UPDATE public.design_quantity_items
SET preview_line_id =
  COALESCE(design_object_id::text, 'unknown-object') ||
  ':' ||
  COALESCE(quantity_type, 'unknown-quantity') ||
  ':legacy:' ||
  id::text
WHERE preview_line_id IS NULL OR preview_line_id = '';

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

CREATE UNIQUE INDEX design_quantity_items_model_preview_line_uidx
  ON public.design_quantity_items(design_model_id, preview_line_id);
