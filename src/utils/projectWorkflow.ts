import type { Project } from '../types';
import { workflowQuery } from './workflow';
import type { PlacementOrder, PlacementOrderStatus } from '../types/placementOrder';
import type { ProposalData } from '../types/proposal';
import type { ProposalStatus } from '../types/proposalTracking';
import type { OpsRiskLevel } from './operationsDashboard';
import {
  getMixDesignWorkflowContext,
  projectRequiresMixDesignApproval,
  type MixDesignWorkflowContext,
} from './mixDesignWorkflow';
import { formatPlacementCalculationLabel } from './placementCalculations';

/** Global project lifecycle — drives dashboard, filters, and next actions. */
export type ProjectWorkflowStage =
  | 'created'
  | 'estimating'
  | 'proposal_sent'
  | 'accepted'
  | 'mix_approved'
  | 'placement_scheduled'
  | 'ordered'
  | 'placed'
  | 'job_completed'
  | 'paid'
  | 'closed';

/** Progress bar & project-card stage dropdown (mix approved not shown). */
export const PROJECT_LIFECYCLE_STAGE_ORDER: ProjectWorkflowStage[] = [
  'created',
  'estimating',
  'proposal_sent',
  'accepted',
  'placement_scheduled',
  'ordered',
  'placed',
  'job_completed',
  'paid',
  'closed',
];

export const PROJECT_WORKFLOW_LABELS: Record<ProjectWorkflowStage, string> = {
  created: 'Created',
  estimating: 'Estimating',
  proposal_sent: 'Proposal Sent',
  accepted: 'Accepted',
  mix_approved: 'Mix Approved',
  placement_scheduled: 'Placement Scheduled',
  ordered: 'Order Ready Mix',
  placed: 'Concrete Placed',
  job_completed: 'Job Completed',
  paid: 'Paid',
  closed: 'Closed',
};

export function normalizeWorkflowStageForDisplay(
  stage: ProjectWorkflowStage,
): ProjectWorkflowStage {
  if (stage === 'mix_approved') return 'accepted';
  return stage;
}

export function workflowStageProgressIndex(stage: ProjectWorkflowStage): number {
  const normalized = normalizeWorkflowStageForDisplay(stage);
  const idx = PROJECT_LIFECYCLE_STAGE_ORDER.indexOf(normalized);
  return idx >= 0 ? idx : 0;
}

export interface ProjectNextAction {
  label: string;
  description?: string;
  path: string;
  search?: string;
  /** In-app handler instead of route navigation (e.g. mark project closed). */
  kind?: 'navigate' | 'close_project' | 'back_to_list' | 'scroll_to_qc';
}

/** Stages where pour planner / placement configuration is still relevant. */
export const PLACEMENT_PLANNER_STAGES: ProjectWorkflowStage[] = [
  'mix_approved',
  'placement_scheduled',
  'ordered',
  'placed',
];

export function shouldShowConfigurePlacement(stage: ProjectWorkflowStage): boolean {
  return PLACEMENT_PLANNER_STAGES.includes(stage);
}

/** Archived jobs — exclude from dashboard placement queues and schedules. */
export function isProjectClosedOut(project: Project): boolean {
  if (project.placementOrder?.lifecycleStage === 'closed') return true;
  const status = project.placementOrder?.status;
  return status === 'completed' || status === 'cancelled';
}

export interface ReadinessIssue {
  id: string;
  message: string;
  fixPath: string;
  fixSearch?: string;
}

export interface ProjectWorkflowMeta {
  stage: ProjectWorkflowStage;
  stageLabel: string;
  nextAction: ProjectNextAction;
  healthScore: number;
  readinessIssues: ReadinessIssue[];
  mixDesign?: MixDesignWorkflowContext;
}

function parsePourDate(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSameDay(a: Date, b: Date): boolean {
  const s = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  return s(a).getTime() === s(b).getTime();
}

function projectVolumeYd(project: Project): number {
  return (project.calculations ?? []).reduce(
    (sum, c) => sum + (c.result?.volume > 0 ? c.result.volume : 0),
    0,
  );
}

function inferStage(
  project: Project,
  order: PlacementOrder | undefined,
  hasProposalDraft: boolean,
  proposalStatus?: ProposalStatus,
  mixContext?: MixDesignWorkflowContext,
  now = new Date(),
): ProjectWorkflowStage {
  const pourDate = parsePourDate(project.pourDate);
  const volume = projectVolumeYd(project);
  const status = order?.status ?? null;
  if (status === 'completed' || status === 'cancelled') return 'closed';

  if (pourDate && pourDate < now && !isSameDay(pourDate, now)) {
    if (status === 'scheduled' || status === 'ordered') return 'placed';
  }

  /** Dispatch stage — only from order-status dropdown on the project card. */
  if (status === 'ordered') return 'ordered';
  if (status === 'scheduled') return 'placement_scheduled';

  /** Pour date + call sheet saved; plant not called yet (status still draft). */
  if (pourDate && (!status || status === 'draft')) {
    return 'placement_scheduled';
  }

  if (status === 'ready_to_call') {
    return pourDate ? 'placement_scheduled' : 'accepted';
  }

  if (proposalStatus === 'paid') return 'paid';
  if (proposalStatus === 'scheduled') return 'placement_scheduled';
  if (proposalStatus === 'deposit_paid') {
    return 'accepted';
  }
  if (proposalStatus === 'accepted') {
    return 'accepted';
  }
  if (
    proposalStatus &&
    ['sent', 'viewed', 'opened'].includes(proposalStatus)
  ) {
    return 'proposal_sent';
  }

  if (hasProposalDraft && volume > 0) return 'proposal_sent';

  if (volume > 0 || (project.calculations?.length ?? 0) > 0) return 'estimating';

  return 'created';
}

function buildMixDesignNextAction(
  projectId: string,
  mixContext: MixDesignWorkflowContext,
): ProjectNextAction {
  const calcId = mixContext.nextPendingCalculationId;
  const calc = mixContext.nextPendingCalculation;
  const placements = mixContext.totalPlacements;
  const nextIndex = mixContext.approvedCount + 1;

  let label = 'Approve Mix Design';
  if (placements > 1 && calc) {
    const idx = mixContext.approvedCount;
    const short = formatPlacementCalculationLabel(calc, idx).slice(0, 42);
    label = `Approve mix (${nextIndex}/${placements}): ${short}`;
  } else if (placements > 1) {
    label = `Approve mix design (${nextIndex} of ${placements})`;
  }

  return {
    label,
    description:
      placements > 1
        ? `${mixContext.approvedCount} of ${placements} placements approved`
        : 'Complete Mix Design Advisor for this takeoff',
    path: '/mix-design-advisor',
    search: workflowQuery(projectId, calcId),
  };
}

function buildNextAction(
  stage: ProjectWorkflowStage,
  projectId: string,
  mixContext?: MixDesignWorkflowContext,
): ProjectNextAction {
  const q = workflowQuery(projectId);
  switch (stage) {
    case 'created':
      return {
        label: 'Add Takeoff',
        description: 'Run concrete volume and scope',
        path: '/calculator',
        search: q,
      };
    case 'estimating':
      return {
        label: 'Generate Proposal',
        path: '/proposal-generator',
        search: q,
      };
    case 'proposal_sent':
      return {
        label: 'Follow Up Proposal',
        path: '/proposal-generator',
        search: q,
      };
    case 'accepted':
      if (mixContext?.nextPendingCalculationId) {
        return buildMixDesignNextAction(projectId, mixContext);
      }
      return {
        label: 'Generate Proposal',
        path: '/proposal-generator',
        search: q,
      };
    case 'mix_approved':
      return {
        label: 'Order Concrete',
        description: 'Configure placement and call the batch plant',
        path: '/pour-planner',
        search: q,
      };
    case 'placement_scheduled':
      return {
        label: 'Order Concrete',
        path: '/pour-planner',
        search: q,
      };
    case 'ordered':
      return {
        label: 'Open Dispatch Sheet',
        path: '/pour-planner',
        search: q,
      };
    case 'placed':
      return {
        label: 'Log QC records',
        description: 'Scroll to quality control on this project',
        path: '/projects',
        kind: 'scroll_to_qc',
      };
    case 'job_completed':
      return {
        label: 'Request Final Payment',
        description: 'Wrap up punch list and billing',
        path: '/proposals',
      };
    case 'paid':
      return {
        label: 'Close Out Project',
        description: 'Mark this job as closed',
        path: '/projects',
        kind: 'close_project',
      };
    case 'closed':
      return {
        label: 'Back to projects',
        description: 'Return to your project list',
        path: '/projects',
        kind: 'back_to_list',
      };
    default:
      return { label: 'Open Project', path: '/projects' };
  }
}

export function buildReadinessIssues(
  project: Project,
  order: PlacementOrder | undefined,
  risks: { wind: OpsRiskLevel; heat: OpsRiskLevel },
  mixContext?: MixDesignWorkflowContext,
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const q = workflowQuery(project.id);

  if (risks.wind === 'moderate' || risks.wind === 'high') {
    issues.push({
      id: 'wind',
      message: 'Wind / evaporation risk elevated',
      fixPath: '/pour-planner',
      fixSearch: q,
    });
  }
  if (!order?.batchPlantName && !order?.batchPlantAddress) {
    issues.push({
      id: 'plant',
      message: 'No batch plant assigned',
      fixPath: '/pour-planner',
      fixSearch: q,
    });
  }
  if (!project.pourDate) {
    issues.push({
      id: 'pour-time',
      message: 'No placement start time scheduled',
      fixPath: '/projects',
      fixSearch: `?project=${project.id}`,
    });
  }
  if (!project.jobsiteAddress?.city && !project.jobsiteAddress?.street) {
    issues.push({
      id: 'jobsite',
      message: 'Jobsite address missing',
      fixPath: '/projects',
      fixSearch: `?project=${project.id}`,
    });
  }
  if (risks.heat === 'high' || risks.heat === 'moderate') {
    issues.push({
      id: 'heat',
      message: 'Heat index may accelerate set',
      fixPath: '/mix-design-advisor',
      fixSearch: q,
    });
  }
  const volume = projectVolumeYd(project);
  if (volume <= 0) {
    issues.push({
      id: 'volume',
      message: 'Placement volume not calculated',
      fixPath: '/calculator',
      fixSearch: q,
    });
  }

  if (mixContext?.nextPendingCalculation) {
    const calc = mixContext.nextPendingCalculation;
    const label = formatPlacementCalculationLabel(
      calc,
      mixContext.approvedCount,
    );
    issues.push({
      id: `mix-${calc.id}`,
      message: `Mix design not approved: ${label}`,
      fixPath: '/mix-design-advisor',
      fixSearch: workflowQuery(project.id, calc.id),
    });
  }

  return issues.slice(0, 6);
}

export function computeProjectHealthScore(
  project: Project,
  order: PlacementOrder | undefined,
  readinessScore: number,
  issueCount: number,
): number {
  let score = readinessScore * 0.45;
  if (project.pourDate) score += 15;
  if (order?.batchPlantName) score += 12;
  if (order?.status === 'scheduled' || order?.status === 'ordered') score += 15;
  if ((project.qcRecords?.length ?? 0) > 0) score += 8;
  if (project.laborEstimates?.length) score += 5;
  const mix = getMixDesignWorkflowContext(project);
  if (mix.totalPlacements > 0) {
    score += Math.round((mix.approvedCount / mix.totalPlacements) * 12);
  }
  score -= issueCount * 6;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function resolveProjectWorkflow(
  project: Project,
  options?: {
    hasProposalDraft?: boolean;
    proposalStatus?: ProposalStatus;
    windRisk?: OpsRiskLevel;
    heatRisk?: OpsRiskLevel;
    readinessScore?: number;
    now?: Date;
  },
): ProjectWorkflowMeta {
  const order = project.placementOrder;
  const mixDesign = getMixDesignWorkflowContext(project);
  const readinessScore = options?.readinessScore ?? 0;
  const wind = options?.windRisk ?? 'low';
  const heat = options?.heatRisk ?? 'low';
  const inferred = inferStage(
    project,
    order,
    options?.hasProposalDraft ?? false,
    options?.proposalStatus,
    mixDesign,
    options?.now,
  );
  const manual = order?.lifecycleStage as ProjectWorkflowStage | undefined;
  const stage =
    manual && manual in PROJECT_WORKFLOW_LABELS
      ? normalizeWorkflowStageForDisplay(manual)
      : normalizeWorkflowStageForDisplay(inferred);
  const readinessIssues = buildReadinessIssues(project, order, {
    wind,
    heat,
  }, mixDesign);
  const healthScore = computeProjectHealthScore(
    project,
    order,
    readinessScore,
    readinessIssues.length,
  );

  return {
    stage,
    stageLabel: PROJECT_WORKFLOW_LABELS[stage],
    nextAction: buildNextAction(stage, project.id, mixDesign),
    healthScore,
    readinessIssues,
    mixDesign,
  };
}

export interface ProposalPipelineStats {
  drafts: number;
  sent: number;
  viewed: number;
  accepted: number;
  declined: number;
  pendingRevenue: number;
}

function parseProposalAmount(amount: string): number {
  const n = parseFloat(amount.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function buildProposalPipeline(
  projects: Project[],
  proposalDrafts: Record<string, { proposalData?: ProposalData } | undefined>,
): ProposalPipelineStats {
  let drafts = 0;
  let sent = 0;
  let accepted = 0;
  let pendingRevenue = 0;

  for (const p of projects) {
    const draft = proposalDrafts[p.id]?.proposalData;
    const order = p.placementOrder?.status;
    const volume = projectVolumeYd(p);

    if (draft?.clientName?.trim() && draft.pricing?.length) {
      const total = draft.pricing.reduce(
        (s, row) => s + parseProposalAmount(row.amount),
        0,
      );
      if (order === 'ready_to_call' || order === 'scheduled' || order === 'ordered') {
        accepted += 1;
        pendingRevenue += total;
      } else if (order === 'cancelled') {
        /* declined proxy */
      } else {
        sent += 1;
        pendingRevenue += total;
      }
    } else if (volume > 0 && !order) {
      drafts += 1;
    }
  }

  return {
    drafts,
    sent,
    viewed: 0,
    accepted,
    declined: 0,
    pendingRevenue,
  };
}
