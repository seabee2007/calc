import { describe, expect, it } from 'vitest';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import {
  ESTIMATE_SCHEDULE_LINE_SYNC_KEY,
  addDaysToScheduleDate,
  calculateScheduleEventEndDate,
  mapScheduleCandidateToScheduleEventInput,
  mapSchedulePlanToScheduleEventInputs,
  resolveScheduleEventDurationDays,
} from '../application/mapScheduleCandidateToScheduleEventInput';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateDomainTask, EstimateDomainVersion } from '../infrastructure/estimateDbTypes';
import type { EstimateScheduleTaskCandidate } from '../domain/estimateScheduleTypes';

const DEFAULT_OPTIONS = {
  projectId: 'proj-1',
  defaultStartDate: '2026-06-10',
  timezone: 'America/Chicago',
  calendarId: 'primary',
};

function buildTask(lineIndex = 0, overrides: Partial<EstimateDomainTask> = {}): EstimateDomainTask {
  const snapshot = buildEstimateSnapshot(sampleEstimateVersion);
  const line = snapshot.lineItems[lineIndex];
  const input = sampleEstimateVersion.lineItems[lineIndex];

  return {
    id: `line-${lineIndex}`,
    lineType: 'task',
    title: input.description,
    description: input.description,
    scopeName: 'Concrete Scope',
    trade: 'Concrete',
    activity: 'Pour',
    position: lineIndex,
    lineItem: input,
    overheadPercent: 10,
    profitPercent: 5,
    contingencyPercent: 2,
    taxPercent: 8,
    wastePercent: 10,
    scheduleEnabled: true,
    weatherSensitive: false,
    inspectionRequired: false,
    calculatedValues: {
      quantityFormula: line.quantityFormula,
      metrics: line.metrics,
      costs: line.costs,
    },
    ...overrides,
  };
}

function buildVersion(lineItems: EstimateDomainTask[]): EstimateDomainVersion {
  const snapshot = buildEstimateSnapshot(sampleEstimateVersion);

  return {
    id: 'ver-1',
    estimateId: 'est-1',
    projectId: 'proj-1',
    versionNumber: 2,
    versionName: 'Initial',
    estimateType: 'detailed',
    status: 'draft',
    snapshot,
    totals: snapshot.totals,
    notes: null,
    createdBy: null,
    createdAt: '2026-06-04T00:00:00.000Z',
    lineItems,
    warnings: [],
  };
}

function buildCandidate(overrides: Partial<EstimateScheduleTaskCandidate> = {}): EstimateScheduleTaskCandidate {
  const plan = buildEstimateSchedulePlan({
    version: buildVersion([buildTask(0)]),
    estimateId: 'est-1',
    projectId: 'proj-1',
  });
  const base = plan.divisions[0].scopes[0].tasks[0];
  return { ...base, ...overrides };
}

function assertFiniteMetadata(metadata: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'number') {
      expect(Number.isFinite(value), `${key} should be finite`).toBe(true);
      expect(Number.isNaN(value), `${key} should not be NaN`).toBe(false);
    }
  }
}

describe('mapScheduleCandidateToScheduleEventInput', () => {
  it('maps a candidate to a draft schedule event input', () => {
    const candidate = buildCandidate();
    const draft = mapScheduleCandidateToScheduleEventInput(candidate, DEFAULT_OPTIONS);

    expect(draft.project_id).toBe('proj-1');
    expect(draft.title).toContain('Slab pour');
    expect(draft.all_day).toBe(true);
    expect(draft.event_type).toBe('estimate_task');
    expect(draft.status).toBe('planned');
    expect(draft.priority).toBe('normal');
    expect(draft.source).toBe('estimate');
    expect(draft.timezone).toBe('America/Chicago');
    expect(draft.calendar_id).toBe('primary');
    expect(draft.description).toContain('Estimate source');
    expect(draft.description).toContain('Concrete Scope');
  });

  it('calculates start and end dates from duration days', () => {
    const candidate = buildCandidate({
      labor: {
        ...buildCandidate().labor,
        durationDays: 3,
      },
    });

    const draft = mapScheduleCandidateToScheduleEventInput(candidate, DEFAULT_OPTIONS);

    expect(draft.start_date).toBe('2026-06-10');
    expect(draft.end_date).toBe('2026-06-12');
    expect(calculateScheduleEventEndDate('2026-06-10', 3)).toBe('2026-06-12');
    expect(addDaysToScheduleDate('2026-06-10', 2)).toBe('2026-06-12');
  });

  it('uses a one-day default duration when duration is missing or less than one', () => {
    const candidate = buildCandidate({
      labor: {
        ...buildCandidate().labor,
        durationDays: 0,
      },
    });

    expect(resolveScheduleEventDurationDays(candidate)).toBe(1);

    const draft = mapScheduleCandidateToScheduleEventInput(candidate, DEFAULT_OPTIONS);
    expect(draft.start_date).toBe('2026-06-10');
    expect(draft.end_date).toBe('2026-06-10');
    expect(draft.syncMetadata.durationDays).toBe(1);
  });

  it('includes estimate traceability in syncMetadata', () => {
    const candidate = buildCandidate({ candidateId: 'ver-1:line-0' });
    const draft = mapScheduleCandidateToScheduleEventInput(candidate, DEFAULT_OPTIONS);

    expect(draft.syncMetadata.syncKey).toBe(ESTIMATE_SCHEDULE_LINE_SYNC_KEY);
    expect(draft.syncMetadata.estimateId).toBe('est-1');
    expect(draft.syncMetadata.estimateVersionId).toBe('ver-1');
    expect(draft.syncMetadata.estimateVersionNumber).toBe(2);
    expect(draft.syncMetadata.estimateLineItemId).toBe('line-0');
    expect(draft.syncMetadata.candidateId).toBe('ver-1:line-0');
    expect(draft.syncMetadata.scopeName).toBe('Concrete Scope');
    assertFiniteMetadata(draft.syncMetadata as unknown as Record<string, unknown>);
  });

  it('preserves weather-sensitive and inspection-required flags', () => {
    const candidate = buildCandidate({
      weatherSensitive: true,
      inspectionRequired: true,
      warnings: [
        { code: 'weather_sensitive', message: 'Weather sensitive line.' },
        { code: 'inspection_required', message: 'Inspection required.' },
      ],
    });

    const draft = mapScheduleCandidateToScheduleEventInput(candidate, DEFAULT_OPTIONS);

    expect(draft.syncMetadata.weatherSensitive).toBe(true);
    expect(draft.syncMetadata.inspectionRequired).toBe(true);
    expect(draft.description).toContain('Warnings:');
    expect(draft.description).toContain('Weather sensitive line.');
  });

  it('uses candidate plannedStartDate when present', () => {
    const candidate = buildCandidate({
      plannedStartDate: '2026-07-01' as never,
    });

    const draft = mapScheduleCandidateToScheduleEventInput(candidate, DEFAULT_OPTIONS);
    expect(draft.start_date).toBe('2026-07-01');
  });

  it('does not mutate the input candidate', () => {
    const candidate = buildCandidate();
    const snapshot = JSON.parse(JSON.stringify(candidate));

    mapScheduleCandidateToScheduleEventInput(candidate, DEFAULT_OPTIONS);

    expect(candidate).toEqual(snapshot);
  });
});

describe('mapSchedulePlanToScheduleEventInputs', () => {
  it('maps multiple candidates from a schedule plan', () => {
    const plan = buildEstimateSchedulePlan({
      version: buildVersion([buildTask(0), buildTask(1, { id: 'line-1', position: 1 })]),
      estimateId: 'est-1',
      projectId: 'proj-1',
    });

    const drafts = mapSchedulePlanToScheduleEventInputs(plan, DEFAULT_OPTIONS);

    expect(drafts).toHaveLength(2);
    expect(drafts[0].syncMetadata.estimateLineItemId).toBe('line-0');
    expect(drafts[1].syncMetadata.estimateLineItemId).toBe('line-1');

    for (const draft of drafts) {
      assertFiniteMetadata(draft.syncMetadata as unknown as Record<string, unknown>);
      expect(draft.end_date).not.toContain('NaN');
      expect(draft.end_date).not.toContain('Infinity');
    }
  });
});
