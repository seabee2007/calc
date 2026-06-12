import { describe, expect, it } from 'vitest';
import {
  buildScheduleCSummary,
  buildScheduleCSummaryCsvContent,
  SCHEDULE_C_DISCLAIMER,
  SCHEDULE_C_LABEL,
} from '../scheduleCExport';
import type { AccountingExportData } from '../accountingExport';
import { DEFAULT_ACCOUNTING_SETTINGS } from '../accountingExport';

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
    grossReceipts: 50000,
    pendingRevenue: 10000,
    changeOrderRevenue: 0,
    totalLaborEstimate: 20000,
    totalMaterialEstimate: 8000,
    totalGrossProfit: 22000,
    projectSummaries: [],
    warnings: [],
    hasMissingCashTimestamps: false,
    ...overrides,
  };
}

describe('SCHEDULE_C_LABEL', () => {
  it('contains "style summary"', () => {
    expect(SCHEDULE_C_LABEL).toContain('style summary');
  });
});

describe('SCHEDULE_C_DISCLAIMER', () => {
  it('says not tax advice', () => {
    expect(SCHEDULE_C_DISCLAIMER).toContain('not tax advice');
  });

  it('says not an official IRS form', () => {
    expect(SCHEDULE_C_DISCLAIMER.toLowerCase()).toContain('not an official irs form');
  });
});

describe('buildScheduleCSummary', () => {
  it('uses SCHEDULE_C_LABEL as label', () => {
    const summary = buildScheduleCSummary(makeExportData());
    expect(summary.label).toBe(SCHEDULE_C_LABEL);
  });

  it('includes disclaimer text', () => {
    const summary = buildScheduleCSummary(makeExportData());
    expect(summary.disclaimer).toBe(SCHEDULE_C_DISCLAIMER);
  });

  it('returns null labor when labor estimate is null', () => {
    const summary = buildScheduleCSummary(makeExportData({ totalLaborEstimate: null }));
    expect(summary.directCosts.labor.amount).toBeNull();
  });

  it('returns null materials when material estimate is null', () => {
    const summary = buildScheduleCSummary(makeExportData({ totalMaterialEstimate: null }));
    expect(summary.directCosts.materials.amount).toBeNull();
  });

  it('computes net profit when costs are available', () => {
    const summary = buildScheduleCSummary(
      makeExportData({
        grossReceipts: 50000,
        totalLaborEstimate: 20000,
        totalMaterialEstimate: 8000,
      }),
    );
    expect(summary.netProfitEstimate.amount).toBe(22000);
  });

  it('returns null net profit when labor is null', () => {
    const summary = buildScheduleCSummary(
      makeExportData({ totalLaborEstimate: null }),
    );
    expect(summary.netProfitEstimate.amount).toBeNull();
  });
});

describe('buildScheduleCSummaryCsvContent', () => {
  it('contains "style summary" in output', () => {
    const csv = buildScheduleCSummaryCsvContent(buildScheduleCSummary(makeExportData()));
    expect(csv.toLowerCase()).toContain('style summary');
  });

  it('contains disclaimer text', () => {
    const csv = buildScheduleCSummaryCsvContent(buildScheduleCSummary(makeExportData()));
    expect(csv).toContain('not tax advice');
    expect(csv.toLowerCase()).toContain('not an official irs form');
  });

  it('shows "Not tracked" for null labor cost, not "$0"', () => {
    const csv = buildScheduleCSummaryCsvContent(
      buildScheduleCSummary(makeExportData({ totalLaborEstimate: null })),
    );
    expect(csv).toContain('Not tracked');
    expect(csv).not.toMatch(/"\$0\.00"/);
  });
});
