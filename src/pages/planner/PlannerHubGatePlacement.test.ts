import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../App.tsx'),
  'utf8',
);

const dashboardLayoutSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../lib/dashboardLayout.ts'),
  'utf8',
);

const toolShortcutWidgetsSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../components/dashboard/widgets/toolShortcutWidgets.tsx'),
  'utf8',
);

const optionalWidgetsSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../components/dashboard/widgets/optionalWidgets.tsx'),
  'utf8',
);

describe('Planner Hub entitlement gate placement', () => {
  it('keeps the base Planner Hub route accessible without the global planner Business gate', () => {
    expect(appSource).toContain('path="planner/hub" element={<LazyRoute Page={LazyPlannerHubPage} />}');
    expect(appSource).not.toContain(
      'path="planner/hub" element={<GatedLazyRoute feature="global_planner_hub"',
    );
    expect(appSource).toContain('path="planner" element={<Navigate to="/planner/hub" replace />}');
  });

  it('keeps premium planner tools gated inside tool routes', () => {
    expect(appSource).toContain('feature="rfis" Page={LazyPlannerAllRfisPage}');
    expect(appSource).toContain('feature="fars" Page={LazyPlannerAllFarsPage}');
    expect(appSource).toContain('feature="rfis" Page={LazyPlannerRFIsPage}');
    expect(appSource).toContain('feature="fars" Page={LazyPlannerAdjustmentsPage}');
    expect(appSource).toContain('feature="change_orders" Page={LazyPlannerChangeOrdersPage}');
    expect(appSource).toContain('feature="document_builder" Page={LazyPlannerDocumentsPage}');
  });

  it('does not gate Planner Hub dashboard shortcuts as global planner', () => {
    expect(dashboardLayoutSource).toContain('plannerHubShortcut');
    expect(dashboardLayoutSource).not.toMatch(
      /plannerHubShortcut:[\s\S]*requiredFeature:\s*'global_planner_hub'/,
    );
    expect(toolShortcutWidgetsSource).toContain('title="Planner Hub"');
    expect(toolShortcutWidgetsSource).not.toMatch(
      /PlannerHubShortcutWidget[\s\S]*feature="global_planner_hub"/,
    );
    expect(optionalWidgetsSource).toContain("navigate('/planner/hub')");
  });
});
