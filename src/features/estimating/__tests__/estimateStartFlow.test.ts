import { describe, expect, it } from 'vitest';
import {
  buildEstimateSetupVersionKey,
  canResetEstimateSetup,
  createEstimateSetupResetState,
  createEstimateSetupRestoredState,
  createEstimateSetupStartState,
  createInitialEstimateSetupSession,
  getBuildScopeModalDescription,
  getBuildScopeModalTitle,
  getScopeModalDescription,
  getScopeModalSubmitLabel,
  getScopeModalTitle,
  getEstimateTabHelperText,
  isQuickFeasibilityEstimateType,
  QUICK_FEASIBILITY_TAB_HELPER,
  resolveActiveStartMode,
  shouldOpenBuildScopeModal,
  shouldReinitializeSetupSessionFromVersion,
  shouldShowActivityWorkflow,
  shouldShowDivisionBucketPanel,
  shouldShowEstimateTypeSelector,
  shouldShowQuickFeasibilityPanel,
  shouldShowSavedActivities,
  supportsActivityWorkflow,
} from '../application/estimateStartFlow';

describe('estimateStartFlow', () => {
  it('shows estimate type selector before start', () => {
    const session = createInitialEstimateSetupSession('detailed');
    expect(shouldShowEstimateTypeSelector(session)).toBe(true);
    expect(shouldShowQuickFeasibilityPanel(session)).toBe(false);
    expect(shouldShowDivisionBucketPanel(session)).toBe(false);
  });

  it('hides selector and shows quick panel after quick start', () => {
    const session = createEstimateSetupStartState('quick');
    expect(session.estimateSetupStarted).toBe(true);
    expect(session.activeStartMode).toBe('quick');
    expect(shouldShowEstimateTypeSelector(session)).toBe(false);
    expect(shouldShowQuickFeasibilityPanel(session)).toBe(true);
    expect(shouldShowActivityWorkflow(session)).toBe(false);
    expect(shouldShowSavedActivities(session)).toBe(false);
    expect(shouldShowDivisionBucketPanel(session)).toBe(false);
    expect(getEstimateTabHelperText(session)).toBe(QUICK_FEASIBILITY_TAB_HELPER);
  });

  it('hides saved activities before start even when line items exist on version', () => {
    const session = createInitialEstimateSetupSession('detailed');
    expect(shouldShowSavedActivities(session)).toBe(false);
    expect(shouldShowActivityWorkflow(session)).toBe(false);
  });

  it('quick feasibility never enables activity workflow or saved activities', () => {
    const session = createEstimateSetupStartState('quick');
    expect(supportsActivityWorkflow(session.selectedEstimateType)).toBe(false);
    expect(shouldShowActivityWorkflow(session)).toBe(false);
    expect(shouldShowSavedActivities(session)).toBe(false);
  });

  it('detailed active mode enables activity workflow without a separate saved activities section', () => {
    const session = createEstimateSetupStartState('detailed');
    expect(shouldShowActivityWorkflow(session)).toBe(true);
    expect(shouldShowSavedActivities(session)).toBe(false);
  });

  it('hides selector and activates conceptual scope workflow after conceptual start', () => {
    const session = createEstimateSetupStartState('conceptual');
    expect(shouldShowEstimateTypeSelector(session)).toBe(false);
    expect(shouldShowQuickFeasibilityPanel(session)).toBe(false);
    expect(shouldShowDivisionBucketPanel(session)).toBe(false);
    expect(session.activeStartMode).toBe('conceptual');
    expect(shouldOpenBuildScopeModal('conceptual')).toBe(true);
  });

  it('restores saved bid estimate workspace instead of showing type selection', () => {
    const session = createEstimateSetupRestoredState('bid', [
      {
        code: '01',
        name: 'General Requirements',
        source: 'ai',
        confidence: 0.9,
        reason: 'General requirements are needed.',
        createdAt: '2026-06-06T00:00:00.000Z',
      },
      {
        code: '03',
        name: 'Concrete',
        source: 'ai',
        confidence: 0.95,
        reason: 'Concrete slab is named.',
        createdAt: '2026-06-06T00:00:00.000Z',
      },
    ]);

    expect(session.estimateSetupStarted).toBe(true);
    expect(session.selectedEstimateType).toBe('bid');
    expect(session.activeStartMode).toBe('bid');
    expect(session.selectedDivisionCodes).toEqual(['01', '03']);
    expect(shouldShowEstimateTypeSelector(session)).toBe(false);
    expect(shouldShowActivityWorkflow(session)).toBe(true);
    expect(shouldShowSavedActivities(session)).toBe(false);
    expect(shouldShowDivisionBucketPanel(session)).toBe(true);
  });

  it('shows division buckets after budget start once divisions are selected', () => {
    const session = {
      ...createEstimateSetupStartState('detailed'),
      selectedDivisionCodes: ['03', '31'],
    };
    expect(shouldShowDivisionBucketPanel(session)).toBe(true);
    expect(session.activeStartMode).toBe('detailed');
  });

  it('reset returns to selector state and hides activity workflow', () => {
    const resetState = createEstimateSetupResetState('bid');
    expect(resetState.estimateSetupStarted).toBe(false);
    expect(resetState.activeStartMode).toBeNull();
    expect(resetState.selectedDivisionCodes).toEqual([]);
    expect(resetState.selectedDivisions).toEqual([]);
    expect(shouldShowEstimateTypeSelector(resetState)).toBe(true);
    expect(shouldShowActivityWorkflow(resetState)).toBe(false);
    expect(shouldShowSavedActivities(resetState)).toBe(false);
    expect(shouldShowDivisionBucketPanel(resetState)).toBe(false);
  });

  it('allows reset only when setup has started', () => {
    expect(canResetEstimateSetup(createEstimateSetupStartState('quick'))).toBe(true);
    expect(canResetEstimateSetup(createInitialEstimateSetupSession('detailed'))).toBe(false);
  });

  it('does not reinitialize session for the same project/version key', () => {
    const key = buildEstimateSetupVersionKey('project-1', 'version-1');
    expect(shouldReinitializeSetupSessionFromVersion(null, key)).toBe(true);
    expect(shouldReinitializeSetupSessionFromVersion(key, key)).toBe(false);
    expect(
      shouldReinitializeSetupSessionFromVersion(
        buildEstimateSetupVersionKey('project-1', 'version-1'),
        buildEstimateSetupVersionKey('project-1', 'version-2'),
      ),
    ).toBe(true);
  });

  it('preserves local selected type in started session state', () => {
    const session = createEstimateSetupStartState('quick');
    expect(session.selectedEstimateType).toBe('quick');
    expect(resolveActiveStartMode(session.selectedEstimateType)).toBe('quick');
  });

  it('identifies quick estimates as non-modal path', () => {
    expect(isQuickFeasibilityEstimateType('quick')).toBe(true);
    expect(isQuickFeasibilityEstimateType('quick_feasibility')).toBe(true);
    expect(isQuickFeasibilityEstimateType('conceptual')).toBe(false);
    expect(shouldOpenBuildScopeModal('quick')).toBe(false);
  });

  it('opens build scope modal for conceptual, detailed, and bid', () => {
    expect(shouldOpenBuildScopeModal('conceptual')).toBe(true);
    expect(shouldOpenBuildScopeModal('detailed')).toBe(true);
    expect(shouldOpenBuildScopeModal('bid')).toBe(true);
  });

  it('uses conceptual-specific modal copy', () => {
    expect(getBuildScopeModalTitle('conceptual')).toBe('Build Budget Scope');
    expect(getBuildScopeModalDescription('conceptual')).toContain('rough budget planning');
  });

  it('uses project scope modal copy for detailed and bid', () => {
    expect(getBuildScopeModalTitle('detailed')).toBe('Build Project Scope');
    expect(getBuildScopeModalTitle('bid')).toBe('Build Project Scope');
    expect(getBuildScopeModalDescription('detailed')).toContain('top-level buckets');
    expect(getBuildScopeModalDescription('bid')).toContain('top-level buckets');
  });

  it('uses add-mode scope modal copy', () => {
    expect(getScopeModalTitle('add', 'detailed')).toBe('Add Divisions');
    expect(getScopeModalDescription('add', 'conceptual')).toBe(
      'Select additional divisions to add to this estimate.',
    );
    expect(getScopeModalSubmitLabel('add')).toBe('Add selected divisions');
  });
});
