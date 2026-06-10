import { describe, expect, it } from 'vitest';
import div03Json from '../../data/manualRates/division03Concrete.reviewed.json';
import div31Json from '../../data/manualRates/division31Earthwork.reviewed.json';
import type { ReviewedProductionRateEntry, ReviewedRateFile } from '../manualRateTypes';
import { validateRateEntries, validateReviewedRateFile } from '../validateProductionRates';

// Cast JSON imports to the expected types
const div03 = div03Json as ReviewedRateFile;
const div31 = div31Json as ReviewedRateFile;

describe('validateReviewedRateFile', () => {
  it('Division 03 Concrete reviewed file passes validation', () => {
    const result = validateReviewedRateFile(div03);
    if (!result.valid) {
      console.error('Validation errors:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.validCount).toBeGreaterThan(0);
  });

  it('Division 31 Earthwork reviewed file passes validation', () => {
    const result = validateReviewedRateFile(div31);
    if (!result.valid) {
      console.error('Validation errors:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.validCount).toBeGreaterThan(0);
  });

  it('Division 03 has expected slab-on-grade rates', () => {
    const ids = div03.rates.map((r) => r.id);
    expect(ids).toContain('03-15-05.96-0220');  // vapor barrier
    expect(ids).toContain('03-22-05.50-0010');  // WWF sheets
    expect(ids).toContain('03-31-05.70-0320');  // place concrete pumped slab
    expect(ids).toContain('03-35-29.30-0040');  // finish: screed + float + trowel
    expect(ids).toContain('03-39-23.13-0010');  // sprayed membrane cure
    expect(ids).toContain('03-35-29.35-0010');  // sawcut control joints
  });

  it('Division 31 has expected earthwork rates', () => {
    const ids = div31.rates.map((r) => r.id);
    expect(ids).toContain('31-11-10.10-0010');  // clear and grub light trees
    expect(ids).toContain('31-23-16.13-0010');  // trench excavation common earth
    expect(ids).toContain('31-23-16.13-0090');  // backfill trench
  });

  it('all Division 03 labor rates have manHoursPerUnit > 0', () => {
    const laborRates = div03.rates.filter((r) => r.rateType === 'labor_production');
    for (const rate of laborRates) {
      expect(rate.manHoursPerUnit).toBeGreaterThan(0);
    }
  });

  it('equipment production rates do not require manHoursPerUnit', () => {
    const equipmentRates = div31.rates.filter((r) => r.rateType === 'equipment_production');
    expect(equipmentRates.length).toBeGreaterThan(0);
    for (const rate of equipmentRates) {
      expect(rate.equipmentHoursPerUnit).toBeGreaterThan(0);
      expect(rate.manHoursPerUnit).toBeUndefined();
    }
  });

  it('all rates have source figure and source page', () => {
    for (const rate of [...div03.rates, ...div31.rates]) {
      expect(rate.sourceFigure).toBeTruthy();
      expect(rate.sourcePage).toBeTruthy();
    }
  });

  it('all rates have directLaborOnly as a boolean', () => {
    for (const rate of [...div03.rates, ...div31.rates]) {
      expect(typeof rate.directLaborOnly).toBe('boolean');
    }
  });

  it('no duplicate IDs within each division file', () => {
    const div03Ids = div03.rates.map((r) => r.id);
    const div31Ids = div31.rates.map((r) => r.id);
    expect(new Set(div03Ids).size).toBe(div03Ids.length);
    expect(new Set(div31Ids).size).toBe(div31Ids.length);
  });

  it('IDs follow the {divCode}-{mfSection}-{lineNumber} format', () => {
    // Format: {2-digit-div}-{2-digit-part}-{2-digit.2-digit-part}-{4+-digit-lineNum}
    // Example: "03-15-05.96-0220", "31-23-16.13-0010"
    const idPattern = /^\d{2}-\d{2}-\d{2}\.\d{2}-\d{4,}$/;
    for (const rate of [...div03.rates, ...div31.rates]) {
      expect(rate.id).toMatch(idPattern);
    }
  });
});

describe('validateRateEntries — invalid entries fail correctly', () => {
  it('rejects entry with missing id', () => {
    const entry = { description: 'test', unit: 'SF', rateType: 'labor_production', manHoursPerUnit: 0.1 } as unknown as ReviewedProductionRateEntry;
    const result = validateRateEntries([entry]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'id')).toBe(true);
  });

  it('rejects entry with malformed id', () => {
    const entry: ReviewedProductionRateEntry = {
      id: 'bad-id-format',
      masterFormatCode: '03 15 05.96',
      workElementLineNumber: '0220',
      description: 'Vapor barrier',
      unit: 'SF',
      rateType: 'labor_production',
      manHoursPerUnit: 0.002,
      sourceFigure: 'Figure 5-C-9',
      sourcePage: '5-C-8',
      directLaborOnly: true,
      militaryAdjusted: false,
      tags: ['concrete'],
      applicableActivityTypes: ['Place Slab on Grade'],
    };
    const result = validateRateEntries([entry]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'id')).toBe(true);
  });

  it('rejects labor_production entry with zero manHoursPerUnit', () => {
    const entry: ReviewedProductionRateEntry = {
      id: '03-15-05.96-0220',
      masterFormatCode: '03 15 05.96',
      workElementLineNumber: '0220',
      description: 'Vapor barrier',
      unit: 'SF',
      rateType: 'labor_production',
      manHoursPerUnit: 0,
      sourceFigure: 'Figure 5-C-9',
      sourcePage: '5-C-8',
      directLaborOnly: true,
      militaryAdjusted: false,
      tags: [],
      applicableActivityTypes: ['Place Slab on Grade'],
    };
    const result = validateRateEntries([entry]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'manHoursPerUnit')).toBe(true);
  });

  it('rejects labor_production entry with missing manHoursPerUnit', () => {
    const entry: ReviewedProductionRateEntry = {
      id: '03-15-05.96-0220',
      masterFormatCode: '03 15 05.96',
      workElementLineNumber: '0220',
      description: 'Vapor barrier',
      unit: 'SF',
      rateType: 'labor_production',
      sourceFigure: 'Figure 5-C-9',
      sourcePage: '5-C-8',
      directLaborOnly: true,
      militaryAdjusted: false,
      tags: [],
      applicableActivityTypes: ['Place Slab on Grade'],
    };
    const result = validateRateEntries([entry]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'manHoursPerUnit')).toBe(true);
  });

  it('rejects equipment_production entry with missing equipmentHoursPerUnit', () => {
    const entry: ReviewedProductionRateEntry = {
      id: '31-23-23.20-0000',
      masterFormatCode: '31 23 23.20',
      workElementLineNumber: '0000',
      description: 'Hauling dump truck',
      unit: 'Loose CYD',
      rateType: 'equipment_production',
      sourceFigure: 'Figure 5-R-20',
      sourcePage: '5-R-11',
      directLaborOnly: false,
      militaryAdjusted: true,
      tags: [],
      applicableActivityTypes: ['Excavate Footings'],
    };
    const result = validateRateEntries([entry]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'equipmentHoursPerUnit')).toBe(true);
  });

  it('rejects entries with duplicate IDs', () => {
    const baseEntry: ReviewedProductionRateEntry = {
      id: '03-15-05.96-0220',
      masterFormatCode: '03 15 05.96',
      workElementLineNumber: '0220',
      description: 'Vapor barrier',
      unit: 'SF',
      rateType: 'labor_production',
      manHoursPerUnit: 0.002,
      sourceFigure: 'Figure 5-C-9',
      sourcePage: '5-C-8',
      directLaborOnly: true,
      militaryAdjusted: false,
      tags: [],
      applicableActivityTypes: ['Place Slab on Grade'],
    };
    const result = validateRateEntries([baseEntry, { ...baseEntry }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
  });

  it('rejects entry with missing sourceFigure', () => {
    const entry: ReviewedProductionRateEntry = {
      id: '03-15-05.96-0220',
      masterFormatCode: '03 15 05.96',
      workElementLineNumber: '0220',
      description: 'Vapor barrier',
      unit: 'SF',
      rateType: 'labor_production',
      manHoursPerUnit: 0.002,
      sourceFigure: '',
      sourcePage: '5-C-8',
      directLaborOnly: true,
      militaryAdjusted: false,
      tags: [],
      applicableActivityTypes: ['Place Slab on Grade'],
    };
    const result = validateRateEntries([entry]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'sourceFigure')).toBe(true);
  });

  it('valid entry passes all checks', () => {
    const entry: ReviewedProductionRateEntry = {
      id: '03-15-05.96-0220',
      masterFormatCode: '03 15 05.96',
      workElementLineNumber: '0220',
      description: 'Vapor barrier, polyethylene',
      unit: 'SF',
      rateType: 'labor_production',
      manHoursPerUnit: 0.002,
      sourceFigure: 'Figure 5-C-9',
      sourcePage: '5-C-8',
      sourcePdfPage: 65,
      directLaborOnly: true,
      militaryAdjusted: false,
      tags: ['concrete', 'vapor-barrier'],
      applicableActivityTypes: ['Place Slab on Grade'],
    };
    const result = validateRateEntries([entry]);
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });
});

describe('buildProductionRateSeedBundle integration', () => {
  it('builds seed from Division 03 reviewed file without errors', async () => {
    const { buildProductionRateSeedBundle } = await import('../buildProductionRateSeed');
    const result = buildProductionRateSeedBundle(div03, 'batch-div03-2026-06');
    expect(result.rates.length).toBe(div03.rates.length);
    expect(result.skippedIds).toHaveLength(0);
  });

  it('built Division 03 seeds have correct IDs and source fields', async () => {
    const { buildProductionRateSeedBundle } = await import('../buildProductionRateSeed');
    const result = buildProductionRateSeedBundle(div03, 'batch-div03-2026-06');
    const vaporBarrier = result.rates.find((r) => r.id === '03-15-05.96-0220');
    expect(vaporBarrier).toBeDefined();
    expect(vaporBarrier?.manHoursPerUnit).toBe(0.002);
    expect(vaporBarrier?.unit).toBe('SF');
    expect(vaporBarrier?.sourceFigure).toBe('Figure 5-C-9');
    expect(vaporBarrier?.directLaborOnly).toBe(true);
    expect(vaporBarrier?.importBatchId).toBe('batch-div03-2026-06');
  });

  it('throws on invalid reviewed file', async () => {
    const { buildProductionRateSeedBundle } = await import('../buildProductionRateSeed');
    const badFile: ReviewedRateFile = {
      batchMeta: {
        sourceManual: 'Test',
        sourceEdition: 'Test',
        divisionCode: '03',
        divisionName: 'Concrete',
        importedAt: '2026-01-01',
        reviewedBy: 'test',
      },
      rates: [
        {
          id: 'bad-id',
          masterFormatCode: '03 15 05.96',
          workElementLineNumber: '0220',
          description: 'Bad entry',
          unit: 'SF',
          rateType: 'labor_production',
          manHoursPerUnit: 0.002,
          sourceFigure: 'Figure 5-C-9',
          sourcePage: '5-C-8',
          directLaborOnly: true,
          militaryAdjusted: false,
          tags: [],
          applicableActivityTypes: [],
        },
      ],
    };
    expect(() => buildProductionRateSeedBundle(badFile, 'test-batch')).toThrow('validation');
  });
});
