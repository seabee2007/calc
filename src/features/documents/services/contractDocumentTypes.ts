import type {
  DocumentInputSnapshot,
  DocumentManifest,
  DocumentRecommendationDecision,
  DocumentRiskScore,
  DocumentSection,
} from '../index';

export type ContractDocumentStatus = 'draft' | 'finalized' | 'archived';

export type ContractSigningStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'declined'
  | 'void';

/** Row shape of the `contract_documents` table. */
export interface ContractDocumentRow {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  document_type: string;
  pack_key: string;
  status: ContractDocumentStatus;
  current_version_id: string | null;
  latest_version_number: number;
  created_at: string;
  updated_at: string;
  // Public signing (Phase 6.2) — present after migration 20260615000000.
  public_token?: string;
  sent_version_id?: string | null;
  signing_status?: ContractSigningStatus;
  sent_at?: string | null;
  viewed_at?: string | null;
  signed_at?: string | null;
  declined_at?: string | null;
  client_signer_name?: string | null;
  client_signature?: string | null;
  client_signed_at?: string | null;
  contractor_signer_name?: string | null;
  contractor_signature?: string | null;
  contractor_signed_at?: string | null;
  public_token_expires_at?: string | null;
  public_token_revoked_at?: string | null;
}

/** Safe public document view returned by `get_contract_by_public_token`. */
export interface PublicContractDocument {
  id: string;
  title: string;
  document_type: string;
  pack_key: string;
  signing_status: ContractSigningStatus;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  client_signer_name: string | null;
  client_signature: string | null;
  client_signed_at: string | null;
  contractor_signer_name: string | null;
  contractor_signature: string | null;
  contractor_signed_at: string | null;
  public_token_expires_at: string | null;
  public_token_revoked_at: string | null;
}

export interface PublicContractVersion {
  version_number: number;
  engine_version: string;
  pack_version: string;
  output_hash: string;
  sections: DocumentSection[];
  manifest: DocumentManifest;
}

export interface PublicContractData {
  document: PublicContractDocument;
  version: PublicContractVersion | null;
}

/** Row shape of the append-only `contract_document_versions` table. */
export interface ContractDocumentVersionRow {
  id: string;
  document_id: string;
  user_id: string;
  version_number: number;
  engine_version: string;
  pack_key: string;
  pack_version: string;
  mode: string | null;
  input_snapshot: DocumentInputSnapshot;
  manifest: DocumentManifest;
  sections: DocumentSection[];
  output_hash: string;
  recommendation_decisions: DocumentRecommendationDecision[];
  risk: DocumentRiskScore;
  created_at: string;
}

export interface ContractDocumentWithVersions {
  document: ContractDocumentRow;
  versions: ContractDocumentVersionRow[];
}

export interface SavedContractVersionResult {
  document: ContractDocumentRow;
  version: ContractDocumentVersionRow;
}
