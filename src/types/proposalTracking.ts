import type { ProposalData } from './proposal';

export type ProposalStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'opened'
  | 'accepted'
  | 'declined'
  | 'deposit_paid'
  | 'scheduled'
  | 'paid';

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  opened: 'Opened',
  accepted: 'Accepted',
  declined: 'Declined',
  deposit_paid: 'Deposit Paid',
  scheduled: 'Scheduled',
  paid: 'Paid',
};

export const PROPOSAL_PIPELINE_STATUSES: ProposalStatus[] = [
  'draft',
  'sent',
  'viewed',
  'opened',
  'accepted',
  'declined',
  'deposit_paid',
  'scheduled',
  'paid',
];

export interface ProposalFinancialFields {
  total_amount: number;
  labor_cost: number;
  material_cost: number;
  equipment_cost?: number;
  total_estimated_cost?: number;
  deposit_amount: number;
  gross_profit?: number;
  gross_margin_percent?: number;
  markup_percent?: number;
}

export interface TrackedProposalRow {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  template_type: 'classic' | 'modern' | 'minimal';
  data: ProposalData;
  created_at: string;
  updated_at: string;
  status: ProposalStatus;
  sent_at: string | null;
  viewed_at: string | null;
  opened_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  deposit_paid_at: string | null;
  scheduled_at: string | null;
  paid_at: string | null;
  total_amount: number;
  labor_cost: number;
  material_cost: number;
  deposit_amount: number;
  gross_profit: number;
  gross_margin_percent: number;
  public_token: string;
  last_sent_to?: string | null;
}
