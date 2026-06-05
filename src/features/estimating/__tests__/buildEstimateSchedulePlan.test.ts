import { describe, expect, it } from 'vitest';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { buildEstimateSchedulePlan } from '../application/buildEstimateSchedulePlan';
import { buildEstimateScheduleCandidateId } from '../application/estimateScheduleCandidateId';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateDomainTask, EstimateDomainVersion } from '../infrastructure/estimateDbTypes';
import { GENERAL_SCOPE_KEY, UNASSIGNED_DIVISION_KEY } from '../domain/estimateLineItemTree';

function buildTaskFromLine(
  lineIndex: number,
  overrides: Partial<EstimateDomainTask> = {},
): EstimateDomainTask {
  const snapshot = buildEstimateSnapshot(sampleEstimateVersion);
  const line = snapshot.lineItems[lineIndex];
  const input = sampleEstimateVersion.lineItems[lineIndex];

  return {
    id: `line-${lineIndex}`,
    lineType: 'task',
    title: input.description,
    description: input.description,
    scopeName: lineIndex === 2 ? 'Masonry Scope' : 'Concrete Scope',
    trade: lineIndex === 2 ? 'Masonry' : 'Concrete',
    activity: 'Work',
    position: lineIndex,
    lineItem: {
      ...input,
      csiDivision: lineIndex === 2 ? '04' : '03',
    },
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
    versionNumber: 1,
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

function allCandidates(plan: ReturnType<typeof buildEstimateSchedulePlan>) {
  return plan.divisions.flatMap((division) =>
    division.scopes.flatMap((scope) => scope.tasks),
  );
}

function assertFiniteLaborPlan(
  plan: ReturnType<typeof buildEstimateSchedulePlan>,
): void {
  for (const candidate of allCandidates(plan)) {
    for (const value of Object.values(candidate.labor)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isNaN(value)).toBe(false);
    }
  }
}

describe('buildEstimateSchedulePlan', () => {
  it('converts scheduled line items into schedule candidates', () => {
    const plan = buildEstimateSchedulePlan({
      version: buildVersion([buildTaskFromLine(0)]),
      estimateId: 'est-1',
      projectId: 'proj-1',
      generatedAtIso: '2026-06-04T12:00:00.000Z',
    });

    const candidates = allCandidates(plan);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].source.estimateLineItemId).toBe('line-0');
    expect(candidates[0].title).toContain('Slab pour');
    assertFiniteLaborPlan(plan);
  });

  it('excludes scheduleEnabled false tasks', () => {
    const plan = buildEstimateSchedulePlan({
      version: buildVersion([
        buildTaskFromLine(0),
        buildTaskFromLine(1, { id: 'line-1', scheduleEnabled: false, position: 1 }),
      ]),
      estimateId: 'est-1',
      projectId: 'proj-1',
      generatedAtIso: '2026-06-04T12:00:00.000Z',
    });

    expect(allCandidates(plan)).toHaveLength(1);
    expect(plan.meta.scheduleEnabledTaskCount).toBe(1);
    expect(plan.meta.excludedTaskCount).toBe(1);
  });

  it('preserves weather-sensitive flag', () => {
    const plan = buildEstimateSchedulePlan({
      version: buildVersion([
        buildTaskFromLine(0, { weatherSensitive: true }),
      ]),
      estimateId: 'est-1',
      projectId: 'proj-1',
    });

    const candidate = allCandidates(plan)[0];
    expect(candidate.weatherSensitive).toBe(true);
    expect(candidate.warnings.some((w) => w.code === 'weather_sensitive')).toBe(true);
  });

  it('preserves inspection-required flag', () => {
    const plan = buildEstimateSchedulePlan({
      version: buildVersion([
        buildTaskFromLine(0, { inspectionRequired: true }),
      ]),
      estimateId: 'est-1',
      projectId: 'proj-1',
    });

    const candidate = allCandidates(plan)[0];
    expect(candidate.inspectionRequired).toBe(true);
    expect(candidate.warnings.some((w) => w.code === 'inspection_required')).toBe(true);
  });

  it('groups candidates by division and scope', () => {
    const plan = buildEstimateSchedulePlan({
      version: buildVersion([
        buildTaskFromLine(0, { position: 0, scopeName: 'Concrete Scope' }),
        buildTaskFromLine(1, {
          id: 'line-1',
          position: 1,
          scopeName: 'Formwork Scope',
          lineItem: {
            ...sampleEstimateVersion.lineItems[1],
            csiDivision: '03',
          },
        }),
        buildTaskFromLine(2, {
          id: 'line-2',
          position: 2,
          scopeName: 'Masonry Scope',
          lineItem: {
            ...sampleEstimateVersion.lineItems[2],
            csiDivision: '04',
          },
        }),
      ]),
      estimateId: 'est-1',
      projectId: 'proj-1',
    });

    expect(plan.divisions).toHaveLength(2);
    expect(plan.divisions[0].key).toBe('03');
    expect(plan.divisions[1].key).toBe('04');

    const concreteScopes = plan.divisions[0].scopes;
    expect(concreteScopes.length).toBeGreaterThanOrEqual(2);

    const firstScopeTasks = concreteScopes[0].tasks;
    expect(firstScopeTasks[0].sortOrder).toBeLessThanOrEqual(firstScopeTasks.at(-1)!.sortOrder);
  });

  it('uses deterministic candidate ids', () => {
    const plan = buildEstimateSchedulePlan({
      version: buildVersion([buildTaskFromLine(0, { id: 'line-abc' })]),
      estimateId: 'est-1',
      projectId: 'proj-1',
    });

    const candidate = allCandidates(plan)[0];
    expect(candidate.candidateId).toBe(
      buildEstimateScheduleCandidateId('ver-1', 'line-abc'),
    );
    expect(candidate.candidateId).toBe('ver-1:line-abc');
  });

  it('returns an empty plan for no schedulable tasks', () => {
    const plan = buildEstimateSchedulePlan({
      version: buildVersion([]),
      estimateId: 'est-1',
      projectId: 'proj-1',
      generatedAtIso: '2026-06-04T12:00:00.000Z',
    });

    expect(plan.divisions).toEqual([]);
    expect(plan.meta.scheduleEnabledTaskCount).toBe(0);
    expect(plan.meta.excludedTaskCount).toBe(0);
  });

  it('reports meta counts for scheduled and excluded tasks', () => {
    const plan = buildEstimateSchedulePlan({
      version: buildVersion([
        buildTaskFromLine(0, { scheduleEnabled: true }),
        buildTaskFromLine(1, { id: 'line-1', position: 1, scheduleEnabled: false }),
        buildTaskFromLine(2, { id: 'line-2', position: 2, scheduleEnabled: true }),
      ]),
      estimateId: 'est-1',
      projectId: 'proj-1',
    });

    expect(plan.meta.scheduleEnabledTaskCount).toBe(2);
    expect(plan.meta.excludedTaskCount).toBe(1);
    expect(plan.meta.estimateVersionId).toBe('ver-1');
    expect(plan.meta.projectId).toBe('proj-1');
  });

  it('assigns unassigned division and general scope keys when missing', () => {
    const plan = buildEstimateSchedulePlan({
      version: buildVersion([
        buildTaskFromLine(0, {
          scopeName: undefined,
          lineItem: {
            ...sampleEstimateVersion.lineItems[0],
            csiDivision: undefined,
          },
        }),
      ]),
      estimateId: 'est-1',
      projectId: 'proj-1',
    });

    const candidate = allCandidates(plan)[0];
    expect(candidate.divisionKey).toBe(UNASSIGNED_DIVISION_KEY);
    expect(candidate.scopeKey).toBe(GENERAL_SCOPE_KEY);
  });

  it('does not mutate the input version', () => {
    const version = buildVersion([
      buildTaskFromLine(0),
      buildTaskFromLine(1, { id: 'line-1', position: 1 }),
    ]);
    const lineItemsCopy = version.lineItems.map((task) => ({ ...task }));

    buildEstimateSchedulePlan({
      version,
      estimateId: 'est-1',
      projectId: 'proj-1',
    });

    expect(version.lineItems).toEqual(lineItemsCopy);
  });
});
