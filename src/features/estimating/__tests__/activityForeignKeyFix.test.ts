/**
 * Regression: FK violation fix for project_construction_activities.activity_template_id
 *
 * Before fix: activityTemplateId was set to the local registry key (e.g. "ca-03-place-slab-on-grade")
 * and written to activity_template_id which is a FK to construction_activity_templates(id).
 * This caused: "violates foreign key constraint project_construction_activities_activity_template_id_fkey"
 *
 * After fix:
 *   - activity_template_id = null  (only valid when created from a real DB template row)
 *   - source_template_key  = the local registry key (stored in text column, no FK)
 */
import { describe, expect, it } from 'vitest';
import { instantiateConstructionActivity } from '../domain/constructionActivityInstantiation';
import { instantiateFromAssemblySpec } from '../domain/activityAssemblyInstantiation';
import { mapProjectActivityToInsert } from '../infrastructure/activityMappers';
import {
  ASSEMBLY_CLEAR_AND_GRUB,
  ASSEMBLY_EXCAVATE_FOOTINGS,
  ASSEMBLY_BACKFILL_AND_COMPACT,
  ASSEMBLY_PLACE_CONTINUOUS_FOOTING,
  ASSEMBLY_PLACE_SLAB_ON_GRADE,
} from '../data/activityAssemblyRegistry';
import {
  DIV03_ALL_PRODUCTION_RATES,
  DIV03_CONCRETE,
  CONTINUOUS_FOOTING_LINE_ITEMS,
  PLACE_SLAB_ON_GRADE_LINE_ITEMS,
} from '../data/div03ConcreteSeeds';
import {
  DIV31_EARTHWORK,
  DIV31_PRODUCTION_RATES,
  CLEAR_AND_GRUB_LINE_ITEMS,
  EXCAVATE_FOOTINGS_LINE_ITEMS,
  BACKFILL_AND_COMPACT_LINE_ITEMS,
} from '../data/div31EarthworkSeeds';

const RATE_MAP = new Map(
  [...DIV03_ALL_PRODUCTION_RATES, ...DIV31_PRODUCTION_RATES].map((r) => [r.id, r]),
);

// ── 1. Core: instantiateConstructionActivity sets activityTemplateId = null ──

describe('instantiateConstructionActivity — FK fix', () => {
  const { projectActivity } = instantiateConstructionActivity({
    projectId: 'proj-fk-001',
    division: DIV03_CONCRETE,
    template: {
      id: 'ca-03-place-slab-on-grade',
      code: '03-01-01',
      name: 'Place Slab on Grade',
      scheduleEnabled: true,
      divisionId: DIV03_CONCRETE.id,
    },
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    quantityMap: {
      'ali-form-slab-edge': 180,
      'ali-vapor-barrier': 2000,
      'ali-wwf': 2000,
      'ali-place-concrete': 25,
      'ali-finish-concrete': 2000,
      'ali-cure-concrete': 2000,
      'ali-sawcut-joints': 350,
    },
  });

  it('activityTemplateId is null — NOT the registry key', () => {
    expect(projectActivity.activityTemplateId).toBeNull();
  });

  it('sourceTemplateKey holds the registry key', () => {
    expect(projectActivity.sourceTemplateKey).toBe('ca-03-place-slab-on-grade');
  });

  it('mapProjectActivityToInsert: activity_template_id is null', () => {
    const row = mapProjectActivityToInsert(projectActivity);
    expect(row.activity_template_id).toBeNull();
  });

  it('mapProjectActivityToInsert: source_template_key = registry key', () => {
    const row = mapProjectActivityToInsert(projectActivity);
    expect(row.source_template_key).toBe('ca-03-place-slab-on-grade');
  });

  it('all required non-FK fields are preserved in the insert payload', () => {
    const row = mapProjectActivityToInsert(projectActivity);
    expect(row.project_id).toBe('proj-fk-001');
    expect(row.division_code).toBe('03');
    expect(row.activity_code).toBe('03-01-01');
    expect(row.title).toBe('Place Slab on Grade');
    expect(row.schedule_enabled).toBe(true);
    expect(typeof row.calculated_man_hours).toBe('number');
    expect(typeof row.effective_duration_days).toBe('number');
  });
});

// ── 2. Division 03 assembly via instantiateFromAssemblySpec ──────────────────

describe('ASSEMBLY_PLACE_SLAB_ON_GRADE — FK fix', () => {
  const result = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: { slabAreaSf: 2000, slabConcreteCy: 25, slabPerimeterLf: 180, controlJointLf: 350 },
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-fk-slab',
  });

  it('activityTemplateId is null', () => {
    expect(result.projectActivity.activityTemplateId).toBeNull();
  });

  it('sourceTemplateKey = "ca-03-place-slab-on-grade"', () => {
    expect(result.projectActivity.sourceTemplateKey).toBe('ca-03-place-slab-on-grade');
  });

  it('insert payload: activity_template_id is null', () => {
    expect(mapProjectActivityToInsert(result.projectActivity).activity_template_id).toBeNull();
  });

  it('insert payload: source_template_key = "ca-03-place-slab-on-grade"', () => {
    expect(mapProjectActivityToInsert(result.projectActivity).source_template_key).toBe('ca-03-place-slab-on-grade');
  });
});

describe('ASSEMBLY_PLACE_CONTINUOUS_FOOTING — FK fix', () => {
  const result = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_CONTINUOUS_FOOTING,
    userInputs: { footingLf: 200, footingContactSf: 120, rebarTon: 0.5, concreteCyd: 22 },
    division: DIV03_CONCRETE,
    lineItemTemplates: CONTINUOUS_FOOTING_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-fk-footing',
  });

  it('activityTemplateId is null', () => {
    expect(result.projectActivity.activityTemplateId).toBeNull();
  });

  it('sourceTemplateKey = "ca-03-place-continuous-footing"', () => {
    expect(result.projectActivity.sourceTemplateKey).toBe('ca-03-place-continuous-footing');
  });

  it('insert payload: activity_template_id is null', () => {
    expect(mapProjectActivityToInsert(result.projectActivity).activity_template_id).toBeNull();
  });
});

// ── 3. Division 31 assemblies ─────────────────────────────────────────────────

describe('ASSEMBLY_CLEAR_AND_GRUB — FK fix', () => {
  const result = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_CLEAR_AND_GRUB,
    userInputs: { siteAcres: 0.057 },
    division: DIV31_EARTHWORK,
    lineItemTemplates: CLEAR_AND_GRUB_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-fk-cg',
  });

  it('activityTemplateId is null', () => {
    expect(result.projectActivity.activityTemplateId).toBeNull();
  });

  it('sourceTemplateKey = "ca-31-clear-and-grub"', () => {
    expect(result.projectActivity.sourceTemplateKey).toBe('ca-31-clear-and-grub');
  });

  it('insert payload: activity_template_id is null', () => {
    expect(mapProjectActivityToInsert(result.projectActivity).activity_template_id).toBeNull();
  });

  it('insert payload: source_template_key = "ca-31-clear-and-grub"', () => {
    expect(mapProjectActivityToInsert(result.projectActivity).source_template_key).toBe('ca-31-clear-and-grub');
  });
});

describe('ASSEMBLY_EXCAVATE_FOOTINGS — FK fix', () => {
  const result = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_EXCAVATE_FOOTINGS,
    userInputs: { excavationCyd: 67, backfillCyd: 44 },
    division: DIV31_EARTHWORK,
    lineItemTemplates: EXCAVATE_FOOTINGS_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-fk-ef',
  });

  it('activityTemplateId is null', () => {
    expect(result.projectActivity.activityTemplateId).toBeNull();
  });

  it('sourceTemplateKey = "ca-31-excavate-footings"', () => {
    expect(result.projectActivity.sourceTemplateKey).toBe('ca-31-excavate-footings');
  });

  it('insert payload: activity_template_id is null', () => {
    expect(mapProjectActivityToInsert(result.projectActivity).activity_template_id).toBeNull();
  });
});

describe('ASSEMBLY_BACKFILL_AND_COMPACT — FK fix', () => {
  const result = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_BACKFILL_AND_COMPACT,
    userInputs: { backfillCyd: 44 },
    division: DIV31_EARTHWORK,
    lineItemTemplates: BACKFILL_AND_COMPACT_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-fk-bc',
  });

  it('activityTemplateId is null', () => {
    expect(result.projectActivity.activityTemplateId).toBeNull();
  });

  it('sourceTemplateKey = "ca-31-backfill-compact"', () => {
    expect(result.projectActivity.sourceTemplateKey).toBe('ca-31-backfill-compact');
  });

  it('insert payload: activity_template_id is null', () => {
    expect(mapProjectActivityToInsert(result.projectActivity).activity_template_id).toBeNull();
  });
});

// ── 4. Rollup and schedule fields are not affected ────────────────────────────

describe('FK fix does not break rollup or schedule fields', () => {
  const result = instantiateFromAssemblySpec({
    assembly: ASSEMBLY_PLACE_SLAB_ON_GRADE,
    userInputs: { slabAreaSf: 2000, slabConcreteCy: 25, slabPerimeterLf: 180, controlJointLf: 350 },
    division: DIV03_CONCRETE,
    lineItemTemplates: PLACE_SLAB_ON_GRADE_LINE_ITEMS,
    productionRates: RATE_MAP,
    projectId: 'proj-fk-rollup',
    crewSize: 4,
    hoursPerDay: 8,
  });

  it('scheduleEnabled is still true', () => {
    expect(result.projectActivity.scheduleEnabled).toBe(true);
  });

  it('calculatedManHours > 0', () => {
    expect(result.projectActivity.calculatedManHours).toBeGreaterThan(0);
  });

  it('effectiveDurationDays >= 1', () => {
    expect(result.projectActivity.effectiveDurationDays).toBeGreaterThanOrEqual(1);
  });

  it('divisionCode = "03"', () => {
    expect(result.projectActivity.divisionCode).toBe('03');
  });

  it('7 line items produced', () => {
    expect(result.projectLineItems).toHaveLength(7);
  });

  it('line items are NOT schedule activities (no scheduleEnabled field)', () => {
    for (const li of result.projectLineItems) {
      expect((li as Record<string, unknown>).scheduleEnabled).toBeUndefined();
    }
  });
});
