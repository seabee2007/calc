import { describe, expect, it } from 'vitest';
import {
  ENABLE_LEGACY_ESTIMATE_SCHEDULE_FALLBACK,
  resolveEstimateWorkspaceScheduleActivities,
} from '../application/estimateWorkspaceScheduleSource';
import type { ProjectConstructionActivity } from '../domain/constructionActivityTypes';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';

function makeActivity(
  overrides: Partial<ProjectConstructionActivity> = {},
): ProjectConstructionActivity {
  return {
    id: 'act-001',
    projectId: 'proj-001',
    divisionCode: '03',
    divisionName: 'Concrete',
    activityCode: '03-30-01',
    title: 'Place Slab on Grade',
    scheduleEnabled: true,
    crewSize: 4,
    hoursPerDay: 8,
    productionFactor: 1,
    calculatedManHours: 42,
    calculatedManDays: 5.25,
    calculatedDurationDays: 2,
    effectiveDurationDays: 2,
    ...overrides,
  };
}

function buildLegacyLineItem(id: string): EstimateDomainTask {
  const snapshot = buildEstimateSnapshot(sampleEstimateVersion);
  const line = snapshot.lineItems[0];
  const input = sampleEstimateVersion.lineItems[0];

  return {
    id,
    lineType: 'task',
    title: input.description,
    description: input.description,
    scopeName: 'Concrete Scope',
    trade: 'Concrete',
    activity: 'Work',
    position: 0,
    lineItem: { ...input, csiDivision: '03' },
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
  };
}

describe('resolveEstimateWorkspaceScheduleActivities', () => {
  it('defaults legacy fallback to disabled', () => {
    expect(ENABLE_LEGACY_ESTIMATE_SCHEDULE_FALLBACK).toBe(false);
  });

  it('returns zero schedule activities when construction activities are empty', () => {
    const result = resolveEstimateWorkspaceScheduleActivities({
      constructionActivities: [],
      lineItems: [buildLegacyLineItem('line-1'), buildLegacyLineItem('line-2')],
      estimateSettings: { defaultCrewSize: 4, hoursPerDay: 8 },
    });

    expect(result.activities).toHaveLength(0);
  });

  it('does not use hidden estimate line items unless legacy fallback is explicitly enabled', () => {
    const withoutLegacy = resolveEstimateWorkspaceScheduleActivities({
      constructionActivities: [],
      lineItems: [buildLegacyLineItem('line-1')],
      estimateSettings: { defaultCrewSize: 4, hoursPerDay: 8 },
      enableLegacyEstimateScheduleFallback: false,
    });
    const withLegacy = resolveEstimateWorkspaceScheduleActivities({
      constructionActivities: [],
      lineItems: [buildLegacyLineItem('line-1')],
      estimateSettings: { defaultCrewSize: 4, hoursPerDay: 8 },
      enableLegacyEstimateScheduleFallback: true,
    });

    expect(withoutLegacy.activities).toHaveLength(0);
    expect(withLegacy.activities.length).toBeGreaterThan(0);
  });

  it('maps one schedule-enabled construction activity to one schedule activity', () => {
    const result = resolveEstimateWorkspaceScheduleActivities({
      constructionActivities: [makeActivity()],
      lineItems: [buildLegacyLineItem('line-legacy')],
      estimateSettings: { defaultCrewSize: 4, hoursPerDay: 8 },
    });

    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].runtimeActivityId).toBe('act-001');
  });

  it('excludes construction activities with scheduleEnabled false', () => {
    const result = resolveEstimateWorkspaceScheduleActivities({
      constructionActivities: [makeActivity({ scheduleEnabled: false })],
      lineItems: [],
      estimateSettings: { defaultCrewSize: 4, hoursPerDay: 8 },
    });

    expect(result.activities).toHaveLength(0);
  });

  it('prefers construction activities over legacy line items when both exist', () => {
    const result = resolveEstimateWorkspaceScheduleActivities({
      constructionActivities: [makeActivity()],
      lineItems: [buildLegacyLineItem('line-1'), buildLegacyLineItem('line-2')],
      estimateSettings: { defaultCrewSize: 4, hoursPerDay: 8 },
      enableLegacyEstimateScheduleFallback: true,
    });

    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].activityCode).toBe('03-30-01');
  });
});
