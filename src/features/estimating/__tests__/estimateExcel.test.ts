import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import {
  ESTIMATE_EXCEL_LINE_COLUMNS,
  ESTIMATE_EXCEL_SHEET_NAMES,
  buildSampleLineRow,
  getSchemaForEstimateType,
  normalizeHeaderKey,
  ESTIMATE_EXCEL_HEADER_ALIASES,
} from '../excel/estimateExcelSchemas';
import { ESTIMATE_EXCEL_SCHEMA_VERSION } from '../excel/estimateExcelTypes';
import {
  buildDuplicateKey,
  buildActivityGroupKey,
  countRowsByStatus,
  groupLineRowsIntoActivities,
  importableRowCount,
  mapRawRowToLineRow,
  parseEstimateLinesSheetRows,
  validateLineRows,
} from '../excel/estimateExcelValidation';
import {
  buildEstimateExcelTemplateWorkbook,
  buildStyledEstimateExcelTemplate,
} from '../excel/estimateExcelTemplateBuilder';
import { parseActivityExcelFile } from '../excel/estimateExcelImportParser';
import {
  buildActivityExcelExportWorkbook,
  mapLoadedActivitiesToExportInput,
} from '../excel/estimateExcelExportBuilder';
import { resetProductionRateLibraryLoaderForTests } from '../data/productionRates/productionRateLibraryLoader';
import {
  SOURCE_DOCUMENT_FULL,
  SOURCE_EDITION,
  type ProductionRateLibraryEntry,
} from '../data/productionRates/productionRateTypes';

const testProductionRate: ProductionRateLibraryEntry = {
  id: '03-31-00-footings-direct-chute',
  divisionCode: '03',
  divisionName: 'Concrete',
  figure: 'test',
  figureTitle: 'Test rates',
  sourcePage: '1',
  category: 'Concrete',
  subcategory: 'Footings',
  activityName: 'Place footing concrete',
  description: 'Direct chute footing concrete',
  unitOfMeasure: 'CY',
  manHoursPerUnit: 0.337,
  crewSize: 4,
  sourceDocumentFull: SOURCE_DOCUMENT_FULL,
  sourceEdition: SOURCE_EDITION,
  referenceNote: 'Test production rate fixture',
  keywords: ['concrete', 'footing'],
};

vi.mock('../data/productionRates/productionRateLibrary', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/productionRates/productionRateLibrary')>();
  return {
    ...actual,
    loadApprovedProductionRateLibrary: vi.fn(async () => ({
      rates: [testProductionRate],
      loadedAt: '2026-01-01T00:00:00.000Z',
    })),
    getProductionRateLibraryEntryById: vi.fn((id: string) =>
      id === testProductionRate.id ? testProductionRate : undefined,
    ),
  };
});

function workbookToFile(workbook: XLSX.WorkBook, name: string): File {
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new File([buffer], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function buildLineSheetRows(
  estimateType: 'detailed' | 'bid',
  extraRows: Record<string, string | number>[] = [],
): unknown[][] {
  const headers = ESTIMATE_EXCEL_LINE_COLUMNS.map((column) => column.key);
  const sample = buildSampleLineRow(estimateType);
  return [
    headers,
    headers.map((key) => sample[key] ?? ''),
    ...extraRows.map((row) => headers.map((key) => row[key] ?? '')),
  ];
}

describe('estimateExcel schemas', () => {
  it('exposes the v1 schema for detailed and bid', () => {
    expect(getSchemaForEstimateType('detailed').schemaVersion).toBe(ESTIMATE_EXCEL_SCHEMA_VERSION);
    expect(getSchemaForEstimateType('bid').estimateType).toBe('bid');
    expect(ESTIMATE_EXCEL_LINE_COLUMNS.filter((column) => column.required).map((c) => c.key)).toEqual([
      'division_code',
      'division_name',
      'activity_name',
      'line_item_description',
      'quantity',
      'unit',
    ]);
  });

  it('normalizes header aliases', () => {
    expect(normalizeHeaderKey('Division Code')).toBe('division_code');
    expect(normalizeHeaderKey('Man Hours Per Unit')).toBe('man_hours_per_unit');
  });
});

describe('estimateExcel validation', () => {
  beforeEach(() => {
    resetProductionRateLibraryLoaderForTests();
  });

  it('classifies missing quantity as blocked and manual pricing as valid', () => {
    const rows = validateLineRows({
      rows: [
        mapRawRowToLineRow({
          rowNumber: 2,
          values: {
            division_code: '03',
            division_name: 'Concrete',
            activity_name: 'Footings',
            line_item_description: 'Direct chute',
            quantity: 10,
            unit: 'CY',
            man_hours_per_unit: 0.5,
          },
        }),
        mapRawRowToLineRow({
          rowNumber: 3,
          values: {
            division_code: '03',
            division_name: 'Concrete',
            activity_name: 'Footings',
            line_item_description: 'Missing qty',
            quantity: null,
            unit: 'CY',
          },
        }),
      ],
      existingDuplicateKeys: new Set(),
    });

    expect(rows[0]?.status).toBe('valid');
    expect(rows[1]?.status).toBe('blocked');
    expect(countRowsByStatus(rows).blocked).toBe(1);
  });

  it('flags duplicate keys against existing estimate lines', () => {
    const existingKey = buildDuplicateKey(
      mapRawRowToLineRow({
        rowNumber: 0,
        values: {
          division_code: '03',
          activity_name: 'Footings',
          line_item_description: 'Existing line',
          quantity: 5,
          unit: 'CY',
        },
      }),
    );

    const rows = validateLineRows({
      rows: [
        mapRawRowToLineRow({
          rowNumber: 2,
          values: {
            division_code: '03',
            division_name: 'Concrete',
            activity_name: 'Footings',
            line_item_description: 'Existing line',
            quantity: 5,
            unit: 'CY',
            man_hours_per_unit: 0.5,
          },
        }),
      ],
      existingDuplicateKeys: new Set([existingKey]),
    });

    expect(rows[0]?.status).toBe('duplicate');
  });

  it('groups rows by division and activity code', () => {
    const rows = [
      mapRawRowToLineRow({
        rowNumber: 2,
        values: {
          division_code: '03',
          activity_code: '03-01-01',
          activity_name: 'Footings',
          line_item_description: 'Line A',
          quantity: 1,
          unit: 'CY',
        },
      }),
      mapRawRowToLineRow({
        rowNumber: 3,
        values: {
          division_code: '03',
          activity_code: '03-01-01',
          activity_name: 'Footings',
          line_item_description: 'Line B',
          quantity: 2,
          unit: 'CY',
        },
      }),
    ];

    const groups = groupLineRowsIntoActivities(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.lineRows).toHaveLength(2);
    expect(buildActivityGroupKey(rows[0]!)).toBe('03::03-01-01');
  });

  it('detects missing required columns in sheet rows', () => {
    const parsed = parseEstimateLinesSheetRows([
      ['division_code', 'activity_name'],
      ['03', 'Footings'],
    ]);
    expect(parsed.missingColumns).toContain('division_name');
    expect(parsed.missingColumns).toContain('line_item_description');
  });
});

describe('estimateExcel import parser', () => {
  beforeEach(() => {
    resetProductionRateLibraryLoaderForTests();
  });

  it('blocks import when estimate_type mismatches', async () => {
    const workbook = buildEstimateExcelTemplateWorkbook('bid', 'Demo Project');
    const file = workbookToFile(workbook, 'bid-template.xlsx');
    const result = await parseActivityExcelFile({
      file,
      expectedEstimateType: 'detailed',
    });

    expect(result.errors.some((error) => error.includes('estimate_type'))).toBe(true);
    expect(result.importableGroups).toEqual([]);
  });

  it('parses a valid detailed template and groups sample row', async () => {
    const workbook = buildEstimateExcelTemplateWorkbook('detailed', 'Demo Project');
    const file = workbookToFile(workbook, 'detailed-template.xlsx');
    const result = await parseActivityExcelFile({
      file,
      expectedEstimateType: 'detailed',
    });

    expect(result.errors).toEqual([]);
    expect(result.preview?.workbookInfo.schemaVersion).toBe(ESTIMATE_EXCEL_SCHEMA_VERSION);
    expect(result.importableGroups.length).toBeGreaterThan(0);
    expect(importableRowCount(result.preview?.rowResults ?? [])).toBe(1);
  });

  it('marks unpriced rows when pricing is missing', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Field', 'Value'],
        ['schema_version', ESTIMATE_EXCEL_SCHEMA_VERSION],
        ['estimate_type', 'detailed'],
        ['template_generated_at', new Date().toISOString()],
        ['project_name', 'Demo'],
      ]),
      ESTIMATE_EXCEL_SHEET_NAMES.estimateInfo,
    );
    const headers = ESTIMATE_EXCEL_LINE_COLUMNS.map((column) => column.key);
    const unpricedRow = {
      division_code: '03',
      division_name: 'Concrete',
      activity_name: 'Shell activity',
      line_item_description: 'Unpriced shell',
      quantity: 10,
      unit: 'CY',
      production_rate_id: '',
      man_hours_per_unit: '',
    };
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        headers,
        headers.map((key) => unpricedRow[key as keyof typeof unpricedRow] ?? ''),
      ]),
      ESTIMATE_EXCEL_SHEET_NAMES.estimateLines,
    );

    const result = await parseActivityExcelFile({
      file: workbookToFile(workbook, 'unpriced.xlsx'),
      expectedEstimateType: 'detailed',
    });

    expect(result.preview?.unpricedCount).toBe(1);
    expect(result.importableGroups[0]?.importable).toBe(true);
  });
});

describe('estimateExcel export builder', () => {
  it('builds an import-compatible workbook with summary sheet', () => {
    const exportInput = mapLoadedActivitiesToExportInput('detailed', 'Demo', [
      {
        activity: {
          id: 'pca-1',
          projectId: 'proj-1',
          estimateId: 'est-1',
          activityTemplateId: null,
          sourceTemplateKey: 'manual_activity',
          activityCode: '03-01-01',
          title: 'Place footing concrete',
          baseTitle: 'Place footing concrete',
          instanceLabel: null,
          location: null,
          drawingReference: null,
          phase: null,
          notes: null,
          activitySequence: 1,
          instanceSequence: 1,
          divisionCode: '03',
          divisionName: 'Concrete',
          scheduleEnabled: true,
          crewSize: 4,
          hoursPerDay: 8,
          productionFactor: 1,
          durationDaysOverride: null,
          calculatedManHours: 10,
          calculatedManDays: 1.25,
          calculatedDurationDays: 1,
          effectiveDurationDays: 1,
          totalLaborCost: 500,
          totalMaterialCost: 100,
          totalEquipmentCost: 20,
          totalSubcontractCost: 0,
          totalCost: 620,
        },
        lineItems: [
          {
            id: 'pali-1',
            projectActivityId: 'pca-1',
            projectId: 'proj-1',
            productionRateId: null,
            sourceProductionRateKey: '03-sample-rate',
            sourceProductionRateLabel: 'Direct chute',
            sourceFigure: null,
            sourcePage: null,
            sourcePdfPage: null,
            sourceDocumentCode: null,
            name: 'Direct chute',
            description: 'Direct chute',
            unit: 'CY',
            quantity: 10,
            manHoursPerUnit: 1,
            productionFactor: 1,
            calculatedManHours: 10,
            laborRoleId: null,
            laborRoleKey: null,
            laborRoleName: null,
            tradeCategory: null,
            hourlyRateSnapshot: 0,
            burdenPercentSnapshot: 0,
            fullyBurdenedRateSnapshot: 50,
            billingRateSnapshot: 0,
            pricingSource: 'manual',
            pricingSnapshotAt: null,
            laborCost: 500,
            materialCost: 100,
            equipmentCost: 20,
            subcontractCost: 0,
            totalCost: 620,
            sortOrder: 1,
          },
        ],
      },
    ]);

    const workbook = buildActivityExcelExportWorkbook(exportInput);
    expect(workbook.SheetNames).toContain(ESTIMATE_EXCEL_SHEET_NAMES.estimateLines);
    expect(workbook.SheetNames).toContain(ESTIMATE_EXCEL_SHEET_NAMES.summaryByDivision);

    const lines = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[ESTIMATE_EXCEL_SHEET_NAMES.estimateLines]!,
      { defval: '' },
    );
    expect(lines[0]?.line_item_description).toBe('Direct chute');
    expect(lines[0]?.quantity).toBe(10);
  });
});

describe('estimateExcel styled template (ExcelJS round-trip)', () => {
  beforeEach(() => {
    resetProductionRateLibraryLoaderForTests();
  });

  async function styledTemplateToFile(
    estimateType: 'detailed' | 'bid',
    projectName: string,
  ): Promise<File> {
    const workbook = await buildStyledEstimateExcelTemplate(estimateType, projectName);
    const buffer = await workbook.xlsx.writeBuffer();
    return new File([buffer], `${estimateType}-styled-template.xlsx`, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  it('produces a parseable workbook with correct schemaVersion', async () => {
    const file = await styledTemplateToFile('detailed', 'Test Project');
    const result = await parseActivityExcelFile({ file, expectedEstimateType: 'detailed' });

    expect(result.errors).toEqual([]);
    expect(result.preview?.workbookInfo.schemaVersion).toBe(ESTIMATE_EXCEL_SCHEMA_VERSION);
    expect(result.preview?.workbookInfo.estimateType).toBe('detailed');
  });

  it('guidance row (row 2) is blocked — not a parse error', async () => {
    const file = await styledTemplateToFile('detailed', 'Test Project');
    const result = await parseActivityExcelFile({ file, expectedEstimateType: 'detailed' });

    const rowResults = result.preview?.rowResults ?? [];
    const blockedRows = rowResults.filter((r) => r.status === 'blocked');
    expect(blockedRows.length).toBeGreaterThanOrEqual(1);
    expect(result.errors).toEqual([]);
  });

  it('sample row (row 3) is importable', async () => {
    const file = await styledTemplateToFile('detailed', 'Test Project');
    const result = await parseActivityExcelFile({ file, expectedEstimateType: 'detailed' });

    expect(importableRowCount(result.preview?.rowResults ?? [])).toBe(1);
    expect(result.importableGroups.length).toBeGreaterThan(0);
  });

  it('no missing required columns', async () => {
    const file = await styledTemplateToFile('detailed', 'Test Project');
    const result = await parseActivityExcelFile({ file, expectedEstimateType: 'detailed' });

    expect(result.errors.some((e) => e.toLowerCase().includes('missing'))).toBe(false);
  });

  it('estimate_type mismatch still blocks import on styled template', async () => {
    const file = await styledTemplateToFile('bid', 'Test Project');
    const result = await parseActivityExcelFile({ file, expectedEstimateType: 'detailed' });

    expect(result.errors.some((e) => e.includes('estimate_type'))).toBe(true);
    expect(result.importableGroups).toEqual([]);
  });

  it('human-readable column labels normalize back to schema keys via normalizeHeaderKey', () => {
    for (const col of ESTIMATE_EXCEL_LINE_COLUMNS) {
      const normalized = normalizeHeaderKey(col.label);
      const canonical = ESTIMATE_EXCEL_HEADER_ALIASES[normalized] ?? normalized;
      expect(canonical).toBe(col.key);
    }
  });
});

vi.mock('../infrastructure/activityRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../infrastructure/activityRepository')>();
  return {
    ...actual,
    saveActivityBundle: vi.fn(async (activity, lineItems) => ({
      data: {
        activity: {
          ...activity,
          id: 'saved-activity',
          createdAt: '',
          updatedAt: '',
        },
        lineItems: lineItems.map((item, index) => ({
          ...item,
          id: `line-${index}`,
          projectActivityId: 'saved-activity',
          createdAt: '',
        })),
      },
      error: null,
    })),
  };
});

describe('estimateExcel activity writer', () => {
  beforeEach(() => {
    resetProductionRateLibraryLoaderForTests();
    vi.clearAllMocks();
  });

  it('maps approved groups through saveActivityBundle', async () => {
    const { applyActivityExcelImport } = await import('../excel/estimateExcelActivityWriter');
    const { saveActivityBundle } = await import('../infrastructure/activityRepository');

    const row = mapRawRowToLineRow({
      rowNumber: 2,
      values: {
        division_code: '03',
        division_name: 'Concrete',
        activity_name: 'Footings',
        line_item_description: 'Manual line',
        quantity: 10,
        unit: 'CY',
        man_hours_per_unit: 0.5,
        material_unit_cost: 10,
      },
    });
    row.status = 'valid';

    const result = await applyActivityExcelImport({
      mode: 'add',
      groups: [
        {
          groupKey: '03::footings',
          divisionCode: '03',
          divisionName: 'Concrete',
          activityCode: null,
          activityName: 'Footings',
          crewSize: 4,
          scheduleEnabled: true,
          lineRows: [row],
          importable: true,
        },
      ],
      projectId: 'proj-1',
      estimateId: 'est-1',
      projectLaborRates: [],
      existingActivities: [],
      existingLineItemsByActivityId: new Map(),
    });

    expect(result.error).toBeNull();
    expect(result.importedActivityCount).toBe(1);
    expect(result.importedLineItemCount).toBe(1);
    expect(saveActivityBundle).toHaveBeenCalledTimes(1);
  });
});
