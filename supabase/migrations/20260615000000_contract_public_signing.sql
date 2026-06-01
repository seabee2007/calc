/*
  Contract & Document Engine - Phase 6.2: public client view + e-signature

  Adds a shareable public token and a signing workflow to contract_documents.
  Both parties sign: the contractor counter-signs in the builder (authenticated,
  owner RLS) before sending; the client signs on the public page via the
  SECURITY DEFINER RPCs below (no auth required, token-scoped).

  A specific immutable version (`sent_version_id`) is frozen at send time so the
  client always sees exactly what they signed, even if the contractor later saves
  new draft versions.
*/

ALTER TABLE contract_documents
  ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS sent_version_id uuid REFERENCES contract_document_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signing_status text NOT NULL DEFAULT 'draft'
    CHECK (signing_status IN ('draft', 'sent', 'viewed', 'signed', 'declined', 'void')),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_signer_name text,
  ADD COLUMN IF NOT EXISTS client_signature text,
  ADD COLUMN IF NOT EXISTS client_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS contractor_signer_name text,
  ADD COLUMN IF NOT EXISTS contractor_signature text,
  ADD COLUMN IF NOT EXISTS contractor_signed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS contract_documents_public_token_idx
  ON contract_documents(public_token);
CREATE INDEX IF NOT EXISTS contract_documents_project_signing_idx
  ON contract_documents(project_id, signing_status) WHERE project_id IS NOT NULL;

-- Public token read: returns a safe document view + the frozen sent version.
CREATE OR REPLACE FUNCTION public.get_contract_by_public_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  d contract_documents;
  v contract_document_versions;
BEGIN
  SELECT * INTO d FROM contract_documents
  WHERE public_token = p_token
    AND signing_status NOT IN ('draft', 'void')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v FROM contract_document_versions
  WHERE id = d.sent_version_id;

  RETURN jsonb_build_object(
    'document', jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'document_type', d.document_type,
      'pack_key', d.pack_key,
      'signing_status', d.signing_status,
      'sent_at', d.sent_at,
      'viewed_at', d.viewed_at,
      'signed_at', d.signed_at,
      'declined_at', d.declined_at,
      'client_signer_name', d.client_signer_name,
      'client_signature', d.client_signature,
      'client_signed_at', d.client_signed_at,
      'contractor_signer_name', d.contractor_signer_name,
      'contractor_signature', d.contractor_signature,
      'contractor_signed_at', d.contractor_signed_at
    ),
    'version', CASE WHEN v.id IS NULL THEN NULL ELSE jsonb_build_object(
      'version_number', v.version_number,
      'engine_version', v.engine_version,
      'pack_version', v.pack_version,
      'output_hash', v.output_hash,
      'sections', v.sections,
      'manifest', v.manifest
    ) END
  );
END;
$$;

-- Public client actions: view / sign / decline, token-scoped.
CREATE OR REPLACE FUNCTION public.record_contract_client_action(
  p_token uuid,
  p_action text,
  p_signer_name text DEFAULT NULL,
  p_signature text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d contract_documents;
  now_ts timestamptz := now();
BEGIN
  SELECT * INTO d FROM contract_documents WHERE public_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contract_not_found';
  END IF;

  IF d.signing_status IN ('draft', 'void') THEN
    RAISE EXCEPTION 'contract_not_available';
  END IF;

  IF p_action = 'viewed' THEN
    UPDATE contract_documents
    SET signing_status = CASE WHEN signing_status = 'sent' THEN 'viewed' ELSE signing_status END,
        viewed_at = COALESCE(viewed_at, now_ts),
        updated_at = now_ts
    WHERE id = d.id;
  ELSIF p_action = 'signed' AND d.signing_status NOT IN ('signed', 'declined') THEN
    IF p_signer_name IS NULL OR length(trim(p_signer_name)) = 0
       OR p_signature IS NULL OR length(trim(p_signature)) = 0 THEN
      RAISE EXCEPTION 'signature_required';
    END IF;
    UPDATE contract_documents
    SET signing_status = 'signed',
        client_signer_name = p_signer_name,
        client_signature = p_signature,
        client_signed_at = now_ts,
        signed_at = now_ts,
        viewed_at = COALESCE(viewed_at, now_ts),
        updated_at = now_ts
    WHERE id = d.id;
  ELSIF p_action = 'declined' AND d.signing_status NOT IN ('signed', 'declined') THEN
    UPDATE contract_documents
    SET signing_status = 'declined',
        declined_at = now_ts,
        updated_at = now_ts
    WHERE id = d.id;
  END IF;

  RETURN public.get_contract_by_public_token(p_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_contract_by_public_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_contract_client_action(uuid, text, text, text) TO anon, authenticated;
