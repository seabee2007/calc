import { describe, expect, it } from 'vitest';
import { createEmptyDraftLine } from '../application/estimateDraftLine';
import { applyImportedEstimate } from '../importExport/estimateImportApply';
import type { ImportedEstimateData } from '../importExport/estimateImportParser';

function importedData(divisionCode: string, title: string): ImportedEstimateData {
  const draft = createEmptyDraftLine(0);
  draft.task.title = title;
  draft.task.lineItem.csiDivision = divisionCode;
  draft.task.lineItem.quantity.quantity = 10;
  draft.unit = 'EA';

  return {
    rows: [
      {
        rowNumber: 2,
        division_code: divisionCode,
        division_name: 'Concrete',
        work_package: '',
        activity_title: title,
        description: title,
        quantity: 10,
        unit: 'EA',
      },
    ],
    draftLines: [draft],
    selectedDivisions: [
      {
        code: divisionCode,
        name: 'Concrete',
        source: 'import',
        reason: 'Imported from estimate file',
        createdAt: '2026-06-06T00:00:00.000Z',
      },
    ],
    warnings: [],
    errors: [],
  };
}

describe('estimateImportApply', () => {
  it('replaces current divisions and draft lines', () => {
    const existing = createEmptyDraftLine(0);
    existing.task.title = 'Existing line';
    existing.task.lineItem.csiDivision = '01';

    const applied = applyImportedEstimate({
      mode: 'replace',
      currentDraftLines: [existing],
      currentSelectedDivisions: [
        {
          code: '01',
          name: 'General Requirements',
          source: 'manual',
          createdAt: '2026-06-06T00:00:00.000Z',
        },
      ],
      imported: importedData('03', 'Imported line'),
    });

    expect(applied.draftLines).toHaveLength(1);
    expect(applied.draftLines[0].task.title).toBe('Imported line');
    expect(applied.selectedDivisions).toEqual([
      expect.objectContaining({ code: '03', source: 'import' }),
    ]);
    expect(applied.importedDivisionCodes).toEqual(['03']);
  });

  it('adds imported data while preserving existing rows and deduping divisions', () => {
    const existing = createEmptyDraftLine(0);
    existing.task.title = 'Existing line';
    existing.task.lineItem.csiDivision = '01';

    const applied = applyImportedEstimate({
      mode: 'add',
      currentDraftLines: [existing],
      currentSelectedDivisions: [
        {
          code: '01',
          name: 'General Requirements',
          source: 'manual',
          createdAt: '2026-06-06T00:00:00.000Z',
        },
        {
          code: '03',
          name: 'Concrete',
          source: 'manual',
          createdAt: '2026-06-06T00:00:00.000Z',
        },
      ],
      imported: importedData('03', 'Imported line'),
    });

    expect(applied.draftLines).toHaveLength(2);
    expect(applied.draftLines[0].task.title).toBe('Existing line');
    expect(applied.draftLines[1].task.title).toBe('Imported line');
    expect(applied.selectedDivisions.map((division) => division.code)).toEqual(['01', '03']);
  });
});
