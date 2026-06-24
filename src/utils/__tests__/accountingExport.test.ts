import { describe, expect, it } from 'vitest';
import {
  buildAccountingExportData,
  proposalRecognitionDate,
  DEFAULT_ACCOUNTING_SETTINGS,
  NON_SCHEDULE_C_ENTITIES,
  type AccountingExportSettings,
} from '../accountingExport';
import type { TrackedProposalRow } from '../../types/proposalTracking';
import type { ChangeOrder } from '../../types/changeOrder';
import type { Project } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProposal(overrides: Partial<TrackedProposalRow> = {}): TrackedProposalRow {
  return {
    id: 'p-1',
    user_id: 'user-1',
    project_id: null,
    title: 'Test Proposal',
    template_type: 'minimal',
    data: {} as TrackedProposalRow['data'],
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    status: 'accepted',
    sent_at: null,
    viewed_at: null,
    opened_at: null,
    accepted_at: '2025-06-01T00:00:00.000Z',
    declined_at: null,
    deposit_paid_at: null,
    scheduled_at: null,
    paid_at: null,
    total_amount: 10000,
    labor_cost: 4000,
    material_cost: 2000,
    deposit_amount: 5000,
    gross_profit: 4000,
    gross_margin_percent: 40,
    public_token: 'tok-1',
    ...overrides,
  };
}

const NO_COS: ChangeOrder[] = [];
const NO_PROJECTS: Project[] = [];

const settings2025: AccountingExportSettings = {
  ...DEFAULT_ACCOUNTING_SETTINGS,
  taxYear: 2025,
  accountingMethod: 'accrual',
  entityType: 'sole_proprietor',
  taxCategoryMap: {},
};

// ---------------------------------------------------------------------------
// Cash vs accrual filtering
// ---------------------------------------------------------------------------

describe('buildAccountingExportData — accrual method', () => {
  it('includes accepted proposals using accepted_at date', () => {
    const p = makeProposal({ accepted_at: '2025-03-01T00:00:00.000Z' });
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, settings2025);
    expect(result.recognizedProposals).toHaveLength(1);
    expect(result.recognizedProposals[0].id).toBe('p-1');
  });

  it('excludes proposals with accepted_at in a different year', () => {
    const p = makeProposal({ accepted_at: '2024-12-31T00:00:00.000Z' });
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, settings2025);
    expect(result.recognizedProposals).toHaveLength(0);
    expect(result.excludedProposals).toHaveLength(1);
  });

  it('excludes proposals with no accepted_at', () => {
    const p = makeProposal({ accepted_at: null });
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, settings2025);
    expect(result.recognizedProposals).toHaveLength(0);
    expect(result.excludedProposals).toHaveLength(1);
  });
});

describe('buildAccountingExportData — cash method', () => {
  const cashSettings: AccountingExportSettings = {
    ...settings2025,
    accountingMethod: 'cash',
  };

  it('includes proposals with paid_at in the tax year', () => {
    const p = makeProposal({
      accepted_at: '2024-11-01T00:00:00.000Z', // different year
      paid_at: '2025-04-01T00:00:00.000Z',
    });
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, cashSettings);
    expect(result.recognizedProposals).toHaveLength(1);
  });

  it('includes proposals with deposit_paid_at but no paid_at', () => {
    const p = makeProposal({
      deposit_paid_at: '2025-02-15T00:00:00.000Z',
      paid_at: null,
    });
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, cashSettings);
    expect(result.recognizedProposals).toHaveLength(1);
  });

  it('excludes accepted proposals with no paid_at and no deposit_paid_at', () => {
    const p = makeProposal({ paid_at: null, deposit_paid_at: null });
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, cashSettings);
    expect(result.recognizedProposals).toHaveLength(0);
    expect(result.excludedProposals).toHaveLength(1);
    expect(result.hasMissingCashTimestamps).toBe(true);
  });

  it('sets hasMissingCashTimestamps = false when all have timestamps', () => {
    const p = makeProposal({ paid_at: '2025-01-01T00:00:00.000Z' });
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, cashSettings);
    expect(result.hasMissingCashTimestamps).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Zero / missing cost data — never fabricate
// ---------------------------------------------------------------------------

describe('buildAccountingExportData — cost data', () => {
  it('returns null for labor/material costs when they are zero', () => {
    const p = makeProposal({ labor_cost: 0, material_cost: 0 });
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, settings2025);
    expect(result.recognizedProposals[0].laborCostEstimate).toBeNull();
    expect(result.recognizedProposals[0].materialCostEstimate).toBeNull();
  });

  it('returns null totalLaborEstimate when all proposals have zero labor_cost', () => {
    const p = makeProposal({ labor_cost: 0 });
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, settings2025);
    expect(result.totalLaborEstimate).toBeNull();
  });

  it('returns null totalMaterialEstimate when all proposals have zero material_cost', () => {
    const p = makeProposal({ material_cost: 0 });
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, settings2025);
    expect(result.totalMaterialEstimate).toBeNull();
  });

  it('sums non-zero labor costs correctly', () => {
    const p1 = makeProposal({ id: 'a', labor_cost: 3000 });
    const p2 = makeProposal({ id: 'b', labor_cost: 2000 });
    const result = buildAccountingExportData([p1, p2], NO_COS, NO_PROJECTS, settings2025);
    expect(result.totalLaborEstimate).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

describe('buildAccountingExportData — warnings', () => {
  it('adds cash_missing_timestamps warning when cash method has no timestamps', () => {
    const p = makeProposal({ paid_at: null, deposit_paid_at: null });
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, {
      ...settings2025,
      accountingMethod: 'cash',
    });
    const keys = result.warnings.map((w) => w.key);
    expect(keys).toContain('cash_missing_timestamps');
    expect(result.warnings.find((w) => w.key === 'cash_missing_timestamps')?.message).toContain(
      'paid/deposit timestamps',
    );
  });

  it('adds non_schedule_c_entity warning for LLC', () => {
    const p = makeProposal();
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, {
      ...settings2025,
      entityType: 'llc',
    });
    const keys = result.warnings.map((w) => w.key);
    expect(keys).toContain('non_schedule_c_entity');
  });

  it('adds non_schedule_c_entity warning for S-Corp', () => {
    const result = buildAccountingExportData([makeProposal()], NO_COS, NO_PROJECTS, {
      ...settings2025,
      entityType: 's_corp',
    });
    expect(result.warnings.map((w) => w.key)).toContain('non_schedule_c_entity');
  });

  it('does NOT add non_schedule_c_entity warning for sole_proprietor', () => {
    const result = buildAccountingExportData([makeProposal()], NO_COS, NO_PROJECTS, {
      ...settings2025,
      entityType: 'sole_proprietor',
    });
    expect(result.warnings.map((w) => w.key)).not.toContain('non_schedule_c_entity');
  });

  it('does NOT add no_recognized_revenue warning when no proposals match (checklist covers it)', () => {
    const p = makeProposal({ accepted_at: '2020-01-01T00:00:00.000Z' });
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, settings2025);
    expect(result.warnings.map((w) => w.key)).not.toContain('no_recognized_revenue');
    expect(result.warnings.map((w) => w.key)).not.toContain('no_cost_data');
  });
});

// ---------------------------------------------------------------------------
// NON_SCHEDULE_C_ENTITIES list
// ---------------------------------------------------------------------------

describe('NON_SCHEDULE_C_ENTITIES', () => {
  it('includes llc, s_corp, c_corp, partnership', () => {
    expect(NON_SCHEDULE_C_ENTITIES).toContain('llc');
    expect(NON_SCHEDULE_C_ENTITIES).toContain('s_corp');
    expect(NON_SCHEDULE_C_ENTITIES).toContain('c_corp');
    expect(NON_SCHEDULE_C_ENTITIES).toContain('partnership');
  });

  it('does not include sole_proprietor', () => {
    expect(NON_SCHEDULE_C_ENTITIES).not.toContain('sole_proprietor');
  });
});

// ---------------------------------------------------------------------------
// proposalRecognitionDate
// ---------------------------------------------------------------------------

describe('proposalRecognitionDate', () => {
  it('accrual: returns accepted_at', () => {
    const p = makeProposal({ accepted_at: '2025-05-01T00:00:00.000Z' });
    expect(proposalRecognitionDate(p, 'accrual')).toBe('2025-05-01T00:00:00.000Z');
  });

  it('cash: returns paid_at when available', () => {
    const p = makeProposal({
      paid_at: '2025-06-01T00:00:00.000Z',
      deposit_paid_at: '2025-01-01T00:00:00.000Z',
    });
    expect(proposalRecognitionDate(p, 'cash')).toBe('2025-06-01T00:00:00.000Z');
  });

  it('cash: falls back to deposit_paid_at when paid_at is null', () => {
    const p = makeProposal({
      paid_at: null,
      deposit_paid_at: '2025-03-01T00:00:00.000Z',
    });
    expect(proposalRecognitionDate(p, 'cash')).toBe('2025-03-01T00:00:00.000Z');
  });

  it('cash: returns null when no timestamps', () => {
    const p = makeProposal({ paid_at: null, deposit_paid_at: null });
    expect(proposalRecognitionDate(p, 'cash')).toBeNull();
  });
});

describe('buildAccountingExportData — company settings', () => {
  it('passes company block through to export data', () => {
    const settings: AccountingExportSettings = {
      ...settings2025,
      company: { name: 'Arden Concrete LLC', email: 'ops@arden.test' },
    };
    const result = buildAccountingExportData([], NO_COS, NO_PROJECTS, settings);
    expect(result.company).toEqual({
      name: 'Arden Concrete LLC',
      email: 'ops@arden.test',
    });
  });

  it('rounds aggregate revenue totals to two decimals', () => {
    const p = makeProposal({ total_amount: 10000.555 });
    const result = buildAccountingExportData([p], NO_COS, NO_PROJECTS, settings2025);
    expect(result.grossReceipts).toBe(10000.56);
  });
});
