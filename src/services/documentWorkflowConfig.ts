import type { DocumentType } from '../features/documents/types';
import { FAR_WORKFLOW_STATUSES, RFI_WORKFLOW_STATUSES } from './builderWorkflowStatus';

export type PlannerDocumentType =
  | 'residential_contract'
  | 'submittal'
  | 'daily_report'
  | 'qc_report'
  | 'warranty_letter'
  | 'punch_list'
  | 'rfi'
  | 'far'
  | 'change_order';

export type WorkflowFieldKind = 'readonly' | 'editable-text' | 'editable-textarea';

export interface WorkflowFieldDef {
  key: string;
  label: string;
  kind: WorkflowFieldKind;
}

export interface DocumentWorkflowFieldSections {
  summaryKeys: WorkflowFieldDef[];
  detailKeys: WorkflowFieldDef[];
  editableKeys: WorkflowFieldDef[];
}

const RESIDENTIAL_CONTRACT_STATUSES = [
  'Draft',
  'Under Review',
  'Sent',
  'Accepted',
  'Declined',
  'Closed',
] as const;

const SUBMITTAL_STATUSES = [
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Approved as Noted',
  'Revise and Resubmit',
  'Rejected',
  'Closed',
] as const;

const DAILY_REPORT_STATUSES = ['Draft', 'Submitted', 'Reviewed', 'Closed'] as const;

const QC_REPORT_STATUSES = [
  'Draft',
  'Open',
  'Passed',
  'Passed with Notes',
  'Failed',
  'Corrective Action Required',
  'Reinspection Required',
  'Closed',
] as const;

const WARRANTY_STATUSES = [
  'Draft',
  'Submitted',
  'Under Review',
  'Accepted',
  'Closed',
] as const;

const PUNCH_LIST_STATUSES = [
  'Draft',
  'Open',
  'In Progress',
  'Ready for Review',
  'Complete',
  'Verified',
  'Closed',
] as const;

const CHANGE_ORDER_STATUSES = [
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Accepted',
  'Declined',
  'Closed',
  'Void',
] as const;

const STATUS_OPTIONS_BY_TYPE: Record<PlannerDocumentType, readonly string[]> = {
  residential_contract: RESIDENTIAL_CONTRACT_STATUSES,
  submittal: SUBMITTAL_STATUSES,
  daily_report: DAILY_REPORT_STATUSES,
  qc_report: QC_REPORT_STATUSES,
  warranty_letter: WARRANTY_STATUSES,
  punch_list: PUNCH_LIST_STATUSES,
  rfi: RFI_WORKFLOW_STATUSES,
  far: FAR_WORKFLOW_STATUSES,
  change_order: CHANGE_ORDER_STATUSES,
};

/** Normalize document type string to planner drawer type. */
export function normalizePlannerDocumentType(documentType: string): PlannerDocumentType {
  const t = documentType.trim().toLowerCase();
  if (t === 'contract' || t === 'remodel_contract' || t === 'commercial_contract') {
    return 'residential_contract';
  }
  if (t === 'closeout' || t === 'closeout_document' || t === 'closeout_package') {
    return 'warranty_letter';
  }
  if (t === 'inspection_report' || t === 'qc_inspection') {
    return 'qc_report';
  }
  const known = Object.keys(STATUS_OPTIONS_BY_TYPE) as PlannerDocumentType[];
  if (known.includes(t as PlannerDocumentType)) {
    return t as PlannerDocumentType;
  }
  return 'residential_contract';
}

export function getDocumentWorkflowStatusOptions(documentType: string): readonly string[] {
  return STATUS_OPTIONS_BY_TYPE[normalizePlannerDocumentType(documentType)];
}

export function getPlannerDocumentPrimaryActionLabel(documentType: string): string {
  const t = normalizePlannerDocumentType(documentType);
  switch (t) {
    case 'rfi':
      return 'View / Respond';
    case 'far':
      return 'View / Review';
    case 'submittal':
    case 'daily_report':
    case 'qc_report':
    case 'punch_list':
    case 'warranty_letter':
      return 'Review';
    case 'residential_contract':
    case 'change_order':
    default:
      return 'View / Update';
  }
}

export interface PlannerDocumentDrawerMeta {
  drawerTitle: string;
  saveLabel: string;
  notesSectionTitle: string;
}

export function getPlannerDocumentDrawerMeta(documentType: string): PlannerDocumentDrawerMeta {
  const t = normalizePlannerDocumentType(documentType);
  switch (t) {
    case 'rfi':
      return {
        drawerTitle: 'RFI Document',
        saveLabel: 'Save response',
        notesSectionTitle: 'Response',
      };
    case 'far':
      return {
        drawerTitle: 'FAR Document',
        saveLabel: 'Save review',
        notesSectionTitle: 'Review / Response',
      };
    case 'submittal':
      return {
        drawerTitle: 'Submittal',
        saveLabel: 'Save updates',
        notesSectionTitle: 'Review / Comments',
      };
    case 'daily_report':
      return {
        drawerTitle: 'Daily Report',
        saveLabel: 'Save updates',
        notesSectionTitle: 'Review notes',
      };
    case 'qc_report':
      return {
        drawerTitle: 'QC Report',
        saveLabel: 'Save updates',
        notesSectionTitle: 'Review notes',
      };
    case 'warranty_letter':
      return {
        drawerTitle: 'Warranty / Closeout Letter',
        saveLabel: 'Save updates',
        notesSectionTitle: 'Review notes',
      };
    case 'punch_list':
      return {
        drawerTitle: 'Punch List',
        saveLabel: 'Save updates',
        notesSectionTitle: 'Review notes',
      };
    case 'change_order':
      return {
        drawerTitle: 'Change Order Document',
        saveLabel: 'Save updates',
        notesSectionTitle: 'Approval notes',
      };
    case 'residential_contract':
    default:
      return {
        drawerTitle: 'Contract Document',
        saveLabel: 'Save updates',
        notesSectionTitle: 'Review notes',
      };
  }
}

export function getDocumentWorkflowFieldSections(
  documentType: string,
): DocumentWorkflowFieldSections {
  const t = normalizePlannerDocumentType(documentType);

  const summary = (fields: WorkflowFieldDef[]): WorkflowFieldDef[] => fields;

  switch (t) {
    case 'submittal':
      return {
        summaryKeys: summary([
          { key: 'preparedBy', label: 'Prepared by', kind: 'readonly' },
          { key: 'submittedBy', label: 'Submitted by', kind: 'readonly' },
        ]),
        detailKeys: [
          { key: 'submittalNumber', label: 'Submittal number', kind: 'readonly' },
          { key: 'specSection', label: 'Spec section', kind: 'readonly' },
          { key: 'reviewer', label: 'Reviewer', kind: 'readonly' },
          { key: 'dueDate', label: 'Due date', kind: 'readonly' },
          { key: 'reviewStatus', label: 'Review status', kind: 'readonly' },
        ],
        editableKeys: [
          { key: 'reviewerComments', label: 'Reviewer comments', kind: 'editable-textarea' },
          { key: 'reviewedBy', label: 'Reviewed by', kind: 'editable-text' },
        ],
      };
    case 'daily_report':
      return {
        summaryKeys: summary([
          { key: 'preparedBy', label: 'Prepared by', kind: 'readonly' },
          { key: 'reportDate', label: 'Report date', kind: 'readonly' },
        ]),
        detailKeys: [
          { key: 'reportNumber', label: 'Report number', kind: 'readonly' },
          { key: 'weatherConditions', label: 'Weather', kind: 'readonly' },
          { key: 'workPerformed', label: 'Work performed', kind: 'readonly' },
        ],
        editableKeys: [
          { key: 'reviewedBy', label: 'Reviewed by', kind: 'editable-text' },
          { key: 'qcNotes', label: 'Review notes', kind: 'editable-textarea' },
        ],
      };
    case 'qc_report':
      return {
        summaryKeys: summary([
          { key: 'preparedBy', label: 'Prepared by', kind: 'readonly' },
          { key: 'reportDate', label: 'Report date', kind: 'readonly' },
        ]),
        detailKeys: [
          { key: 'reportNumber', label: 'Report number', kind: 'readonly' },
          { key: 'inspectionType', label: 'Inspection type', kind: 'readonly' },
          { key: 'inspectionLocation', label: 'Location', kind: 'readonly' },
          { key: 'overallStatus', label: 'Overall status', kind: 'readonly' },
          { key: 'deficiencies', label: 'Deficiencies', kind: 'readonly' },
          { key: 'correctiveActions', label: 'Corrective actions', kind: 'readonly' },
        ],
        editableKeys: [
          { key: 'reviewedBy', label: 'Reviewed by', kind: 'editable-text' },
          { key: 'qcNotes', label: 'Review notes', kind: 'editable-textarea' },
        ],
      };
    case 'warranty_letter':
      return {
        summaryKeys: summary([
          { key: 'preparedBy', label: 'Prepared by', kind: 'readonly' },
          { key: 'recipientName', label: 'Recipient', kind: 'readonly' },
        ]),
        detailKeys: [
          { key: 'documentNumber', label: 'Document number', kind: 'readonly' },
          { key: 'projectCompletionDate', label: 'Completion date', kind: 'readonly' },
          { key: 'warrantyPeriod', label: 'Warranty period', kind: 'readonly' },
          { key: 'punchListStatus', label: 'Punch list status', kind: 'readonly' },
          { key: 'finalInspectionResult', label: 'Final inspection result', kind: 'readonly' },
        ],
        editableKeys: [
          { key: 'reviewedBy', label: 'Reviewed by', kind: 'editable-text' },
          { key: 'closeoutSummary', label: 'Review notes', kind: 'editable-textarea' },
        ],
      };
    case 'punch_list':
      return {
        summaryKeys: summary([
          { key: 'preparedBy', label: 'Prepared by', kind: 'readonly' },
          { key: 'listDate', label: 'List date', kind: 'readonly' },
        ]),
        detailKeys: [
          { key: 'punchListNumber', label: 'Punch list number', kind: 'readonly' },
          { key: 'overallStatus', label: 'Overall status', kind: 'readonly' },
          { key: 'summary', label: 'Summary', kind: 'readonly' },
        ],
        editableKeys: [
          { key: 'finalAcceptanceBy', label: 'Verified by', kind: 'editable-text' },
          { key: 'summary', label: 'Review notes', kind: 'editable-textarea' },
        ],
      };
    case 'rfi':
      return {
        summaryKeys: summary([
          { key: 'submittedBy', label: 'Submitted by', kind: 'readonly' },
          { key: 'submittedTo', label: 'Submitted to', kind: 'readonly' },
          { key: 'dueDate', label: 'Due date', kind: 'readonly' },
          { key: 'priority', label: 'Priority', kind: 'readonly' },
        ]),
        detailKeys: [
          { key: 'question', label: 'Question', kind: 'readonly' },
          { key: 'location', label: 'Location', kind: 'readonly' },
        ],
        editableKeys: [
          { key: 'response', label: 'Response', kind: 'editable-textarea' },
          { key: 'respondedBy', label: 'Responded by', kind: 'editable-text' },
          { key: 'responseDate', label: 'Response date', kind: 'editable-text' },
        ],
      };
    case 'far':
      return {
        summaryKeys: summary([
          { key: 'requestedBy', label: 'Requested by', kind: 'readonly' },
          { key: 'location', label: 'Location', kind: 'readonly' },
        ]),
        detailKeys: [
          { key: 'description', label: 'Description', kind: 'readonly' },
          { key: 'proposedAdjustment', label: 'Proposed adjustment', kind: 'readonly' },
          { key: 'existingCondition', label: 'Existing condition', kind: 'readonly' },
        ],
        editableKeys: [
          { key: 'reviewerResponse', label: 'Reviewer response', kind: 'editable-textarea' },
          { key: 'reviewedBy', label: 'Reviewed by', kind: 'editable-text' },
          { key: 'responseDate', label: 'Response date', kind: 'editable-text' },
          { key: 'approvalDecision', label: 'Approval decision', kind: 'editable-text' },
        ],
      };
    case 'change_order':
      return {
        summaryKeys: summary([
          { key: 'requestedBy', label: 'Requested by', kind: 'readonly' },
        ]),
        detailKeys: [
          { key: 'changeOrderTitle', label: 'Title', kind: 'readonly' },
          { key: 'scopeOfChange', label: 'Scope summary', kind: 'readonly' },
          { key: 'totalChangeOrderAmount', label: 'Total amount', kind: 'readonly' },
          { key: 'scheduleImpact', label: 'Schedule impact', kind: 'readonly' },
        ],
        editableKeys: [
          { key: 'terms', label: 'Approval notes', kind: 'editable-textarea' },
        ],
      };
    case 'residential_contract':
    default:
      return {
        summaryKeys: summary([
          { key: 'ownerName', label: 'Owner / client', kind: 'readonly' },
          { key: 'clientName', label: 'Client name', kind: 'readonly' },
        ]),
        detailKeys: [
          { key: 'contractNumber', label: 'Contract number', kind: 'readonly' },
          { key: 'contractPrice', label: 'Contract amount', kind: 'readonly' },
        ],
        editableKeys: [
          { key: 'contractNotes', label: 'Review notes', kind: 'editable-textarea' },
        ],
      };
  }
}

/** Keys merged into answers on drawer save (editable + status). */
export function getEditableAnswerKeysForSave(documentType: string): string[] {
  const sections = getDocumentWorkflowFieldSections(documentType);
  return ['status', ...sections.editableKeys.map((f) => f.key)];
}

export function isSupportedPlannerDrawerType(documentType: string): boolean {
  const t = normalizePlannerDocumentType(documentType);
  return t in STATUS_OPTIONS_BY_TYPE;
}

/** Re-export for document type checks in UI. */
export type { DocumentType };
