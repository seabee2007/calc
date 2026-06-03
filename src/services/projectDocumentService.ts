import type {
  DocumentAssemblyResult,
  DocumentRiskScore,
  DocumentType,
} from '../features/documents/types';
import { assembleDocument, scoreDocumentRisk } from '../features/documents';
import { getPackCatalog } from '../features/documents/packs/registry';
import {
  buildSaveVersionPayload,
  restoreBuilderStateFromSnapshot,
  type SaveContractVersionMeta,
} from '../features/documents/ui/contractVersionState';
import { buildDocumentInput } from '../features/documents/ui/contractInput';
import type { ContractDocumentStatus } from '../features/documents/services/contractDocumentTypes';
import {
  deleteContractDocument,
  getContractDocument,
  listContractDocuments,
  saveContractVersion,
} from '../features/documents/services/contractDocumentService';
import type {
  ContractDocumentRow,
  ContractDocumentWithVersions,
  SavedContractVersionResult,
} from '../features/documents/services/contractDocumentTypes';
import type { CompanySettings } from './companySettingsService';
import type { Project } from '../types/index';
import {
  buildCompanySnapshot,
  buildProjectSnapshot,
  extractBuilderWorkflowStatus,
  extractDocumentNumber,
} from './projectDocumentSnapshots';
import {
  isChangeOrderBuilderDocument,
  isFarBuilderDocument,
  isRfiBuilderDocument,
  resolveEffectiveDocumentType,
} from './projectDocumentDisplay';

export type BuilderDocumentType =
  | 'residential_contract'
  | 'change_order'
  | 'rfi'
  | 'submittal'
  | 'daily_report'
  | 'qc_report'
  | 'warranty_letter'
  | 'punch_list'
  | 'far';

export type ProjectDocumentRow = ContractDocumentRow;

export interface ProjectDocumentDraftPayload {
  documentId: string | null;
  title: string;
  projectId: string | null;
  documentType: DocumentType | string;
  packKey: string;
  mode: string | null;
  assembly: DocumentAssemblyResult;
  risk: DocumentRiskScore;
  status?: ContractDocumentStatus;
  selectedProject: Project | null;
  companySettings: CompanySettings;
  renderedSnapshot?: Record<string, unknown>;
}

export type ProjectDocumentUpdatePayload = Partial<
  Omit<ProjectDocumentDraftPayload, 'assembly' | 'risk'>
> & {
  assembly?: DocumentAssemblyResult;
  risk?: DocumentRiskScore;
};

export function listProjectDocuments(projectId?: string | null): Promise<ProjectDocumentRow[]> {
  return listContractDocuments(projectId);
}

export async function listProjectDocumentsByType(
  projectId: string,
  documentType: string,
): Promise<ProjectDocumentRow[]> {
  const rows = await listContractDocuments(projectId);
  return rows.filter((r) => resolveEffectiveDocumentType(r) === documentType);
}

export async function listProjectChangeOrderBuilderDocuments(
  projectId: string,
): Promise<ProjectDocumentRow[]> {
  const rows = await listContractDocuments(projectId);
  return rows.filter(isChangeOrderBuilderDocument);
}

export async function listProjectRfiBuilderDocuments(
  projectId: string,
): Promise<ProjectDocumentRow[]> {
  const rows = await listContractDocuments(projectId);
  return rows.filter(isRfiBuilderDocument);
}

export async function listProjectFarBuilderDocuments(
  projectId: string,
): Promise<ProjectDocumentRow[]> {
  const rows = await listContractDocuments(projectId);
  return rows.filter(isFarBuilderDocument);
}

export function getProjectDocument(documentId: string): Promise<ContractDocumentWithVersions> {
  return getContractDocument(documentId);
}

function resolveTemplateKey(packKey: string): string | null {
  const catalog = getPackCatalog(packKey);
  const key = catalog?.template?.templateKey ?? catalog?.pack.templateKeys?.[0];
  return key ?? null;
}

/** Manual save: append immutable version + update parent metadata and snapshots. */
export async function saveProjectDocumentDraft(
  payload: ProjectDocumentDraftPayload,
): Promise<SavedContractVersionResult> {
  const answers = payload.assembly.manifest.inputSnapshot.answers ?? {};
  const documentNumber = extractDocumentNumber(payload.documentType, answers);
  const builderWorkflowStatus = extractBuilderWorkflowStatus(answers);
  const templateKey = resolveTemplateKey(payload.packKey);

  const meta: SaveContractVersionMeta & {
    documentNumber?: string | null;
    templateKey?: string | null;
    builderWorkflowStatus?: string | null;
    projectSnapshot?: Record<string, unknown>;
    companySnapshot?: Record<string, unknown>;
    renderedSnapshot?: Record<string, unknown>;
  } = {
    documentId: payload.documentId,
    title: payload.title,
    projectId: payload.projectId,
    status: payload.status ?? 'draft',
    documentNumber,
    templateKey,
    builderWorkflowStatus,
    projectSnapshot: buildProjectSnapshot(
      payload.selectedProject,
    ) as unknown as Record<string, unknown>,
    companySnapshot: buildCompanySnapshot(
      payload.companySettings,
    ) as unknown as Record<string, unknown>,
    renderedSnapshot: payload.renderedSnapshot ?? {},
  };

  const savePayload = buildSaveVersionPayload(payload.assembly, payload.risk, meta);
  savePayload.documentNumber = documentNumber;
  savePayload.templateKey = templateKey;
  savePayload.builderWorkflowStatus = builderWorkflowStatus;
  savePayload.projectSnapshot = meta.projectSnapshot;
  savePayload.companySnapshot = meta.companySnapshot;
  savePayload.renderedSnapshot = meta.renderedSnapshot;

  return saveContractVersion(savePayload);
}

/** Merge workflow answers from Planner review drawer; keeps contract_documents.status as draft/finalized/archived. */
export async function saveProjectDocumentWorkflowAnswers(
  documentId: string,
  partialAnswers: Record<string, unknown>,
  options: {
    companySettings: CompanySettings;
    selectedProject?: Project | null;
  },
): Promise<SavedContractVersionResult> {
  const { document, versions } = await getContractDocument(documentId);
  const current =
    versions.find((v) => v.id === document.current_version_id) ?? versions[0];
  if (!current) {
    throw new Error('Document has no saved version');
  }

  const state = restoreBuilderStateFromSnapshot(current.input_snapshot);
  const mergedAnswers = { ...state.answers, ...partialAnswers };
  const documentType = resolveEffectiveDocumentType(document);
  const packKey = document.pack_key;

  const input = buildDocumentInput(mergedAnswers, [...state.accepted], {
    packKey,
    mode: state.mode,
    documentType: documentType as DocumentType,
  });
  const assembly = assembleDocument(input);
  const risk = scoreDocumentRisk(input);

  return saveProjectDocumentDraft({
    documentId: document.id,
    title: document.title,
    projectId: document.project_id,
    documentType,
    packKey,
    mode: state.mode,
    assembly,
    risk,
    status: document.status,
    selectedProject: options.selectedProject ?? null,
    companySettings: options.companySettings,
    renderedSnapshot: document.rendered_snapshot ?? {},
  });
}

export async function updateProjectDocumentDraft(
  id: string,
  updates: ProjectDocumentUpdatePayload,
): Promise<SavedContractVersionResult> {
  if (!updates.assembly || !updates.risk) {
    throw new Error('updateProjectDocumentDraft requires assembly and risk');
  }
  const existing = await getContractDocument(id);
  return saveProjectDocumentDraft({
    documentId: id,
    title: updates.title ?? existing.document.title,
    projectId: updates.projectId ?? existing.document.project_id,
    documentType: updates.documentType ?? existing.document.document_type,
    packKey: updates.packKey ?? existing.document.pack_key,
    mode: updates.mode ?? null,
    assembly: updates.assembly,
    risk: updates.risk,
    status: updates.status ?? existing.document.status,
    selectedProject: updates.selectedProject ?? null,
    companySettings: updates.companySettings as CompanySettings,
    renderedSnapshot: updates.renderedSnapshot,
  });
}

export function deleteProjectDocument(id: string): Promise<void> {
  return deleteContractDocument(id);
}

export const BUILDER_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  residential_contract: 'Residential Contract',
  change_order: 'Change Order',
  rfi: 'RFI',
  submittal: 'Submittal',
  daily_report: 'Daily Report',
  qc_report: 'QC Report',
  warranty_letter: 'Warranty / Closeout Letter',
  punch_list: 'Punch List',
  far: 'FAR',
};

export function formatProjectDocumentTypeLabel(documentType: string): string {
  return BUILDER_DOCUMENT_TYPE_LABELS[documentType] ?? documentType.replace(/_/g, ' ');
}
