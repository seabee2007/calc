import type {
  buildOperationsSnapshot,
  buildQcDashboardStats,
  resolveNextUpcomingPlacement,
} from '../../../utils/operationsDashboard';
import type { buildScheduleDashboardSnapshot } from '../../../utils/scheduleDashboard';
import type { buildProjectRiskReview } from '../../../utils/projectRiskReview';
import type { buildCrmRevenueMetrics } from '../../../utils/proposalCrm';
import type { Project } from '../../../types';
import type { TrackedProposalRow } from '../../../types/proposalTracking';
import type { DashboardExtraAction } from '../DashboardNextActionsCard';

/** Shown when the operational queue is empty (e.g. all projects closed). */
export const QUEUE_EMPTY_MESSAGE =
  'No projects scheduled — closed jobs are out of the queue.';

type OperationsSnapshot = ReturnType<typeof buildOperationsSnapshot>;
type QcDashboardStats = ReturnType<typeof buildQcDashboardStats>;
type ScheduleSnapshot = ReturnType<typeof buildScheduleDashboardSnapshot>;
type ProjectRiskReview = ReturnType<typeof buildProjectRiskReview>;
type CrmRevenueMetrics = ReturnType<typeof buildCrmRevenueMetrics>;
type NextUpcomingPlacement = ReturnType<typeof resolveNextUpcomingPlacement>;

export interface DashboardPrePlacementState {
  projectId?: string;
  projectName?: string;
  pourDateLabel?: string;
  checks: {
    mixSelected: boolean;
    volumeCalculated: boolean;
    weatherAcceptable: boolean;
    pourDateScheduled: boolean;
    batchPlantAssigned: boolean;
    truckSpacingEntered: boolean;
    curingMethodSelected: boolean;
    callSheetReady: boolean;
  };
  attention: string[];
}

/**
 * Everything a dashboard card needs to render. `OperationsDashboard` computes
 * this once (identical to today's logic) and hands it to each registry card's
 * `render(ctx)` — no card recomputes dashboard data.
 */
export interface DashboardCardContext {
  isOwner: boolean;
  projects: Project[];
  proposals: TrackedProposalRow[];
  snapshot: OperationsSnapshot;
  qcStats: QcDashboardStats;
  scheduleSnapshot: ScheduleSnapshot | null;
  projectRiskReview: ProjectRiskReview;
  crmRevenueMetrics: CrmRevenueMetrics;
  prePlacement: DashboardPrePlacementState;
  financial: OperationsSnapshot['proposalMetrics']['financial'];
  pipeline: OperationsSnapshot['proposalMetrics']['pipeline'];
  proposalWeightedForecast: number;
  totalQcRecords: number;
  hasAnyConcreteWork: boolean;
  allProjectsClosedOut: boolean;
  nextUpcomingPlacement: NextUpcomingPlacement;
  primaryPourTodayId?: string;
  fieldNotesProject: { id: string; name: string } | null;
  dashboardExtraActions: DashboardExtraAction[];
  onStartProject: () => void;
  onQuickQuote: () => void;
}
