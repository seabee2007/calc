import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getVisibleWorkspaceTabs } from '../application/estimateWorkspaceTabPolicy';
import { shouldOpenBuildScopeModal } from '../application/estimateStartFlow';
import {
  conceptualEstimateToAssumptions,
  isConceptualEstimateAssumptions,
} from '../application/conceptualEstimatePersistence';
import { createEmptyConceptualEstimatePayload, CONCEPTUAL_ESTIMATE_ASSUMPTIONS_TYPE } from '../domain/conceptualEstimateTypes';

const workspacePageSource = readFileSync(
  resolve(process.cwd(), 'src/features/estimating/ui/EstimateWorkspacePage.tsx'),
  'utf8',
);

describe('conceptual estimate workflow', () => {
  it('includes scenarios and risks-contingency tabs for conceptual estimates', () => {
    const tabs = getVisibleWorkspaceTabs('conceptual', false).map((tab) => tab.id);
    expect(tabs).toEqual([
      'conceptual-budget',
      'assumptions-allowances',
      'scenarios',
      'risks-contingency',
      'overview',
      'settings',
    ]);
  });

  it('does not treat conceptual tabs as workflow placeholders', () => {
    expect(workspacePageSource).toContain('ConceptualBudgetPanel');
    expect(workspacePageSource).toContain('ConceptualAssumptionsExclusionsPanel');
    expect(workspacePageSource).toContain('ConceptualScenariosPanel');
    expect(workspacePageSource).toContain('ConceptualRisksContingencyPanel');
    const placeholderMatch = workspacePageSource.match(
      /WORKFLOW_PLACEHOLDER_TAB_IDS:\s*EstimateWorkspaceTabId\[\]\s*=\s*\[([\s\S]*?)\];/,
    );
    expect(placeholderMatch?.[1]).not.toContain("'conceptual-budget'");
    expect(placeholderMatch?.[1]).not.toContain("'assumptions-allowances'");
    expect(placeholderMatch?.[1]).not.toContain("'scenarios'");
    expect(placeholderMatch?.[1]).not.toContain("'risks-contingency'");
  });

  it('does not open division scope modal for conceptual start flow', () => {
    expect(shouldOpenBuildScopeModal('conceptual')).toBe(false);
    expect(workspacePageSource).toContain('shouldOpenBuildScopeModal(estimateType)');
  });

  it('writes conceptual assumptions type with empty line items on save helper', () => {
    const payload = createEmptyConceptualEstimatePayload();
    payload.lineItems.push({
      id: 'cli-1',
      type: 'lump_sum',
      title: 'Shell budget',
      amount: 100000,
      confidenceLevel: 'medium',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const assumptions = conceptualEstimateToAssumptions(payload);
    expect(assumptions.type).toBe(CONCEPTUAL_ESTIMATE_ASSUMPTIONS_TYPE);
    expect(isConceptualEstimateAssumptions(assumptions)).toBe(true);
    expect(Array.isArray(assumptions.lineItems)).toBe(true);
  });

  it('keeps detailed activities panel mounted only on activities tab', () => {
    expect(workspacePageSource).toContain("activeTab === 'activities'");
    expect(workspacePageSource).toContain('ConstructionActivityBuilderPanel');
    const activitiesMount = workspacePageSource.match(
      /activeTab === 'activities'[\s\S]{0,400}ConstructionActivityBuilderPanel/,
    );
    expect(activitiesMount).not.toBeNull();
  });

  it('branches top save to saveCurrentConceptualEstimate for conceptual workflow', () => {
    expect(workspacePageSource).toContain('saveCurrentConceptualEstimate');
    expect(workspacePageSource).toContain('isConceptualEstimateType(resolvedEstimateType)');
  });

  it('places Convert to Detailed Estimate in the Actions menu, not add-item toolbar', () => {
    expect(workspacePageSource).toContain('shouldShowConvertToDetailedAction');
    expect(workspacePageSource).toContain('onConvertToDetailed={() => setConvertToDetailedModalOpen(true)}');
    expect(workspacePageSource).not.toMatch(
      /ConceptualBudgetPanel[\s\S]*Convert to detailed estimate/,
    );
  });
});
