/**
 * Accounting & Tax Prep Package — data aggregation utility.
 *
 * Aggregates existing proposal, change order, and project data for
 * year-end export. Does NOT add new DB queries, does NOT fabricate values,
 * and does NOT change any existing calculation.
 *
 * GUARDRAILS (do not remove):
 * - Cash method uses only paid_at / deposit_paid_at timestamps.
 * - Accrual method uses accepted_at timestamp.
 * - Zero / missing costs are represented as null, not $0.
 * - This module performs NO network calls.
 */

import type { TrackedProposalRow } from '../types/proposalTracking';
import type { ChangeOrder } from '../types/changeOrder';
import type { Project } from '../types';

export type AccountingMethod = 'cash' | 'accrual';

export type BusinessEntityType =
  | 'sole_proprietor'
  | 'llc'
  | 's_corp'
  | 'c_corp'
  | 'partnership';

export const ENTITY_TYPE_LABELS: Record<BusinessEntityType, string> = {
  sole_proprietor: 'Sole Proprietor',
  llc: 'LLC',
  s_corp: 'S-Corp',
  c_corp: 'C-Corp',
  partnership: 'Partnership',
};

/** Entity types where Schedule C style layout may not apply. */
export const NON_SCHEDULE_C_ENTITIES: BusinessEntityType[] = [
  'llc',
  's_corp',
  'c_corp',
  'partnership',
];

export interface AccountingExportSettings {
  taxYear: number;
  entityType: BusinessEntityType;
  accountingMethod: AccountingMethod;
  taxCategoryMap: TaxCategoryMap;
}

export const DEFAULT_TAX_YEAR = new Date().getFullYear();

export const DEFAULT_ACCOUNTING_SETTINGS: AccountingExportSettings = {
  taxYear: DEFAULT_TAX_YEAR,
  entityType: 'sole_proprietor',
  accountingMethod: 'accrual',
  taxCategoryMap: {},
};

// ---------------------------------------------------------------------------
// Tax category mapping
// ---------------------------------------------------------------------------

export type AppCostCategory =
  | 'labor'
  | 'materials'
  | 'equipment'
  | 'subcontractors'
  | 'change_orders';

export const DEFAULT_TAX_CATEGORY_MAP: Record<AppCostCategory, string> = {
  labor: 'Contract labor',
  materials: 'Materials/supplies',
  equipment: 'Equipment rental',
  subcontractors: 'Contract labor',
  change_orders: 'Revenue adjustment',
};

/** User overrides stored in localStorage. Key = AppCostCategory, value = custom label. */
export type TaxCategoryMap = Partial<Record<AppCostCategory, string>>;

export const TAX_CATEGORY_MAP_STORAGE_KEY = 'accounting_tax_category_map';

export function loadTaxCategoryMap(): TaxCategoryMap {
  try {
    const raw = localStorage.getItem(TAX_CATEGORY_MAP_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TaxCategoryMap) : {};
  } catch {
    return {};
  }
}

export function saveTaxCategoryMap(map: TaxCategoryMap): void {
  try {
    localStorage.setItem(TAX_CATEGORY_MAP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function resolvedTaxLabel(
  category: AppCostCategory,
  userMap: TaxCategoryMap,
): string {
  return userMap[category] ?? DEFAULT_TAX_CATEGORY_MAP[category];
}

// ---------------------------------------------------------------------------
// WON proposal statuses
// ---------------------------------------------------------------------------

const WON_STATUSES = new Set([
  'accepted',
  'deposit_paid',
  'scheduled',
  'paid',
] as const);

const PENDING_STATUSES = new Set(['sent', 'viewed', 'opened'] as const);

function isWon(p: TrackedProposalRow): boolean {
  return WON_STATUSES.has(p.status as never);
}

function isPending(p: TrackedProposalRow): boolean {
  return PENDING_STATUSES.has(p.status as never);
}

// ---------------------------------------------------------------------------
// Year extraction helpers (no fabrication)
// ---------------------------------------------------------------------------

function yearOf(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.getFullYear();
}

/**
 * Returns the "recognition date" for a proposal under the chosen accounting method.
 * Cash: paid_at → deposit_paid_at → null (excluded from cash-basis reports).
 * Accrual: accepted_at → null.
 */
export function proposalRecognitionDate(
  p: TrackedProposalRow,
  method: AccountingMethod,
): string | null {
  if (method === 'cash') {
    return p.paid_at ?? p.deposit_paid_at ?? null;
  }
  return p.accepted_at ?? null;
}

// ---------------------------------------------------------------------------
// Per-proposal summary
// ---------------------------------------------------------------------------

export interface ProposalSummaryRow {
  id: string;
  title: string;
  clientName: string;
  projectTitle: string;
  status: string;
  totalRevenue: number;
  /** Job-cost estimate — not necessarily actual paid vendor bills. */
  laborCostEstimate: number | null;
  /** Job-cost estimate — includes equipment (combined field). */
  materialCostEstimate: number | null;
  grossProfit: number | null;
  grossMarginPercent: number | null;
  recognitionDate: string | null;
  acceptedAt: string | null;
  paidAt: string | null;
  depositPaidAt: string | null;
}

function toProposalSummaryRow(
  p: TrackedProposalRow,
  method: AccountingMethod,
): ProposalSummaryRow {
  return {
    id: p.id,
    title: p.title,
    clientName: p.data?.clientName ?? '',
    projectTitle: p.data?.projectTitle ?? '',
    status: p.status,
    totalRevenue: p.total_amount ?? 0,
    laborCostEstimate: (p.labor_cost ?? 0) > 0 ? (p.labor_cost ?? 0) : null,
    materialCostEstimate: (p.material_cost ?? 0) > 0 ? (p.material_cost ?? 0) : null,
    grossProfit: (p.gross_profit ?? 0) > 0 ? (p.gross_profit ?? 0) : null,
    grossMarginPercent:
      (p.gross_margin_percent ?? 0) > 0 ? (p.gross_margin_percent ?? 0) : null,
    recognitionDate: proposalRecognitionDate(p, method),
    acceptedAt: p.accepted_at ?? null,
    paidAt: p.paid_at ?? null,
    depositPaidAt: p.deposit_paid_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// Change order summary
// ---------------------------------------------------------------------------

export interface ChangeOrderSummaryRow {
  id: string;
  title: string;
  projectId: string | null;
  status: string;
  totalRevenue: number;
  laborCostEstimate: number | null;
  materialCostEstimate: number | null;
}

function toChangeOrderSummaryRow(co: ChangeOrder): ChangeOrderSummaryRow {
  const labor = (co.laborTotal ?? 0) > 0 ? (co.laborTotal ?? 0) : null;
  const material =
    (co.materialCostAdjusted ?? 0) > 0 ? (co.materialCostAdjusted ?? 0) : null;
  return {
    id: co.id,
    title: co.title ?? 'Change Order',
    projectId: co.project_id ?? null,
    status: co.status ?? '',
    totalRevenue: co.total ?? 0,
    laborCostEstimate: labor,
    materialCostEstimate: material,
  };
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

export interface AccountingExportWarning {
  key: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Main export data shape
// ---------------------------------------------------------------------------

export interface AccountingExportData {
  taxYear: number;
  accountingMethod: AccountingMethod;
  entityType: BusinessEntityType;
  taxCategoryMap: TaxCategoryMap;

  /** Won proposals recognized in taxYear under selected method. */
  recognizedProposals: ProposalSummaryRow[];
  /** Pipeline proposals not yet won — shown separately, never counted as revenue. */
  pendingProposals: ProposalSummaryRow[];
  /** Won proposals recognized outside taxYear (or lacking a recognition date under cash method). */
  excludedProposals: ProposalSummaryRow[];

  /** Accepted change orders (no year filter — COs don't carry independent timestamps yet). */
  acceptedChangeOrders: ChangeOrderSummaryRow[];

  /** Revenue totals */
  grossReceipts: number;
  pendingRevenue: number;
  changeOrderRevenue: number;

  /** Cost totals (job-cost estimates, not actual vendor bills) */
  totalLaborEstimate: number | null;
  totalMaterialEstimate: number | null;
  totalGrossProfit: number | null;

  /** Per-project rollup */
  projectSummaries: ProjectSummaryRow[];

  /** Warnings to display in UI */
  warnings: AccountingExportWarning[];

  /** True if any accepted proposals lack a cash-method timestamp. */
  hasMissingCashTimestamps: boolean;
}

export interface ProjectSummaryRow {
  projectId: string;
  projectName: string;
  baseContractValue: number | null;
  approvedChangeOrderTotal: number | null;
  currentContractValue: number | null;
  proposalRevenue: number;
  proposalLaborEstimate: number | null;
  proposalMaterialEstimate: number | null;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildAccountingExportData(
  proposals: TrackedProposalRow[],
  changeOrders: ChangeOrder[],
  projects: Project[],
  settings: AccountingExportSettings,
): AccountingExportData {
  const { taxYear, accountingMethod, entityType, taxCategoryMap } = settings;

  // --- Filter proposals by accounting method and tax year ---
  const wonProposals = proposals.filter(isWon);
  const pendingProposals = proposals.filter(isPending);

  const recognizedProposals: ProposalSummaryRow[] = [];
  const excludedProposals: ProposalSummaryRow[] = [];
  let hasMissingCashTimestamps = false;

  for (const p of wonProposals) {
    const recDate = proposalRecognitionDate(p, accountingMethod);
    if (!recDate) {
      // Cash method: no paid_at / deposit_paid_at — exclude from revenue
      if (accountingMethod === 'cash') hasMissingCashTimestamps = true;
      excludedProposals.push(toProposalSummaryRow(p, accountingMethod));
      continue;
    }
    const recYear = yearOf(recDate);
    if (recYear === taxYear) {
      recognizedProposals.push(toProposalSummaryRow(p, accountingMethod));
    } else {
      excludedProposals.push(toProposalSummaryRow(p, accountingMethod));
    }
  }

  // --- Accepted change orders ---
  const acceptedChangeOrders = changeOrders
    .filter((co) => co.status === 'accepted' || co.status === 'approved')
    .map(toChangeOrderSummaryRow);

  // --- Revenue totals ---
  const grossReceipts = recognizedProposals.reduce((s, r) => s + r.totalRevenue, 0);
  const pendingRevenue = pendingProposals.reduce(
    (s, p) => s + (proposals.find((x) => x.id === p.id)?.total_amount ?? 0),
    0,
  );
  const changeOrderRevenue = acceptedChangeOrders.reduce((s, c) => s + c.totalRevenue, 0);

  // --- Cost totals (null when nothing tracked) ---
  const laborValues = recognizedProposals
    .map((r) => r.laborCostEstimate)
    .filter((v): v is number => v !== null);
  const materialValues = recognizedProposals
    .map((r) => r.materialCostEstimate)
    .filter((v): v is number => v !== null);
  const profitValues = recognizedProposals
    .map((r) => r.grossProfit)
    .filter((v): v is number => v !== null);

  const totalLaborEstimate = laborValues.length > 0
    ? laborValues.reduce((s, v) => s + v, 0)
    : null;
  const totalMaterialEstimate = materialValues.length > 0
    ? materialValues.reduce((s, v) => s + v, 0)
    : null;
  const totalGrossProfit = profitValues.length > 0
    ? profitValues.reduce((s, v) => s + v, 0)
    : null;

  // --- Per-project rollup ---
  const projectSummaries: ProjectSummaryRow[] = projects.map((proj) => {
    const projProposals = recognizedProposals.filter(
      (r) =>
        proposals.find((p) => p.id === r.id)?.project_id === proj.id,
    );
    const projLabor = projProposals
      .map((r) => r.laborCostEstimate)
      .filter((v): v is number => v !== null);
    const projMaterial = projProposals
      .map((r) => r.materialCostEstimate)
      .filter((v): v is number => v !== null);

    return {
      projectId: proj.id,
      projectName: proj.name ?? proj.clientInfo?.projectAddress ?? 'Unnamed Project',
      baseContractValue:
        (proj.baseContractValue ?? 0) > 0 ? (proj.baseContractValue ?? 0) : null,
      approvedChangeOrderTotal:
        (proj.approvedChangeOrderTotal ?? 0) > 0
          ? (proj.approvedChangeOrderTotal ?? 0)
          : null,
      currentContractValue:
        (proj.currentContractValue ?? 0) > 0 ? (proj.currentContractValue ?? 0) : null,
      proposalRevenue: projProposals.reduce((s, r) => s + r.totalRevenue, 0),
      proposalLaborEstimate: projLabor.length > 0 ? projLabor.reduce((s, v) => s + v, 0) : null,
      proposalMaterialEstimate:
        projMaterial.length > 0 ? projMaterial.reduce((s, v) => s + v, 0) : null,
    };
  });

  // --- Warnings ---
  const warnings: AccountingExportWarning[] = [];

  if (hasMissingCashTimestamps) {
    warnings.push({
      key: 'cash_missing_timestamps',
      message:
        'Cash-basis export is based on available paid/deposit timestamps. ' +
        'Actual received payments may require review.',
    });
  }

  if (NON_SCHEDULE_C_ENTITIES.includes(entityType)) {
    warnings.push({
      key: 'non_schedule_c_entity',
      message:
        'Schedule C style layout may not apply to every entity type. ' +
        'Review with your CPA or tax preparer.',
    });
  }

  if (recognizedProposals.length === 0) {
    warnings.push({
      key: 'no_recognized_revenue',
      message: `No accepted proposals found for ${taxYear} under the selected accounting method.`,
    });
  }

  if (totalLaborEstimate === null && totalMaterialEstimate === null) {
    warnings.push({
      key: 'no_cost_data',
      message:
        'No job-cost data found on recognized proposals. ' +
        'Cost fields will show "Not tracked" in exports.',
    });
  }

  return {
    taxYear,
    accountingMethod,
    entityType,
    taxCategoryMap,
    recognizedProposals,
    pendingProposals: pendingProposals.map((p) => toProposalSummaryRow(p, accountingMethod)),
    excludedProposals,
    acceptedChangeOrders,
    grossReceipts,
    pendingRevenue,
    changeOrderRevenue,
    totalLaborEstimate,
    totalMaterialEstimate,
    totalGrossProfit,
    projectSummaries,
    warnings,
    hasMissingCashTimestamps,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers (used by export generators)
// ---------------------------------------------------------------------------

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

export function formatMoney(v: number | null): string {
  if (v === null) return 'Not tracked';
  return USD.format(v);
}

export function formatPercent(v: number | null): string {
  if (v === null) return 'Not tracked';
  return `${v.toFixed(1)}%`;
}
