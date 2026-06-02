import type { CompanySettings } from '../../../../services/companySettingsService';
import type { Project } from '../../../../types/index';
import type { ChangeOrder, ChangeOrderStatus } from '../../../../types/changeOrder';
import { CHANGE_ORDER_STATUSES } from '../../../../types/changeOrder';
import type { ChangeOrderDocumentContext } from '../../../../utils/changeOrderDocumentContext';
import {
  buildChangeOrderDocumentContext,
  buildChangeOrderContractValues,
} from '../../../../utils/changeOrderDocumentContext';

// ─── Preview base ─────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function isTrue(v: unknown): boolean {
  return v === true || v === 'true' || v === 'yes';
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

// ─── Clause text for accepted recommendations ─────────────────────────────────

/**
 * When the user accepts a recommended clause in the Document Builder, this map
 * provides the plain-language text that is appended to `order.terms` so the
 * accepted clause is visible in the Change Order preview.
 */
const ACCEPTED_CLAUSE_TEXT: Record<string, string> = {
  'co.approval_before_work':
    'Work described in this Change Order shall not proceed until approved in writing by the Owner, except emergency protection work required to prevent damage or unsafe conditions.',
  'co.emergency_work_docs':
    'Emergency work shall be documented with photographs, labor records, materials used, and time logs, and the Owner shall be notified promptly.',
  'co.concealed_condition':
    'Concealed or unknown conditions were discovered during the course of work. These conditions are excluded from the original contract scope unless specifically included by this Change Order.',
  'co.owner_requested_scope':
    'Owner requested this change and acknowledges that the Contract Price and/or Contract Time may be adjusted accordingly.',
  'co.cost_backup_required':
    'Cost backup or detailed breakdown shall be attached to or made available with this Change Order before final approval.',
  'co.schedule_adjustment':
    'The Contract Time is adjusted as stated in the schedule impact section of this Change Order.',
  'change_order.unknown_conditions':
    'Concealed or unknown site conditions discovered during work may require additional changes not included in this Change Order.',
};

function uniqueTerms(parts: string[]): string[] {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = part.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Composite field builders ─────────────────────────────────────────────────

/**
 * Builds a composite `scopeDescription` from multiple scope answer keys.
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
 * Builds a composite `scheduleImpact` string.
 *
 * Free-text `scheduleImpact` is used first; `additionalCalendarDays` and
 * `revisedCompletionDate` are appended when provided.
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
 *
 * Appends:
 * - Human-readable `requestedBy` label
 * - `fieldCondition` context note (latent/concealed condition)
 * - `ownerRequestedChange` context note
 */
function buildReasonForChange(answers: Record<string, unknown>): string {
  const reason = str(answers.reasonForChange);
  const requestedBy = str(answers.requestedBy);
  const requestedByText = requestedBy
    ? `Requested by: ${REQUESTED_BY_LABELS[requestedBy] ?? requestedBy}`
    : '';
  const fieldConditionText = isTrue(answers.fieldCondition)
    ? 'This change is related to concealed, latent, or unforeseen field conditions.'
    : '';
  const ownerRequestedText = isTrue(answers.ownerRequestedChange)
    ? 'This change was requested by the Owner/Client.'
    : '';
  return [reason, requestedByText, fieldConditionText, ownerRequestedText]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Builds the composite `terms` string for Additional Terms in the preview.
 *
 * Change Management toggles trigger recommendations and risk signals only —
 * they do not append clause language here. Accepted recommended clauses are
 * the sole source of optional clause text (plus user-entered terms and RFI/FAR).
 */
function buildTerms(answers: Record<string, unknown>, accepted: string[]): string {
  const rfiFarRef = str(answers.rfiFarReference);
  const relatedReferenceText = rfiFarRef ? `Related reference: ${rfiFarRef}` : '';

  const acceptedClauseTexts = accepted
    .map((clauseKey) => ACCEPTED_CLAUSE_TEXT[clauseKey])
    .filter((text): text is string => Boolean(text));

  const termsParts = uniqueTerms([
    str(answers.terms),
    relatedReferenceText,
    ...acceptedClauseTexts,
  ]);

  return termsParts.join('\n\n');
}

// ─── Main export ──────────────────────────────────────────────────────────────

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
 *   reasonForChange + requestedBy + fieldCondition + ownerRequestedChange → reasonForChange (composite)
 *   scheduleImpact + additionalCalendarDays + revisedCompletionDate → scheduleImpact (composite)
 *   totalChangeOrderAmount      → total / subtotal
 *   terms + rfiFarReference + accepted clauses → terms (composite)
 *   contractorName              → contractorName (signature block)
 *   clientName                  → clientName (signature block)
 *   status                      → status (validated against ChangeOrderStatus union)
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
  /** Accepted recommendation clause keys — their language is appended to order.terms. */
  accepted?: string[];
}): { order: ChangeOrder; context: ChangeOrderDocumentContext } {
  const { answers, selectedProject, companySettings, title, accepted = [] } = input;

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

  // --- money ---
  const total = num(answers.totalChangeOrderAmount);

  // --- composite terms (user text + accepted recommendations + references) ---
  const terms = buildTerms(answers, accepted);

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

  // --- project name: selected project takes precedence; no more free-text fallback ---
  const projectName = selectedProject?.name?.trim() || 'Project';

  // --- contract value override: use form answers when no project provides them ---
  const syntheticOriginal = num(answers.originalContractAmount);
  const syntheticPrevious = num(answers.previouslyApprovedChangeOrders);
  const syntheticRevised = num(answers.revisedContractAmount);

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
