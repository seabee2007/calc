/*
  Phase DB-1: Builder document snapshots on contract_documents.

  Extends the existing contract_documents table (no parallel project_documents).
  Adds metadata columns for document number, template key, workflow status, and
  point-in-time project/company/rendered snapshots. Extends save_contract_version RPC.
*/

ALTER TABLE contract_documents
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS builder_workflow_status text,
  ADD COLUMN IF NOT EXISTS project_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS company_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rendered_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS contract_documents_type_project_idx
  ON contract_documents(project_id, document_type, updated_at DESC)
  WHERE project_id IS NOT NULL;

-- Replace RPC with extended signature (drop prior overload).
DROP FUNCTION IF EXISTS public.save_contract_version(
  uuid, text, uuid, text, text, text, text, text, jsonb, jsonb, jsonb, text, jsonb, jsonb
);

CREATE OR REPLACE FUNCTION public.save_contract_version(
  p_document_id uuid,
  p_title text,
  p_project_id uuid,
  p_document_type text,
  p_pack_key text,
  p_pack_version text,
  p_mode text,
  p_status text,
  p_input_snapshot jsonb,
  p_manifest jsonb,
  p_sections jsonb,
  p_output_hash text,
  p_recommendation_decisions jsonb,
  p_risk jsonb,
  p_document_number text DEFAULT NULL,
  p_template_key text DEFAULT NULL,
  p_builder_workflow_status text DEFAULT NULL,
  p_project_snapshot jsonb DEFAULT '{}'::jsonb,
  p_company_snapshot jsonb DEFAULT '{}'::jsonb,
  p_rendered_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_doc contract_documents;
  v_version contract_document_versions;
  v_next integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_document_id IS NULL THEN
    INSERT INTO contract_documents (
      user_id,
      project_id,
      title,
      document_type,
      pack_key,
      status,
      document_number,
      template_key,
      builder_workflow_status,
      project_snapshot,
      company_snapshot,
      rendered_snapshot
    ) VALUES (
      v_uid,
      p_project_id,
      COALESCE(NULLIF(trim(p_title), ''), 'Untitled contract'),
      COALESCE(p_document_type, 'residential_contract'),
      p_pack_key,
      COALESCE(p_status, 'draft'),
      NULLIF(trim(p_document_number), ''),
      NULLIF(trim(p_template_key), ''),
      NULLIF(trim(p_builder_workflow_status), ''),
      COALESCE(p_project_snapshot, '{}'::jsonb),
      COALESCE(p_company_snapshot, '{}'::jsonb),
      COALESCE(p_rendered_snapshot, '{}'::jsonb)
    )
    RETURNING * INTO v_doc;
  ELSE
    SELECT * INTO v_doc FROM contract_documents WHERE id = p_document_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'contract_document_not_found';
    END IF;
    IF v_doc.user_id <> v_uid THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
  FROM contract_document_versions
  WHERE document_id = v_doc.id;

  INSERT INTO contract_document_versions (
    document_id, user_id, version_number, engine_version, pack_key, pack_version,
    mode, input_snapshot, manifest, sections, output_hash, recommendation_decisions, risk
  ) VALUES (
    v_doc.id,
    v_uid,
    v_next,
    COALESCE(p_manifest->>'engineVersion', 'unknown'),
    p_pack_key,
    COALESCE(p_pack_version, p_manifest->>'packVersion', '0.0.0'),
    p_mode,
    COALESCE(p_input_snapshot, '{}'::jsonb),
    COALESCE(p_manifest, '{}'::jsonb),
    COALESCE(p_sections, '[]'::jsonb),
    COALESCE(p_output_hash, ''),
    COALESCE(p_recommendation_decisions, '[]'::jsonb),
    COALESCE(p_risk, '{}'::jsonb)
  )
  RETURNING * INTO v_version;

  UPDATE contract_documents
  SET current_version_id = v_version.id,
      latest_version_number = v_next,
      title = COALESCE(NULLIF(trim(p_title), ''), title),
      project_id = p_project_id,
      pack_key = p_pack_key,
      document_type = COALESCE(p_document_type, document_type),
      status = COALESCE(p_status, status),
      document_number = COALESCE(NULLIF(trim(p_document_number), ''), document_number),
      template_key = COALESCE(NULLIF(trim(p_template_key), ''), template_key),
      builder_workflow_status = COALESCE(
        NULLIF(trim(p_builder_workflow_status), ''),
        builder_workflow_status
      ),
      project_snapshot = COALESCE(p_project_snapshot, project_snapshot),
      company_snapshot = COALESCE(p_company_snapshot, company_snapshot),
      rendered_snapshot = COALESCE(p_rendered_snapshot, rendered_snapshot),
      updated_at = now()
  WHERE id = v_doc.id
  RETURNING * INTO v_doc;

  RETURN jsonb_build_object(
    'document', to_jsonb(v_doc),
    'version', to_jsonb(v_version)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_contract_version(
  uuid, text, uuid, text, text, text, text, text, jsonb, jsonb, jsonb, text, jsonb, jsonb,
  text, text, text, jsonb, jsonb, jsonb
) TO authenticated;

COMMENT ON COLUMN contract_documents.document_number IS
  'Builder document number (RFI #, submittal #, CO #, etc.) at last save.';
COMMENT ON COLUMN contract_documents.builder_workflow_status IS
  'Workflow status from builder answers (Draft, Submitted, etc.), separate from contract status.';
COMMENT ON COLUMN contract_documents.project_snapshot IS
  'Point-in-time project/client snapshot when draft was saved.';
COMMENT ON COLUMN contract_documents.company_snapshot IS
  'Point-in-time company settings snapshot when draft was saved.';
