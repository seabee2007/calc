import { supabase } from './supabase';
import type { ProposalStatus } from '../types/proposalTracking';
import type { ProposalFinancialFields } from '../types/proposalTracking';
import type { TrackedProposalRow } from '../types/proposalTracking';
import { computeProposalFinancials } from '../utils/proposalFinancials';
import type { ProposalData } from '../types/proposal';

const TIMESTAMP_COLUMN: Record<ProposalStatus, string | null> = {
  draft: null,
  sent: 'sent_at',
  viewed: 'viewed_at',
  opened: 'opened_at',
  accepted: 'accepted_at',
  declined: 'declined_at',
  deposit_paid: 'deposit_paid_at',
  scheduled: 'scheduled_at',
};

export function getPublicProposalUrl(publicToken: string): string {
  return `${window.location.origin}/proposal/${publicToken}`;
}

export async function updateProposalStatus(
  proposalId: string,
  status: ProposalStatus,
): Promise<{ data: TrackedProposalRow | null; error: Error | null }> {
  const timestampColumn = TIMESTAMP_COLUMN[status];
  const payload: Record<string, string> = { status };
  if (timestampColumn) {
    payload[timestampColumn] = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('proposals')
    .update(payload)
    .eq('id', proposalId)
    .select()
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as TrackedProposalRow, error: null };
}

export async function syncProposalFinancials(
  proposalId: string,
  data: ProposalData,
): Promise<ProposalFinancialFields> {
  const financials = computeProposalFinancials(data);
  await supabase
    .from('proposals')
    .update(financials)
    .eq('id', proposalId);
  return financials;
}

export async function markProposalSent(proposalId: string): Promise<TrackedProposalRow> {
  const { data, error } = await updateProposalStatus(proposalId, 'sent');
  if (error || !data) throw error ?? new Error('Failed to mark proposal sent');
  return data;
}

export async function markProposalViewed(publicToken: string): Promise<TrackedProposalRow> {
  const { data, error } = await supabase.rpc('record_proposal_client_action', {
    p_token: publicToken,
    p_action: 'viewed',
  });
  if (error) throw new Error(error.message);
  return data as TrackedProposalRow;
}

export async function markProposalOpened(publicToken: string): Promise<TrackedProposalRow> {
  const { data, error } = await supabase.rpc('record_proposal_client_action', {
    p_token: publicToken,
    p_action: 'opened',
  });
  if (error) throw new Error(error.message);
  return data as TrackedProposalRow;
}

export async function acceptProposal(publicToken: string): Promise<TrackedProposalRow> {
  const { data, error } = await supabase.rpc('record_proposal_client_action', {
    p_token: publicToken,
    p_action: 'accepted',
  });
  if (error) throw new Error(error.message);
  return data as TrackedProposalRow;
}

export async function declineProposal(publicToken: string): Promise<TrackedProposalRow> {
  const { data, error } = await supabase.rpc('record_proposal_client_action', {
    p_token: publicToken,
    p_action: 'declined',
  });
  if (error) throw new Error(error.message);
  return data as TrackedProposalRow;
}

export async function markDepositPaid(proposalId: string): Promise<TrackedProposalRow> {
  const { data, error } = await updateProposalStatus(proposalId, 'deposit_paid');
  if (error || !data) throw error ?? new Error('Failed to mark deposit paid');
  return data;
}

export async function markScheduled(proposalId: string): Promise<TrackedProposalRow> {
  const { data, error } = await updateProposalStatus(proposalId, 'scheduled');
  if (error || !data) throw error ?? new Error('Failed to mark scheduled');
  return data;
}

export async function fetchProposalByPublicToken(
  publicToken: string,
): Promise<TrackedProposalRow | null> {
  const { data, error } = await supabase.rpc('get_proposal_by_public_token', {
    p_token: publicToken,
  });
  if (error) {
    console.error('fetchProposalByPublicToken', error);
    return null;
  }
  return (data as TrackedProposalRow) ?? null;
}
