/**
 * CPA Excel workbook export (XLSX).
 * Uses the xlsx library already in the project (see estimateExportBuilder.ts).
 *
 * GUARDRAILS (do not remove):
 * - Disclaimer tab included in every workbook.
 * - "Not tracked" for zero/missing costs — never fabricate.
 * - No network calls.
 */

import * as XLSX from 'xlsx';
import type { AccountingExportData, ProposalSummaryRow } from './accountingExport';
import { ENTITY_TYPE_LABELS, formatMoney, formatPercent, DEFAULT_TAX_CATEGORY_MAP, resolvedTaxLabel } from './accountingExport';
import { SCHEDULE_C_DISCLAIMER } from './scheduleCExport';

export const CPA_WORKBOOK_SHEET_NAMES = [
  'Summary',
  'Revenue by Project',
  'Proposal Revenue',
  'Project Costs',
  'Labor Costs',
  'Change Orders',
  'Tax Category Mapping',
  'Notes & Assumptions',
] as const;

type SheetName = (typeof CPA_WORKBOOK_SHEET_NAMES)[number];

// ---------------------------------------------------------------------------
// Sheet builders
// ---------------------------------------------------------------------------

function mkSheet(rows: (string | number | null)[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildSummarySheet(data: AccountingExportData): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = [
    ['Concrete Calc — CPA Workbook'],
    ['Schedule C style summary — not an official IRS form'],
    [],
    ['Tax Year', data.taxYear],
    ['Entity Type', ENTITY_TYPE_LABELS[data.entityType]],
    [
      'Accounting Method',
      data.accountingMethod === 'cash'
        ? 'Cash (paid/deposit timestamps)'
        : 'Accrual (accepted dates)',
    ],
    [],
    ['DISCLAIMER', SCHEDULE_C_DISCLAIMER],
    [],
    ['— Revenue —', ''],
    ['Gross Receipts (accepted proposals)', data.grossReceipts],
    ['Change Order Revenue (accepted)', data.changeOrderRevenue > 0 ? data.changeOrderRevenue : 'Not tracked'],
    ['Pipeline Revenue (not yet accepted)', data.pendingRevenue],
    [],
    ['— Direct Job Costs (estimates) —', ''],
    ['Labor / Contract Labor', data.totalLaborEstimate ?? 'Not tracked'],
    ['Materials / Supplies', data.totalMaterialEstimate ?? 'Not tracked'],
    [
      'Total Direct Costs',
      data.totalLaborEstimate !== null || data.totalMaterialEstimate !== null
        ? (data.totalLaborEstimate ?? 0) + (data.totalMaterialEstimate ?? 0)
        : 'Not tracked',
    ],
    [],
    ['Gross Profit', data.totalGrossProfit ?? 'Not tracked'],
    [],
    ['Recognized proposals', data.recognizedProposals.length],
    ['Excluded / outside tax year', data.excludedProposals.length],
  ];
  return mkSheet(rows);
}

function buildRevenueByProjectSheet(data: AccountingExportData): XLSX.WorkSheet {
  const header = ['Project', 'Proposal Revenue', 'Labor Estimate', 'Material Estimate', 'Base Contract', 'CO Total'];
  const dataRows = data.projectSummaries.map((p) => [
    p.projectName,
    p.proposalRevenue,
    p.proposalLaborEstimate ?? 'Not tracked',
    p.proposalMaterialEstimate ?? 'Not tracked',
    p.baseContractValue ?? 'Not tracked',
    p.approvedChangeOrderTotal ?? 'Not tracked',
  ]);
  return mkSheet([header, ...dataRows]);
}

function buildProposalRevenueSheet(data: AccountingExportData): XLSX.WorkSheet {
  const header = [
    'Title',
    'Client',
    'Project',
    'Status',
    'Total Revenue',
    'Labor Estimate',
    'Material Estimate',
    'Gross Profit',
    'Margin %',
    'Recognition Date',
    'Accepted At',
    'Paid At',
  ];
  const toRow = (r: ProposalSummaryRow) => [
    r.title,
    r.clientName || 'N/A',
    r.projectTitle || 'N/A',
    r.status,
    r.totalRevenue,
    r.laborCostEstimate ?? 'Not tracked',
    r.materialCostEstimate ?? 'Not tracked',
    r.grossProfit ?? 'Not tracked',
    r.grossMarginPercent != null ? r.grossMarginPercent / 100 : 'Not tracked',
    r.recognitionDate ?? 'N/A',
    r.acceptedAt ?? 'N/A',
    r.paidAt ?? 'N/A',
  ];
  const recognized = data.recognizedProposals.map(toRow);
  const separator = ['— Excluded / outside tax year —', '', '', '', '', '', '', '', '', '', '', ''];
  const excluded = data.excludedProposals.map(toRow);
  return mkSheet([header, ...recognized, separator, ...excluded]);
}

function buildProjectCostsSheet(data: AccountingExportData): XLSX.WorkSheet {
  const header = ['Project', 'Labor Estimate', 'Material Estimate', 'Total Job Cost Estimate', 'Gross Profit'];
  const dataRows = data.projectSummaries.map((p) => [
    p.projectName,
    p.proposalLaborEstimate ?? 'Not tracked',
    p.proposalMaterialEstimate ?? 'Not tracked',
    p.proposalLaborEstimate !== null || p.proposalMaterialEstimate !== null
      ? (p.proposalLaborEstimate ?? 0) + (p.proposalMaterialEstimate ?? 0)
      : 'Not tracked',
    'See Proposal Revenue sheet',
  ]);
  const note = [
    [],
    ['NOTE: These are job-cost estimates from proposal records, not actual vendor invoices.'],
    ['Equipment and subcontractor costs are combined with labor and materials respectively.'],
  ];
  return mkSheet([header, ...dataRows, ...note]);
}

function buildLaborCostsSheet(data: AccountingExportData): XLSX.WorkSheet {
  const header = ['Proposal Title', 'Client', 'Labor Estimate (incl. subcontractors)', 'Status'];
  const dataRows = data.recognizedProposals.map((r) => [
    r.title,
    r.clientName || 'N/A',
    r.laborCostEstimate ?? 'Not tracked',
    r.status,
  ]);
  const note = [
    [],
    ['NOTE: "Labor" includes subcontractor costs (combined field). Separate subcontractor tracking coming in a future update.'],
  ];
  return mkSheet([header, ...dataRows, ...note]);
}

function buildChangeOrdersSheet(data: AccountingExportData): XLSX.WorkSheet {
  const header = ['Title', 'Project ID', 'Status', 'Total Revenue', 'Labor Estimate', 'Material Estimate'];
  const dataRows = data.acceptedChangeOrders.map((co) => [
    co.title,
    co.projectId ?? 'N/A',
    co.status,
    co.totalRevenue,
    co.laborCostEstimate ?? 'Not tracked',
    co.materialCostEstimate ?? 'Not tracked',
  ]);
  if (dataRows.length === 0) {
    return mkSheet([header, ['No accepted change orders found for this period.']]);
  }
  return mkSheet([header, ...dataRows]);
}

function buildTaxCategoryMappingSheet(data: AccountingExportData): XLSX.WorkSheet {
  const header = ['App Category', 'Tax / Accounting Label', 'Override Applied'];
  const dataRows = (Object.keys(DEFAULT_TAX_CATEGORY_MAP) as (keyof typeof DEFAULT_TAX_CATEGORY_MAP)[]).map(
    (cat) => {
      const override = data.taxCategoryMap[cat];
      return [cat, resolvedTaxLabel(cat, data.taxCategoryMap), override ? 'Yes' : 'Default'];
    },
  );
  return mkSheet([header, ...dataRows]);
}

function buildNotesSheet(data: AccountingExportData): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['Concrete Calc — Accounting & Tax Prep Package'],
    ['Notes & Assumptions'],
    [],
    ['Generated', new Date().toISOString()],
    ['Tax Year', data.taxYear],
    ['Accounting Method', data.accountingMethod],
    [],
    ['DISCLAIMER'],
    [SCHEDULE_C_DISCLAIMER],
    [],
    ['DATA SOURCES'],
    ['Revenue data sourced from accepted proposals in Concrete Calc.'],
    ['Cost data are job-cost estimates from proposal pricing records.'],
    ['Equipment and subcontractor costs may be combined with labor/materials.'],
    ['Change order data sourced from accepted change order records.'],
    [],
    ['NOT INCLUDED IN THIS EXPORT'],
    ['• Actual vendor invoices or bills (not tracked in Concrete Calc Phase 1)'],
    ['• Partial payments or payment schedules beyond paid_at / deposit_paid_at timestamps'],
    ['• Overhead, insurance, vehicle, and other indirect expenses (not tracked)'],
    ['• Federal, state, or payroll tax calculations'],
    [],
    ['RECOMMENDATIONS'],
    ['• Review with your CPA or tax preparer before filing.'],
    ['• Cross-check revenue totals against your bank/payment processor records.'],
    ['• Subcontractor costs may need separate 1099 reporting — consult your CPA.'],
  ];
  return mkSheet(rows);
}

// ---------------------------------------------------------------------------
// Workbook builder
// ---------------------------------------------------------------------------

export function buildCpaWorkbook(data: AccountingExportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const sheets: Record<SheetName, XLSX.WorkSheet> = {
    'Summary': buildSummarySheet(data),
    'Revenue by Project': buildRevenueByProjectSheet(data),
    'Proposal Revenue': buildProposalRevenueSheet(data),
    'Project Costs': buildProjectCostsSheet(data),
    'Labor Costs': buildLaborCostsSheet(data),
    'Change Orders': buildChangeOrdersSheet(data),
    'Tax Category Mapping': buildTaxCategoryMappingSheet(data),
    'Notes & Assumptions': buildNotesSheet(data),
  };

  for (const name of CPA_WORKBOOK_SHEET_NAMES) {
    XLSX.utils.book_append_sheet(wb, sheets[name], name);
  }

  return wb;
}

export function downloadCpaWorkbook(data: AccountingExportData, fileName?: string): void {
  const wb = buildCpaWorkbook(data);
  const outFile = fileName ?? `cpa-workbook-${data.taxYear}.xlsx`;
  XLSX.writeFile(wb, outFile);
}
