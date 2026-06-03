import { formatTabLabel } from '../../../utils/formatTabLabel';

/** Document/file categories shown on Planner → Documents (not workflow tabs). */
export const DOCUMENTS_TAB_IDS = [
  'contracts',
  'submittals',
  'daily-reports',
  'qc-reports',
  'safety-meetings',
  'punch-lists',
  'closeout',
] as const;

export type DocumentsTabId = (typeof DOCUMENTS_TAB_IDS)[number];

export const DEFAULT_DOCUMENTS_TAB: DocumentsTabId = 'contracts';

const TAB_LABELS: Record<DocumentsTabId, string> = {
  contracts: 'Contracts',
  submittals: 'Submittals',
  'daily-reports': 'Daily Reports',
  'qc-reports': 'QC Reports',
  'safety-meetings': 'Safety Meetings',
  'punch-lists': 'Punch Lists',
  closeout: 'Closeout',
};

export function isDocumentsTabId(value: string): value is DocumentsTabId {
  return (DOCUMENTS_TAB_IDS as readonly string[]).includes(value);
}

export function parseDocumentsTab(raw: string | null): DocumentsTabId {
  if (raw && isDocumentsTabId(raw)) return raw;
  return DEFAULT_DOCUMENTS_TAB;
}

export function documentsTabLabel(id: DocumentsTabId, count?: number): string {
  return formatTabLabel(TAB_LABELS[id], count);
}

/** Map highlight query keys on the Documents page to a document-category tab. */
export function documentsTabFromHighlightParams(params: {
  contract?: string | null;
  safety?: string | null;
  inspection?: string | null;
}): DocumentsTabId | null {
  if (params.contract) return 'contracts';
  if (params.safety) return 'safety-meetings';
  if (params.inspection) return 'qc-reports';
  return null;
}
