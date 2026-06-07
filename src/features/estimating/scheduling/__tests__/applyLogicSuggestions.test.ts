import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import * as calculateCpmModule from '../cpm/calculateCpm';
import { checkLogicNetwork } from '../logic/checkLogicNetwork';
import {
  applyLogicSuggestions,
  buildAcceptAllToastMessage,
  collectVisibleAutoFixLinks,
  filterResolvedAiWarnings,
} from '../logic/logicReviewUtils';
import type { LogicReviewWarning } from '../logic/logicTypes';
import type { CpmLogicLink } from '../cpmTypes';

function fs(pred: string, succ: string, lagDays = 0): CpmLogicLink {
  return {
    predecessorActivityCode: pred,
    successorActivityCode: succ,
    relationshipType: 'FS',
    lagDays,
  };
}

function makeWarning(
  overrides: Partial<LogicReviewWarning> & Pick<LogicReviewWarning, 'id'>,
): LogicReviewWarning {
  return {
    severity: 'warning',
    category: 'missingLikelyPredecessor',
    issue: 'Missing predecessor',
    canAutoFix: true,
    source: 'deterministic',
    suggestedLinks: [],
    ...overrides,
  };
}

describe('applyLogicSuggestions', () => {
  const activities = [
    { activityCode: 'A' },
    { activityCode: 'B' },
    { activityCode: 'C' },
    { activityCode: 'D' },
  ];

  it('adds all non-duplicate visible suggestions', () => {
    const result = applyLogicSuggestions({
      suggestions: [fs('A', 'B'), fs('B', 'C')],
      existingLinks: [],
      activities,
    });

    expect(result.added).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(result.nextLinks).toHaveLength(2);
  });

  it('skips duplicate links already in the network', () => {
    const existingLinks = [fs('A', 'B')];
    const result = applyLogicSuggestions({
      suggestions: [fs('A', 'B'), fs('B', 'C')],
      existingLinks,
      activities,
    });

    expect(result.added).toHaveLength(1);
    expect(result.added[0]).toEqual(fs('B', 'C'));
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toBe('duplicate');
  });

  it('skips links that would create a cycle', () => {
    const existingLinks = [fs('A', 'B'), fs('B', 'C')];
    const result = applyLogicSuggestions({
      suggestions: [fs('C', 'A')],
      existingLinks,
      activities,
    });

    expect(result.added).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toBe('cycle');
  });

  it('skips suggestions with missing activity codes', () => {
    const result = applyLogicSuggestions({
      suggestions: [fs('MISSING', 'B')],
      existingLinks: [],
      activities,
    });

    expect(result.added).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('invalid-activity');
  });

  it('skips duplicate suggestions within the same accept-all batch', () => {
    const result = applyLogicSuggestions({
      suggestions: [fs('A', 'B'), fs('A', 'B')],
      existingLinks: [],
      activities,
    });

    expect(result.added).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toBe('duplicate');
  });

  it('skips reverse links when the opposite direction already exists', () => {
    const result = applyLogicSuggestions({
      suggestions: [fs('A', 'B')],
      existingLinks: [fs('B', 'A')],
      activities,
    });

    expect(result.added).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('reverse-link');
  });

  it('skips invalid relationship types', () => {
    const result = applyLogicSuggestions({
      suggestions: [
        {
          ...fs('A', 'B'),
          relationshipType: 'XX' as CpmLogicLink['relationshipType'],
        },
      ],
      existingLinks: [],
      activities,
    });

    expect(result.added).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('invalid-relationship-type');
  });

  it('skips invalid lag values', () => {
    const result = applyLogicSuggestions({
      suggestions: [{ ...fs('A', 'B'), lagDays: Number.NaN }],
      existingLinks: [],
      activities,
    });

    expect(result.added).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('invalid-lag');
  });

  it('skips links that would over-constrain the network', () => {
    vi.spyOn(calculateCpmModule, 'calculateCpm').mockReturnValue({
      activities: [
        {
          activityCode: 'B',
          earlyStart: 5,
          earlyFinish: 8,
          lateStart: 3,
          lateFinish: 6,
          totalFloat: -2,
          freeFloat: 0,
          isCritical: false,
        },
      ],
      projectDurationDays: 8,
      criticalPathActivityCodes: ['B'],
      warnings: [],
    });

    const result = applyLogicSuggestions({
      suggestions: [fs('A', 'B')],
      existingLinks: [],
      activities,
    });

    expect(result.added).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('would-over-constrain-network');

    vi.restoreAllMocks();
  });

  it('validates later suggestions against the evolving draft network', () => {
    const result = applyLogicSuggestions({
      suggestions: [fs('A', 'B'), fs('B', 'C'), fs('C', 'A')],
      existingLinks: [],
      activities,
    });

    expect(result.added).toHaveLength(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toBe('cycle');
  });
});

describe('collectVisibleAutoFixLinks', () => {
  it('collects only auto-fixable visible warning links', () => {
    const warnings = [
      makeWarning({
        id: 'fixable',
        suggestedLinks: [fs('A', 'B')],
      }),
      makeWarning({
        id: 'manual',
        canAutoFix: false,
        suggestedLinks: [fs('B', 'C')],
      }),
    ];

    expect(collectVisibleAutoFixLinks(warnings)).toEqual([fs('A', 'B')]);
  });
});

describe('filterResolvedAiWarnings', () => {
  it('removes AI warnings whose suggested links were all added', () => {
    const aiWarnings = [
      makeWarning({
        id: 'ai-1',
        source: 'ai',
        suggestedLinks: [fs('A', 'B')],
      }),
      makeWarning({
        id: 'ai-2',
        source: 'ai',
        suggestedLinks: [fs('B', 'C')],
      }),
    ];

    const remaining = filterResolvedAiWarnings(aiWarnings, [], [fs('A', 'B')]);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe('ai-2');
  });
});

describe('buildAcceptAllToastMessage', () => {
  it('returns success when all suggestions are accepted', () => {
    expect(buildAcceptAllToastMessage(3, 0)).toEqual({
      message: 'Logic suggestions accepted',
      variant: 'success',
    });
  });

  it('returns partial success when some suggestions are skipped', () => {
    expect(buildAcceptAllToastMessage(12, 3)).toEqual({
      message: 'Accepted 12 suggestions. 3 could not be added.',
      variant: 'success',
    });
  });

  it('returns failure when nothing is accepted', () => {
    expect(buildAcceptAllToastMessage(0, 2)).toEqual({
      message: 'Could not accept logic suggestions',
      variant: 'error',
    });
  });
});

describe('accept all integration with logic review', () => {
  it('removes accepted deterministic warnings after links are added', () => {
    const activities = [
      {
        activityCode: '26-01-01',
        activityDescription: 'Pull wire circuits 1A',
        divisionCode: '26',
        durationDays: 2,
        crewSize: 2,
      },
      {
        activityCode: '09-01-01',
        activityDescription: 'Hang drywall',
        divisionCode: '09',
        durationDays: 3,
        crewSize: 3,
      },
    ];

    const before = checkLogicNetwork({ activities, logicLinks: [] });
    const suggestions = collectVisibleAutoFixLinks(before.warnings);
    const applied = applyLogicSuggestions({
      suggestions,
      existingLinks: [],
      activities,
    });

    const after = checkLogicNetwork({ activities, logicLinks: applied.nextLinks });
    expect(after.warnings.length).toBeLessThan(before.warnings.length);
  });

  it('does not include ignored warnings in visible accept-all suggestions', () => {
    const activities = [
      {
        activityCode: '26-01-01',
        activityDescription: 'Pull wire circuits 1A',
        divisionCode: '26',
        durationDays: 2,
        crewSize: 2,
      },
      {
        activityCode: '09-01-01',
        activityDescription: 'Hang drywall',
        divisionCode: '09',
        durationDays: 3,
        crewSize: 3,
      },
    ];

    const initial = checkLogicNetwork({ activities, logicLinks: [] });
    const ignored = checkLogicNetwork({
      activities,
      logicLinks: [],
      ignoredWarningIds: initial.warnings.map((warning) => warning.id),
    });

    expect(collectVisibleAutoFixLinks(ignored.warnings)).toHaveLength(0);
  });
});

describe('accept all UI wiring', () => {
  const panelSource = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../logic/LogicReviewPanel.tsx',
    ),
    'utf8',
  );
  const modalSource = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../logic/LogicReviewAcceptAllConfirmModal.tsx',
    ),
    'utf8',
  );
  const workspaceSource = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../ui/components/scheduling/LogicNetworkWorkspace.tsx',
    ),
    'utf8',
  );
  const pageSource = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../ui/EstimateWorkspacePage.tsx',
    ),
    'utf8',
  );

  it('renders Accept all button and confirmation modal in Logic Review panel', () => {
    expect(panelSource).toContain('Accept all');
    expect(panelSource).toContain('LogicReviewAcceptAllConfirmModal');
    expect(modalSource).toContain('Accept all logic suggestions?');
    expect(panelSource).toContain('applyLogicSuggestions');
    expect(panelSource).toContain('collectVisibleAutoFixLinks');
  });

  it('disables Accept all when no visible auto-fix suggestions exist', () => {
    expect(panelSource).toContain('disabled={!canAcceptAll || busy || acceptingAll}');
  });

  it('wires accept-all toast notifications through Logic Network workspace', () => {
    expect(workspaceSource).toContain('onNotify');
    expect(workspaceSource).toContain('setLayoutSaveToast');
  });

  it('reuses handleAddSuggestedLogicLinks to save accepted links to assumptions', () => {
    expect(pageSource).toContain('handleAddSuggestedLogicLinks');
    expect(pageSource).toContain('applyLogicSuggestions');
    expect(pageSource).toContain('handleLogicLinksChange');
    expect(pageSource).not.toContain('appendSuggestedLogicLinks');
  });

  it('exposes revert and clear logic link handlers in Logic Review panel', () => {
    expect(panelSource).toContain('Revert last AI changes');
    expect(panelSource).toContain('Clear all logic links');
    expect(panelSource).toContain('Repair unsafe logic');
    expect(workspaceSource).toContain('onRevertLastLogicBatch');
    expect(workspaceSource).toContain('onClearAllLogicLinks');
  });
});
