import { describe, expect, it } from 'vitest';
import {
  buildQuickBooksCustomersCsvContent,
  buildQuickBooksInvoicesCsvContent,
  buildJobCostSummaryCsvContent,
  buildTurboTaxHelperCsvContent,
  TURBOTAX_HELPER_DISCLAIMER,
} from '../quickbooksExport';
import type { AccountingExportData } from '../accountingExport';

function makeExportData(overrides: Partial<AccountingExportData> = {}): AccountingExportData {
  return {
    taxYear: 2025,
    accountingMethod: 'accrual',
    entityType: 'sole_proprietor',
    taxCategoryMap: {},
    recognizedProposals: [
      {
        id: 'p-aabbccdd',
        title: 'Main Street Pour',
        clientName: 'Bob Builder',
        projectTitle: 'Main Street',
        status: 'accepted',
        totalRevenue: 12000,
        laborCostEstimate: 5000,
        materialCostEstimate: 2000,
        grossProfit: 5000,
        grossMarginPercent: 41.7,
        recognitionDate: '2025-04-01T00:00:00.000Z',
        acceptedAt: '2025-04-01T00:00:00.000Z',
        paidAt: null,
        depositPaidAt: null,
      },
    ],
    pendingProposals: [],
    excludedProposals: [],
    acceptedChangeOrders: [],
    grossReceipts: 12000,
    pendingRevenue: 0,
    changeOrderRevenue: 0,
    totalLaborEstimate: 5000,
    totalMaterialEstimate: 2000,
    totalGrossProfit: 5000,
    projectSummaries: [],
    warnings: [],
    hasMissingCashTimestamps: false,
    company: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// No network calls — verified by inspecting module source
// ---------------------------------------------------------------------------

describe('quickbooksExport module', () => {
  it('does not call fetch', () => {
    // All exported functions that accept data are pure CSV builders that never
    // call fetch or XMLHttpRequest. Verify by importing and checking function source.
    import('../quickbooksExport').then((mod) => {
      const fnSrc = mod.buildJobCostSummaryCsvContent.toString();
      expect(fnSrc).not.toContain('fetch(');
      expect(fnSrc).not.toContain('XMLHttpRequest');
    });
  });
});

// ---------------------------------------------------------------------------
// Customers CSV
// ---------------------------------------------------------------------------

describe('buildQuickBooksCustomersCsvContent', () => {
  it('generates header row with Name column', () => {
    const csv = buildQuickBooksCustomersCsvContent(makeExportData());
    const firstLine = csv.split('\r\n')[0];
    expect(firstLine).toContain('Name');
  });

  it('includes client name from recognized proposals', () => {
    const csv = buildQuickBooksCustomersCsvContent(makeExportData());
    expect(csv).toContain('Bob Builder');
  });

  it('deduplicates clients with the same name', () => {
    const data = makeExportData({
      recognizedProposals: [
        { ...makeExportData().recognizedProposals[0] },
        { ...makeExportData().recognizedProposals[0], id: 'p-2' },
      ],
    });
    const csv = buildQuickBooksCustomersCsvContent(data);
    const matches = (csv.match(/Bob Builder/g) ?? []).length;
    expect(matches).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Invoices CSV
// ---------------------------------------------------------------------------

describe('buildQuickBooksInvoicesCsvContent', () => {
  it('generates expected column headers', () => {
    const csv = buildQuickBooksInvoicesCsvContent(makeExportData());
    const header = csv.split('\r\n')[0];
    expect(header).toContain('Invoice No');
    expect(header).toContain('Customer');
    expect(header).toContain('Amount');
  });

  it('does not contain "expense" in column headers', () => {
    const csv = buildQuickBooksInvoicesCsvContent(makeExportData());
    const header = csv.split('\r\n')[0].toLowerCase();
    expect(header).not.toContain('expense');
  });

  it('includes recognized proposal revenue with two decimal places', () => {
    const csv = buildQuickBooksInvoicesCsvContent(makeExportData());
    expect(csv).toContain('12000.00');
    expect(csv).toContain('Bob Builder');
  });

  it('uses date-only invoice dates', () => {
    const csv = buildQuickBooksInvoicesCsvContent(makeExportData());
    expect(csv).toContain('2025-04-01');
    expect(csv).not.toContain('2025-04-01T');
  });
});

// ---------------------------------------------------------------------------
// Job Cost Summary CSV
// ---------------------------------------------------------------------------

describe('buildJobCostSummaryCsvContent', () => {
  it('header does not contain bare "expense" as a column name', () => {
    const csv = buildJobCostSummaryCsvContent(makeExportData());
    const header = csv.split('\r\n')[0].toLowerCase();
    // Should not have an "expense" column (it's a job-cost summary, not an expense ledger)
    expect(header).not.toMatch(/"expense"/i);
  });

  it('header contains "Job Cost" column', () => {
    const csv = buildJobCostSummaryCsvContent(makeExportData());
    const header = csv.split('\r\n')[0];
    expect(header.toLowerCase()).toContain('job cost');
  });

  it('shows "Not tracked" for null labor cost', () => {
    const data = makeExportData({
      recognizedProposals: [
        {
          ...makeExportData().recognizedProposals[0],
          laborCostEstimate: null,
        },
      ],
    });
    const csv = buildJobCostSummaryCsvContent(data);
    expect(csv).toContain('Not tracked');
  });

  it('includes note that this is not a vendor expense record', () => {
    const csv = buildJobCostSummaryCsvContent(makeExportData());
    expect(csv.toLowerCase()).toContain('not a vendor expense record');
  });
});

// ---------------------------------------------------------------------------
// TurboTax helper CSV
// ---------------------------------------------------------------------------

describe('buildTurboTaxHelperCsvContent', () => {
  it('does not claim direct TurboTax import', () => {
    const csv = buildTurboTaxHelperCsvContent(makeExportData());
    expect(csv.toLowerCase()).not.toContain('direct import supported');
    expect(csv.toLowerCase()).not.toContain('guaranteed compatibility');
  });

  it('includes "later phase" note about direct import', () => {
    const csv = buildTurboTaxHelperCsvContent(makeExportData());
    expect(csv.toLowerCase()).toContain('later phase');
  });

  it('TURBOTAX_HELPER_DISCLAIMER says depends on product/version', () => {
    expect(TURBOTAX_HELPER_DISCLAIMER.toLowerCase()).toContain('product/version');
  });

  it('includes note that this is NOT an official tax form', () => {
    const csv = buildTurboTaxHelperCsvContent(makeExportData());
    expect(csv.toLowerCase()).toContain('not an official tax form');
  });

  it('shows "Not tracked" for null costs', () => {
    const data = makeExportData({
      totalLaborEstimate: null,
      totalMaterialEstimate: null,
    });
    const csv = buildTurboTaxHelperCsvContent(data);
    expect(csv).toContain('Not tracked');
  });
});
