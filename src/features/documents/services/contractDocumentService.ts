import { supabase } from '../../../lib/supabase';
import type { SaveContractVersionPayload } from '../ui/contractVersionState';
import type {
  ContractDocumentRow,
  ContractDocumentVersionRow,
  ContractDocumentWithVersions,
  PublicContractData,
  SavedContractVersionResult,
} from './contractDocumentTypes';

/**
 * Persistence service for saved contracts (Phase 6.1). Reads are RLS-scoped to
 * the current user (and project members for linked documents); writes go through
 * the `save_contract_version` SECURITY DEFINER RPC so the document row and its
 * immutable version are created atomically.
 */

/** List the current user's saved contracts, optionally filtered to a project. */
export async function listContractDocuments(
  projectId?: string | null,
): Promise<ContractDocumentRow[]> {
  let query = supabase
    .from('contract_documents')
    .select('*')
    .order('updated_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ContractDocumentRow[];
}

/** Load a single contract with its full (ordered) version history. */
export async function getContractDocument(
  documentId: string,
): Promise<ContractDocumentWithVersions> {
  const [{ data: document, error: docError }, { data: versions, error: verError }] =
    await Promise.all([
      supabase.from('contract_documents').select('*').eq('id', documentId).single(),
      supabase
        .from('contract_document_versions')
        .select('*')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false }),
    ]);

  if (docError) throw new Error(docError.message);
  if (verError) throw new Error(verError.message);

  return {
    document: document as ContractDocumentRow,
    versions: (versions ?? []) as ContractDocumentVersionRow[],
  };
}

/** Load a single stored version (immutable snapshot). */
export async function getContractVersion(
  versionId: string,
): Promise<ContractDocumentVersionRow> {
  const { data, error } = await supabase
    .from('contract_document_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (error) throw new Error(error.message);
  return data as ContractDocumentVersionRow;
}

/** Append a new immutable version (creating the document on first save). */
export async function saveContractVersion(
  payload: SaveContractVersionPayload,
): Promise<SavedContractVersionResult> {
  const { data, error } = await supabase.rpc('save_contract_version', {
    p_document_id: payload.documentId,
    p_title: payload.title,
    p_project_id: payload.projectId,
    p_document_type: payload.documentType,
    p_pack_key: payload.packKey,
    p_pack_version: payload.packVersion,
    p_mode: payload.mode,
    p_status: payload.status,
    p_input_snapshot: payload.inputSnapshot,
    p_manifest: payload.manifest,
    p_sections: payload.sections,
    p_output_hash: payload.outputHash,
    p_recommendation_decisions: payload.recommendationDecisions,
    p_risk: payload.risk,
    p_document_number: payload.documentNumber ?? null,
    p_template_key: payload.templateKey ?? null,
    p_builder_workflow_status: payload.builderWorkflowStatus ?? null,
    p_project_snapshot: payload.projectSnapshot ?? {},
    p_company_snapshot: payload.companySnapshot ?? {},
    p_rendered_snapshot: payload.renderedSnapshot ?? {},
  });

  if (error) throw new Error(error.message);
  return data as unknown as SavedContractVersionResult;
}

/** Delete a saved document and all versions (owner only via RLS). */
export async function deleteContractDocument(documentId: string): Promise<void> {
  const { error } = await supabase.from('contract_documents').delete().eq('id', documentId);
  if (error) throw new Error(error.message);
}

/* -------------------------------------------------------------------------- */
/* Public signing (Phase 6.2)                                                 */
/* -------------------------------------------------------------------------- */

/** Shareable public URL for the client signing page. */
export function getPublicContractUrl(token: string): string {
  return `${window.location.origin}/contract/${token}`;
}

export interface SendContractForSignatureInput {
  documentId: string;
  contractorName?: string;
  contractorSignature?: string;
  /** Optional ISO timestamp; defaults to 90 days from send on the server. */
  tokenExpiresAt?: string;
}

/**
 * Freezes the document's current version as the `sent_version_id`, flips it to
 * `sent`, and optionally records the contractor's counter-signature. Uses the
 * `send_contract_for_signature` SECURITY DEFINER RPC (Phase A token hardening).
 */
export async function sendContractForSignature(
  input: SendContractForSignatureInput,
): Promise<ContractDocumentRow> {
  const { data, error } = await supabase.rpc('send_contract_for_signature', {
    p_document_id: input.documentId,
    p_contractor_name: input.contractorName?.trim() || null,
    p_contractor_signature: input.contractorSignature?.trim() || null,
    p_token_expires_at: input.tokenExpiresAt ?? null,
  });

  if (error) throw new Error(error.message);
  return data as ContractDocumentRow;
}

/** Revoke an active public signing token (voids sent/viewed contracts). */
export async function revokeContractPublicToken(documentId: string): Promise<ContractDocumentRow> {
  const { data, error } = await supabase.rpc('revoke_contract_public_token', {
    p_document_id: documentId,
  });

  if (error) throw new Error(error.message);
  return data as ContractDocumentRow;
}

/** Fetch the public, token-scoped contract view (anon-capable RPC). */
export async function fetchContractByPublicToken(
  token: string,
): Promise<PublicContractData | null> {
  const { data, error } = await supabase.rpc('get_contract_by_public_token', {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return (data as PublicContractData | null) ?? null;
}

async function recordContractClientAction(
  token: string,
  action: 'viewed' | 'signed' | 'declined',
  signerName?: string,
  signature?: string,
): Promise<PublicContractData | null> {
  const { data, error } = await supabase.rpc('record_contract_client_action', {
    p_token: token,
    p_action: action,
    p_signer_name: signerName ?? null,
    p_signature: signature ?? null,
  });
  if (error) throw new Error(error.message);
  return (data as PublicContractData | null) ?? null;
}

export function markContractViewed(token: string): Promise<PublicContractData | null> {
  return recordContractClientAction(token, 'viewed');
}

export function signContract(
  token: string,
  signerName: string,
  signature: string,
): Promise<PublicContractData | null> {
  return recordContractClientAction(token, 'signed', signerName, signature);
}

export function declineContract(token: string): Promise<PublicContractData | null> {
  return recordContractClientAction(token, 'declined');
}
