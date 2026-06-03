import type { ProjectDocumentRow } from './projectDocumentService';

export type ProjectDocumentPlannerGroup =
  | 'Change Orders'
  | 'RFIs'
  | 'FARs'
  | 'Contracts'
  | 'Submittals'
  | 'Daily Reports'
  | 'QC Reports'
  | 'Closeout / Warranty'
  | 'Other Documents';

export interface ProjectDocumentDisplayMeta {
  label: string;
  group: ProjectDocumentPlannerGroup;
  /** Shown after "Document Builder draft ·" */
  subtitleLabel: string;
}

const PACK_TO_TYPE: Record<string, string> = {
  GENERIC_CHANGE_ORDER: 'change_order',
  GENERIC_RFI: 'rfi',
  GENERIC_SUBMITTAL: 'submittal',
  GENERIC_DAILY_REPORT: 'daily_report',
  GENERIC_RESIDENTIAL: 'residential_contract',
};

const CONTRACT_TYPES = new Set([
  'residential_contract',
  'contract',
  'remodel_contract',
  'commercial_contract',
]);

const QC_TYPES = new Set(['qc_report', 'qc_inspection', 'inspection_report']);

const CLOSEOUT_TYPES = new Set(['warranty_letter', 'closeout', 'closeout_package', 'closeout_document']);

/** Resolve effective document type from row (pack_key wins when type is missing or mismatched). */
export function resolveEffectiveDocumentType(doc: Pick<ProjectDocumentRow, 'document_type' | 'pack_key'>): string {
  const fromPack = PACK_TO_TYPE[doc.pack_key];
  if (fromPack) return fromPack;
  return doc.document_type?.trim() || 'residential_contract';
}

export function getProjectDocumentDisplayMeta(
  doc: Pick<ProjectDocumentRow, 'document_type' | 'pack_key'>,
): ProjectDocumentDisplayMeta {
  const effectiveType = resolveEffectiveDocumentType(doc);

  switch (effectiveType) {
    case 'daily_report':
      return {
        label: 'Daily Report',
        group: 'Daily Reports',
        subtitleLabel: 'Daily Report',
      };
    case 'submittal':
      return {
        label: 'Submittal Cover Sheet',
        group: 'Submittals',
        subtitleLabel: 'Submittal Cover Sheet',
      };
    case 'change_order':
      return {
        label: 'Change Order Document',
        group: 'Change Orders',
        subtitleLabel: 'Change Order Document',
      };
    case 'rfi':
      return {
        label: 'RFI Document',
        group: 'RFIs',
        subtitleLabel: 'RFI Document',
      };
    case 'far':
    case 'work_authorization':
      return {
        label: 'FAR Document',
        group: 'FARs',
        subtitleLabel: 'FAR Document',
      };
    default:
      if (CONTRACT_TYPES.has(effectiveType)) {
        return {
          label: 'Residential Contract',
          group: 'Contracts',
          subtitleLabel: 'Residential Contract',
        };
      }
      if (QC_TYPES.has(effectiveType)) {
        return {
          label: 'QC Report',
          group: 'QC Reports',
          subtitleLabel: 'QC Report',
        };
      }
      if (CLOSEOUT_TYPES.has(effectiveType)) {
        return {
          label: 'Closeout Document',
          group: 'Closeout / Warranty',
          subtitleLabel: 'Closeout Document',
        };
      }
      return {
        label: effectiveType.replace(/_/g, ' '),
        group: 'Other Documents',
        subtitleLabel: effectiveType.replace(/_/g, ' '),
      };
  }
}

export function isChangeOrderBuilderDocument(
  doc: Pick<ProjectDocumentRow, 'document_type' | 'pack_key'>,
): boolean {
  const effective = resolveEffectiveDocumentType(doc);
  if (effective === 'change_order') return true;
  if (doc.pack_key === 'GENERIC_CHANGE_ORDER') return true;
  return false;
}

export function isRfiBuilderDocument(doc: Pick<ProjectDocumentRow, 'document_type' | 'pack_key'>): boolean {
  const effective = resolveEffectiveDocumentType(doc);
  return effective === 'rfi' || doc.pack_key === 'GENERIC_RFI';
}

export function isFarBuilderDocument(doc: Pick<ProjectDocumentRow, 'document_type' | 'pack_key'>): boolean {
  const effective = resolveEffectiveDocumentType(doc);
  return effective === 'far' || effective === 'work_authorization';
}

/** Documents shown on Planner Documents / Files tab (not CO / RFI / FAR workflow tabs). */
export function isDocumentsTabBuilderDocument(
  doc: Pick<ProjectDocumentRow, 'document_type' | 'pack_key'>,
): boolean {
  if (isChangeOrderBuilderDocument(doc)) return false;
  if (isRfiBuilderDocument(doc)) return false;
  if (isFarBuilderDocument(doc)) return false;
  return true;
}

export function filterDocumentsTabBuilderDocuments(docs: ProjectDocumentRow[]): {
  contracts: ProjectDocumentRow[];
  submittals: ProjectDocumentRow[];
  dailyReports: ProjectDocumentRow[];
  qcReports: ProjectDocumentRow[];
  closeout: ProjectDocumentRow[];
  other: ProjectDocumentRow[];
} {
  const contracts: ProjectDocumentRow[] = [];
  const submittals: ProjectDocumentRow[] = [];
  const dailyReports: ProjectDocumentRow[] = [];
  const qcReports: ProjectDocumentRow[] = [];
  const closeout: ProjectDocumentRow[] = [];
  const other: ProjectDocumentRow[] = [];

  for (const doc of docs) {
    if (!isDocumentsTabBuilderDocument(doc)) continue;
    const { group } = getProjectDocumentDisplayMeta(doc);
    switch (group) {
      case 'Contracts':
        contracts.push(doc);
        break;
      case 'Submittals':
        submittals.push(doc);
        break;
      case 'Daily Reports':
        dailyReports.push(doc);
        break;
      case 'QC Reports':
        qcReports.push(doc);
        break;
      case 'Closeout / Warranty':
        closeout.push(doc);
        break;
      default:
        other.push(doc);
        break;
    }
  }

  return { contracts, submittals, dailyReports, qcReports, closeout, other };
}

export const DEFAULT_PACK_BY_DOCUMENT_TYPE: Record<string, string> = {
  change_order: 'GENERIC_CHANGE_ORDER',
  rfi: 'GENERIC_RFI',
  submittal: 'GENERIC_SUBMITTAL',
  daily_report: 'GENERIC_DAILY_REPORT',
  residential_contract: 'GENERIC_RESIDENTIAL',
};
