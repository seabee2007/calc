import type { Project } from '../types';
import type { PlacementOrder, PlacementOrderStatus } from '../types/placementOrder';
import type { ProposalData } from '../types/proposal';
import type { ProposalStatus } from '../types/proposalTracking';
import type { OpsRiskLevel } from './operationsDashboard';

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
  | 'closed';

export const PROJECT_WORKFLOW_LABELS: Record<ProjectWorkflowStage, string> = {
  created: 'Created',
  estimating: 'Estimating',
  proposal_sent: 'Proposal Sent',
  accepted: 'Accepted',
  mix_approved: 'Mix Approved',
  placement_scheduled: 'Placement Scheduled',
  ordered: 'Ordered',
  placed: 'Placed',
  closed: 'Closed',
};

export interface ProjectNextAction {
  label: string;
  description?: string;
  path: string;
  search?: string;
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
  now = new Date(),
): ProjectWorkflowStage {
  const pourDate = parsePourDate(project.pourDate);
  const volume = projectVolumeYd(project);
  const status = order?.status ?? null;

  if (status === 'completed' || status === 'cancelled') return 'closed';

  if (pourDate && pourDate < now && !isSameDay(pourDate, now)) {
    if (status === 'scheduled' || status === 'ordered') return 'placed';
  }

  if (status === 'scheduled' || status === 'ordered') {
    if (pourDate && isSameDay(pourDate, now)) return 'ordered';
    return 'placement_scheduled';
  }

  if (status === 'ready_to_call') return 'mix_approved';

  if (proposalStatus === 'scheduled' || proposalStatus === 'deposit_paid') {
    return proposalStatus === 'scheduled' ? 'placement_scheduled' : 'accepted';
  }
  if (proposalStatus === 'accepted') return 'accepted';
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

function buildNextAction(
  stage: ProjectWorkflowStage,
  projectId: string,
): ProjectNextAction {
  const q = `?workflow=1&project=${projectId}`;
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
        path: '/proposals',
        search: q,
      };
    case 'proposal_sent':
      return {
        label: 'Follow Up Proposal',
        path: '/proposals',
        search: q,
      };
    case 'accepted':
    case 'mix_approved':
      return {
        label: 'Approve Mix Design',
        path: '/mix-design-advisor',
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
        label: 'Log QC Records',
        path: '/projects',
        search: `?project=${projectId}`,
      };
    case 'closed':
      return {
        label: 'View Project',
        path: '/projects',
        search: `?project=${projectId}`,
      };
    default:
      return { label: 'Open Project', path: '/projects' };
  }
}

export function buildReadinessIssues(
  project: Project,
  order: PlacementOrder | undefined,
  risks: { wind: OpsRiskLevel; heat: OpsRiskLevel },
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const q = `?workflow=1&project=${project.id}`;

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

  return issues.slice(0, 5);
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
  const readinessScore = options?.readinessScore ?? 0;
  const wind = options?.windRisk ?? 'low';
  const heat = options?.heatRisk ?? 'low';
  const stage = inferStage(
    project,
    order,
    options?.hasProposalDraft ?? false,
    options?.proposalStatus,
    options?.now,
  );
  const readinessIssues = buildReadinessIssues(project, order, {
    wind,
    heat,
  });
  const healthScore = computeProjectHealthScore(
    project,
    order,
    readinessScore,
    readinessIssues.length,
  );

  return {
    stage,
    stageLabel: PROJECT_WORKFLOW_LABELS[stage],
    nextAction: buildNextAction(stage, project.id),
    healthScore,
    readinessIssues,
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
