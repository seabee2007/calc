/*
  Contract & Document Engine - Phase 6.1: persistence + immutable versioning

  - contract_documents: the logical contract (mutable metadata + pointer to the
    latest version). Owned by user_id, with an OPTIONAL project_id link (hybrid).
  - contract_document_versions: append-only, immutable snapshots of the assembled
    document (manifest + rendered sections + output hash + risk). No UPDATE allowed.

  Reuses the project RLS helpers is_project_owner / can_access_project from
  20260601000001_field_planner_core.sql and the set_field_tool_updated_at trigger
  from 20260611000000_field_safety_tools.sql.
*/

-- Logical contract (mutable metadata)
CREATE TABLE IF NOT EXISTS contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled contract',
  document_type text NOT NULL DEFAULT 'residential_contract',
  pack_key text NOT NULL DEFAULT 'GENERIC_RESIDENTIAL',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'finalized', 'archived')),
  current_version_id uuid,
  latest_version_number integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Immutable, append-only version snapshots
CREATE TABLE IF NOT EXISTS contract_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES contract_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  engine_version text NOT NULL DEFAULT 'unknown',
  pack_key text NOT NULL,
  pack_version text NOT NULL DEFAULT '0.0.0',
  mode text,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  output_hash text NOT NULL DEFAULT '',
  recommendation_decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);

-- Latest-version pointer (added after the versions table exists)
ALTER TABLE contract_documents
  ADD CONSTRAINT contract_documents_current_version_fkey
  FOREIGN KEY (current_version_id)
  REFERENCES contract_document_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contract_documents_user_idx
  ON contract_documents(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS contract_documents_project_idx
  ON contract_documents(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contract_document_versions_document_idx
  ON contract_document_versions(document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS contract_document_versions_user_idx
  ON contract_document_versions(user_id);

ALTER TABLE contract_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_document_versions ENABLE ROW LEVEL SECURITY;

-- contract_documents: owner manages; project members may read a linked document.
CREATE POLICY "Owners manage contract documents"
  ON contract_documents
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Project members view contract documents"
  ON contract_documents
  FOR SELECT
  TO authenticated
  USING (project_id IS NOT NULL AND public.can_access_project(project_id));

-- contract_document_versions: append-only. SELECT for owner or linked-project
-- members; INSERT only by the owning user. No UPDATE/DELETE policies => denied.
CREATE POLICY "Owners and project members view contract versions"
  ON contract_document_versions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM contract_documents d
      WHERE d.id = document_id
        AND d.project_id IS NOT NULL
        AND public.can_access_project(d.project_id)
    )
  );

CREATE POLICY "Owners insert contract versions"
  ON contract_document_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM contract_documents d
      WHERE d.id = document_id AND d.user_id = auth.uid()
    )
  );

-- updated_at maintenance on the mutable parent.
CREATE TRIGGER contract_documents_updated_at
  BEFORE UPDATE ON contract_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_field_tool_updated_at();

-- Defense-in-depth immutability: reject any UPDATE to a stored version. Whole-
-- document deletion still cascades (BEFORE DELETE is intentionally not guarded);
-- direct version DELETE by clients is already denied by the absent RLS policy.
CREATE OR REPLACE FUNCTION public.prevent_contract_version_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'contract_document_versions are immutable';
END;
$$;

CREATE TRIGGER contract_document_versions_immutable
  BEFORE UPDATE ON contract_document_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_contract_version_update();

-- Atomic save: create the document if needed, append the next immutable version,
-- and advance the document's latest-version pointer. Returns { document, version }.
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
  p_risk jsonb
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
      user_id, project_id, title, document_type, pack_key, status
    ) VALUES (
      v_uid,
      p_project_id,
      COALESCE(NULLIF(trim(p_title), ''), 'Untitled contract'),
      COALESCE(p_document_type, 'residential_contract'),
      p_pack_key,
      COALESCE(p_status, 'draft')
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
  uuid, text, uuid, text, text, text, text, text, jsonb, jsonb, jsonb, text, jsonb, jsonb
) TO authenticated;

COMMENT ON TABLE contract_documents IS
  'Contract & Document Engine: logical contract metadata, owned by user_id with an optional project_id link.';
COMMENT ON TABLE contract_document_versions IS
  'Append-only immutable snapshots (manifest + rendered sections + output hash) for each saved contract version.';
