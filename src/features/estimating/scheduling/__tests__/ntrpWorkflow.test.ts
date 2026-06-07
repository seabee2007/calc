import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import { calculateCpm, runCpmCalculation } from '../cpm/calculateCpm';
import { isDisplayCritical } from '../cpm/cpmDisplayCritical';
import { buildLogicNetworkTopology } from '../logic/logicNetworkTopology';
import { validateCpmReadiness } from '../logic/validateCpmReadiness';
import type { CpmLogicLink } from '../cpmTypes';

const cpmNodeSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/CpmActivityNode.tsx',
  ),
  'utf8',
);
const workspaceSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../ui/EstimateWorkspacePage.tsx'),
  'utf8',
);
const logicWorkspaceSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/LogicNetworkWorkspace.tsx',
  ),
  'utf8',
);
const canvasSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/EstimateLogicNetworkCanvas.tsx',
  ),
  'utf8',
);
const logicReviewSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../logic/LogicReviewPanel.tsx'),
  'utf8',
);

function makeActivity(code: string, durationDays = 3): ScheduleActivity {
  return {
    activityCode: code,
    activityDescription: code,
    divisionCode: '01',
    divisionName: 'General',
    durationDays,
    laborHours: 0,
    manDays: 0,
    crewDays: 0,
    crewSize: 2,
    totalCost: 0,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

function fs(pred: string, succ: string): CpmLogicLink {
  return {
    predecessorActivityCode: pred,
    successorActivityCode: succ,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

describe('NTRP staged workflow', () => {
  it('calculateCpm preview does not mark hasRunCpm', () => {
    const activities = [makeActivity('A'), makeActivity('B')];
    const result = calculateCpm({ activities, logicLinks: [fs('A', 'B')] });
    expect(result.hasRunCpm).toBe(false);
    expect(isDisplayCritical(result, 'A')).toBe(false);
  });

  it('runCpmCalculation marks hasRunCpm and enables display-critical when valid', () => {
    const activities = [makeActivity('A', 5), makeActivity('B', 2), makeActivity('C', 3)];
    const links = [fs('A', 'B'), fs('B', 'C')];
    const result = runCpmCalculation({ activities, logicLinks: links });
    expect(result.hasRunCpm).toBe(true);
    expect(result.hasValidPrecedenceDiagram).toBe(true);
    if (result.hasValidCriticalPath) {
      expect(isDisplayCritical(result, 'A')).toBe(true);
    }
  });

  it('disables Run CPM when no links exist and multiple activities', () => {
    const readiness = validateCpmReadiness({
      activities: [makeActivity('A'), makeActivity('B')],
      logicLinks: [],
    });
    expect(readiness.canRunCpm).toBe(false);
    expect(readiness.disabledReasons).toContain('No logic links exist.');
  });

  it('disables Run CPM on circular dependency', () => {
    const readiness = validateCpmReadiness({
      activities: [makeActivity('A'), makeActivity('B')],
      logicLinks: [fs('A', 'B'), fs('B', 'A')],
    });
    expect(readiness.canRunCpm).toBe(false);
    expect(readiness.disabledReasons).toContain('Circular dependency detected.');
  });
});

describe('Logic Network mode UI contract', () => {
  it('activity node hides CPM fields in logic-network mode', () => {
    expect(cpmNodeSource).toContain("viewMode === 'logic-network'");
    expect(cpmNodeSource).toContain('predecessorCount');
    expect(cpmNodeSource).toContain('successorCount');
    expect(cpmNodeSource).toContain('showCpmFields');
  });

  it('canvas never uses critical red edges in logic-network mode', () => {
    expect(canvasSource).toContain("viewMode === 'precedence-diagram'");
    expect(canvasSource).toContain('buildLogicNetworkTopology');
  });

  it('workspace exposes Logic Network and Precedence Diagram modes with Run CPM', () => {
    expect(logicWorkspaceSource).toContain('Logic Network');
    expect(logicWorkspaceSource).toContain('Precedence Diagram');
    expect(logicWorkspaceSource).toContain('Run CPM');
    expect(logicWorkspaceSource).toContain('Check logic');
  });

  it('workspace uses committed CPM via runCpmCalculation, not auto calculateCpm', () => {
    expect(workspaceSource).toContain('runCpmCalculation');
    expect(workspaceSource).toContain('committedCpmResult');
    expect(workspaceSource).toContain('validateCpmReadiness');
    expect(workspaceSource).not.toMatch(/useMemo\(\s*\(\)\s*=>\s*\n?\s*scheduleActivitiesResult\.activities\.length > 0\s*\?\s*calculateCpm/);
  });

  it('AI helper is renamed to Suggest precedence links', () => {
    expect(logicReviewSource).toContain('Suggest precedence links');
    expect(logicReviewSource).not.toContain('Suggest logic with AI');
  });
});

describe('logic network topology without CPM', () => {
  it('reports open start and open finish without running CPM', () => {
    const activities = [makeActivity('A'), makeActivity('B'), makeActivity('C')];
    const topology = buildLogicNetworkTopology(activities, [fs('A', 'B'), fs('B', 'C')]);
    expect(topology.openStartActivityCodes).toEqual(['A']);
    expect(topology.openFinishActivityCodes).toEqual(['C']);
    expect(topology.predecessorCountByCode.B).toBe(1);
    expect(topology.successorCountByCode.B).toBe(1);
  });
});
