import type {
  DocumentAssemblyResult,
  DocumentInputSnapshot,
  DocumentManifest,
  DocumentRecommendationDecision,
  DocumentRiskScore,
  DocumentSection,
  QuestionnaireMode,
} from '../index';
import type { ContractAnswers } from './contractInput';
import type { ContractDocumentStatus } from '../services/contractDocumentTypes';

/**
 * Pure (DB-free) mapping helpers between the in-memory engine result and the
 * persisted contract-version payload. Kept out of the service so they can be
 * unit tested without Supabase, and out of `engine/` so the engine stays pure.
 */

const QUESTIONNAIRE_MODES: QuestionnaireMode[] = ['quick', 'standard', 'advanced'];

export interface SaveContractVersionPayload {
  documentId: string | null;
  title: string;
  projectId: string | null;
  documentType: string;
  packKey: string;
  packVersion: string;
  mode: string | null;
  status: ContractDocumentStatus;
  inputSnapshot: DocumentInputSnapshot;
  manifest: DocumentManifest;
  sections: DocumentSection[];
  outputHash: string;
  recommendationDecisions: DocumentRecommendationDecision[];
  risk: DocumentRiskScore;
}

export interface SaveContractVersionMeta {
  documentId?: string | null;
  title: string;
  projectId?: string | null;
  status?: ContractDocumentStatus;
}

/** Builds the persistence payload from an assembled document + risk score. */
export function buildSaveVersionPayload(
  assembly: DocumentAssemblyResult,
  risk: DocumentRiskScore,
  meta: SaveContractVersionMeta,
): SaveContractVersionPayload {
  const manifest = assembly.manifest;
  return {
    documentId: meta.documentId ?? null,
    title: meta.title,
    projectId: meta.projectId ?? null,
    documentType: manifest.documentType,
    packKey: manifest.packKey,
    packVersion: manifest.packVersion,
    mode: manifest.mode ?? null,
    status: meta.status ?? 'draft',
    inputSnapshot: manifest.inputSnapshot,
    manifest,
    sections: assembly.sections,
    outputHash: manifest.outputHash,
    recommendationDecisions: manifest.recommendationDecisions,
    risk,
  };
}

export interface RestoredBuilderState {
  packKey: string;
  mode: QuestionnaireMode;
  answers: ContractAnswers;
  accepted: string[];
}

/**
 * Reconstructs builder UI state from a stored input snapshot. The snapshot
 * already carries everything needed: flat answers plus `facts.mode` and
 * `facts.acceptedAddendumKeys` (written by `buildDocumentInput`).
 */
export function restoreBuilderStateFromSnapshot(
  snapshot: DocumentInputSnapshot,
): RestoredBuilderState {
  const facts = (snapshot.facts ?? {}) as Record<string, unknown>;

  const acceptedRaw = facts.acceptedAddendumKeys;
  const accepted = Array.isArray(acceptedRaw)
    ? acceptedRaw.filter((item): item is string => typeof item === 'string')
    : [];

  const mode = QUESTIONNAIRE_MODES.includes(facts.mode as QuestionnaireMode)
    ? (facts.mode as QuestionnaireMode)
    : 'standard';

  return {
    packKey: snapshot.packKey,
    mode,
    answers: (snapshot.answers ?? {}) as ContractAnswers,
    accepted,
  };
}
