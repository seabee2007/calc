import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ESTIMATING_CALCULATOR_OPTIONS,
  ESTIMATING_CALCULATORS_MODAL_COPY,
  ESTIMATING_CALCULATORS_MODAL_TITLE,
} from '../constants/estimatingCalculators';
import { shouldShowEstimatingPathButtons } from '../../../utils/projectWorkflow';
import { estimateWorkspaceHref } from '../../estimating/utils/estimateRoutes';

const projectDetailsSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../pages/Projects/ProjectDetails.tsx'),
  'utf8',
);

const estimatingCalculatorsModalSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../components/EstimatingCalculatorsModal.tsx',
  ),
  'utf8',
);

const projectProposalNextActionSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../utils/projectProposalNextAction.ts'),
  'utf8',
);

const projectWorkflowSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../utils/projectWorkflow.ts'),
  'utf8',
);

const calculatorHubSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../pages/CalculatorHub.tsx'),
  'utf8',
);

describe('Project Details next actions estimating paths', () => {
  it('no longer shows Add estimates in Project Details or workflow next action', () => {
    expect(projectDetailsSource).not.toContain('Add estimates');
    expect(projectWorkflowSource).not.toContain("label: 'Add estimates'");
  });

  it('shows Calculators and Estimate Workspace buttons in Next actions', () => {
    expect(projectDetailsSource).toContain('Calculators');
    expect(projectDetailsSource).toContain('Estimate Workspace');
    expect(projectDetailsSource).toContain('shouldShowEstimatingPathButtons');
    expect(projectDetailsSource).toContain('setShowEstimatingCalculatorsModal(true)');
  });

  it('clicking Calculators opens the estimating calculators modal', () => {
    expect(projectDetailsSource).toContain('EstimatingCalculatorsModal');
    expect(projectDetailsSource).toContain('showEstimatingCalculatorsModal');
    expect(estimatingCalculatorsModalSource).toContain('ESTIMATING_CALCULATORS_MODAL_TITLE');
    expect(estimatingCalculatorsModalSource).toContain('ESTIMATING_CALCULATORS_MODAL_COPY');
    expect(ESTIMATING_CALCULATORS_MODAL_TITLE).toBe('Estimating Calculators');
    expect(ESTIMATING_CALCULATORS_MODAL_COPY).toContain('added to proposals');
  });

  it('calculator modal lists existing calculator tools with open actions', () => {
    expect(estimatingCalculatorsModalSource).toContain('ESTIMATING_CALCULATOR_OPTIONS');
    expect(estimatingCalculatorsModalSource).toContain('openCalculator(calculator.path)');
    expect(ESTIMATING_CALCULATOR_OPTIONS.map((entry) => entry.title)).toEqual([
      'Concrete',
      'Labor',
      'General Trade Labor',
      'Materials',
      'Rebar Design',
    ]);
    expect(ESTIMATING_CALCULATOR_OPTIONS.map((entry) => entry.path)).toEqual([
      '/calculator/concrete',
      '/calculator/labor',
      '/calculator/general-trade-labor',
      '/calculator/custom',
      '/calculator/reinforcement',
    ]);
  });

  it('clicking Estimate Workspace navigates to the project estimate route', () => {
    expect(projectDetailsSource).toContain('navigate(estimateWorkspaceHref(project.id))');
    expect(estimateWorkspaceHref('proj-123')).toBe('/projects/proj-123/planner/estimate');
  });

  it('Estimate Workspace navigation does not auto-create a new estimate', () => {
    expect(projectDetailsSource).not.toMatch(
      /Estimate Workspace[\s\S]{0,200}createEstimate/,
    );
    expect(projectDetailsSource).not.toMatch(
      /navigate\(estimateWorkspaceHref\(project\.id\)\)[\s\S]{0,120}saveCurrentEstimate/,
    );
  });

  it('no estimates saved state still shows both estimating path buttons', () => {
    expect(projectDetailsSource).toContain('No estimates saved yet');
    expect(shouldShowEstimatingPathButtons('created', false)).toBe(true);
    expect(shouldShowEstimatingPathButtons('estimating', false)).toBe(true);
    expect(shouldShowEstimatingPathButtons('estimating', true)).toBe(false);
  });

  it('preserves existing calculator proposal import behavior', () => {
    expect(calculatorHubSource).toContain('projectHasImportablePricing');
    expect(calculatorHubSource).toContain('Continue to proposal');
    expect(estimatingCalculatorsModalSource).toContain('workflowQuery(projectId)');
    expect(estimatingCalculatorsModalSource).toContain('workflowNavigateState(projectId)');
  });
});

describe('Project Details proposal next actions', () => {
  it('opens proposal send/follow-up modal instead of generic proposal pipeline', () => {
    expect(projectDetailsSource).toContain('ProposalSendEmailModal');
    expect(projectDetailsSource).toContain('handlePrimaryNextAction');
    expect(projectDetailsSource).toContain('resolveProjectProposalNextAction');
    expect(projectDetailsSource).toContain('openProposalEmailModal');
    expect(projectDetailsSource).not.toMatch(
      /Follow Up Proposal[\s\S]{0,200}navigate\(\{ pathname: '\/proposals'/,
    );
  });

  it('routes missing proposal context to project proposals list', () => {
    expect(projectProposalNextActionSource).toContain("label: 'Create proposal'");
    expect(projectDetailsSource).toContain('resolveProjectProposalNextAction');
    expect(projectDetailsSource).toContain('projectProposalsHref');
  });
});
