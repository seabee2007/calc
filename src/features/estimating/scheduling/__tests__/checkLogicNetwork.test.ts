import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkLogicNetwork } from '../logic/checkLogicNetwork';
import { appendSuggestedLogicLinks } from '../logic/logicReviewUtils';
import type { CheckLogicNetworkInput } from '../logic/logicTypes';
import type { CpmLogicLink } from '../cpmTypes';

type ActivityInput = CheckLogicNetworkInput['activities'][number];

function makeActivity(
  activityCode: string,
  title: string,
  overrides: Partial<ActivityInput> = {},
): ActivityInput {
  return {
    activityCode,
    activityDescription: title,
    divisionCode: '03',
    durationDays: 3,
    crewSize: 2,
    ...overrides,
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

describe('checkLogicNetwork sequence rules', () => {
  it('warns when place concrete footings predecessors exist but are not linked', () => {
    const activities = [
      makeActivity('31-03-01', 'Excavate footings and trenches'),
      makeActivity('03-01-01', 'Form footings'),
      makeActivity('03-01-02', 'Install footing reinforcement'),
      makeActivity('03-01-03', 'Place concrete footings'),
    ];

    const result = checkLogicNetwork({ activities, logicLinks: [] });
    const warning = result.warnings.find(
      (entry) => entry.activityCode === '03-01-03' && entry.category === 'missingLikelyPredecessor',
    );

    expect(warning).toBeDefined();
    expect(warning?.suggestedLinks?.map((link) => link.predecessorActivityCode).sort()).toEqual([
      '03-01-01',
      '03-01-02',
      '31-03-01',
    ]);
  });

  it('does not warn when required footing links already exist', () => {
    const activities = [
      makeActivity('31-03-01', 'Excavate footings and trenches'),
      makeActivity('03-01-01', 'Form footings'),
      makeActivity('03-01-02', 'Install footing reinforcement'),
      makeActivity('03-01-03', 'Place concrete footings'),
    ];
    const logicLinks = [
      fs('31-03-01', '03-01-03'),
      fs('03-01-01', '03-01-03'),
      fs('03-01-02', '03-01-03'),
    ];

    const result = checkLogicNetwork({ activities, logicLinks });
    expect(
      result.warnings.some(
        (warning) =>
          warning.activityCode === '03-01-03' && warning.category === 'missingLikelyPredecessor',
      ),
    ).toBe(false);
  });

  it('warns when form footings is not linked after excavation', () => {
    const activities = [
      makeActivity('31-03-01', 'Excavate footings and trenches'),
      makeActivity('03-01-01', 'Form footings'),
    ];
    const result = checkLogicNetwork({ activities, logicLinks: [] });
    expect(
      result.warnings.some(
        (warning) =>
          warning.activityCode === '03-01-01' && warning.category === 'missingLikelyPredecessor',
      ),
    ).toBe(true);
  });

  it('warns when slab pour is not linked after vapor barrier', () => {
    const activities = [
      makeActivity('03-02-01', 'Install vapor barrier'),
      makeActivity('03-02-02', 'Place and finish slab'),
    ];
    const result = checkLogicNetwork({ activities, logicLinks: [] });
    expect(
      result.warnings.some(
        (warning) =>
          warning.activityCode === '03-02-02' && warning.category === 'missingLikelyPredecessor',
      ),
    ).toBe(true);
  });

  it('warns when framing is not linked after foundation/slab work', () => {
    const activities = [
      makeActivity('03-01-10', 'Place concrete slab'),
      makeActivity('06-01-01', 'Wall framing'),
    ];
    const result = checkLogicNetwork({ activities, logicLinks: [] });
    expect(
      result.warnings.some(
        (warning) =>
          warning.activityCode === '06-01-01' && warning.category === 'missingLikelyPredecessor',
      ),
    ).toBe(true);
  });

  it('warns when drywall is not linked after MEP rough-ins and insulation', () => {
    const activities = [
      makeActivity('26-01-04', 'Pull wire for circuits 1A'),
      makeActivity('26-01-05', 'Electrical rough-in'),
      makeActivity('07-01-01', 'Install insulation'),
      makeActivity('09-01-03', 'Hang drywall'),
    ];
    const result = checkLogicNetwork({ activities, logicLinks: [] });
    const warning = result.warnings.find(
      (entry) =>
        entry.activityCode === '09-01-03' && entry.category === 'missingLikelyPredecessor',
    );
    expect(warning).toBeDefined();
    expect((warning?.suggestedLinks ?? []).length).toBeGreaterThan(0);
  });

  it('warns when turnover is not linked after punch list or final inspection', () => {
    const activities = [
      makeActivity('01-90-01', 'Punch list'),
      makeActivity('01-99-01', 'Project turnover'),
    ];
    const result = checkLogicNetwork({ activities, logicLinks: [] });
    expect(
      result.warnings.some(
        (warning) =>
          warning.activityCode === '01-99-01' && warning.category === 'missingLikelyPredecessor',
      ),
    ).toBe(true);
  });
});

describe('checkLogicNetwork hard validation', () => {
  it('creates critical warning for duplicate activity codes', () => {
    const activities = [
      makeActivity('03-01-01', 'Form footings'),
      makeActivity('03-01-01', 'Duplicate form footings'),
    ];
    const result = checkLogicNetwork({ activities, logicLinks: [] });
    expect(result.warnings.some((warning) => warning.category === 'duplicateActivityCode')).toBe(
      true,
    );
    expect(result.blocksSave).toBe(true);
  });

  it('creates critical warning for circular dependencies', () => {
    const activities = [
      makeActivity('A', 'Activity A'),
      makeActivity('B', 'Activity B'),
    ];
    const logicLinks = [fs('A', 'B'), fs('B', 'A')];
    const result = checkLogicNetwork({ activities, logicLinks });
    expect(result.warnings.some((warning) => warning.category === 'circularDependency')).toBe(true);
    expect(result.blocksSave).toBe(true);
  });

  it('warns on missing predecessor references', () => {
    const activities = [makeActivity('A', 'Activity A')];
    const logicLinks = [fs('MISSING', 'A')];
    const result = checkLogicNetwork({ activities, logicLinks });
    expect(
      result.warnings.some((warning) => warning.category === 'missingPredecessorReference'),
    ).toBe(true);
  });

  it('warns when duration is missing', () => {
    const activities = [makeActivity('A', 'Activity A', { durationDays: 0 })];
    const result = checkLogicNetwork({ activities, logicLinks: [] });
    expect(result.warnings.some((warning) => warning.category === 'missingDuration')).toBe(true);
  });

  it('warns when crew data is missing', () => {
    const activities = [makeActivity('A', 'Activity A', { crewSize: 0 })];
    const result = checkLogicNetwork({ activities, logicLinks: [] });
    expect(result.warnings.some((warning) => warning.category === 'missingCrewData')).toBe(true);
  });

  it('warns when an activity has no successor and is not a natural finish', () => {
    const activities = [
      makeActivity('A', 'Activity A'),
      makeActivity('B', 'Activity B'),
      makeActivity('C', 'Activity C'),
    ];
    const logicLinks = [fs('A', 'B')];
    const result = checkLogicNetwork({ activities, logicLinks });
    expect(result.warnings.some((warning) => warning.category === 'noSuccessor')).toBe(true);
  });

  it('warns when an activity has no predecessor link', () => {
    const activities = [
      makeActivity('A', 'Activity A'),
      makeActivity('B', 'Activity B'),
    ];
    const result = checkLogicNetwork({ activities, logicLinks: [] });
    expect(result.warnings.some((warning) => warning.category === 'noPredecessor')).toBe(true);
  });
});

describe('logic review persistence helpers', () => {
  it('appendSuggestedLogicLinks avoids duplicate links', () => {
    const existing = [fs('A', 'B')];
    const next = appendSuggestedLogicLinks(existing, [
      {
        predecessorActivityCode: 'A',
        successorActivityCode: 'B',
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'duplicate',
      },
      {
        predecessorActivityCode: 'B',
        successorActivityCode: 'C',
        relationshipType: 'FS',
        lagDays: 0,
        reason: 'new',
      },
    ]);
    expect(next).toHaveLength(2);
    expect(next[1]?.successorActivityCode).toBe('C');
  });

  it('filters ignored warnings by stable warning id', () => {
    const activities = [
      makeActivity('31-03-01', 'Excavate footings and trenches'),
      makeActivity('03-01-03', 'Place concrete footings'),
    ];
    const first = checkLogicNetwork({ activities, logicLinks: [] });
    const warningId = first.warnings.find((warning) => warning.activityCode === '03-01-03')?.id;
    expect(warningId).toBeTruthy();

    const second = checkLogicNetwork({
      activities,
      logicLinks: [],
      ignoredWarningIds: warningId ? [warningId] : [],
    });
    expect(second.warnings.some((warning) => warning.id === warningId)).toBe(false);
  });
});

describe('logic review UI wiring', () => {
  const workspaceSource = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../ui/components/scheduling/LogicNetworkWorkspace.tsx',
    ),
    'utf8',
  );

  it('adds Check logic toolbar button and review panel', () => {
    expect(workspaceSource).toContain('Check logic');
    expect(workspaceSource).toContain('LogicReviewPanel');
  });

  it('wires add-link and ignore handlers from estimate workspace', () => {
    const pageSource = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../../ui/EstimateWorkspacePage.tsx',
      ),
      'utf8',
    );
    expect(pageSource).toContain('handleAddSuggestedLogicLinks');
    expect(pageSource).toContain('handleIgnoreLogicWarning');
    expect(pageSource).toContain('logicReviewIgnored');
  });
});

describe('aiLogicReviewService guardrails', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects invalid AI suggestions before display', async () => {
    const { validateAiLogicSuggestion } = await import('../logic/aiLogicReviewService');
    const input = {
      activities: [{ activityCode: 'A', title: 'A' }],
      logicLinks: [],
    };
    expect(
      validateAiLogicSuggestion(
        {
          id: 'bad',
          confidence: 'high',
          issue: 'bad',
          predecessorActivityCode: 'MISSING',
          successorActivityCode: 'A',
          relationshipType: 'FS',
          lagDays: 0,
          reason: 'bad',
        },
        input,
      ),
    ).toBe(false);
  });
});
