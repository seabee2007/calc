import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workspacePageSource = readFileSync(
  join(process.cwd(), 'src/features/estimating/ui/EstimateWorkspacePage.tsx'),
  'utf8',
);
const headerControlSource = readFileSync(
  join(process.cwd(), 'src/features/estimating/ui/components/EstimateTypeHeaderControl.tsx'),
  'utf8',
);
const tabBarSource = readFileSync(
  join(process.cwd(), 'src/features/estimating/ui/components/EstimateWorkspaceTabBar.tsx'),
  'utf8',
);

describe('Estimate Workspace estimate type header', () => {
  it('renders EstimateTypeHeaderControl on EstimateWorkspacePage', () => {
    expect(workspacePageSource).toContain('<EstimateTypeHeaderControl');
    expect(workspacePageSource).toContain('estimateTypeControl={');
  });

  it('does not gate EstimateTypeHeaderControl behind hasEstimate', () => {
    expect(workspacePageSource).not.toMatch(
      /estimateTypeControl=\{\s*hasEstimate\s*\?\s*\(\s*<EstimateTypeHeaderControl/,
    );
    expect(workspacePageSource).toContain('hasEstimate={hasEstimate}');
  });

  it('shows Choose Estimate Type when no estimate exists', () => {
    expect(headerControlSource).toContain('No estimate type selected');
    expect(headerControlSource).toContain('Choose Estimate Type');
  });

  it('shows Detailed Estimate label and Change when estimate exists', () => {
    expect(headerControlSource).toContain('Estimate Type:');
    expect(headerControlSource).toContain('formatEstimateMethodLabel(estimateType)');
    expect(headerControlSource).toContain('Change');
  });

  it('opens ChooseEstimateTypeModal from header action', () => {
    expect(workspacePageSource).toContain('setEstimateTypeModalOpen(true)');
    expect(workspacePageSource).toContain('<ChooseEstimateTypeModal');
  });

  it('starts estimate when type is chosen with no existing estimate', () => {
    expect(workspacePageSource).toContain('if (!currentEstimate)');
    expect(workspacePageSource).toContain('void handleStartEstimate(nextType)');
  });

  it('keeps estimate type control and toolbar actions on one header row', () => {
    expect(tabBarSource).toContain('estimateTypeControl');
    expect(tabBarSource).toContain('rightActions');
    expect(tabBarSource).toContain('justify-between');
    expect(tabBarSource).not.toContain('<Tabs');
    expect(tabBarSource).not.toContain('<nav');
  });

  it('keeps estimate type control outside tab-specific content branches', () => {
    const tabBarBlockStart = workspacePageSource.indexOf('<EstimateWorkspaceTabBar');
    const activitiesBranch = workspacePageSource.indexOf("activeTab === 'activities'");
    expect(tabBarBlockStart).toBeGreaterThan(-1);
    expect(activitiesBranch).toBeGreaterThan(tabBarBlockStart);
  });

  it('preserves line items when confirming estimate type change', () => {
    expect(workspacePageSource).toContain('lineItems: currentEstimate.lineItems');
    expect(workspacePageSource).not.toContain('lineItems: []');
  });

  it('does not reset construction activities when changing estimate type', () => {
    expect(workspacePageSource).not.toMatch(
      /handleConfirmEstimateTypeChange[\s\S]{0,800}removeProjectActivity/,
    );
    expect(workspacePageSource).not.toMatch(
      /handleConfirmEstimateTypeChange[\s\S]{0,800}deleteProjectActivity/,
    );
  });

  it('shows scheduling enabled badge in header control', () => {
    expect(headerControlSource).toContain('Scheduling enabled');
    expect(headerControlSource).toContain('Scheduling not enabled');
  });

  it('keeps TAB_NO_ESTIMATE_MESSAGE defined for gated tabs', () => {
    expect(workspacePageSource).toContain('const TAB_NO_ESTIMATE_MESSAGE =');
  });
});
