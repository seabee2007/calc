/*
  Contract & Document Engine - Phase A: public token hardening

  Adds expiry, revocation, and append-only audit events for public signing tokens.
  Replaces direct owner UPDATE for send-for-signature with a SECURITY DEFINER RPC
  that enforces invariants and records audit metadata.
*/

ALTER TABLE contract_documents
  ADD COLUMN IF NOT EXISTS public_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_token_revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS contract_documents_public_token_validity_idx
  ON contract_documents(public_token)
  WHERE public_token_revoked_at IS NULL
    AND signing_status NOT IN ('draft', 'void');

-- Append-only audit trail for token lifecycle and signing events.
CREATE TABLE IF NOT EXISTS contract_signing_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES contract_documents(id) ON DELETE CASCADE,
  public_token uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'sent',
    'viewed',
    'signed',
    'declined',
    'revoked',
    'token_expired'
  )),
  actor_type text NOT NULL CHECK (actor_type IN ('owner', 'client', 'system')),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_signing_audit_document_idx
  ON contract_signing_audit_events(document_id, created_at DESC);

ALTER TABLE contract_signing_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY contract_signing_audit_owner_read ON contract_signing_audit_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contract_documents d
      WHERE d.id = contract_signing_audit_events.document_id
        AND d.user_id = auth.uid()
    )
  );

-- Returns true when the public token is usable for client-facing actions.
CREATE OR REPLACE FUNCTION public.is_public_contract_token_valid(d contract_documents)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    d.signing_status NOT IN ('draft', 'void')
    AND d.public_token_revoked_at IS NULL
    AND (d.public_token_expires_at IS NULL OR d.public_token_expires_at > now());
$$;

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
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT public.is_public_contract_token_valid(d) THEN
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
      'contractor_signed_at', d.contractor_signed_at,
      'public_token_expires_at', d.public_token_expires_at,
      'public_token_revoked_at', d.public_token_revoked_at
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

  IF NOT public.is_public_contract_token_valid(d) THEN
    RAISE EXCEPTION 'contract_not_available';
  END IF;

  IF p_action = 'viewed' THEN
    UPDATE contract_documents
    SET signing_status = CASE WHEN signing_status = 'sent' THEN 'viewed' ELSE signing_status END,
        viewed_at = COALESCE(viewed_at, now_ts),
        updated_at = now_ts
    WHERE id = d.id;

    INSERT INTO contract_signing_audit_events (document_id, public_token, event_type, actor_type, metadata)
    VALUES (d.id, d.public_token, 'viewed', 'client', jsonb_build_object('action', p_action));
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

    INSERT INTO contract_signing_audit_events (document_id, public_token, event_type, actor_type, metadata)
    VALUES (
      d.id,
      d.public_token,
      'signed',
      'client',
      jsonb_build_object('signer_name', p_signer_name)
    );
  ELSIF p_action = 'declined' AND d.signing_status NOT IN ('signed', 'declined') THEN
    UPDATE contract_documents
    SET signing_status = 'declined',
        declined_at = now_ts,
        updated_at = now_ts
    WHERE id = d.id;

    INSERT INTO contract_signing_audit_events (document_id, public_token, event_type, actor_type, metadata)
    VALUES (d.id, d.public_token, 'declined', 'client', jsonb_build_object('action', p_action));
  END IF;

  RETURN public.get_contract_by_public_token(p_token);
END;
$$;

-- Owner RPC: send for signature with invariants + default 90-day token expiry.
CREATE OR REPLACE FUNCTION public.send_contract_for_signature(
  p_document_id uuid,
  p_contractor_name text DEFAULT NULL,
  p_contractor_signature text DEFAULT NULL,
  p_token_expires_at timestamptz DEFAULT NULL
)
RETURNS contract_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d contract_documents;
  now_ts timestamptz := now();
  expires_at timestamptz;
BEGIN
  SELECT * INTO d FROM contract_documents
  WHERE id = p_document_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contract_not_found';
  END IF;

  IF d.current_version_id IS NULL THEN
    RAISE EXCEPTION 'no_saved_version';
  END IF;

  IF d.signing_status IN ('signed', 'declined') THEN
    RAISE EXCEPTION 'contract_already_finalized';
  END IF;

  expires_at := COALESCE(p_token_expires_at, now_ts + interval '90 days');

  UPDATE contract_documents
  SET signing_status = 'sent',
      sent_version_id = d.current_version_id,
      sent_at = now_ts,
      public_token_expires_at = expires_at,
      public_token_revoked_at = NULL,
      contractor_signer_name = CASE
        WHEN p_contractor_name IS NOT NULL AND length(trim(p_contractor_name)) > 0
             AND p_contractor_signature IS NOT NULL AND length(trim(p_contractor_signature)) > 0
        THEN trim(p_contractor_name)
        ELSE contractor_signer_name
      END,
      contractor_signature = CASE
        WHEN p_contractor_name IS NOT NULL AND length(trim(p_contractor_name)) > 0
             AND p_contractor_signature IS NOT NULL AND length(trim(p_contractor_signature)) > 0
        THEN trim(p_contractor_signature)
        ELSE contractor_signature
      END,
      contractor_signed_at = CASE
        WHEN p_contractor_name IS NOT NULL AND length(trim(p_contractor_name)) > 0
             AND p_contractor_signature IS NOT NULL AND length(trim(p_contractor_signature)) > 0
        THEN now_ts
        ELSE contractor_signed_at
      END,
      updated_at = now_ts
  WHERE id = d.id
  RETURNING * INTO d;

  INSERT INTO contract_signing_audit_events (
    document_id,
    public_token,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  VALUES (
    d.id,
    d.public_token,
    'sent',
    'owner',
    auth.uid(),
    jsonb_build_object(
      'sent_version_id', d.sent_version_id,
      'expires_at', expires_at
    )
  );

  RETURN d;
END;
$$;

-- Owner RPC: revoke an active public token.
CREATE OR REPLACE FUNCTION public.revoke_contract_public_token(p_document_id uuid)
RETURNS contract_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d contract_documents;
  now_ts timestamptz := now();
BEGIN
  SELECT * INTO d FROM contract_documents
  WHERE id = p_document_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contract_not_found';
  END IF;

  UPDATE contract_documents
  SET public_token_revoked_at = now_ts,
      signing_status = CASE
        WHEN signing_status IN ('sent', 'viewed') THEN 'void'
        ELSE signing_status
      END,
      updated_at = now_ts
  WHERE id = d.id
  RETURNING * INTO d;

  INSERT INTO contract_signing_audit_events (
    document_id,
    public_token,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  VALUES (d.id, d.public_token, 'revoked', 'owner', auth.uid(), '{}'::jsonb);

  RETURN d;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_contract_for_signature(uuid, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_contract_public_token(uuid) TO authenticated;
