import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workspacePageSource = readFileSync(
  join(process.cwd(), 'src/features/estimating/ui/EstimateWorkspacePage.tsx'),
  'utf8',
);

const useScheduleSettingsSource = readFileSync(
  join(process.cwd(), 'src/features/estimating/ui/hooks/useScheduleSettings.ts'),
  'utf8',
);

describe('estimate workspace schedule source wiring', () => {
  it('uses shared resolver instead of automatic line-item fallback', () => {
    expect(workspacePageSource).toContain('resolveEstimateWorkspaceScheduleActivities');
    expect(workspacePageSource).toContain('resolvedScheduleActivitiesBundle');
    expect(workspacePageSource).not.toContain('estimateLineItemsToScheduleActivities(');
  });

  it('passes explicit empty schedule activities when construction activities are absent', () => {
    expect(workspacePageSource).toContain('resolvedScheduleActivitiesBundle.activities');
    expect(useScheduleSettingsSource).toContain('scheduleActivities !== undefined');
  });

  it('reconciles links after schedule activities load without clearing CPM in an empty-activities effect', () => {
    expect(workspacePageSource).toContain('reconcileLogicLinksWithScheduleActivities');
    expect(workspacePageSource).toContain('if (constructionActivitiesLoading) return');
    expect(workspacePageSource).not.toMatch(
      /if \(scheduleActivitiesResult\.activities\.length === 0\)[\s\S]*setLogicLinks\(\[\]\)/,
    );
  });

  it('shows empty states for logic network and level iii gantt without schedule activities', () => {
    expect(workspacePageSource).toContain('resolveScheduleTabEmptyState(');
    expect(workspacePageSource).toContain("'logic-network'");
    expect(workspacePageSource).toContain("'level-iii-gantt'");
    expect(workspacePageSource).toContain('No schedule-enabled construction activities yet.');
    expect(workspacePageSource).toContain('No CPM schedule available yet.');
  });

  it('waits for construction activities load before schedule rehydrate', () => {
    expect(workspacePageSource).toContain('constructionActivitiesLoading');
  });
});
