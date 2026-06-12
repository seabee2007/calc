import { describe, expect, it } from 'vitest';
import {
  resolveProjectProposalNextAction,
  shouldUseProjectProposalNextAction,
} from '../projectProposalNextAction';
import type { TrackedProposalRow } from '../../types/proposalTracking';

const baseProposal = {
  id: 'prop-1',
  user_id: 'user-1',
  project_id: 'proj-1',
  title: 'Riverfront Slab',
  template_type: 'classic' as const,
  data: { projectTitle: 'Riverfront Slab' } as TrackedProposalRow['data'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  sent_at: null,
  viewed_at: null,
  opened_at: null,
  accepted_at: null,
  declined_at: null,
  deposit_paid_at: null,
  scheduled_at: null,
  paid_at: null,
  total_amount: 1000,
  labor_cost: 100,
  material_cost: 100,
  deposit_amount: 0,
  gross_profit: 800,
  gross_margin_percent: 80,
  public_token: 'token-1',
  last_sent_to: null,
};

describe('resolveProjectProposalNextAction', () => {
  it('navigates to project proposals when none linked', () => {
    expect(resolveProjectProposalNextAction('proj-1', undefined)).toEqual({
      type: 'navigate',
      label: 'Create proposal',
      path: '/projects/proj-1/proposals',
    });
  });

  it('opens send modal action for draft proposals', () => {
    const action = resolveProjectProposalNextAction('proj-1', {
      ...baseProposal,
      status: 'draft',
    });
    expect(action).toMatchObject({
      type: 'email',
      label: 'Send proposal',
      mode: 'send',
    });
  });

  it('opens follow-up modal action for sent proposals', () => {
    const action = resolveProjectProposalNextAction('proj-1', {
      ...baseProposal,
      status: 'sent',
    });
    expect(action).toMatchObject({
      type: 'email',
      label: 'Follow up proposal',
      mode: 'followUp',
    });
  });
});

describe('shouldUseProjectProposalNextAction', () => {
  it('uses proposal email action for proposal_sent stage', () => {
    expect(
      shouldUseProjectProposalNextAction('proposal_sent', {
        ...baseProposal,
        status: 'sent',
      }),
    ).toBe(true);
  });

  it('does not use proposal email action for unrelated stages', () => {
    expect(
      shouldUseProjectProposalNextAction('in_progress', {
        ...baseProposal,
        status: 'sent',
      }),
    ).toBe(false);
  });
});
