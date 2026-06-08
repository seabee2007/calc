import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { CurrentEstimate } from '../application/currentEstimateService';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';
import { ESTIMATE_SETTINGS_SHEET_NAME } from '../application/estimateSettings';
import {
  CONCRETE_CALC_BID_ESTIMATE_TEMPLATE_NAME,
  ESTIMATE_IMPORT_ESTIMATE_INFO_SHEET_NAME,
  ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME,
  ESTIMATE_IMPORT_SUMMARY_SHEET_NAME,
} from '../importExport/estimateImportColumns';
import {
  buildBlankEstimateTemplateWorkbook,
  buildEstimateCsv,
  buildEstimateExportFileName,
  buildEstimateWorkbook,
} from '../importExport/estimateExportBuilder';

function sampleTask(): EstimateDomainTask {
  return {
    id: 'task-1',
    lineType: 'task',
    title: 'Place slab',
    description: 'Interior slab',
    scopeName: 'Flatwork',
    trade: '',
    activity: '',
    position: 0,
    lineItem: {
      id: 'task-1',
      description: 'Interior slab',
      csiDivision: '03',
      quantity: { formula: 'quantity_with_waste', quantity: 100, wastePercent: 0 },
      labor: {
        productionRate: 0.5,
        productionRateType: 'labor_hours_per_unit',
        hoursPerDay: 8,
        crewSize: 2,
        laborRate: 45,
        burdenPercent: 0,
      },
      material: { unitCost: 10 },
      equipment: { rate: 200, rateType: 'lump_sum', usageUnits: 1 },
      subcontractor: { cost: 0 },
    },
    overheadPercent: 10,
    profitPercent: 5,
    contingencyPercent: 0,
    taxPercent: 0,
    wastePercent: 0,
    scheduleEnabled: true,
    weatherSensitive: false,
    inspectionRequired: false,
    activityCode: '03-01-01',
    divisionCode: '03',
    divisionName: 'Concrete',
    workPackageCode: '03-01',
    workPackageName: 'Flatwork',
    activitySequence: 1,
    lineSequence: 1,
    predecessorActivityCode: '03-01-00',
    relationshipType: 'FS',
    lagDays: 0,
    calculatedValues: {
      unit: 'SF',
      importedEstimate: {
        notes: 'Keep me',
        predecessorActivityCode: '03-01-00',
        predecessorActivity: 'Mobilize',
      },
      metrics: {
        adjustedLaborHours: 50,
        durationDays: 3,
      },
      costs: {
        totalLaborCost: 2250,
        materialCost: 1000,
        equipmentCost: 200,
        subcontractorCost: 0,
      },
    },
  };
}

function sampleEstimate(): CurrentEstimate {
  return {
    id: 'estimate-1',
    projectId: 'project-1',
    estimateType: 'bid',
    status: 'draft',
    selectedDivisions: [
      {
        code: '03',
        name: 'Concrete',
        source: 'manual',
        createdAt: '2026-06-06T00:00:00.000Z',
      },
    ],
    lineItems: [sampleTask()],
    totals: {},
    summary: {},
    assumptions: {},
    createdBy: null,
    createdAt: '2026-06-06T00:00:00.000Z',
    updatedAt: '2026-06-06T00:00:00.000Z',
  };
}

describe('estimateExportBuilder', () => {
  it('creates an import-compatible workbook with info, line items, and summary sheets', () => {
    const workbook = buildEstimateWorkbook(sampleEstimate(), 'Riverside Plaza');
    expect(workbook.SheetNames).toEqual([
      ESTIMATE_IMPORT_ESTIMATE_INFO_SHEET_NAME,
      ESTIMATE_SETTINGS_SHEET_NAME,
      ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME,
      ESTIMATE_IMPORT_SUMMARY_SHEET_NAME,
    ]);

    const infoRows = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets[ESTIMATE_IMPORT_ESTIMATE_INFO_SHEET_NAME],
      { header: 1 },
    );
    const lineRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME],
    );
    const summaryRows = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets[ESTIMATE_IMPORT_SUMMARY_SHEET_NAME],
      { header: 1 },
    );

    expect(infoRows).toContainEqual(['project_name', 'Riverside Plaza']);
    expect(lineRows[0]).toEqual(
      expect.objectContaining({
        activity_code: '03-01-01',
        division_code: '03',
        activity_title: 'Place slab',
        unit: 'SF',
        notes: 'Keep me',
        predecessor_activity_code: '03-01-00',
        predecessor_activity: 'Mobilize',
        // v2.0 production rate bridge fields
        production_rate_id: expect.any(String),
        production_rate_type: expect.any(String),
        man_hours_per_unit: expect.anything(),
        // v2.0 per-line markup override names
        overhead_percent_override: 10,
        profit_percent_override: 5,
      }),
    );
    expect(summaryRows.some((row) => row[0] === '03')).toBe(true);
  });

  it('exports CSV line items only', () => {
    const csv = buildEstimateCsv(sampleEstimate());
    expect(csv).toContain('division_code');
    expect(csv).toContain('Place slab');
    // v2.0 columns present in header
    expect(csv).toContain('production_rate_id');
    expect(csv).toContain('man_hours_per_unit');
    expect(csv).toContain('production_rate_type');
  });

  it('builds a blank import template workbook', () => {
    const workbook = buildBlankEstimateTemplateWorkbook();
    const infoRows = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets[ESTIMATE_IMPORT_ESTIMATE_INFO_SHEET_NAME],
      { header: 1 },
    );

    expect(infoRows).toContainEqual(['template', CONCRETE_CALC_BID_ESTIMATE_TEMPLATE_NAME]);
    expect(workbook.SheetNames).toContain(ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME);
  });

  it('formats export filenames from project names', () => {
    expect(buildEstimateExportFileName('Riverside Plaza', new Date('2026-06-06T12:00:00.000Z'))).toBe(
      'riverside-plaza-bid-estimate-2026-06-06.xlsx',
    );
  });

  it('blank template v2.0 includes production_rate_id, man_hours_per_unit, production_rate_type columns', () => {
    const workbook = buildBlankEstimateTemplateWorkbook();
    const lineRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME],
    );
    expect(lineRows[0]).toHaveProperty('production_rate_id');
    expect(lineRows[0]).toHaveProperty('man_hours_per_unit');
    expect(lineRows[0]).toHaveProperty('production_rate_type');
  });

  it('blank template sample row uses 03-01-03 with 0.337 man_hours_per_unit', () => {
    const workbook = buildBlankEstimateTemplateWorkbook();
    const lineRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME],
    );
    expect(lineRows[0]?.activity_code).toBe('03-01-03');
    expect(lineRows[0]?.man_hours_per_unit).toBe(0.337);
    expect(lineRows[0]?.production_rate_id).toBe('03-31-00-footings-direct-chute');
    expect(lineRows[0]?.production_rate_type).toBe('labor_hours_per_unit');
  });

  it('blank template summary total_cost is non-zero', () => {
    const workbook = buildBlankEstimateTemplateWorkbook();
    const summaryRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[ESTIMATE_IMPORT_SUMMARY_SHEET_NAME],
    );
    const concreteRow = summaryRows.find((row) => row.division_code === '03');
    expect(concreteRow?.total_cost).toBeGreaterThan(0);
  });

  it('blank template guidance does not mention DIVISION-ACTIVITY-LINE format', () => {
    const workbook = buildBlankEstimateTemplateWorkbook();
    const infoRows = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets[ESTIMATE_IMPORT_ESTIMATE_INFO_SHEET_NAME],
      { header: 1 },
    );
    const allGuidance = infoRows
      .filter((row) => row[0] === 'guidance')
      .map((row) => row[1] as string)
      .join(' ');
    expect(allGuidance).not.toContain('DIVISION-ACTIVITY-LINE');
    expect(allGuidance).toContain('fixed master activity codes');
    expect(allGuidance).toContain('production_rate_id');
  });

  it('blank template version is 2.0', () => {
    const workbook = buildBlankEstimateTemplateWorkbook();
    const infoRows = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets[ESTIMATE_IMPORT_ESTIMATE_INFO_SHEET_NAME],
      { header: 1 },
    );
    expect(infoRows).toContainEqual(['template_version', '2.0']);
  });
});
