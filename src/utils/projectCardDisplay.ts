import type { Project } from '../types';
import type { ProposalStatus } from '../types/proposalTracking';
import type { TrackedProposalRow } from '../types/proposalTracking';
import { projectHasSavedEstimates } from './customEstimateUtils';
import { formatProposalMoney } from './proposalKpis';
import { resolveProposalTotalAmount } from './proposalFinancials';
import {
  PROJECT_LIFECYCLE_STAGE_ORDER,
  workflowStageProgressIndex,
  type ProjectWorkflowStage,
  type ProjectCardPresentation,
} from './projectWorkflow';
import type { ProjectFolder } from './projectFolders';

export type ProjectCardEstimateState =
  | 'Not started'
  | 'Needs pricing'
  | 'Ready'
  | 'Complete';

export type ProjectCardScheduleState =
  | 'Not started'
  | 'Scheduled'
  | 'Active'
  | 'Complete';

const CONCRETE_ACTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /^Estimate Workspace$/i, label: 'Build estimate' },
  { pattern: /^Generate Proposal$/i, label: 'Send proposal' },
  { pattern: /^Follow Up Proposal$/i, label: 'Follow up proposal' },
  { pattern: /^Schedule placement$/i, label: 'Schedule work' },
  { pattern: /^Approve mix/i, label: 'Review specs' },
  { pattern: /^Log QC & field notes$/i, label: 'Log field update' },
  { pattern: /^Request Final Payment$/i, label: 'Request final payment' },
  { pattern: /^Close Out Project$/i, label: 'Close out project' },
  { pattern: /^Back to projects$/i, label: 'View project' },
  { pattern: /^Open Project$/i, label: 'Open project' },
  { pattern: /^View project$/i, label: 'View project' },
  { pattern: /^No further action$/i, label: 'No further action' },
  { pattern: /^Enter /i, label: 'Review QC' },
];

const CONCRETE_TERM_PATTERN =
  /\b(pour|placement|mix design|mix\b|psi\b|cubic yard|\bcy\b|batch plant|slab|concrete)\b/i;

export function mapNextActionLabelForCard(rawLabel: string): string {
  const trimmed = rawLabel.trim();
  for (const { pattern, label } of CONCRETE_ACTION_PATTERNS) {
    if (pattern.test(trimmed)) return label;
  }
  if (CONCRETE_TERM_PATTERN.test(trimmed)) {
    if (/qc|field|log/i.test(trimmed)) return 'Log field update';
    if (/schedule|plan/i.test(trimmed)) return 'Schedule work';
    if (/approve|review|spec/i.test(trimmed)) return 'Review specs';
    if (/proposal|send|follow/i.test(trimmed)) return 'Follow up proposal';
    if (/close|wrap|final|payment/i.test(trimmed)) return 'Close out project';
    if (/estimate|workspace|calculator/i.test(trimmed)) return 'Build estimate';
    return 'Review project';
  }
  return trimmed;
}

export interface ProjectCardStatusBadge {
  label: string;
  badgeClass: string;
  ringClass: string;
}

export function getProjectCardStatusBadge(
  folder: ProjectFolder,
  presentation: Pick<
    ProjectCardPresentation,
    'priorityLabel' | 'priorityBadgeClass' | 'priorityRingClass'
  >,
): ProjectCardStatusBadge {
  if (folder === 'qc_closeout') {
    return {
      label: 'QC Closeout',
      badgeClass:
        'bg-violet-500/15 text-violet-800 border-violet-500/40 dark:text-violet-200',
      ringClass: 'ring-1 ring-violet-500/35',
    };
  }
  if (folder === 'archived') {
    return {
      label: 'Archived',
      badgeClass:
        'bg-slate-600/20 text-slate-700 border-slate-500/50 dark:text-slate-200',
      ringClass: 'ring-1 ring-slate-500/40',
    };
  }
  return {
    label: presentation.priorityLabel,
    badgeClass: presentation.priorityBadgeClass,
    ringClass: presentation.priorityRingClass,
  };
}

export interface ProjectCardWorkflowReadiness {
  current: number;
  total: number;
  percent: number;
  label: string;
}

export function getProjectCardWorkflowReadiness(
  stage: ProjectWorkflowStage,
): ProjectCardWorkflowReadiness {
  const stageIdx = workflowStageProgressIndex(stage);
  const total = PROJECT_LIFECYCLE_STAGE_ORDER.length;
  const maxIdx = total - 1;
  const percent = Math.round((stageIdx / maxIdx) * 100);
  return {
    current: stageIdx + 1,
    total,
    percent,
    label: `${stageIdx + 1}/${total} · ${percent}%`,
  };
}

const PROPOSAL_COMPLETE_STATUSES: ProposalStatus[] = [
  'sent',
  'viewed',
  'opened',
  'accepted',
  'deposit_paid',
  'scheduled',
  'paid',
];

const ACCEPTED_FINANCIAL_STATUSES: ProposalStatus[] = [
  'accepted',
  'deposit_paid',
  'scheduled',
  'paid',
];

export function getProjectCardEstimateState(
  project: Project,
  stage: ProjectWorkflowStage,
  hasProposalDraft: boolean,
  proposalStatus?: ProposalStatus,
): ProjectCardEstimateState {
  const normalized = workflowStageProgressIndex(stage);
  const sentIdx = PROJECT_LIFECYCLE_STAGE_ORDER.indexOf('proposal_sent');
  if (
    normalized >= sentIdx ||
    (proposalStatus && PROPOSAL_COMPLETE_STATUSES.includes(proposalStatus))
  ) {
    return 'Complete';
  }
  if (hasProposalDraft && proposalStatus === 'draft') {
    return 'Ready';
  }
  if (projectHasSavedEstimates(project)) {
    return 'Needs pricing';
  }
  return 'Not started';
}

function parseTargetDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getProjectCardScheduleState(
  stage: ProjectWorkflowStage,
  targetDateIso?: string,
  now = new Date(),
): ProjectCardScheduleState {
  const terminalStages: ProjectWorkflowStage[] = [
    'job_completed',
    'paid',
    'closed',
    'placed',
  ];
  if (terminalStages.includes(stage)) return 'Complete';

  const target = parseTargetDate(targetDateIso);
  if (!target) return 'Not started';

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const targetDay = new Date(target);
  targetDay.setHours(0, 0, 0, 0);

  if (targetDay.getTime() < today.getTime()) return 'Active';
  if (isSameDay(target, now)) return 'Active';
  return 'Scheduled';
}

export function formatProjectCardEstimateLine(state: ProjectCardEstimateState): string {
  return `Estimate: ${state}`;
}

export function formatProjectCardScheduleLine(state: ProjectCardScheduleState): string {
  return `Schedule: ${state}`;
}

export function getProjectCardFinancialLine(
  proposal: TrackedProposalRow | undefined,
): string {
  if (!proposal) return 'Financial: No proposal';

  const status = proposal.status;
  if (status === 'accepted') return 'Financial: Proposal accepted';
  if (status === 'deposit_paid' || status === 'scheduled' || status === 'paid') {
    const amount = formatProposalMoney(resolveProposalTotalAmount(proposal));
    return `Financial: ${amount} accepted`;
  }
  if (ACCEPTED_FINANCIAL_STATUSES.includes(status)) {
    return 'Financial: Proposal accepted';
  }
  if (['sent', 'viewed', 'opened'].includes(status)) {
    return 'Financial: Proposal sent';
  }
  if (status === 'declined') return 'Financial: Proposal declined';
  if (status === 'draft') return 'Financial: Draft proposal';
  return 'Financial: No proposal';
}

export function formatProjectCardOpenItemsLine(): string {
  return 'Tasks 0 · RFIs 0 · Docs 0';
}

export function formatProjectCardCreatedDate(iso?: string): string {
  if (!iso) return 'Created —';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Created —';
  return `Created ${d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

export function formatProjectCardTargetDate(iso?: string): string | null {
  const d = parseTargetDate(iso);
  if (!d) return null;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export type ProjectCardRiskIndicator =
  | 'On track'
  | 'Needs estimate'
  | 'Follow up'
  | 'Deposit due'
  | 'Closeout pending'
  | 'Archived'
  | 'QC overdue';

export function getProjectCardRiskIndicator(options: {
  folder: ProjectFolder;
  stage: ProjectWorkflowStage;
  project: Project;
  proposalStatus?: ProposalStatus;
  hasProposalDraft: boolean;
  qcOverdue?: boolean;
}): ProjectCardRiskIndicator {
  const { folder, stage, project, proposalStatus, hasProposalDraft, qcOverdue } =
    options;

  if (folder === 'archived') return 'Archived';
  if (folder === 'qc_closeout') {
    return qcOverdue ? 'QC overdue' : 'Closeout pending';
  }
  if (stage === 'closed') return 'Archived';
  if (stage === 'job_completed' || stage === 'paid' || stage === 'placed') {
    return 'Closeout pending';
  }
  if (proposalStatus === 'accepted') return 'Deposit due';
  if (stage === 'proposal_sent') return 'Follow up';
  if (
    !projectHasSavedEstimates(project) &&
    (stage === 'created' || stage === 'estimating')
  ) {
    return 'Needs estimate';
  }
  if (!hasProposalDraft && stage === 'estimating') return 'Needs estimate';
  return 'On track';
}

export function resolveProjectCardNextActionLabel(options: {
  folder: ProjectFolder;
  rawNextActionLabel: string;
  qcNextDueLabel?: string;
  qcComplete?: boolean;
}): string {
  const { folder, rawNextActionLabel, qcNextDueLabel, qcComplete } = options;

  if (folder === 'archived') return 'View project';
  if (folder === 'qc_closeout') {
    if (qcComplete) return 'View project';
    return mapNextActionLabelForCard(
      qcNextDueLabel ? `Enter ${qcNextDueLabel}` : 'Review QC',
    );
  }
  return mapNextActionLabelForCard(rawNextActionLabel);
}

const SCOPE_CHIP_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\broof(ing|s)?\b/i, label: 'Roofing' },
  { pattern: /\belectrical\b/i, label: 'Electrical' },
  { pattern: /\bplumb(ing|er)\b/i, label: 'Plumbing' },
  { pattern: /\bhvac\b/i, label: 'HVAC' },
  { pattern: /\bframing\b/i, label: 'Framing' },
  { pattern: /\bdrywall\b/i, label: 'Drywall' },
  { pattern: /\bpaint(ing|er)?\b/i, label: 'Painting' },
  { pattern: /\blandscap(e|ing)\b/i, label: 'Landscaping' },
  { pattern: /\bfoundation\b/i, label: 'Foundation' },
  { pattern: /\bremodel\b/i, label: 'Remodel' },
];

export function inferProjectCardScopeChip(
  name?: string,
  description?: string,
): string | null {
  const text = `${name ?? ''} ${description ?? ''}`.trim();
  if (!text) return null;
  for (const { pattern, label } of SCOPE_CHIP_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

/** Labels that must never appear on project cards (trade-specific). */
export const PROJECT_CARD_BANNED_TERMS = [
  'pour',
  'placement',
  'mix design',
  'PSI',
  ' CY',
  'batch plant',
  'slab',
  'concrete',
] as const;

export function projectCardDisplayContainsBannedTerms(text: string): boolean {
  const lower = text.toLowerCase();
  return PROJECT_CARD_BANNED_TERMS.some((term) =>
    lower.includes(term.trim().toLowerCase()),
  );
}
