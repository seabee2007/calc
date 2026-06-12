import { describe, expect, it } from 'vitest';
import { buildCrmNextActions } from '../proposalCrm';
import type { TrackedProposalRow } from '../../types/proposalTracking';

const baseProposal: TrackedProposalRow = {
  id: 'prop-1',
  user_id: 'user-1',
  project_id: 'proj-1',
  title: 'CO26-201 Single Story Concrete House With Garage',
  template_type: 'classic',
  data: {
    projectTitle: 'CO26-201 Single Story Concrete House With Garage',
    clientName: 'Drew Billy Bob',
    businessName: 'Concrete Co',
  } as TrackedProposalRow['data'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  status: 'draft',
  sent_at: null,
  viewed_at: null,
  opened_at: null,
  accepted_at: null,
  declined_at: null,
  deposit_paid_at: null,
  scheduled_at: null,
  paid_at: null,
  total_amount: 10000,
  labor_cost: 1000,
  material_cost: 1000,
  deposit_amount: 2500,
  gross_profit: 8000,
  gross_margin_percent: 80,
  public_token: 'token-1',
  last_sent_to: null,
};

describe('buildCrmNextActions', () => {
  it('returns send_proposal for draft proposals', () => {
    const actions = buildCrmNextActions([baseProposal]);
    expect(actions[0]?.type).toBe('send_proposal');
    expect(actions[0]?.label).toBe('Send proposal');
  });

  it('returns request_deposit for accepted proposals', () => {
    const actions = buildCrmNextActions([
      { ...baseProposal, status: 'accepted', accepted_at: '2026-01-05T00:00:00Z' },
    ]);
    expect(actions[0]?.type).toBe('request_deposit');
  });

  it('returns follow_up_proposal for stale sent proposals', () => {
    const oldSent = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const actions = buildCrmNextActions([
      {
        ...baseProposal,
        status: 'sent',
        sent_at: oldSent,
        updated_at: oldSent,
      },
    ]);
    expect(actions[0]?.type).toBe('follow_up_proposal');
  });

  it('returns check_in_client for recently sent proposals', () => {
    const recentSent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const actions = buildCrmNextActions([
      {
        ...baseProposal,
        status: 'sent',
        sent_at: recentSent,
        updated_at: recentSent,
      },
    ]);
    expect(actions[0]?.type).toBe('check_in_client');
  });
});
