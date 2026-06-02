import type { CompanySettings } from '../../../services/companySettingsService';
import type { Project } from '../../../types/index';
import type { ChangeOrder } from '../../../types/changeOrder';
import type { ChangeOrderDocumentContext } from '../../../utils/changeOrderDocumentContext';
import { buildChangeOrderDocumentContext } from '../../../utils/changeOrderDocumentContext';

/**
 * A minimal, zero-value `ChangeOrder` used as the base for preview objects
 * built from Document Builder questionnaire answers. All fields that are not
 * driven by answers default to safe zeros or empty values so that
 * `ChangeOrderDocument` (client audience) renders cleanly without hitting any
 * undefined-access errors.
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

function toString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function toNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/**
 * Builds a preview-only `ChangeOrder` + `ChangeOrderDocumentContext` from the
 * Document Builder's flat `answers` record and the currently-selected project /
 * company settings. Designed to be called inside a `useMemo` in
 * `DocumentPreviewRouter`.
 *
 * Question-key → ChangeOrder field mapping:
 *   changeOrderTitle      → title
 *   scopeOfChange         → scopeDescription
 *   reasonForChange       → reasonForChange
 *   scheduleImpact        → scheduleImpact
 *   totalChangeOrderAmount → total / subtotal
 *   additionalCalendarDays → (surfaced via scheduleImpact string)
 *   revisedCompletionDate  → (surfaced via scheduleImpact string)
 */
export function buildChangeOrderPreviewFromAnswers(input: {
  answers: Record<string, unknown>;
  selectedProject: Project | null;
  companySettings: Pick<
    CompanySettings,
    'companyName' | 'address' | 'phone' | 'email' | 'licenseNumber' | 'logoUrl'
  > & { logo?: string | null };
}): { order: ChangeOrder; context: ChangeOrderDocumentContext } {
  const { answers, selectedProject, companySettings } = input;

  const total = toNumber(answers.totalChangeOrderAmount);
  const scheduleText = toString(answers.scheduleImpact) || null;

  const order: ChangeOrder = {
    ...PREVIEW_BASE,
    title: toString(answers.changeOrderTitle) || 'Change Order',
    displayNumber: 'Draft',
    scopeDescription: toString(answers.scopeOfChange),
    reasonForChange: toString(answers.reasonForChange),
    scheduleImpact: scheduleText,
    total,
    subtotal: total,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const context = buildChangeOrderDocumentContext({
    order,
    project: selectedProject,
    companySettings,
    thisChangeOrderTotal: total,
  });

  return { order, context };
}
