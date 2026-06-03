import type { ContractDocumentRow } from '../features/documents/services/contractDocumentTypes';
import type { ProjectDocumentRow } from './projectDocumentService';

export const RFI_WORKFLOW_STATUSES = [
  'Draft',
  'Submitted',
  'Under Review',
  'Answered',
  'Closed',
  'Void',
] as const;

export const FAR_WORKFLOW_STATUSES = [
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Closed',
  'Void',
] as const;

export type RfiWorkflowStatus = (typeof RFI_WORKFLOW_STATUSES)[number];
export type FarWorkflowStatus = (typeof FAR_WORKFLOW_STATUSES)[number];

export type RfiBuilderListSection = 'drafts' | 'open' | 'closed';
export type FarBuilderListSection = 'open' | 'closed';

const STATUS_LABEL_MAP: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  answered: 'Answered',
  approved: 'Approved',
  rejected: 'Rejected',
  closed: 'Closed',
  void: 'Void',
  finalized: 'Finalized',
  archived: 'Archived',
};

const RFI_OPEN_STATUSES = new Set<RfiWorkflowStatus>(['Submitted', 'Under Review', 'Answered']);
const RFI_CLOSED_STATUSES = new Set<RfiWorkflowStatus>(['Closed', 'Void']);
const FAR_OPEN_STATUSES = new Set<FarWorkflowStatus>([
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
]);
const FAR_CLOSED_STATUSES = new Set<FarWorkflowStatus>(['Closed', 'Void']);

/** Normalize stored workflow value to display label. */
export function formatWorkflowStatusLabel(raw: string | null | undefined): string {
  if (!raw?.trim()) return 'Draft';
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase().replace(/\s+/g, '_');
  if (STATUS_LABEL_MAP[lower]) return STATUS_LABEL_MAP[lower];
  return trimmed;
}

/** Alias for formatWorkflowStatusLabel — single canonical workflow label. */
export function normalizeBuilderWorkflowStatus(raw: string | null | undefined): string {
  return formatWorkflowStatusLabel(raw);
}

export function normalizeWorkflowStatusForSave(label: string): string {
  return formatWorkflowStatusLabel(label);
}

/** Display workflow status for builder documents (not contract_documents.status enum). */
export function resolveBuilderWorkflowStatusDisplay(
  doc: Pick<ContractDocumentRow, 'builder_workflow_status' | 'status'>,
  answersStatus?: string | null,
): string {
  if (doc.builder_workflow_status?.trim()) {
    return formatWorkflowStatusLabel(doc.builder_workflow_status);
  }
  if (answersStatus?.trim()) {
    return formatWorkflowStatusLabel(answersStatus);
  }
  if (doc.status === 'finalized') return 'Finalized';
  if (doc.status === 'archived') return 'Archived';
  return 'Draft';
}

/** Resolve workflow status from a list row (builder_workflow_status → contract status fallback). */
export function resolveBuilderWorkflowStatusFromDoc(
  doc: Pick<ProjectDocumentRow, 'builder_workflow_status' | 'status'>,
): string {
  return resolveBuilderWorkflowStatusDisplay(doc);
}

export function workflowStatusesForKind(kind: 'rfi' | 'far'): readonly string[] {
  return kind === 'rfi' ? RFI_WORKFLOW_STATUSES : FAR_WORKFLOW_STATUSES;
}

export function isRfiBuilderWorkflowDraft(status: string): boolean {
  return normalizeBuilderWorkflowStatus(status) === 'Draft';
}

export function isRfiBuilderWorkflowOpen(status: string): boolean {
  return RFI_OPEN_STATUSES.has(normalizeBuilderWorkflowStatus(status) as RfiWorkflowStatus);
}

export function isRfiBuilderWorkflowClosed(status: string): boolean {
  return RFI_CLOSED_STATUSES.has(normalizeBuilderWorkflowStatus(status) as RfiWorkflowStatus);
}

export function partitionRfiBuilderDocument(
  doc: Pick<ProjectDocumentRow, 'builder_workflow_status' | 'status'>,
): RfiBuilderListSection {
  const status = resolveBuilderWorkflowStatusFromDoc(doc);
  if (isRfiBuilderWorkflowClosed(status)) return 'closed';
  if (isRfiBuilderWorkflowOpen(status)) return 'open';
  return 'drafts';
}

export function isFarBuilderWorkflowOpen(status: string): boolean {
  return FAR_OPEN_STATUSES.has(normalizeBuilderWorkflowStatus(status) as FarWorkflowStatus);
}

export function isFarBuilderWorkflowClosed(status: string): boolean {
  return FAR_CLOSED_STATUSES.has(normalizeBuilderWorkflowStatus(status) as FarWorkflowStatus);
}

export function partitionFarBuilderDocument(
  doc: Pick<ProjectDocumentRow, 'builder_workflow_status' | 'status'>,
): FarBuilderListSection {
  const status = resolveBuilderWorkflowStatusFromDoc(doc);
  return isFarBuilderWorkflowClosed(status) ? 'closed' : 'open';
}

export function partitionRfiBuilderDocuments(
  docs: ProjectDocumentRow[],
): Record<RfiBuilderListSection, ProjectDocumentRow[]> {
  const result: Record<RfiBuilderListSection, ProjectDocumentRow[]> = {
    drafts: [],
    open: [],
    closed: [],
  };
  for (const doc of docs) {
    result[partitionRfiBuilderDocument(doc)].push(doc);
  }
  return result;
}

export function partitionFarBuilderDocuments(
  docs: ProjectDocumentRow[],
): Record<FarBuilderListSection, ProjectDocumentRow[]> {
  const result: Record<FarBuilderListSection, ProjectDocumentRow[]> = {
    open: [],
    closed: [],
  };
  for (const doc of docs) {
    result[partitionFarBuilderDocument(doc)].push(doc);
  }
  return result;
}
