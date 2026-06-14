/**
 * Schedule C style summary export — CSV and PDF.
 *
 * GUARDRAILS (do not remove):
 * - Output MUST be labeled "Schedule C style summary" — never "Schedule C" alone.
 * - MUST include disclaimer: not tax advice, not an official IRS form.
 * - Zero / missing cost data MUST display "Not tracked", not $0.
 * - Explicit zero revenue (e.g. no change orders) displays $0.00.
 * - No network calls.
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { AccountingExportData } from './accountingExport';
import { ENTITY_TYPE_LABELS } from './accountingExport';
import {
  exportCompanyInfoPairs,
  formatMoneyCsv,
  formatMoneyOrNotTracked,
  roundMoney,
  toAsciiExportText,
} from './accountingExportFormatting';
import { savePDFWithPlatformSupport } from './pdf';

export const SCHEDULE_C_DISCLAIMER =
  'This export is a business records summary for bookkeeping and tax preparation. ' +
  'It is not tax advice and is not an official IRS form.';

export const SCHEDULE_C_LABEL = 'Schedule C style summary';

// ---------------------------------------------------------------------------
// Plain-data summary shape
// ---------------------------------------------------------------------------

export interface ScheduleCSummaryLine {
  label: string;
  amount: number | null;
  note?: string;
}

export interface ScheduleCSummary {
  label: string;
  taxYear: number;
  entityType: string;
  accountingMethod: string;
  disclaimer: string;
  grossReceipts: ScheduleCSummaryLine;
  pendingRevenue: ScheduleCSummaryLine;
  changeOrderRevenue: ScheduleCSummaryLine;
  directCosts: {
    labor: ScheduleCSummaryLine;
    materials: ScheduleCSummaryLine;
    total: ScheduleCSummaryLine;
  };
  grossProfit: ScheduleCSummaryLine;
  jobCostMarginEstimate: ScheduleCSummaryLine;
}

export function buildScheduleCSummary(data: AccountingExportData): ScheduleCSummary {
  const jobCostMargin =
    data.totalLaborEstimate !== null && data.totalMaterialEstimate !== null
      ? roundMoney(data.grossReceipts - data.totalLaborEstimate - data.totalMaterialEstimate)
      : null;

  const directCostTotal =
    data.totalLaborEstimate !== null || data.totalMaterialEstimate !== null
      ? roundMoney((data.totalLaborEstimate ?? 0) + (data.totalMaterialEstimate ?? 0))
      : null;

  return {
    label: SCHEDULE_C_LABEL,
    taxYear: data.taxYear,
    entityType: ENTITY_TYPE_LABELS[data.entityType],
    accountingMethod:
      data.accountingMethod === 'cash'
        ? 'Cash (based on paid/deposit timestamps)'
        : 'Accrual (based on accepted dates)',
    disclaimer: SCHEDULE_C_DISCLAIMER,
    grossReceipts: {
      label: 'Gross receipts / sales (accepted proposals)',
      amount: data.grossReceipts,
    },
    pendingRevenue: {
      label: 'Pipeline revenue (not yet accepted — not included in gross receipts)',
      amount: data.pendingRevenue,
      note: 'Informational only',
    },
    changeOrderRevenue: {
      label: 'Accepted change order revenue',
      amount: data.changeOrderRevenue,
    },
    directCosts: {
      labor: {
        label: 'Contract labor / labor costs (job-cost estimate)',
        amount: data.totalLaborEstimate,
        note:
          data.totalLaborEstimate === null
            ? 'Not tracked — labor and subcontractor costs may be combined'
            : undefined,
      },
      materials: {
        label: 'Materials / supplies (job-cost estimate)',
        amount: data.totalMaterialEstimate,
        note:
          data.totalMaterialEstimate === null
            ? 'Not tracked — materials and equipment costs may be combined'
            : undefined,
      },
      total: {
        label: 'Total direct job costs',
        amount: directCostTotal,
      },
    },
    grossProfit: {
      label: 'Gross profit (from proposal records)',
      amount: data.totalGrossProfit,
    },
    jobCostMarginEstimate: {
      label: 'Job-cost margin estimate (gross receipts - direct job costs)',
      amount: jobCostMargin,
      note: 'Estimate only. Excludes overhead, indirect costs not tracked in this app.',
    },
  };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvRow(...cols: string[]): string {
  return cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',') + '\r\n';
}

function amountDisplay(v: number | null): string {
  if (v === null) return 'Not tracked';
  return `$${formatMoneyCsv(v)}`;
}

export function buildScheduleCSummaryCsvContent(
  summary: ScheduleCSummary,
  companyPairs: [string, string][] = [],
): string {
  let csv = '';
  csv += csvRow('Arden Project OS — Schedule C Style Summary');
  for (const [label, value] of companyPairs) {
    csv += csvRow(label, value);
  }
  csv += csvRow(`Tax Year: ${summary.taxYear}`);
  csv += csvRow(`Entity Type: ${summary.entityType}`);
  csv += csvRow(`Accounting Method: ${summary.accountingMethod}`);
  csv += csvRow('');
  csv += csvRow('DISCLAIMER', summary.disclaimer);
  csv += csvRow('');
  csv += csvRow('Category', 'Amount (USD)', 'Notes');

  const rawAmount = (v: number | null) => formatMoneyOrNotTracked(v);
  const line = (l: ScheduleCSummaryLine) =>
    csvRow(toAsciiExportText(l.label), rawAmount(l.amount), l.note ?? '');

  csv += line(summary.grossReceipts);
  csv += line(summary.changeOrderRevenue);
  csv += line(summary.pendingRevenue);
  csv += csvRow('');
  csv += csvRow('--- Direct Job Costs (estimates) ---', '', '');
  csv += line(summary.directCosts.labor);
  csv += line(summary.directCosts.materials);
  csv += line(summary.directCosts.total);
  csv += csvRow('');
  csv += line(summary.grossProfit);
  csv += line(summary.jobCostMarginEstimate);

  return csv;
}

export function downloadScheduleCSummaryCsv(
  data: AccountingExportData,
  fileName?: string,
): void {
  const summary = buildScheduleCSummary(data);
  const content = buildScheduleCSummaryCsvContent(
    summary,
    exportCompanyInfoPairs(data.company),
  );
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName ?? `schedule-c-style-summary-${data.taxYear}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export async function downloadScheduleCSummaryPdf(
  data: AccountingExportData,
  fileName?: string,
): Promise<void> {
  const summary = buildScheduleCSummary(data);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(toAsciiExportText(`Arden Project OS — ${SCHEDULE_C_LABEL}`), margin, y);
  y += 22;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  for (const [label, value] of exportCompanyInfoPairs(data.company)) {
    doc.text(toAsciiExportText(`${label}: ${value}`), margin, y);
    y += 14;
  }
  doc.text(`Tax Year: ${summary.taxYear}`, margin, y);
  y += 14;
  doc.text(toAsciiExportText(`Entity Type: ${summary.entityType}`), margin, y);
  y += 14;
  doc.text(toAsciiExportText(`Accounting Method: ${summary.accountingMethod}`), margin, y);
  y += 20;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  const disclaimerLines = doc.splitTextToSize(toAsciiExportText(SCHEDULE_C_DISCLAIMER), contentWidth);
  doc.text(disclaimerLines, margin, y);
  y += disclaimerLines.length * 12 + 16;

  doc.setFont('helvetica', 'normal');
  const tableRows: [string, string, string][] = [
    [summary.grossReceipts.label, amountDisplay(summary.grossReceipts.amount), ''],
    [
      summary.changeOrderRevenue.label,
      amountDisplay(summary.changeOrderRevenue.amount),
      summary.changeOrderRevenue.note ?? '',
    ],
    [
      summary.pendingRevenue.label,
      amountDisplay(summary.pendingRevenue.amount),
      summary.pendingRevenue.note ?? '',
    ],
    ['', '', ''],
    ['--- Direct Job Costs (estimates) ---', '', ''],
    [
      summary.directCosts.labor.label,
      amountDisplay(summary.directCosts.labor.amount),
      summary.directCosts.labor.note ?? '',
    ],
    [
      summary.directCosts.materials.label,
      amountDisplay(summary.directCosts.materials.amount),
      summary.directCosts.materials.note ?? '',
    ],
    [summary.directCosts.total.label, amountDisplay(summary.directCosts.total.amount), ''],
    ['', '', ''],
    [summary.grossProfit.label, amountDisplay(summary.grossProfit.amount), ''],
    [
      summary.jobCostMarginEstimate.label,
      amountDisplay(summary.jobCostMarginEstimate.amount),
      summary.jobCostMarginEstimate.note ?? '',
    ],
  ].map(([label, amount, note]) => [
    toAsciiExportText(label),
    amount,
    toAsciiExportText(note),
  ]);

  doc.autoTable({
    startY: y,
    head: [['Category', 'Amount (USD)', 'Notes']],
    body: tableRows,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: { fontSize: 9, overflow: 'linebreak', cellWidth: 'wrap' },
    headStyles: { fillColor: [30, 64, 175] },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.52 },
      1: { halign: 'right', cellWidth: contentWidth * 0.18 },
      2: { cellWidth: contentWidth * 0.3 },
    },
  });

  const outFile = fileName ?? `schedule-c-style-summary-${data.taxYear}.pdf`;
  await savePDFWithPlatformSupport(doc, outFile, 'Schedule C Style Summary');
}
