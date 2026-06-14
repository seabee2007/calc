import { supabase } from './supabase';
import { normalizeProposal } from './proposalService';
import { useTrackedProposalsStore } from '../store/trackedProposalsStore';
import type { ProposalStatus } from '../types/proposalTracking';
import type { ProposalFinancialFields } from '../types/proposalTracking';
import type { TrackedProposalRow } from '../types/proposalTracking';
import { computeProposalFinancials } from '../utils/proposalFinancials';
import type { ProposalData } from '../types/proposal';
import { getAppUrl, isMarketingHost } from '../config/brand';
import { createProposalNotification } from '../services/proposalNotificationService';

function trackProposalRow(row: Record<string, unknown>): TrackedProposalRow {
  const normalized = normalizeProposal(row);
  useTrackedProposalsStore.getState().upsertProposal(normalized);
  return normalized;
}

const TIMESTAMP_COLUMN: Record<ProposalStatus, string | null> = {
  draft: null,
  sent: 'sent_at',
  viewed: 'viewed_at',
  opened: 'opened_at',
  accepted: 'accepted_at',
  declined: 'declined_at',
  deposit_paid: 'deposit_paid_at',
  scheduled: 'scheduled_at',
  paid: 'paid_at',
};

export function getPublicProposalUrl(publicToken: string): string {
  const origin =
    typeof window !== 'undefined' && !isMarketingHost()
      ? window.location.origin
      : getAppUrl();
  return `${origin}/proposal/${publicToken}`;
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
  const normalized = trackProposalRow(data as Record<string, unknown>);
  return { data: normalized, error: null };
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
  const prior = await fetchProposalById(proposalId);
  const { data, error } = await updateProposalStatus(proposalId, 'sent');
  if (error || !data) throw error ?? new Error('Failed to mark proposal sent');
  if (prior && !prior.sent_at) {
    void createProposalNotification({ proposal: data, type: 'proposal_sent' });
  }
  return data;
}

function trackRpcProposalRow(data: unknown): TrackedProposalRow {
  return trackProposalRow(data as Record<string, unknown>);
}

export async function markProposalViewed(publicToken: string): Promise<TrackedProposalRow> {
  const prior = await fetchProposalByPublicToken(publicToken);
  const { data, error } = await supabase.rpc('record_proposal_client_action', {
    p_token: publicToken,
    p_action: 'viewed',
  });
  if (error) throw new Error(error.message);
  const normalized = trackRpcProposalRow(data);
  if (prior && !prior.viewed_at) {
    void createProposalNotification({ proposal: normalized, type: 'proposal_viewed' });
  }
  return normalized;
}

export async function markProposalOpened(publicToken: string): Promise<TrackedProposalRow> {
  const prior = await fetchProposalByPublicToken(publicToken);
  const { data, error } = await supabase.rpc('record_proposal_client_action', {
    p_token: publicToken,
    p_action: 'opened',
  });
  if (error) throw new Error(error.message);
  const normalized = trackRpcProposalRow(data);
  if (prior && !prior.opened_at && !prior.viewed_at) {
    void createProposalNotification({ proposal: normalized, type: 'proposal_viewed' });
  }
  return normalized;
}

export async function acceptProposal(publicToken: string): Promise<TrackedProposalRow> {
  const prior = await fetchProposalByPublicToken(publicToken);
  const { data, error } = await supabase.rpc('record_proposal_client_action', {
    p_token: publicToken,
    p_action: 'accepted',
  });
  if (error) throw new Error(error.message);
  const normalized = trackRpcProposalRow(data);
  if (prior?.status !== 'accepted' && normalized.status === 'accepted') {
    void createProposalNotification({ proposal: normalized, type: 'proposal_accepted' });
  }
  return normalized;
}

export async function declineProposal(publicToken: string): Promise<TrackedProposalRow> {
  const prior = await fetchProposalByPublicToken(publicToken);
  const { data, error } = await supabase.rpc('record_proposal_client_action', {
    p_token: publicToken,
    p_action: 'declined',
  });
  if (error) throw new Error(error.message);
  const normalized = trackRpcProposalRow(data);
  if (prior?.status !== 'declined' && normalized.status === 'declined') {
    void createProposalNotification({ proposal: normalized, type: 'proposal_declined' });
  }
  return normalized;
}

export async function markDepositPaid(proposalId: string): Promise<TrackedProposalRow> {
  const prior = await fetchProposalById(proposalId);
  const { data, error } = await updateProposalStatus(proposalId, 'deposit_paid');
  if (error || !data) throw error ?? new Error('Failed to mark deposit paid');
  if (prior && prior.status !== 'deposit_paid') {
    void createProposalNotification({ proposal: data, type: 'proposal_deposit_paid' });
  }
  return data;
}

export async function markScheduled(proposalId: string): Promise<TrackedProposalRow> {
  const { data, error } = await updateProposalStatus(proposalId, 'scheduled');
  if (error || !data) throw error ?? new Error('Failed to mark scheduled');
  return data;
}

export async function markPaid(proposalId: string): Promise<TrackedProposalRow> {
  const { data, error } = await updateProposalStatus(proposalId, 'paid');
  if (error || !data) throw error ?? new Error('Failed to mark paid');
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

async function fetchProposalById(proposalId: string): Promise<TrackedProposalRow | null> {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeProposal(data as Record<string, unknown>);
}
