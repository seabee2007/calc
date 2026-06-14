/**
 * QuickBooks-compatible CSV exports — Phase 1 (CSV only).
 *
 * GUARDRAILS (do not remove):
 * - NO Intuit API calls. No fetch(), no XMLHttpRequest, no network calls.
 * - NO OAuth, NO credential storage, NO connection UI.
 * - CSV files only. Direct QuickBooks Online sync is deferred to a later phase.
 * - Cost export is labeled "Job Cost Summary" — NOT "expenses" (these are
 *   job-cost estimates from proposals, not actual vendor bills).
 */

import type { AccountingExportData } from './accountingExport';
import {
  exportCompanyInfoPairs,
  formatDateOnly,
  formatMoneyCsv,
  formatMoneyOrNotTracked,
  toAsciiExportText,
} from './accountingExportFormatting';

// ---------------------------------------------------------------------------
// CSV helper
// ---------------------------------------------------------------------------

function csvRow(...cols: (string | number | null)[]): string {
  return (
    cols
      .map((c) => {
        const s = c === null ? '' : String(c);
        return `"${s.replace(/"/g, '""')}"`;
      })
      .join(',') + '\r\n'
  );
}

function downloadCsv(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Customers CSV
// ---------------------------------------------------------------------------

/**
 * Generates a customer list CSV from accepted proposal client data.
 * Column headers match common QuickBooks customer import format.
 */
export function buildQuickBooksCustomersCsvContent(data: AccountingExportData): string {
  let csv = '';
  for (const [label, value] of exportCompanyInfoPairs(data.company)) {
    csv += csvRow(label, value);
  }
  if (exportCompanyInfoPairs(data.company).length > 0) {
    csv += csvRow('');
  }
  // QuickBooks customer import columns (common subset)
  csv += csvRow('Name', 'Company', 'Email', 'Phone', 'Billing Address');

  const seen = new Set<string>();
  for (const row of [...data.recognizedProposals, ...data.excludedProposals]) {
    const name = row.clientName?.trim() || 'Unknown';
    if (seen.has(name)) continue;
    seen.add(name);
    csv += csvRow(name, '', '', '', '');
  }

  return csv;
}

export function downloadQuickBooksCustomersCsv(
  data: AccountingExportData,
  fileName?: string,
): void {
  const content = buildQuickBooksCustomersCsvContent(data);
  downloadCsv(content, fileName ?? `quickbooks-customers-${data.taxYear}.csv`);
}

// ---------------------------------------------------------------------------
// Invoices / Sales Receipts CSV
// ---------------------------------------------------------------------------

/**
 * Generates accepted proposals as invoice/sales receipt records.
 * Column headers are chosen to be compatible with QuickBooks import workflows.
 * These represent accepted proposal amounts — not verified payment records.
 */
export function buildQuickBooksInvoicesCsvContent(data: AccountingExportData): string {
  let csv = '';
  for (const [label, value] of exportCompanyInfoPairs(data.company)) {
    csv += csvRow(label, value);
  }
  if (exportCompanyInfoPairs(data.company).length > 0) {
    csv += csvRow('');
  }
  csv += csvRow(
    'Invoice No',
    'Customer',
    'Invoice Date',
    'Due Date',
    'Amount',
    'Status',
    'Description',
    'Source',
  );

  for (const row of data.recognizedProposals) {
    csv += csvRow(
      row.id.slice(0, 8).toUpperCase(),
      row.clientName || 'Unknown',
      formatDateOnly(row.recognitionDate ?? row.acceptedAt),
      '',
      formatMoneyCsv(row.totalRevenue),
      row.status,
      row.title,
      'Arden Project OS proposal',
    );
  }

  return csv;
}

export function downloadQuickBooksInvoicesCsv(
  data: AccountingExportData,
  fileName?: string,
): void {
  const content = buildQuickBooksInvoicesCsvContent(data);
  downloadCsv(content, fileName ?? `quickbooks-invoices-${data.taxYear}.csv`);
}

// ---------------------------------------------------------------------------
// Job Cost Summary CSV (NOT "Expenses CSV")
// ---------------------------------------------------------------------------

/**
 * Exports job-cost category totals from proposal data.
 * This is NOT a vendor expense ledger. These are estimates/job-cost summaries.
 *
 * Column naming deliberately avoids "expense" to prevent misrepresentation.
 */
export function buildJobCostSummaryCsvContent(data: AccountingExportData): string {
  let csv = '';
  for (const [label, value] of exportCompanyInfoPairs(data.company)) {
    csv += csvRow(label, value);
  }
  if (exportCompanyInfoPairs(data.company).length > 0) {
    csv += csvRow('');
  }
  csv += csvRow(
    'Proposal',
    'Client',
    'Tax Year',
    'Recognition Date',
    'Total Revenue',
    'Labor Job Cost',
    'Material Job Cost',
    'Gross Profit',
    'Margin %',
    'Note',
  );

  for (const row of data.recognizedProposals) {
    csv += csvRow(
      row.title,
      row.clientName || 'Unknown',
      data.taxYear,
      formatDateOnly(row.recognitionDate),
      formatMoneyCsv(row.totalRevenue),
      formatMoneyOrNotTracked(row.laborCostEstimate),
      formatMoneyOrNotTracked(row.materialCostEstimate),
      formatMoneyOrNotTracked(row.grossProfit),
      row.grossMarginPercent !== null ? `${row.grossMarginPercent.toFixed(1)}%` : 'Not tracked',
      'Job-cost estimate from proposal. Not a vendor expense record.',
    );
  }

  return csv;
}

export function downloadJobCostSummaryCsv(
  data: AccountingExportData,
  fileName?: string,
): void {
  const content = buildJobCostSummaryCsvContent(data);
  downloadCsv(content, fileName ?? `job-cost-summary-${data.taxYear}.csv`);
}

// ---------------------------------------------------------------------------
// TurboTax helper CSV (minimal — Phase 1)
// ---------------------------------------------------------------------------

export const TURBOTAX_HELPER_DISCLAIMER =
  'Direct TurboTax import support depends on TurboTax product/version ' +
  'and will be evaluated in a later phase. This file is a tax-prep helper only.';

/**
 * Minimal CSV for TurboTax manual entry assistance.
 * Does NOT promise direct TurboTax import. Does NOT produce TXF format.
 */
export function buildTurboTaxHelperCsvContent(data: AccountingExportData): string {
  let csv = '';
  csv += csvRow('Arden Project OS — TurboTax Helper Export');
  for (const [label, value] of exportCompanyInfoPairs(data.company)) {
    csv += csvRow(label, value);
  }
  csv += csvRow(`Tax Year: ${data.taxYear}`);
  csv += csvRow('');
  csv += csvRow('NOTICE', TURBOTAX_HELPER_DISCLAIMER);
  csv += csvRow('');
  csv += csvRow('Category', 'Amount (USD)', 'Notes');
  csv += csvRow('Gross Business Income', formatMoneyCsv(data.grossReceipts), 'From accepted proposals');
  csv += csvRow(
    'Contract Labor / Labor Costs',
    formatMoneyOrNotTracked(data.totalLaborEstimate),
    'Job-cost estimate. Review with CPA.',
  );
  csv += csvRow(
    'Materials / Supplies',
    formatMoneyOrNotTracked(data.totalMaterialEstimate),
    'Job-cost estimate. Review with CPA.',
  );
  csv += csvRow(
    'Gross Profit',
    formatMoneyOrNotTracked(data.totalGrossProfit),
    'From proposal records',
  );
  csv += csvRow('');
  csv += csvRow('This is NOT an official tax form or TurboTax-compatible import file.');
  csv += csvRow('Review all amounts with your CPA or tax preparer before filing.');
  return csv;
}

export function downloadTurboTaxHelperCsv(
  data: AccountingExportData,
  fileName?: string,
): void {
  const content = buildTurboTaxHelperCsvContent(data);
  downloadCsv(content, fileName ?? `turbotax-helper-${data.taxYear}.csv`);
}
