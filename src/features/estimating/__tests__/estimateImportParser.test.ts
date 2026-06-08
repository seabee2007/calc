import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  ESTIMATE_IMPORT_ALL_COLUMNS,
  ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME,
  ESTIMATE_IMPORT_TEMPLATE_GUIDANCE,
  ESTIMATE_IMPORT_TEMPLATE_SAMPLE_ROW,
} from '../importExport/estimateImportColumns';
import {
  mapRowsToEstimateData,
  parseEstimateBuffer,
  previewImportedEstimate,
  validateImportedEstimate,
} from '../importExport/estimateImportParser';
import { hasImportPreviewErrors } from '../ui/EstimateImportPreview';

function buildWorkbookBuffer(rows: unknown[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, ESTIMATE_IMPORT_LINE_ITEMS_SHEET_NAME);
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}

function buildCsvBuffer(csv: string): ArrayBuffer {
  return new TextEncoder().encode(csv).buffer;
}

const HEADER_ROW = [...ESTIMATE_IMPORT_ALL_COLUMNS];

const SAMPLE_ROW = ESTIMATE_IMPORT_ALL_COLUMNS.map(
  (column) => ESTIMATE_IMPORT_TEMPLATE_SAMPLE_ROW[column],
);

describe('estimateImportParser', () => {
  it('parses XLSX imports with required columns and maps draft lines', () => {
    const buffer = buildWorkbookBuffer([HEADER_ROW, SAMPLE_ROW]);
    const result = parseEstimateBuffer(buffer, 'estimate.xlsx');

    expect(result.errors).toEqual([]);
    expect(result.importedData?.rows).toHaveLength(1);
    expect(result.importedData?.selectedDivisions).toEqual([
      expect.objectContaining({
        code: '03',
        name: 'Concrete',
        source: 'import',
        reason: 'Imported from estimate file',
      }),
    ]);

    const draft = result.importedData?.draftLines[0];
    // v2.0 sample row: 03-01-03 Place footing concrete, 50 CY, 0.337 MH/CY
    expect(draft?.task.title).toBe('Place footing concrete');
    expect(draft?.task.activityCode).toBe('03-01-03');
    expect(draft?.task.lineItem.csiDivision).toBe('03');
    expect(draft?.task.lineItem.quantity.quantity).toBe(50);
    expect(draft?.task.lineItem.labor.productionRateType).toBe('labor_hours_per_unit');
    // man_hours_per_unit is provided explicitly → productionRate = 0.337
    expect(draft?.task.lineItem.labor.productionRate).toBeCloseTo(0.337);
    expect(draft?.task.lineItem.labor.crewSize).toBe(4);
    expect(draft?.unit).toBe('CY');
    expect(draft?.task.calculatedValues.importedEstimate).toEqual(
      expect.objectContaining({
        notes: 'Sample row — replace with your estimate lines',
        laborHours: 17,
        durationDays: 1,
      }),
    );
  });

  it('parses CSV imports', () => {
    const csv = `${HEADER_ROW.join(',')}\n${SAMPLE_ROW.join(',')}`;
    const result = parseEstimateBuffer(buildCsvBuffer(csv), 'estimate.csv');

    expect(result.errors).toEqual([]);
    expect(result.importedData?.rows).toHaveLength(1);
  });

  it('rejects missing required columns', () => {
    const buffer = buildWorkbookBuffer([
      ['activity_title', 'quantity', 'unit'],
      ['Place slab', 100, 'SF'],
    ]);
    const result = parseEstimateBuffer(buffer, 'estimate.xlsx');

    expect(result.importedData).toBeNull();
    expect(result.errors.some((error) => error.includes('division_code'))).toBe(true);
  });

  it('calculates labor hours and duration when source fields are missing', () => {
    const imported = mapRowsToEstimateData([
      {
        division_code: '03',
        division_name: 'Concrete',
        activity_title: 'Place slab',
        quantity: 100,
        unit: 'SF',
        labor_cost: 400,
        labor_rate: 40,
        crew_size: 2,
      },
    ]);

    expect(imported.rows[0].labor_hours).toBeCloseTo(10);
    expect(imported.rows[0].duration_days).toBeCloseTo(10 / (2 * 8));
    expect(imported.draftLines[0].task.lineItem.labor.productionRate).toBeCloseTo(0.1);
  });

  it('calculates total cost when total_cost is blank', () => {
    const imported = mapRowsToEstimateData([
      {
        division_code: '03',
        division_name: 'Concrete',
        activity_title: 'Place slab',
        quantity: 100,
        unit: 'SF',
        labor_cost: 1000,
        material_cost: 500,
        overhead_percent: 10,
        profit_percent: 10,
      },
    ]);

    expect(imported.rows[0].total_cost).toBeCloseTo(1815);
  });

  it('warns on unknown division codes and skips invalid rows unless all fail', () => {
    const validation = validateImportedEstimate([
      {
        division_code: '99',
        division_name: 'Unknown',
        activity_title: 'Mystery work',
        quantity: 10,
        unit: 'EA',
      },
      {
        division_code: 'bad',
        division_name: '',
        activity_title: 'Bad row',
        quantity: 10,
        unit: 'EA',
      },
    ]);

    expect(validation.warnings.some((warning) => warning.includes('unknown CSI'))).toBe(true);
    expect(validation.warnings.some((warning) => warning.includes('invalid division_code'))).toBe(
      true,
    );
    expect(validation.errors).toEqual([]);
  });

  it('builds preview counts and disables apply when errors exist', () => {
    const imported = mapRowsToEstimateData([
      {
        division_code: '03',
        division_name: 'Concrete',
        activity_title: 'Place slab',
        quantity: 100,
        unit: 'SF',
        labor_cost: 1000,
      },
    ]);
    const preview = previewImportedEstimate(imported);

    expect(preview.divisionCount).toBe(1);
    expect(preview.lineItemCount).toBe(1);
    expect(preview.estimatedTotal).toBeGreaterThan(0);
    expect(hasImportPreviewErrors({ ...preview, errors: ['broken'] })).toBe(true);
    expect(hasImportPreviewErrors(preview)).toBe(false);
  });

  it('uses provided activity_code when valid and generates missing codes', () => {
    const withCode = mapRowsToEstimateData([
      {
        activity_code: '03-01-01',
        division_code: '03',
        division_name: 'Concrete',
        activity_title: 'Form slab',
        quantity: 100,
        unit: 'SF',
        work_package_name: 'Slab on Grade',
      },
      {
        division_code: '03',
        division_name: 'Concrete',
        activity_title: 'Place slab',
        quantity: 100,
        unit: 'SF',
        work_package_name: 'Slab on Grade',
      },
    ]);

    expect(withCode.draftLines[0].task.activityCode).toBe('03-01-01');
    expect(withCode.draftLines[1].task.activityCode).toBe('03-01-02');
  });

  // ── v2.0 production rate bridge tests ────────────────────────────────────

  it('uses man_hours_per_unit as productionRate when provided', () => {
    const imported = mapRowsToEstimateData([
      {
        division_code: '03',
        division_name: 'Concrete',
        activity_title: 'Place footing concrete',
        activity_code: '03-01-03',
        quantity: 50,
        unit: 'CY',
        man_hours_per_unit: 0.337,
        crew_size: 4,
      },
    ]);
    const draft = imported.draftLines[0];
    expect(draft.task.lineItem.labor.productionRate).toBeCloseTo(0.337);
    expect(draft.task.lineItem.labor.productionRateType).toBe('labor_hours_per_unit');
    // labor_hours derived: 50 * 0.337 = 16.85
    expect(imported.rows[0].labor_hours).toBeCloseTo(16.85);
  });

  it('derives man_hours_per_unit from production_rate_id lookup when man_hours_per_unit absent', () => {
    const imported = mapRowsToEstimateData([
      {
        division_code: '03',
        division_name: 'Concrete',
        activity_title: 'Place footing concrete',
        activity_code: '03-01-03',
        quantity: 50,
        unit: 'CY',
        production_rate_id: '03-31-00-footings-direct-chute',
        // no man_hours_per_unit — should be filled from production rate lookup
      },
    ]);
    const draft = imported.draftLines[0];
    expect(draft.task.lineItem.labor.productionRate).toBeCloseTo(0.337);
    expect(imported.rows[0].man_hours_per_unit).toBeCloseTo(0.337);
    expect(imported.errors).toEqual([]);
  });

  it('warns on unknown production_rate_id but does not fail', () => {
    const imported = mapRowsToEstimateData([
      {
        division_code: '03',
        division_name: 'Concrete',
        activity_title: 'Custom activity',
        quantity: 10,
        unit: 'CY',
        production_rate_id: 'xx-99-99-nonexistent-rate',
      },
    ]);
    expect(imported.errors).toEqual([]);
    expect(imported.draftLines).toHaveLength(1);
    expect(imported.warnings.some((w) => w.includes('xx-99-99-nonexistent-rate'))).toBe(true);
  });

  it('accepts overhead_percent_override as per-line markup override (v2.0)', () => {
    const imported = mapRowsToEstimateData([
      {
        division_code: '03',
        division_name: 'Concrete',
        activity_title: 'Place slab',
        quantity: 100,
        unit: 'SF',
        labor_cost: 1000,
        material_cost: 500,
        overhead_percent_override: 12,
        profit_percent_override: 8,
      },
    ]);
    expect(imported.rows[0].overhead_percent).toBe(12);
    expect(imported.rows[0].profit_percent).toBe(8);
    // total_cost: direct(1500) + overhead(180) + profit(134.4) = 1814.4
    expect(imported.rows[0].total_cost).toBeCloseTo(1814.4);
  });

  it('backward-compat: old overhead_percent / profit_percent still accepted', () => {
    const imported = mapRowsToEstimateData([
      {
        division_code: '03',
        division_name: 'Concrete',
        activity_title: 'Place slab',
        quantity: 100,
        unit: 'SF',
        labor_cost: 1000,
        material_cost: 500,
        overhead_percent: 10,
        profit_percent: 10,
      },
    ]);
    expect(imported.errors).toEqual([]);
    expect(imported.rows[0].total_cost).toBeCloseTo(1815);
  });

  it('template column list includes v2.0 production rate and CSI fields', () => {
    expect(ESTIMATE_IMPORT_ALL_COLUMNS).toContain('production_rate_id');
    expect(ESTIMATE_IMPORT_ALL_COLUMNS).toContain('man_hours_per_unit');
    expect(ESTIMATE_IMPORT_ALL_COLUMNS).toContain('production_rate_type');
    expect(ESTIMATE_IMPORT_ALL_COLUMNS).toContain('csi_code');
    expect(ESTIMATE_IMPORT_ALL_COLUMNS).toContain('overhead_percent_override');
    expect(ESTIMATE_IMPORT_ALL_COLUMNS).toContain('profit_percent_override');
    // v2.0 guidance must not mention the deprecated DIVISION-ACTIVITY-LINE format
    expect([...ESTIMATE_IMPORT_TEMPLATE_GUIDANCE].join(' ')).not.toContain('DIVISION-ACTIVITY-LINE');
    expect([...ESTIMATE_IMPORT_TEMPLATE_GUIDANCE].join(' ')).toContain('fixed master activity codes');
    expect([...ESTIMATE_IMPORT_TEMPLATE_GUIDANCE].join(' ')).toContain('production_rate_id');
  });

  it('auto-renumbers duplicate activity codes when enabled', () => {
    const imported = mapRowsToEstimateData(
      [
        {
          activity_code: '03-01-01',
          division_code: '03',
          division_name: 'Concrete',
          activity_title: 'First',
          quantity: 1,
          unit: 'EA',
        },
        {
          activity_code: '03-01-01',
          division_code: '03',
          division_name: 'Concrete',
          activity_title: 'Second',
          quantity: 1,
          unit: 'EA',
        },
      ],
      { autoRenumberDuplicates: true },
    );

    const codes = imported.draftLines.map((line) => line.task.activityCode);
    expect(new Set(codes).size).toBe(2);
    expect(imported.warnings.some((warning) => warning.includes('auto-renumbered'))).toBe(true);
  });
});
