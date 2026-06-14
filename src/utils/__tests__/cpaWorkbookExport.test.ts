import { describe, expect, it } from 'vitest';
import { buildCpaWorkbook, CPA_WORKBOOK_SHEET_NAMES } from '../cpaWorkbookExport';
import type { AccountingExportData } from '../accountingExport';

function makeExportData(overrides: Partial<AccountingExportData> = {}): AccountingExportData {
  return {
    taxYear: 2025,
    accountingMethod: 'accrual',
    entityType: 'sole_proprietor',
    taxCategoryMap: {},
    recognizedProposals: [],
    pendingProposals: [],
    excludedProposals: [],
    acceptedChangeOrders: [],
    grossReceipts: 30000,
    pendingRevenue: 5000,
    changeOrderRevenue: 0,
    totalLaborEstimate: null,
    totalMaterialEstimate: null,
    totalGrossProfit: null,
    projectSummaries: [],
    warnings: [],
    hasMissingCashTimestamps: false,
    company: {},
    ...overrides,
  };
}

describe('buildCpaWorkbook', () => {
  it('creates a workbook with all required sheet names', () => {
    const wb = buildCpaWorkbook(makeExportData());
    const sheetNames = wb.SheetNames;
    for (const name of CPA_WORKBOOK_SHEET_NAMES) {
      expect(sheetNames).toContain(name);
    }
  });

  it('creates exactly the right number of sheets', () => {
    const wb = buildCpaWorkbook(makeExportData());
    expect(wb.SheetNames).toHaveLength(CPA_WORKBOOK_SHEET_NAMES.length);
  });

  it('Summary sheet contains disclaimer text', () => {
    const wb = buildCpaWorkbook(makeExportData());
    const summarySheet = wb.Sheets['Summary'];
    const cellValues = Object.values(summarySheet)
      .filter((c): c is { v: unknown } => typeof c === 'object' && c !== null && 'v' in c)
      .map((c) => String(c.v));
    const combined = cellValues.join(' ');
    expect(combined.toLowerCase()).toContain('not tax advice');
    expect(combined.toLowerCase()).toContain('not an official irs form');
  });

  it('Summary sheet contains "Schedule C style summary" label', () => {
    const wb = buildCpaWorkbook(makeExportData());
    const summarySheet = wb.Sheets['Summary'];
    const cellValues = Object.values(summarySheet)
      .filter((c): c is { v: unknown } => typeof c === 'object' && c !== null && 'v' in c)
      .map((c) => String(c.v));
    const combined = cellValues.join(' ').toLowerCase();
    expect(combined).toContain('style summary');
    expect(combined).toContain('not an official irs form');
  });

  it('shows zero change order revenue as 0, not Not tracked', () => {
    const wb = buildCpaWorkbook(makeExportData({ changeOrderRevenue: 0 }));
    const summarySheet = wb.Sheets['Summary'];
    const cellValues = Object.values(summarySheet)
      .filter((c): c is { v: unknown } => typeof c === 'object' && c !== null && 'v' in c)
      .map((c) => c.v);
    expect(cellValues).toContain(0);
    const coRow = Object.values(summarySheet).find(
      (c) => typeof c === 'object' && c !== null && 'v' in c && c.v === 'Change Order Revenue (accepted)',
    );
    expect(coRow).toBeDefined();
  });

  it('includes company name on Summary sheet when provided', () => {
    const wb = buildCpaWorkbook(
      makeExportData({ company: { name: 'Summit Builders' } }),
    );
    const summarySheet = wb.Sheets['Summary'];
    const cellValues = Object.values(summarySheet)
      .filter((c): c is { v: unknown } => typeof c === 'object' && c !== null && 'v' in c)
      .map((c) => String(c.v));
    expect(cellValues.join(' ')).toContain('Summit Builders');
  });
});
