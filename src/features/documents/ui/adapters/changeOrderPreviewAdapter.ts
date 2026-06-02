import type { CompanySettings } from '../../../../services/companySettingsService';
import type { Project } from '../../../../types/index';
import type { ChangeOrder, ChangeOrderStatus } from '../../../../types/changeOrder';
import { CHANGE_ORDER_STATUSES } from '../../../../types/changeOrder';
import type { ChangeOrderDocumentContext } from '../../../../utils/changeOrderDocumentContext';
import {
  buildChangeOrderDocumentContext,
  buildChangeOrderContractValues,
} from '../../../../utils/changeOrderDocumentContext';

/**
 * Zero-value base for preview `ChangeOrder` objects. Every required field
 * that answers cannot supply gets a safe default so `ChangeOrderDocument`
 * (client audience) never hits undefined-access errors.
 */
const PREVIEW_BASE: ChangeOrder = {
  id: 'preview',
  projectId: '',
  userId: '',
  linkedFarId: null,
  linkedRfiId: null,
  linkedTaskId: null,
  displayNumber: 'Draft',
  title: 'Change Order',
  scopeDescription: '',
  reasonForChange: '',
  terms: '',
  laborItems: [],
  materialItems: [],
  equipmentItems: [],
  subcontractorItems: [],
  markupPercent: 0,
  pricingModel: 'standard',
  wasteFactorPercent: 0,
  wasteCost: 0,
  materialCostBase: 0,
  materialCostAdjusted: 0,
  contingencyPercent: 0,
  contingencyCost: 0,
  taxSystem: '',
  taxRatePercent: 0,
  taxApplication: '',
  taxCost: 0,
  targetMarginPercent: 0,
  grossProfit: 0,
  grossMarginPercent: 0,
  markupPercentReporting: 0,
  costWithOverhead: 0,
  totalEstimatedCost: 0,
  feesAmount: 0,
  permitsAmount: 0,
  overheadPercent: 0,
  profitPercent: 0,
  overheadAmount: 0,
  profitAmount: 0,
  subtotal: 0,
  total: 0,
  scheduleImpact: null,
  status: 'draft',
  publicToken: '',
  sentAt: null,
  viewedAt: null,
  openedAt: null,
  acceptedAt: null,
  declinedAt: null,
  contractorName: null,
  contractorSignature: null,
  contractorSignedAt: null,
  clientName: null,
  clientSignature: null,
  clientSignedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function toStatus(v: unknown): ChangeOrderStatus {
  if (typeof v === 'string' && (CHANGE_ORDER_STATUSES as readonly string[]).includes(v)) {
    return v as ChangeOrderStatus;
  }
  return 'draft';
}

const REQUESTED_BY_LABELS: Record<string, string> = {
  owner: 'Owner / Client',
  contractor: 'Contractor',
  inspector: 'Inspector',
  engineer: 'Engineer / Architect',
  other: 'Other',
};

/**
 * Builds a composite `scopeDescription` string from the multiple scope
 * answer keys the questionnaire provides.
 *
 * - `scopeOfChange` / `scope` — primary scope text (quick mode)
 * - `addedWork`   — appended as "Added: …"
 * - `deletedWork` — appended as "Removed: …"
 * - `exclusions`  — appended as "Exclusions: …"
 */
function buildScopeDescription(answers: Record<string, unknown>): string {
  const parts = [
    str(answers.scopeOfChange) || str(answers.scope),
    str(answers.addedWork) ? `Added: ${str(answers.addedWork)}` : '',
    str(answers.deletedWork) ? `Removed: ${str(answers.deletedWork)}` : '',
    str(answers.exclusions) ? `Exclusions: ${str(answers.exclusions)}` : '',
  ].filter(Boolean);
  return parts.join('\n\n');
}

/**
 * Builds a composite `scheduleImpact` string. The free-text `scheduleImpact`
 * field from the questionnaire is used first; numeric `additionalCalendarDays`
 * and `revisedCompletionDate` are appended when provided.
 */
function buildScheduleImpact(answers: Record<string, unknown>): string | null {
  const base = str(answers.scheduleImpact);
  const days = num(answers.additionalCalendarDays);
  const date = str(answers.revisedCompletionDate);
  const parts: string[] = [];
  if (base) parts.push(base);
  if (days > 0) parts.push(`+${days} calendar day${days === 1 ? '' : 's'}`);
  if (date) parts.push(`Revised completion: ${date}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Builds a composite `reasonForChange` string.
 * Appends the human-readable `requestedBy` label when that field is set.
 */
function buildReasonForChange(answers: Record<string, unknown>): string {
  const reason = str(answers.reasonForChange);
  const requestedBy = str(answers.requestedBy);
  const requestedByText = requestedBy
    ? `Requested by: ${REQUESTED_BY_LABELS[requestedBy] ?? requestedBy}`
    : '';
  return [reason, requestedByText].filter(Boolean).join(' · ');
}

/**
 * Builds a preview-only `ChangeOrder` + `ChangeOrderDocumentContext` from the
 * Document Builder's flat questionnaire `answers`. Designed for use inside a
 * `useMemo` in `DocumentPreviewRouter` and in the `handleExport` function when
 * `documentType === 'change_order'`.
 *
 * Answer-key → ChangeOrder field mapping (complete):
 *
 *   changeOrderNumber           → displayNumber (fallback 'Draft')
 *   changeOrderTitle / title    → title (fallback 'Change Order')
 *   scopeOfChange + addedWork + deletedWork + exclusions → scopeDescription (composite)
 *   reasonForChange + requestedBy → reasonForChange (composite)
 *   scheduleImpact + additionalCalendarDays + revisedCompletionDate → scheduleImpact (composite)
 *   totalChangeOrderAmount      → total / subtotal
 *   terms                       → terms
 *   contractorName              → contractorName (signature block)
 *   clientName                  → clientName (signature block)
 *   status                      → status (validated against ChangeOrderStatus union)
 *   project (text)              → context.project.name fallback when no project selected
 *   originalContractAmount + previouslyApprovedChangeOrders → context.contractValues override
 */
export function buildChangeOrderPreviewFromDocumentAnswers(input: {
  answers: Record<string, unknown>;
  selectedProject: Project | null;
  companySettings: Pick<
    CompanySettings,
    'companyName' | 'address' | 'phone' | 'email' | 'licenseNumber' | 'logoUrl'
  > & { logo?: string | null };
  title?: string;
}): { order: ChangeOrder; context: ChangeOrderDocumentContext } {
  const { answers, selectedProject, companySettings, title } = input;

  // --- title / displayNumber / status ---
  const resolvedTitle =
    title?.trim() ||
    str(answers.changeOrderTitle) ||
    str(answers.title) ||
    'Change Order';

  const displayNumber =
    str(answers.changeOrderNumber) ||
    str(answers.displayNumber) ||
    'Draft';

  // --- composite body fields ---
  const scopeDescription = buildScopeDescription(answers);
  const reasonForChange = buildReasonForChange(answers);
  const scheduleImpact = buildScheduleImpact(answers);

  // --- money / terms ---
  const total = num(answers.totalChangeOrderAmount);
  const terms = str(answers.terms);

  // --- signature names ---
  const contractorName = str(answers.contractorName) || null;
  const clientName = str(answers.clientName) || null;

  const order: ChangeOrder = {
    ...PREVIEW_BASE,
    projectId: selectedProject?.id ?? '',
    title: resolvedTitle,
    displayNumber,
    scopeDescription,
    reasonForChange,
    scheduleImpact,
    total,
    subtotal: total,
    terms,
    contractorName,
    clientName,
    status: toStatus(answers.status),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // --- context (project / company) ---
  const context = buildChangeOrderDocumentContext({
    order,
    project: selectedProject,
    companySettings,
    thisChangeOrderTotal: total,
  });

  // --- project name fallback from answer key 'project' when no project is selected ---
  const projectName =
    selectedProject?.name?.trim() ||
    str(answers.project) ||
    'Project';

  // --- contract value override: use form answers when no project provides them ---
  const syntheticOriginal = num(answers.originalContractAmount);
  const syntheticPrevious = num(answers.previouslyApprovedChangeOrders);
  const syntheticRevised = num(answers.revisedContractAmount);

  // Only substitute synthetic values when:
  //   (a) no project is selected, OR
  //   (b) the project has no baseContractValue and the user entered one manually
  const projectHasContractData =
    selectedProject != null &&
    (selectedProject.baseContractValue != null || selectedProject.currentContractValue != null);

  const contractValuesSource: Parameters<typeof buildChangeOrderContractValues>[0] =
    projectHasContractData
      ? selectedProject
      : syntheticOriginal > 0
        ? {
            baseContractValue: syntheticOriginal,
            approvedChangeOrderTotal: syntheticPrevious,
            currentContractValue: syntheticRevised > 0 ? syntheticRevised : undefined,
          }
        : null;

  const contractValues = buildChangeOrderContractValues(contractValuesSource, total);

  return {
    order,
    context: {
      ...context,
      project: {
        ...context.project,
        name: projectName,
      },
      contractValues,
    },
  };
}
