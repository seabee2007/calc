import { describe, expect, it } from 'vitest';
import type { Project } from '../../types';
import type { TrackedProposalRow } from '../../types/proposalTracking';
import {
  formatProjectCardEstimateLine,
  formatProjectCardOpenItemsLine,
  formatProjectCardScheduleLine,
  getProjectCardEstimateState,
  getProjectCardFinancialLine,
  getProjectCardRiskIndicator,
  getProjectCardScheduleState,
  getProjectCardWorkflowReadiness,
  inferProjectCardScopeChip,
  mapNextActionLabelForCard,
  projectCardDisplayContainsBannedTerms,
  PROJECT_CARD_BANNED_TERMS,
  resolveProjectCardNextActionLabel,
} from '../projectCardDisplay';

const baseProject: Project = {
  id: 'proj-1',
  name: 'Office Buildout',
  description: 'General construction',
  createdAt: '2026-06-14T12:00:00.000Z',
  updatedAt: '2026-06-14T12:00:00.000Z',
  calculations: [],
};

const baseProposal: TrackedProposalRow = {
  id: 'prop-1',
  user_id: 'user-1',
  project_id: 'proj-1',
  title: 'Office Buildout',
  template_type: 'classic',
  data: { projectTitle: 'Office Buildout' } as TrackedProposalRow['data'],
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  status: 'draft',
  sent_at: null,
  viewed_at: null,
  opened_at: null,
  accepted_at: null,
  declined_at: null,
  deposit_paid_at: null,
  scheduled_at: null,
  paid_at: null,
  total_amount: 125000,
  labor_cost: 1000,
  material_cost: 1000,
  deposit_amount: 5000,
  gross_profit: 80000,
  gross_margin_percent: 64,
  public_token: 'token-1',
};

describe('mapNextActionLabelForCard', () => {
  it('maps workflow labels to PM-level copy', () => {
    expect(mapNextActionLabelForCard('Estimate Workspace')).toBe('Build estimate');
    expect(mapNextActionLabelForCard('Generate Proposal')).toBe('Send proposal');
    expect(mapNextActionLabelForCard('Follow Up Proposal')).toBe('Follow up proposal');
    expect(mapNextActionLabelForCard('Schedule placement')).toBe('Schedule work');
    expect(mapNextActionLabelForCard('Log QC & field notes')).toBe('Log field update');
    expect(mapNextActionLabelForCard('Close Out Project')).toBe('Close out project');
  });

  it('maps concrete-specific mix actions to trade-neutral copy', () => {
    expect(mapNextActionLabelForCard('Approve Mix Design')).toBe('Review specs');
    expect(
      mapNextActionLabelForCard('Approve mix (2/3): Slab section A'),
    ).toBe('Review specs');
  });

  it('never returns concrete terms in mapped labels', () => {
    const samples = [
      'Estimate Workspace',
      'Schedule placement',
      'Approve Mix Design (optional)',
      'Log QC & field notes',
      'Enter 7-day break test',
    ];
    for (const sample of samples) {
      const mapped = mapNextActionLabelForCard(sample);
      expect(projectCardDisplayContainsBannedTerms(mapped)).toBe(false);
    }
  });
});

describe('resolveProjectCardNextActionLabel', () => {
  it('uses archived and qc folder overrides', () => {
    expect(
      resolveProjectCardNextActionLabel({
        folder: 'archived',
        rawNextActionLabel: 'Schedule placement',
      }),
    ).toBe('View project');

    expect(
      resolveProjectCardNextActionLabel({
        folder: 'qc_closeout',
        rawNextActionLabel: 'Log QC & field notes',
        qcNextDueLabel: '7-day break',
        qcComplete: false,
      }),
    ).toBe('Review QC');
  });
});

describe('getProjectCardWorkflowReadiness', () => {
  it('derives fraction and percent from lifecycle order', () => {
    const created = getProjectCardWorkflowReadiness('created');
    expect(created).toEqual({
      current: 1,
      total: 8,
      percent: 0,
      label: '1/8 · 0%',
    });

    const estimating = getProjectCardWorkflowReadiness('estimating');
    expect(estimating.label).toBe('2/8 · 14%');
  });
});

describe('getProjectCardEstimateState', () => {
  it('returns Not started without saved estimates', () => {
    expect(
      getProjectCardEstimateState(baseProject, 'created', false, undefined),
    ).toBe('Not started');
  });

  it('returns Needs pricing when estimates exist but proposal is not sent', () => {
    const withCalc: Project = {
      ...baseProject,
      calculations: [
        {
          id: 'calc-1',
          type: 'slab',
          dimensions: {},
          result: { volume: 12, bags: 0 },
          createdAt: '2026-06-01T00:00:00Z',
        },
      ],
    };
    expect(
      getProjectCardEstimateState(withCalc, 'estimating', false, undefined),
    ).toBe('Needs pricing');
  });

  it('returns Complete once proposal is sent', () => {
    expect(
      getProjectCardEstimateState(baseProject, 'proposal_sent', true, 'sent'),
    ).toBe('Complete');
  });
});

describe('getProjectCardScheduleState', () => {
  it('returns trade-neutral schedule states', () => {
    expect(getProjectCardScheduleState('created', undefined)).toBe('Not started');
    expect(
      getProjectCardScheduleState('accepted', '2026-12-01T09:00:00.000Z', new Date('2026-06-14')),
    ).toBe('Scheduled');
    expect(getProjectCardScheduleState('job_completed', '2026-01-01T09:00:00.000Z')).toBe(
      'Complete',
    );
  });
});

describe('getProjectCardFinancialLine', () => {
  it('formats financial states for cards', () => {
    expect(getProjectCardFinancialLine(undefined)).toBe('Financial: No proposal');
    expect(
      getProjectCardFinancialLine({ ...baseProposal, status: 'accepted' }),
    ).toBe('Financial: Proposal accepted');
    expect(
      getProjectCardFinancialLine({ ...baseProposal, status: 'paid' }),
    ).toMatch(/^Financial: \$[\d,]+ accepted$/);
  });
});

describe('getProjectCardRiskIndicator', () => {
  it('derives risk from proposal and stage without admin data', () => {
    expect(
      getProjectCardRiskIndicator({
        folder: 'active',
        stage: 'created',
        project: baseProject,
        hasProposalDraft: false,
      }),
    ).toBe('Needs estimate');

    expect(
      getProjectCardRiskIndicator({
        folder: 'active',
        stage: 'proposal_sent',
        project: baseProject,
        proposalStatus: 'sent',
        hasProposalDraft: true,
      }),
    ).toBe('Follow up');

    expect(
      getProjectCardRiskIndicator({
        folder: 'active',
        stage: 'accepted',
        project: baseProject,
        proposalStatus: 'accepted',
        hasProposalDraft: true,
      }),
    ).toBe('Deposit due');
  });
});

describe('card metric lines', () => {
  it('formats four metric lines with static open items for PR1', () => {
    expect(formatProjectCardEstimateLine('Needs pricing')).toBe('Estimate: Needs pricing');
    expect(formatProjectCardScheduleLine('Not started')).toBe('Schedule: Not started');
    expect(formatProjectCardOpenItemsLine()).toBe('Tasks 0 · RFIs 0 · Docs 0');
  });

  it('does not expose banned concrete terms in formatted lines', () => {
    const lines = [
      formatProjectCardEstimateLine('Needs pricing'),
      formatProjectCardScheduleLine('Scheduled'),
      formatProjectCardOpenItemsLine(),
      getProjectCardFinancialLine({ ...baseProposal, status: 'accepted' }),
    ];
    for (const line of lines) {
      for (const term of PROJECT_CARD_BANNED_TERMS) {
        expect(line.toLowerCase()).not.toContain(term.trim().toLowerCase());
      }
    }
  });
});

describe('inferProjectCardScopeChip', () => {
  it('returns a scope chip only on confident matches', () => {
    expect(inferProjectCardScopeChip('Riverfront Roofing', '')).toBe('Roofing');
    expect(inferProjectCardScopeChip('Generic job', 'Standard buildout')).toBeNull();
  });
});
