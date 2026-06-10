import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('EstimateWorkspacePage source order', () => {
  it('declares constructionActivities hook before scheduleActivitiesResult uses it', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/estimating/ui/EstimateWorkspacePage.tsx'),
      'utf8',
    );
    const hookPos = source.indexOf('useProjectConstructionActivitiesForSchedule(');
    const usePos = source.indexOf('constructionActivities.length > 0');
    expect(hookPos).toBeGreaterThan(-1);
    expect(usePos).toBeGreaterThan(-1);
    expect(hookPos).toBeLessThan(usePos);
  });

  it('defines TAB_NO_ESTIMATE_MESSAGE used by gated workspace tabs', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/estimating/ui/EstimateWorkspacePage.tsx'),
      'utf8',
    );
    expect(source).toContain('const TAB_NO_ESTIMATE_MESSAGE =');
    expect(source).toContain('body={TAB_NO_ESTIMATE_MESSAGE}');
  });
});
