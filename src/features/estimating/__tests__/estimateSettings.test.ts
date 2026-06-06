import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildEstimateDraftSnapshot } from '../application/buildEstimateDraftSnapshot';
import { createEmptyDraftLine } from '../application/estimateDraftLine';
import {
  DEFAULT_ESTIMATE_SETTINGS,
  ESTIMATE_SETTINGS_SHEET_NAME,
  buildEstimateTotalsFromSettings,
  estimateSettingsRowsForExport,
  estimateSettingsToAssumptions,
  mergeEstimateSettingsFromUserSources,
  normalizeEstimateSettings,
  parseEstimateSettingsFromAssumptions,
  parseEstimateSettingsSheetRows,
} from '../application/estimateSettings';
import { buildEstimateLineSnapshot } from '../domain/estimateSnapshot';
import { buildBlankEstimateTemplateWorkbook, buildEstimateWorkbook } from '../importExport/estimateExportBuilder';
import { parseEstimateWorkbook } from '../importExport/estimateImportParser';
import type { CurrentEstimate } from '../application/currentEstimateService';

function populatedDraftLine() {
  const draft = createEmptyDraftLine();
  draft.task.title = 'Pour slab';
  draft.task.lineItem.quantity.quantity = 100;
  draft.task.lineItem.labor = {
    productionRate: 10,
    productionRateType: 'units_per_labor_hour',
    hoursPerDay: 8,
    crewSize: 2,
    laborRate: 50,
    burdenPercent: 10,
  };
  draft.task.lineItem.material = { unitCost: 5 };
  draft.task.lineItem.equipment = { rate: 200, rateType: 'lump_sum', usageUnits: 1 };
  draft.task.lineItem.subcontractor = { cost: 100 };
  return draft;
}

describe('estimateSettings', () => {
  it('parses settings from assumptions.estimateSettings', () => {
    const settings = parseEstimateSettingsFromAssumptions({
      estimateSettings: {
        overheadPercent: 12,
        profitPercent: 8,
        currency: 'CAD',
      },
    });

    expect(settings.overheadPercent).toBe(12);
    expect(settings.profitPercent).toBe(8);
    expect(settings.currency).toBe('CAD');
  });

  it('falls back to app defaults when assumptions settings are missing', () => {
    expect(parseEstimateSettingsFromAssumptions({})).toEqual(DEFAULT_ESTIMATE_SETTINGS);
  });

  it('merges only available user settings without inventing values', () => {
    const merged = mergeEstimateSettingsFromUserSources(DEFAULT_ESTIMATE_SETTINGS, {
      preferences: { currency: 'EUR' },
      company: {
        taxRatePercent: 7.5,
        taxApplication: 'materials_only',
        taxSystem: 'sales_tax',
      },
    });

    expect(merged.currency).toBe('EUR');
    expect(merged.taxPercent).toBe(7.5);
    expect(merged.taxBase).toBe('materials_only');
    expect(merged.overheadPercent).toBe(0);
    expect(merged.importedFromUserSettingsAt).toBeTruthy();
  });

  it('uses app defaults when company tax system is none', () => {
    const merged = mergeEstimateSettingsFromUserSources(
      { ...DEFAULT_ESTIMATE_SETTINGS, taxPercent: 5 },
      {
        company: {
          taxRatePercent: 8,
          taxApplication: 'entire_project',
          taxSystem: 'none',
        },
      },
    );

    expect(merged.taxPercent).toBe(0);
    expect(merged.taxBase).toBe('none');
  });

  it('calculates project totals from project-wide settings', () => {
    const draft = populatedDraftLine();
    const lineSnapshot = buildEstimateLineSnapshot(draft.task.lineItem);
    const totals = buildEstimateTotalsFromSettings([lineSnapshot], {
      indirectCostPercent: 5,
      overheadPercent: 10,
      profitPercent: 8,
      contingencyPercent: 2,
      taxPercent: 4,
      overheadBase: 'direct_cost',
      profitBase: 'direct_plus_overhead',
      taxBase: 'total_estimate',
    });

    expect(totals.directCost).toBeGreaterThan(0);
    expect(totals.indirectCost).toBeGreaterThan(0);
    expect(totals.overhead).toBeGreaterThan(0);
    expect(totals.profit).toBeGreaterThan(0);
    expect(totals.contingency).toBeGreaterThan(0);
    expect(totals.tax).toBeGreaterThan(0);
    expect(totals.finalSellPrice).toBeGreaterThan(totals.directCost);
  });

  it('persists settings through estimateSettingsToAssumptions', () => {
    const assumptions = estimateSettingsToAssumptions(
      normalizeEstimateSettings({ overheadPercent: 15, hoursPerDay: 10 }),
      { quickFeasibility: { kept: true } },
    );

    expect(assumptions.quickFeasibility).toEqual({ kept: true });
    expect(parseEstimateSettingsFromAssumptions(assumptions).overheadPercent).toBe(15);
    expect(parseEstimateSettingsFromAssumptions(assumptions).hoursPerDay).toBe(10);
  });

  it('buildEstimateDraftSnapshot uses project settings for totals', () => {
    const snapshot = buildEstimateDraftSnapshot({
      estimateId: 'est-1',
      projectId: 'proj-1',
      versionNumber: 1,
      estimateType: 'bid',
      draftLines: [populatedDraftLine()],
      estimateSettings: {
        overheadPercent: 10,
        profitPercent: 5,
      },
    });

    expect(snapshot.totals.overhead).toBeGreaterThan(0);
    expect(snapshot.totals.profit).toBeGreaterThan(0);
    expect(snapshot.totals.finalSellPrice).toBeGreaterThan(snapshot.totals.directCost);
  });

  it('exports and imports Estimate Settings sheet rows', () => {
    const estimate: CurrentEstimate = {
      id: 'estimate-1',
      projectId: 'project-1',
      estimateType: 'bid',
      status: 'draft',
      selectedDivisions: [],
      lineItems: [populatedDraftLine().task],
      totals: {},
      summary: {},
      assumptions: estimateSettingsToAssumptions(
        normalizeEstimateSettings({ overheadPercent: 11, profitPercent: 7, currency: 'USD' }),
      ),
      createdBy: null,
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    };

    const workbook = buildEstimateWorkbook(estimate, 'Demo Project');
    expect(workbook.SheetNames).toContain(ESTIMATE_SETTINGS_SHEET_NAME);

    const parsed = parseEstimateWorkbook(workbook);
    expect(parsed.estimateSettings?.overheadPercent).toBe(11);
    expect(parsed.estimateSettings?.profitPercent).toBe(7);
    expect(parsed.estimateSettings?.currency).toBe('USD');
  });

  it('includes Estimate Settings sheet in blank import template', () => {
    const workbook = buildBlankEstimateTemplateWorkbook();
    expect(workbook.SheetNames).toContain(ESTIMATE_SETTINGS_SHEET_NAME);

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[ESTIMATE_SETTINGS_SHEET_NAME],
    );
    expect(rows.some((row) => row.setting === 'default_labor_rate')).toBe(true);
  });

  it('parses settings sheet rows by setting key', () => {
    const patch = parseEstimateSettingsSheetRows([
      { setting: 'overhead_percent', value: 14 },
      { setting: 'profit_percent', value: 6 },
      { setting: 'tax_base', value: 'materials_only' },
    ]);

    expect(patch?.overheadPercent).toBe(14);
    expect(patch?.profitPercent).toBe(6);
    expect(patch?.taxBase).toBe('materials_only');
  });

  it('exports all expected setting keys', () => {
    const rows = estimateSettingsRowsForExport(DEFAULT_ESTIMATE_SETTINGS);
    expect(rows.map((row) => row.setting)).toEqual([
      'default_labor_rate',
      'burden_percent',
      'material_markup_percent',
      'equipment_markup_percent',
      'subcontractor_markup_percent',
      'indirect_cost_percent',
      'overhead_percent',
      'profit_percent',
      'contingency_percent',
      'tax_percent',
      'hours_per_day',
      'default_crew_size',
      'currency',
      'overhead_base',
      'profit_base',
      'tax_base',
    ]);
  });
});
