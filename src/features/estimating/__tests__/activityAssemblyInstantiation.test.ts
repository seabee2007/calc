import { describe, expect, it } from 'vitest';
import {
  ASSEMBLY_BACKFILL_AND_COMPACT,
  ASSEMBLY_CLEAR_AND_GRUB,
  ASSEMBLY_EXCAVATE_FOOTINGS,
  ASSEMBLY_PLACE_CONTINUOUS_FOOTING,
  ASSEMBLY_PLACE_SLAB_ON_GRADE,
  CA_ASSEMBLY_BY_ID,
  CA_ASSEMBLY_GROUPS,
} from '../data/activityAssemblyRegistry';
import {
  CONTINUOUS_FOOTING_LINE_ITEMS,
  CONTINUOUS_FOOTING_RATES,
  DIV03_CONCRETE,
  DIV03_ALL_PRODUCTION_RATES,
  PLACE_CONTINUOUS_FOOTING_ACTIVITY,
  PLACE_SLAB_ON_GRADE_LINE_ITEMS,
} from '../data/div03ConcreteSeeds';
import {
  BACKFILL_AND_COMPACT_LINE_ITEMS,
  CLEAR_AND_GRUB_LINE_ITEMS,
  DIV31_EARTHWORK,
  DIV31_PRODUCTION_RATES,
  EXCAVATE_FOOTINGS_LINE_ITEMS,
} from '../data/div31EarthworkSeeds';
import { instantiateFromAssemblySpec } from '../domain/activityAssemblyInstantiation';

// ── Registry ─────────────────────────────────────────────────────────────────

describe('activityAssemblyRegistry', () => {
  it('has two division groups (31 Earthwork first, then 03 Concrete)', () => {
    expect(CA_ASSEMBLY_GROUPS).toHaveLength(2);
    expect(CA_ASSEMBLY_GROUPS[0].divisionCode).toBe('31');
    expect(CA_ASSEMBLY_GROUPS[1].divisionCode).toBe('03');
  });

  it('contains five assemblies total', () => {
    const total = CA_ASSEMBLY_GROUPS.reduce((n, g) => n + g.assemblies.length, 0);
    expect(total).toBe(5);
  });

  it('all assembly IDs are unique and findable by ID', () => {
    const allIds = CA_ASSEMBLY_GROUPS.flatMap((g) => g.assemblies.map((a) => a.id));
    expect(new Set(allIds).size).toBe(allIds.length);
    for (const id of allIds) {
      expect(CA_ASSEMBLY_BY_ID.has(id)).toBe(true);
    }
  });

  it('each assembly has at least one quantity input and one line item mapping', () => {
    for (const group of CA_ASSEMBLY_GROUPS) {
      for (const asm of group.assemblies) {
        expect(asm.quantityInputs.length).toBeGreaterThan(0);
        expect(asm.lineItemQuantityMap.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── Place Slab on Grade assembly ─────────────────────────────────────────────

describe('instantiateFromAssemblySpec — Place Slab on Grade', () => {
  const div03Rates = new Map(DIV03_ALL_PRODUCTION_RATES.map((r) => [r.id, r]));

  it('produces 7 line items from slab on grade assembly', () => {
    const result = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
      userInputs: {
        slabAreaSf: 2000,
        slabConcreteCyd: 24.7,
        slabPerimeterLf: 180,
        controlJointLf: 250,
      },
      division: DIV03_CONCRETE,
      lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      productionRates: div03Rates,
      projectId: 'test-project',
    });

    expect(result.projectLineItems).toHaveLength(7);
    expect(result.quantityWarnings).toHaveLength(0);
    expect(result.rollup.totalManHours).toBeGreaterThan(0);
  });

  it('applies quantityMultiplier to vapor barrier and WWF', () => {
    const result = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
      userInputs: {
        slabAreaSf: 1000,
        slabConcreteCyd: 12,
        slabPerimeterLf: 120,
        controlJointLf: 100,
      },
      division: DIV03_CONCRETE,
      lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      productionRates: div03Rates,
      projectId: 'test-project',
    });

    const vaporBarrier = result.projectLineItems.find((li) => li.name === 'Place vapor barrier');
    const wwf = result.projectLineItems.find((li) => li.name === 'Place welded wire fabric');

    // 1.05 multiplier for vapor barrier
    expect(vaporBarrier?.quantity).toBeCloseTo(1050, 1);
    // 1.10 multiplier for WWF
    expect(wwf?.quantity).toBeCloseTo(1100, 1);
  });

  it('all line items are not schedule activities', () => {
    const result = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
      userInputs: { slabAreaSf: 500, slabConcreteCyd: 6, slabPerimeterLf: 90, controlJointLf: 60 },
      division: DIV03_CONCRETE,
      lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      productionRates: div03Rates,
      projectId: 'test-project',
    });

    for (const li of result.projectLineItems) {
      expect('scheduleEnabled' in li).toBe(false);
    }
    expect(result.projectActivity.scheduleEnabled).toBe(true);
  });

  it('missing inputs default to 0 and generate warnings', () => {
    const result = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
      userInputs: {},
      division: DIV03_CONCRETE,
      lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      productionRates: div03Rates,
      projectId: 'test-project',
    });

    expect(result.rollup.totalManHours).toBe(0);
    expect(result.quantityWarnings.length).toBeGreaterThan(0);
  });

  it('2,000 SF house slab produces expected rollup range', () => {
    const result = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
      userInputs: {
        slabAreaSf: 2000,
        slabConcreteCyd: 24.7,
        slabPerimeterLf: 180,
        controlJointLf: 250,
      },
      division: DIV03_CONCRETE,
      lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      productionRates: div03Rates,
      projectId: 'test-project',
    });

    // With manual rates, 2000 SF slab should be between 100–300 MH range
    expect(result.rollup.totalManHours).toBeGreaterThan(100);
    expect(result.rollup.totalManHours).toBeLessThan(400);
    expect(result.rollup.calculatedDurationDays).toBeGreaterThan(0);
  });
});

// ── Place Continuous Footing assembly ────────────────────────────────────────

describe('instantiateFromAssemblySpec — Place Continuous Footing', () => {
  const div03Rates = new Map(DIV03_ALL_PRODUCTION_RATES.map((r) => [r.id, r]));

  it('produces 3 line items from continuous footing assembly', () => {
    // 2,000 SF house: 300 LF footing, 8" × 12" (0.667 × 1 ft)
    // Contact SF: 2 sides × 1 ft height × 300 LF = 600 SF
    // Rebar: ~300 LF × 2 bars #5 (1.04 lb/ft) × 2 / 2000 = 0.312 Ton
    // Concrete: 300 LF × 0.667 ft wide × 1 ft deep / 27 = 7.4 CYD
    const result = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_PLACE_CONTINUOUS_FOOTING,
      userInputs: {
        footingContactSf: 600,
        footingRebarTon: 0.31,
        footingConcreteCyd: 7.4,
      },
      division: DIV03_CONCRETE,
      lineItemTemplates: CONTINUOUS_FOOTING_LINE_ITEMS,
      productionRates: div03Rates,
      projectId: 'test-project',
    });

    expect(result.projectLineItems).toHaveLength(3);
    expect(result.quantityWarnings).toHaveLength(0);
    expect(result.rollup.totalManHours).toBeGreaterThan(0);

    const forms = result.projectLineItems.find((li) => li.name.includes('Form'));
    expect(forms?.quantity).toBe(600);

    const concrete = result.projectLineItems.find((li) => li.name.includes('concrete'));
    expect(concrete?.quantity).toBe(7.4);
  });
});

// ── Division 31 Earthwork assemblies ─────────────────────────────────────────

describe('instantiateFromAssemblySpec — Clear and Grub Site', () => {
  const div31Rates = new Map(DIV31_PRODUCTION_RATES.map((r) => [r.id, r]));

  it('produces 2 line items for 0.1 acre site', () => {
    const result = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_CLEAR_AND_GRUB,
      userInputs: { siteAcres: 0.1 },
      division: DIV31_EARTHWORK,
      lineItemTemplates: CLEAR_AND_GRUB_LINE_ITEMS,
      productionRates: div31Rates,
      projectId: 'test-project',
    });

    expect(result.projectLineItems).toHaveLength(2);
    expect(result.rollup.totalManHours).toBeCloseTo((64.0 + 16.0) * 0.1, 3);
  });
});

describe('instantiateFromAssemblySpec — Excavate Footings', () => {
  const div31Rates = new Map(DIV31_PRODUCTION_RATES.map((r) => [r.id, r]));

  it('produces 2 line items with correct quantities', () => {
    // 300 LF footing × 2 ft wide × 1 ft deep / 27 = 22.2 Bank CYD
    // backfill ≈ 22.2 − 7.4 = 14.8 CYD
    const result = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_EXCAVATE_FOOTINGS,
      userInputs: { excavationCyd: 22.2, backfillCyd: 14.8 },
      division: DIV31_EARTHWORK,
      lineItemTemplates: EXCAVATE_FOOTINGS_LINE_ITEMS,
      productionRates: div31Rates,
      projectId: 'test-project',
    });

    expect(result.projectLineItems).toHaveLength(2);
    const excavation = result.projectLineItems.find((li) => li.name.includes('Excavate'));
    expect(excavation?.quantity).toBe(22.2);
    const backfill = result.projectLineItems.find((li) => li.name.includes('Backfill'));
    expect(backfill?.quantity).toBe(14.8);
  });
});

describe('instantiateFromAssemblySpec — Backfill and Compact', () => {
  const div31Rates = new Map(DIV31_PRODUCTION_RATES.map((r) => [r.id, r]));

  it('produces 1 line item', () => {
    const result = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_BACKFILL_AND_COMPACT,
      userInputs: { backfillVolumeCyd: 50 },
      division: DIV31_EARTHWORK,
      lineItemTemplates: BACKFILL_AND_COMPACT_LINE_ITEMS,
      productionRates: div31Rates,
      projectId: 'test-project',
    });

    expect(result.projectLineItems).toHaveLength(1);
    expect(result.rollup.totalManHours).toBeCloseTo(50 * 0.06, 5);
  });
});

// ── M1/M2 Gate: 2,000 SF house foundation package ────────────────────────────

describe('M1/M2 Gate — 2,000 SF house foundation package', () => {
  const div03Rates = new Map(DIV03_ALL_PRODUCTION_RATES.map((r) => [r.id, r]));
  const div31Rates = new Map(DIV31_PRODUCTION_RATES.map((r) => [r.id, r]));

  // Assumptions for a 2,000 SF slab-on-grade house:
  //   Footprint: 40' × 50' = 2,000 SF
  //   Site: 0.1 acres (4,356 SF ~ small residential lot clearing)
  //   Footing: 180 LF perimeter + 120 LF interior beams = 300 LF total
  //     Size: 8" wide × 12" deep = 0.667 × 1 ft
  //     Contact SF: 2 sides × 1 ft × 300 LF = 600 SF
  //     Concrete: 300 × 0.667 × 1 / 27 = 7.4 CYD
  //     Rebar: ~0.31 Ton (#5 bar, 2 bars continuous)
  //     Excavation: 300 × 0.667 × 1 / 27 = 7.4 Bank CYD (trench only)
  //     Backfill: 0 CYD (footing fills the trench, negligible)
  //   Slab: 2,000 SF, 4" thick = 24.7 CYD, perimeter 180 LF, joints 250 LF

  it('Clear and Grub: 0.1 acres produces non-zero MH', () => {
    const r = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_CLEAR_AND_GRUB,
      userInputs: { siteAcres: 0.1 },
      division: DIV31_EARTHWORK,
      lineItemTemplates: CLEAR_AND_GRUB_LINE_ITEMS,
      productionRates: div31Rates,
      projectId: 'gate-test',
    });
    expect(r.rollup.totalManHours).toBeGreaterThan(0);
    expect(r.rollup.warnings.length).toBe(0);
  });

  it('Excavate Footings: 7.4 CYD produces non-zero MH', () => {
    const r = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_EXCAVATE_FOOTINGS,
      userInputs: { excavationCyd: 7.4, backfillCyd: 0 },
      division: DIV31_EARTHWORK,
      lineItemTemplates: EXCAVATE_FOOTINGS_LINE_ITEMS,
      productionRates: div31Rates,
      projectId: 'gate-test',
    });
    expect(r.rollup.totalManHours).toBeGreaterThan(0);
  });

  it('Place Continuous Footing: 300 LF footing produces non-zero MH', () => {
    const r = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_PLACE_CONTINUOUS_FOOTING,
      userInputs: { footingContactSf: 600, footingRebarTon: 0.31, footingConcreteCyd: 7.4 },
      division: DIV03_CONCRETE,
      lineItemTemplates: CONTINUOUS_FOOTING_LINE_ITEMS,
      productionRates: div03Rates,
      projectId: 'gate-test',
    });
    expect(r.rollup.totalManHours).toBeGreaterThan(0);
    expect(r.rollup.warnings.length).toBe(0);
  });

  it('Place Slab on Grade: 2,000 SF slab produces correct activity count', () => {
    const r = instantiateFromAssemblySpec({
      assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
      userInputs: {
        slabAreaSf: 2000,
        slabConcreteCyd: 24.7,
        slabPerimeterLf: 180,
        controlJointLf: 250,
      },
      division: DIV03_CONCRETE,
      lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
      productionRates: div03Rates,
      projectId: 'gate-test',
    });

    expect(r.projectLineItems).toHaveLength(7);
    expect(r.projectActivity.scheduleEnabled).toBe(true);
    expect(r.rollup.totalManHours).toBeGreaterThan(100);
    expect(r.rollup.warnings.length).toBe(0);
  });

  it('all four gate assemblies produce positive MH with no warnings', () => {
    const results = [
      instantiateFromAssemblySpec({
        assembly: ASSEMBLY_CLEAR_AND_GRUB,
        userInputs: { siteAcres: 0.1 },
        division: DIV31_EARTHWORK,
        lineItemTemplates: CLEAR_AND_GRUB_LINE_ITEMS,
        productionRates: div31Rates,
        projectId: 'gate-test',
      }),
      instantiateFromAssemblySpec({
        assembly: ASSEMBLY_EXCAVATE_FOOTINGS,
        userInputs: { excavationCyd: 7.4, backfillCyd: 0 },
        division: DIV31_EARTHWORK,
        lineItemTemplates: EXCAVATE_FOOTINGS_LINE_ITEMS,
        productionRates: div31Rates,
        projectId: 'gate-test',
      }),
      instantiateFromAssemblySpec({
        assembly: ASSEMBLY_PLACE_CONTINUOUS_FOOTING,
        userInputs: { footingContactSf: 600, footingRebarTon: 0.31, footingConcreteCyd: 7.4 },
        division: DIV03_CONCRETE,
        lineItemTemplates: CONTINUOUS_FOOTING_LINE_ITEMS,
        productionRates: div03Rates,
        projectId: 'gate-test',
      }),
      instantiateFromAssemblySpec({
        assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
        userInputs: {
          slabAreaSf: 2000,
          slabConcreteCyd: 24.7,
          slabPerimeterLf: 180,
          controlJointLf: 250,
        },
        division: DIV03_CONCRETE,
        lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
        productionRates: div03Rates,
        projectId: 'gate-test',
      }),
    ];

    for (const r of results) {
      expect(r.rollup.totalManHours).toBeGreaterThan(0);
    }

    const totalMH = results.reduce((s, r) => s + r.rollup.totalManHours, 0);
    expect(totalMH).toBeGreaterThan(200);
  });
});
