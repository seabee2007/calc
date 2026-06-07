import { describe, expect, it } from 'vitest';
import {
  formatMasterActivityOption,
  getMasterActivitiesByDivision,
  getMasterActivityByCode,
  isMasterActivityCode,
  searchMasterActivities,
} from '../data/masterActivityIndex';
import {
  applyMasterActivityToDraftLine,
  assignCustomActivityCodeToDraftLine,
  buildDisplayCode,
  countMasterActivityInstances,
  nextCustomLineSequence,
  parseActivityCode,
} from '../application/estimateActivityCoding';
import {
  createEmptyDraftLine,
  draftLinesFromVersion,
  enrichLegacyDraftLineFromMaster,
} from '../application/estimateDraftLine';
import {
  estimateLineItemsToScheduleActivities,
  getActivityGraphKey,
} from '../scheduling/adapters/estimateLineItemsToScheduleActivities';
import {
  mapDomainTaskToLineItemInsert,
  mapLineItemRowToDomainTask,
} from '../infrastructure/estimateMappers';
import type { EstimateDomainTask, EstimateLineItemRow } from '../infrastructure/estimateDbTypes';
import type { EstimateDraftLine } from '../application/estimateDraftLine';

const FOOTING_FORMS = '03-01-01';
const FOOTING_REBAR = '03-01-02';

function draftFor(_code: string, clientId = 'c1'): EstimateDraftLine {
  return createEmptyDraftLine(0, clientId);
}

describe('masterActivityIndex', () => {
  it('looks up a master activity by exact code', () => {
    const master = getMasterActivityByCode(FOOTING_FORMS);
    expect(master?.title).toBe('Set footing forms');
    expect(isMasterActivityCode(FOOTING_FORMS)).toBe(true);
    expect(isMasterActivityCode('99-99-99')).toBe(false);
  });

  it('returns activities for a division sorted by code', () => {
    const division03 = getMasterActivitiesByDivision('03');
    expect(division03.length).toBeGreaterThan(0);
    expect(division03.every((a) => a.divisionCode === '03')).toBe(true);
    const codes = division03.map((a) => a.activityCode);
    expect([...codes]).toEqual([...codes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  });

  it('searches across code, title, and trade', () => {
    expect(searchMasterActivities('footing').some((a) => a.activityCode === FOOTING_FORMS)).toBe(true);
    expect(searchMasterActivities('Set footing forms')[0]?.activityCode).toBe(FOOTING_FORMS);
    expect(searchMasterActivities(FOOTING_REBAR)[0]?.activityCode).toBe(FOOTING_REBAR);
  });

  it('formats an option label', () => {
    const master = getMasterActivityByCode(FOOTING_FORMS)!;
    expect(formatMasterActivityOption(master)).toBe('03-01-01 — Set footing forms');
  });
});

describe('applyMasterActivityToDraftLine', () => {
  it('fixes code and title from the master regardless of add order', () => {
    const master = getMasterActivityByCode(FOOTING_REBAR)!;
    const applied = applyMasterActivityToDraftLine(draftFor(FOOTING_REBAR), master, 1);
    expect(applied.task.activityCode).toBe(FOOTING_REBAR);
    expect(applied.task.title).toBe('Place footing reinforcement');
    expect(applied.task.masterActivityCode).toBe(FOOTING_REBAR);
    expect(applied.task.isCustomActivity).toBe(false);
    expect(applied.task.displayCode).toBe(FOOTING_REBAR);
    expect(applied.task.activityType).toBe(master.activityType);
    expect(applied.task.workPackageName).toBe(master.workPackageName);
  });

  it('does not overwrite custom scope notes (description)', () => {
    const master = getMasterActivityByCode(FOOTING_FORMS)!;
    const draft = draftFor(FOOTING_FORMS);
    draft.task.description = 'Use 2x12 forms on the north wall';
    const applied = applyMasterActivityToDraftLine(draft, master, 1);
    expect(applied.task.description).toBe('Use 2x12 forms on the north wall');
    expect(applied.task.title).toBe('Set footing forms');
  });

  it('assigns a unique display code for repeated instances while keeping the base code', () => {
    const master = getMasterActivityByCode(FOOTING_FORMS)!;
    const first = applyMasterActivityToDraftLine(draftFor(FOOTING_FORMS, 'a'), master, 1);
    const second = applyMasterActivityToDraftLine(draftFor(FOOTING_FORMS, 'b'), master, 2);
    expect(first.task.activityCode).toBe(FOOTING_FORMS);
    expect(second.task.activityCode).toBe(FOOTING_FORMS);
    expect(first.task.displayCode).toBe(FOOTING_FORMS);
    expect(second.task.displayCode).toBe('03-01-01.2');
  });
});

describe('buildDisplayCode + duplicate counting', () => {
  it('appends .N only for repeats', () => {
    expect(buildDisplayCode('03-01-01')).toBe('03-01-01');
    expect(buildDisplayCode('03-01-01', 1)).toBe('03-01-01');
    expect(buildDisplayCode('03-01-01', 3)).toBe('03-01-01.3');
  });

  it('counts existing master instances', () => {
    const master = getMasterActivityByCode(FOOTING_FORMS)!;
    const a = applyMasterActivityToDraftLine(draftFor(FOOTING_FORMS, 'a'), master, 1);
    const b = applyMasterActivityToDraftLine(draftFor(FOOTING_FORMS, 'b'), master, 2);
    expect(countMasterActivityInstances([a, b], FOOTING_FORMS)).toBe(2);
    expect(countMasterActivityInstances([a, b], FOOTING_FORMS, 'a')).toBe(1);
  });
});

describe('custom activity coding', () => {
  it('assigns a reserved DD-99-XX code and marks custom', () => {
    const draft = createEmptyDraftLine(0, 'c1');
    draft.task.divisionCode = '03';
    draft.task.title = 'Hand-carve decorative cornice';
    draft.task.isCustomActivity = true;
    const coded = assignCustomActivityCodeToDraftLine(draft, []);
    expect(coded.task.activityCode).toBe('03-99-01');
    expect(coded.task.isCustomActivity).toBe(true);
    expect(coded.task.displayCode).toBe('03-99-01');
    expect(parseActivityCode(coded.task.activityCode!)?.activitySequence).toBe(99);
    expect(coded.task.title).toBe('Hand-carve decorative cornice');
  });

  it('increments the custom line sequence within a division', () => {
    const draft = createEmptyDraftLine(0, 'c1');
    draft.task.divisionCode = '03';
    draft.task.isCustomActivity = true;
    const first = assignCustomActivityCodeToDraftLine(draft, []);
    expect(nextCustomLineSequence([first], '03')).toBe(2);
  });
});

describe('runtime graph key', () => {
  it('uses runtime id when present, falls back to code', () => {
    expect(getActivityGraphKey({ runtimeActivityId: 'rt-1', activityCode: '03-01-01' })).toBe('rt-1');
    expect(getActivityGraphKey({ runtimeActivityId: undefined, activityCode: '03-01-01' })).toBe('03-01-01');
  });

  it('keeps repeated master codes uniquely keyed by runtime id', () => {
    const master = getMasterActivityByCode(FOOTING_FORMS)!;
    const a = applyMasterActivityToDraftLine(draftFor(FOOTING_FORMS, 'a'), master, 1);
    const b = applyMasterActivityToDraftLine(draftFor(FOOTING_FORMS, 'b'), master, 2);
    // distinct line-item ids => distinct runtime ids on the schedule activities
    a.task.id = 'task-a';
    a.task.lineItem.id = 'task-a';
    b.task.id = 'task-b';
    b.task.lineItem.id = 'task-b';
    const { activities } = estimateLineItemsToScheduleActivities([a.task, b.task]);
    const keys = activities.map(getActivityGraphKey);
    expect(new Set(keys).size).toBe(2);
    expect(activities.map((x) => x.activityCode)).toEqual([FOOTING_FORMS, FOOTING_FORMS]);
    expect(activities.map((x) => x.displayCode)).toEqual([FOOTING_FORMS, '03-01-01.2']);
  });
});

describe('legacy enrichment', () => {
  it('links a saved code to the master without overwriting the saved title', () => {
    const draft = createEmptyDraftLine(0, 'c1');
    draft.task.activityCode = FOOTING_FORMS;
    draft.task.title = 'Footing forms (legacy label)';
    const enriched = enrichLegacyDraftLineFromMaster(draft);
    expect(enriched.task.masterActivityCode).toBe(FOOTING_FORMS);
    expect(enriched.task.isCustomActivity).toBe(false);
    expect(enriched.task.title).toBe('Footing forms (legacy label)');
    expect(enriched.task.activityType).toBeDefined();
  });

  it('marks an unknown code as custom', () => {
    const draft = createEmptyDraftLine(0, 'c1');
    draft.task.activityCode = '03-99-07';
    draft.task.title = 'One-off site task';
    const enriched = enrichLegacyDraftLineFromMaster(draft);
    expect(enriched.task.isCustomActivity).toBe(true);
    expect(enriched.task.masterActivityCode).toBeUndefined();
  });
});

describe('identity persistence round-trip', () => {
  it('round-trips identity fields through the mappers', () => {
    const master = getMasterActivityByCode(FOOTING_REBAR)!;
    const applied = applyMasterActivityToDraftLine(draftFor(FOOTING_REBAR), master, 2);
    const insert = mapDomainTaskToLineItemInsert({
      task: applied.task,
      estimateVersionId: 'v1',
      projectId: 'p1',
    });

    expect(insert.activity_code).toBe(FOOTING_REBAR);
    expect(insert.master_activity_code).toBe(FOOTING_REBAR);
    expect(insert.activity_instance).toBe(2);
    expect(insert.display_code).toBe('03-01-02.2');
    expect(insert.is_custom_activity).toBe(false);
    expect(insert.activity_type).toBe(master.activityType);

    const row: EstimateLineItemRow = {
      id: 'li-1',
      estimate_version_id: 'v1',
      project_id: 'p1',
      parent_line_item_id: null,
      line_type: 'task',
      csi_division: '03',
      csi_section: null,
      scope_name: insert.scope_name ?? null,
      title: insert.title,
      description: insert.description ?? null,
      trade: insert.trade ?? null,
      activity: insert.activity ?? null,
      quantity: 0,
      unit: insert.unit ?? null,
      production_rate: 0,
      production_rate_type: null,
      crew_size: 0,
      hours_per_day: 8,
      labor_rate: 0,
      burden_percent: 0,
      overhead_percent: 0,
      profit_percent: 0,
      contingency_percent: 0,
      tax_percent: 0,
      waste_percent: 0,
      difficulty_factor: 1,
      location_factor: 1,
      material_cost: 0,
      equipment_cost: 0,
      subcontractor_cost: 0,
      indirect_cost: 0,
      calculated_values: insert.calculated_values ?? {},
      schedule_enabled: true,
      weather_sensitive: false,
      inspection_required: false,
      position: 0,
      created_at: '2026-06-08T00:00:00Z',
      activity_code: insert.activity_code ?? null,
      master_activity_code: insert.master_activity_code ?? null,
      activity_instance: insert.activity_instance ?? null,
      display_code: insert.display_code ?? null,
      is_custom_activity: insert.is_custom_activity ?? null,
      activity_type: insert.activity_type ?? null,
      sequencing_category: insert.sequencing_category ?? null,
      logic_anchor: insert.logic_anchor ?? null,
      work_package_code: insert.work_package_code ?? null,
      division_code: insert.division_code ?? null,
      division_name: insert.division_name ?? null,
      predecessor_activity_code: insert.predecessor_activity_code ?? null,
      relationship_type: insert.relationship_type ?? null,
      lag_days: insert.lag_days ?? null,
    };

    const task: EstimateDomainTask = mapLineItemRowToDomainTask(row);
    expect(task.activityCode).toBe(FOOTING_REBAR);
    expect(task.masterActivityCode).toBe(FOOTING_REBAR);
    expect(task.activityInstance).toBe(2);
    expect(task.displayCode).toBe('03-01-02.2');
    expect(task.isCustomActivity).toBe(false);
    expect(task.activityType).toBe(master.activityType);
  });

  it('preserves a master code on reload via draftLinesFromVersion (no add-order regeneration)', () => {
    const master = getMasterActivityByCode(FOOTING_REBAR)!;
    const applied = applyMasterActivityToDraftLine(draftFor(FOOTING_REBAR), master, 1);
    const reloaded = draftLinesFromVersion([applied.task]);
    expect(reloaded[0].task.activityCode).toBe(FOOTING_REBAR);
    expect(reloaded[0].task.masterActivityCode).toBe(FOOTING_REBAR);
  });
});
