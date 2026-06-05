import { describe, expect, it } from 'vitest';
import { buildEstimateDraftSnapshot } from '../application/buildEstimateDraftSnapshot';
import { draftLineFromDomainTask } from '../application/estimateDraftLine';
import { buildEstimateSnapshot } from '../application/buildEstimateSnapshot';
import { sampleEstimateVersion } from '../__fixtures__/sampleEstimateVersion';
import type { EstimateDomainTask } from '../infrastructure/estimateDbTypes';

function taskFromFixtureLine(
  line: (typeof sampleEstimateVersion.lineItems)[number],
  position: number,
): EstimateDomainTask {
  return {
    id: line.id,
    lineType: 'task',
    title: line.description,
    description: line.description,
    scopeName: line.csiSection,
    position,
    lineItem: line,
    overheadPercent: 0,
    profitPercent: 0,
    contingencyPercent: 0,
    taxPercent: 0,
    wastePercent: line.quantity.wastePercent ?? 0,
    scheduleEnabled: true,
    weatherSensitive: false,
    inspectionRequired: false,
    calculatedValues: {},
  };
}

describe('buildEstimateDraftSnapshot', () => {
  it('matches buildEstimateSnapshot for equivalent draft lines', () => {
    const draftLines = sampleEstimateVersion.lineItems.map((line, index) =>
      draftLineFromDomainTask(taskFromFixtureLine(line, index), `client-${index}`),
    );

    const draftSnapshot = buildEstimateDraftSnapshot({
      estimateId: sampleEstimateVersion.meta.estimateId,
      projectId: sampleEstimateVersion.meta.projectId,
      versionNumber: sampleEstimateVersion.meta.version,
      estimateType: sampleEstimateVersion.meta.estimateType,
      status: sampleEstimateVersion.meta.status,
      draftLines,
      pricing: sampleEstimateVersion.pricing,
      currencyCode: sampleEstimateVersion.meta.currencyCode,
    });

    const directSnapshot = buildEstimateSnapshot(sampleEstimateVersion);

    expect(draftSnapshot.totals).toEqual(directSnapshot.totals);
    expect(draftSnapshot.lineItems).toHaveLength(directSnapshot.lineItems.length);
    expect(draftSnapshot.lineItems.map((line) => line.costs.directCost)).toEqual(
      directSnapshot.lineItems.map((line) => line.costs.directCost),
    );
  });

  it('returns empty line totals when no draft lines are provided', () => {
    const snapshot = buildEstimateDraftSnapshot({
      estimateId: 'est-1',
      projectId: 'proj-1',
      versionNumber: 1,
      draftLines: [],
    });

    expect(snapshot.lineItems).toEqual([]);
    expect(snapshot.totals.directCost).toBe(0);
    expect(snapshot.warnings.some((warning) => warning.code === 'empty_estimate_lines')).toBe(
      true,
    );
  });
});
