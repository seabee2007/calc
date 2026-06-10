import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { shouldInvalidateCpmOnEstimateSave } from '../scheduling/precedenceDiagram';

const workspacePageSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../ui/EstimateWorkspacePage.tsx'),
  'utf8',
);

describe('shouldInvalidateCpmOnEstimateSave', () => {
  it('does not invalidate CPM when only legacy line items change but construction activities drive schedule', () => {
    expect(
      shouldInvalidateCpmOnEstimateSave({
        estimateSettingsDirty: false,
        lineItemDraftDirty: true,
        usesConstructionActivities: true,
      }),
    ).toBe(false);
  });

  it('invalidates CPM when estimate settings change', () => {
    expect(
      shouldInvalidateCpmOnEstimateSave({
        estimateSettingsDirty: true,
        lineItemDraftDirty: false,
        usesConstructionActivities: true,
      }),
    ).toBe(true);
  });

  it('invalidates CPM when line items are the schedule source', () => {
    expect(
      shouldInvalidateCpmOnEstimateSave({
        estimateSettingsDirty: false,
        lineItemDraftDirty: true,
        usesConstructionActivities: false,
      }),
    ).toBe(true);
  });
});

describe('top-right Estimate Workspace save stays in place', () => {
  const saveEstimateBody =
    workspacePageSource.match(
      /const handleSaveEstimate = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[/,
    )?.[0] ?? '';

  it('does not navigate after save', () => {
    expect(saveEstimateBody).not.toContain('navigate(');
  });

  it('does not rehydrate schedule settings after save', () => {
    expect(saveEstimateBody).not.toContain('rehydrateScheduleFromEstimate');
    expect(saveEstimateBody).not.toContain('scheduleSourceRehydrateKeyRef.current = null');
  });

  it('preserves in-memory workspace state with a functional estimate update', () => {
    expect(saveEstimateBody).toContain('setCurrentEstimate((previous) =>');
    expect(saveEstimateBody).toContain('assumptions: result.data.assumptions');
  });

  it('shows save success toast only', () => {
    expect(saveEstimateBody).toContain('setSaveToastMessage(createEstimateSaveSuccessToast().message)');
  });

  it('persists logic network view mode and precedence diagram metadata', () => {
    expect(saveEstimateBody).toContain('logicNetworkViewMode: scheduleSettingsHook.logicNetworkViewMode');
    expect(saveEstimateBody).toContain('precedenceDiagram: precedenceDiagramForSave');
  });

  it('skips CPM stale checks when estimate save does not touch schedule source', () => {
    expect(saveEstimateBody).toContain('shouldInvalidateCpmOnEstimateSave');
    expect(saveEstimateBody).toContain('usesConstructionActivities: constructionActivities.length > 0');
  });

  it('toolbar save button wires to handleSaveEstimate without tab changes', () => {
    expect(workspacePageSource).toContain('onSave={handleSaveEstimate}');
    expect(workspacePageSource).not.toMatch(
      /onSave=\{handleSaveEstimate\}[\s\S]{0,200}navigate\(/,
    );
  });

  it('tab routing effect is unrelated to save handler', () => {
    const tabRoutingEffect =
      workspacePageSource.match(
        /useEffect\(\(\) => \{[\s\S]*?estimateTab === 'line-items'[\s\S]*?\}, \[estimateTab, parsedTab, resolvedProjectId, navigate\]\);/,
      )?.[0] ?? '';
    expect(tabRoutingEffect).toContain("navigate(estimateWorkspaceHref(resolvedProjectId, 'activities')");
    expect(saveEstimateBody).not.toContain("activeTab === 'logic-network'");
  });
});

describe('top save preserves workspace tabs (source wiring)', () => {
  it('uses route param for active tab instead of save-time reset', () => {
    expect(workspacePageSource).toContain('parseEstimateWorkspaceTabParam');
    expect(workspacePageSource).toContain('const activeTab: EstimateWorkspaceTabId = parsedTab ?? DEFAULT_ESTIMATE_WORKSPACE_TAB');
    expect(workspacePageSource).toContain("activeTab === 'activities'");
    expect(workspacePageSource).toContain("activeTab === 'logic-network'");
    expect(workspacePageSource).toContain("activeTab === 'level-iii-gantt'");
  });

  it('Logic Network sub-view comes from schedule hook state, not save navigation', () => {
    expect(workspacePageSource).toContain('viewMode={scheduleSettingsHook.logicNetworkViewMode}');
    expect(workspacePageSource).toContain('onViewModeChange={handleLogicNetworkViewModeChange}');
  });
});
