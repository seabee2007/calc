import type { TrackedProposalRow, ProposalStatus } from '../types/proposalTracking';
import { PROPOSAL_STATUS_LABELS } from '../types/proposalTracking';

export type CrmPipelineFilter =
  | 'all'
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined';

export const CRM_PIPELINE_COLUMNS: {
  id: CrmPipelineFilter;
  label: string;
  statuses: ProposalStatus[] | null;
}[] = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'draft', label: 'Draft', statuses: ['draft'] },
  { id: 'sent', label: 'Sent', statuses: ['sent'] },
  { id: 'viewed', label: 'Viewed', statuses: ['viewed', 'opened'] },
  {
    id: 'accepted',
    label: 'Accepted',
    statuses: ['accepted', 'deposit_paid', 'scheduled', 'paid'],
  },
  { id: 'declined', label: 'Declined', statuses: ['declined'] },
];

const WEIGHT_BY_STATUS: Record<ProposalStatus, number> = {
  draft: 0.1,
  sent: 0.25,
  viewed: 0.5,
  opened: 0.5,
  accepted: 1,
  declined: 0,
  deposit_paid: 1,
  scheduled: 1,
  paid: 1,
};

export type ProposalAgingTier = 'active' | 'follow_up' | 'stale';

export interface ProposalAgingInfo {
  tier: ProposalAgingTier;
  badgeLabel: string;
  badgeClass: string;
  sentDaysAgo: number | null;
  lastViewedDaysAgo: number | null;
  lastActivityDaysAgo: number;
  activityLine: string;
}

export interface ProposalActivityEvent {
  date: string;
  label: string;
  sortKey: number;
}

export interface CrmNextActionItem {
  proposalId: string;
  projectTitle: string;
  clientName: string;
  actionTitle: string;
  actionDetail: string;
  priority: number;
}

export interface CrmRevenueMetrics {
  pipelineValue: number;
  weightedForecast: number;
  wonThisMonth: number;
  averageMargin: number;
  winRate: number;
  needFollowUpCount: number;
  oldestFollowUpDays: number | null;
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function daysAgo(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function formatDaysAgo(days: number | null): string {
  if (days == null) return '—';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function proposalMatchesPipelineFilter(
  proposal: TrackedProposalRow,
  filter: CrmPipelineFilter,
): boolean {
  if (filter === 'all') return true;
  const col = CRM_PIPELINE_COLUMNS.find((c) => c.id === filter);
  if (!col?.statuses) return true;
  const status = proposal.status ?? 'draft';
  return col.statuses.includes(status);
}

export function sumPipelineColumn(
  proposals: TrackedProposalRow[],
  filter: CrmPipelineFilter,
): { count: number; value: number } {
  const list = proposals.filter((p) => proposalMatchesPipelineFilter(p, filter));
  return {
    count: list.length,
    value: list.reduce((s, p) => s + num(p.total_amount), 0),
  };
}

export function getProposalMargin(proposal: TrackedProposalRow): number {
  const total = num(proposal.total_amount);
  if (total <= 0) return 0;
  const profit =
    total - num(proposal.labor_cost) - num(proposal.material_cost);
  return profit / total;
}

export function getProposalAging(
  proposal: TrackedProposalRow,
  now = new Date(),
): ProposalAgingInfo {
  const status = proposal.status ?? 'draft';
  const sentDays = daysAgo(proposal.sent_at, now);
  const viewedDays = daysAgo(
    proposal.viewed_at ?? proposal.opened_at,
    now,
  );

  const activityDates = [
    proposal.updated_at,
    proposal.sent_at,
    proposal.viewed_at,
    proposal.opened_at,
    proposal.accepted_at,
    proposal.deposit_paid_at,
    proposal.scheduled_at,
    proposal.paid_at,
  ].filter(Boolean) as string[];

  let lastActivityDays = 0;
  if (activityDates.length > 0) {
    const latest = Math.max(...activityDates.map((d) => new Date(d).getTime()));
    lastActivityDays = Math.floor((now.getTime() - latest) / (24 * 60 * 60 * 1000));
  }

  let tier: ProposalAgingTier = 'active';
  let badgeLabel = 'Active';

  if (status === 'declined' || status === 'paid') {
    tier = 'active';
    badgeLabel = status === 'paid' ? 'Closed' : 'Declined';
  } else if (status === 'draft') {
    tier = lastActivityDays >= 14 ? 'follow_up' : 'active';
    badgeLabel = tier === 'follow_up' ? 'Draft — idle' : 'Draft';
  } else if (
    ['sent', 'viewed', 'opened'].includes(status) &&
    (lastActivityDays >= 10 ||
      (sentDays != null && sentDays >= 14 && viewedDays == null) ||
      (sentDays != null && sentDays >= 14))
  ) {
    tier = 'stale';
    badgeLabel = 'Stale';
  } else if (
    ['sent', 'viewed', 'opened'].includes(status) &&
    ((sentDays != null && sentDays >= 7) ||
      (viewedDays != null && viewedDays >= 5) ||
      lastActivityDays >= 7)
  ) {
    tier = 'follow_up';
    badgeLabel = 'Follow up';
  }

  const badgeClass =
    tier === 'stale'
      ? 'bg-red-500/15 text-red-700 ring-red-500/30 dark:text-red-300'
      : tier === 'follow_up'
        ? 'bg-amber-500/15 text-amber-800 ring-amber-500/30 dark:text-amber-200'
        : 'bg-emerald-500/15 text-emerald-800 ring-emerald-500/30 dark:text-emerald-200';

  const activityLine =
    viewedDays != null
      ? `Viewed ${formatDaysAgo(viewedDays)}`
      : sentDays != null
        ? `Sent ${formatDaysAgo(sentDays)}`
        : `Updated ${formatDaysAgo(lastActivityDays)}`;

  return {
    tier,
    badgeLabel,
    badgeClass,
    sentDaysAgo: sentDays,
    lastViewedDaysAgo: viewedDays,
    lastActivityDaysAgo: lastActivityDays,
    activityLine,
  };
}

export function buildProposalActivityTimeline(
  proposal: TrackedProposalRow,
): ProposalActivityEvent[] {
  const events: ProposalActivityEvent[] = [
    {
      date: proposal.created_at,
      label: 'Proposal created',
      sortKey: new Date(proposal.created_at).getTime(),
    },
  ];

  const push = (iso: string | null | undefined, label: string) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return;
    events.push({ date: iso, label, sortKey: t });
  };

  push(proposal.sent_at, 'Sent to client');
  push(proposal.viewed_at, 'Viewed by client');
  push(proposal.opened_at, 'Opened by client');
  push(proposal.accepted_at, 'Accepted');
  push(proposal.declined_at, 'Declined');
  push(proposal.deposit_paid_at, 'Deposit paid');
  push(proposal.scheduled_at, 'Scheduled');
  push(proposal.paid_at, 'Paid');

  return events.sort((a, b) => a.sortKey - b.sortKey);
}

function crmActionForProposal(proposal: TrackedProposalRow): {
  title: string;
  detail: string;
  priority: number;
} | null {
  const status = proposal.status ?? 'draft';
  const aging = getProposalAging(proposal);

  if (status === 'draft') {
    return { title: 'Send proposal', detail: 'Ready to send to client', priority: 30 };
  }
  if (status === 'accepted') {
    return { title: 'Request deposit', detail: 'Client accepted — collect deposit', priority: 10 };
  }
  if (status === 'deposit_paid') {
    return { title: 'Schedule placement', detail: 'Deposit received', priority: 15 };
  }
  if (aging.tier === 'stale' && ['sent', 'viewed', 'opened'].includes(status)) {
    return {
      title: 'Follow up — stale',
      detail: aging.activityLine,
      priority: 5,
    };
  }
  if (aging.tier === 'follow_up' && ['sent', 'viewed', 'opened'].includes(status)) {
    return {
      title: 'Follow up',
      detail: aging.activityLine,
      priority: 12,
    };
  }
  if (status === 'sent' || status === 'viewed' || status === 'opened') {
    return { title: 'Check in with client', detail: aging.activityLine, priority: 20 };
  }
  return null;
}

export function buildCrmNextActions(
  proposals: TrackedProposalRow[],
): CrmNextActionItem[] {
  const items: CrmNextActionItem[] = [];

  for (const p of proposals) {
    const action = crmActionForProposal(p);
    if (!action) continue;
    const projectTitle =
      p.data?.projectTitle?.trim() || p.title || 'Untitled project';
    const clientName = p.data?.clientName?.trim() || 'Client';
    items.push({
      proposalId: p.id,
      projectTitle,
      clientName,
      actionTitle: action.title,
      actionDetail: action.detail,
      priority: action.priority,
    });
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, 8);
}

export function buildCrmRevenueMetrics(
  proposals: TrackedProposalRow[],
  winRate: number,
  wonThisMonth: number,
  now = new Date(),
): CrmRevenueMetrics {
  const active = proposals.filter((p) => (p.status ?? 'draft') !== 'declined');

  const pipelineValue = active.reduce((s, p) => s + num(p.total_amount), 0);

  const weightedForecast = active.reduce((s, p) => {
    const status = p.status ?? 'draft';
    return s + num(p.total_amount) * (WEIGHT_BY_STATUS[status] ?? 0);
  }, 0);

  const margins = active
    .map(getProposalMargin)
    .filter((m) => m > 0);
  const averageMargin =
    margins.length > 0
      ? margins.reduce((a, b) => a + b, 0) / margins.length
      : 0;

  const followUpProposals = proposals.filter((p) => {
    const a = getProposalAging(p, now);
    return (
      a.tier === 'follow_up' ||
      a.tier === 'stale' ||
      ['sent', 'viewed', 'opened'].includes(p.status ?? 'draft')
    );
  });

  const needFollowUpCount = proposals.filter((p) => {
    const a = getProposalAging(p, now);
    return a.tier === 'follow_up' || a.tier === 'stale';
  }).length;

  let oldestFollowUpDays: number | null = null;
  for (const p of followUpProposals) {
    const a = getProposalAging(p, now);
    if (a.tier !== 'follow_up' && a.tier !== 'stale') continue;
    const d = a.sentDaysAgo ?? a.lastActivityDaysAgo;
    if (oldestFollowUpDays == null || d > oldestFollowUpDays) {
      oldestFollowUpDays = d;
    }
  }

  return {
    pipelineValue,
    weightedForecast,
    wonThisMonth,
    averageMargin,
    winRate,
    needFollowUpCount,
    oldestFollowUpDays,
  };
}

export function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function statusShortLabel(status: ProposalStatus): string {
  return PROPOSAL_STATUS_LABELS[status];
}
