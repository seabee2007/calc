import type { ReactNode } from 'react';
import DashboardHero from '../DashboardHero';
import ScheduleOperationsSection from '../schedule/ScheduleOperationsSection';
import OwnerActivityFeed from '../../owner/OwnerActivityFeed';
import BusinessSnapshotCard from '../BusinessSnapshotCard';
import ActiveProjectsPanel from '../ActiveProjectsPanel';
import ProposalPipelineCard from '../ProposalPipelineCard';
import DashboardNextActionsCard from '../DashboardNextActionsCard';
import ProjectControlsCard from '../ProjectControlsCard';
import ProjectHealthCard from '../ProjectHealthCard';
import FeaturedPlacementConditions from '../FeaturedPlacementConditions';
import SmartPourAssistant from '../SmartPourAssistant';
import ConcreteDeliveryScheduleCard from '../ConcreteDeliveryScheduleCard';
import {
  DASHBOARD_CARD_META,
  type DashboardCardId,
  type DashboardCardMeta,
} from '../../../lib/dashboardLayout';
import { QUEUE_EMPTY_MESSAGE, type DashboardCardContext } from './dashboardData';

export interface DashboardCardRenderOptions {
  /** Extra class names applied to the card root where the card supports it. */
  className?: string;
}

export interface DashboardCardDefinition extends DashboardCardMeta {
  /** Whether this card should render for the current user/data context. */
  isVisible: (ctx: DashboardCardContext) => boolean;
  /** Render the card's content from the shared dashboard context. */
  render: (ctx: DashboardCardContext, options?: DashboardCardRenderOptions) => ReactNode;
}

const ownerOnly = (ctx: DashboardCardContext) => ctx.isOwner;
const concreteOnly = (ctx: DashboardCardContext) => ctx.hasAnyConcreteWork;
const alwaysVisible = () => true;

const queueEmptyMessage = (ctx: DashboardCardContext): string | undefined =>
  ctx.allProjectsClosedOut ? QUEUE_EMPTY_MESSAGE : undefined;

type DashboardCardBehavior = Pick<DashboardCardDefinition, 'isVisible' | 'render'>;

const CARD_BEHAVIOR: Record<DashboardCardId, DashboardCardBehavior> = {
  todaysOperations: {
    isVisible: alwaysVisible,
    render: (ctx) => (
      <DashboardHero
        activeProjects={ctx.snapshot.activeProjectCount}
        placementsToday={ctx.hasAnyConcreteWork ? ctx.snapshot.todayPourCount : undefined}
        proposalsSent={ctx.snapshot.proposalsSentCount}
        onStartProject={ctx.onStartProject}
        onQuickQuote={ctx.onQuickQuote}
      />
    ),
  },
  operationsSchedule: {
    isVisible: ownerOnly,
    render: (ctx) => <ScheduleOperationsSection snapshot={ctx.scheduleSnapshot} />,
  },
  fieldActivity: {
    isVisible: ownerOnly,
    render: () => <OwnerActivityFeed />,
  },
  businessSnapshot: {
    isVisible: alwaysVisible,
    render: (ctx) => <BusinessSnapshotCard financial={ctx.financial} />,
  },
  activeProjects: {
    isVisible: alwaysVisible,
    render: (ctx) => <ActiveProjectsPanel projects={ctx.snapshot.projects} />,
  },
  proposalPipeline: {
    isVisible: alwaysVisible,
    render: (ctx) => (
      <ProposalPipelineCard
        pipeline={ctx.pipeline}
        pipelineValue={ctx.crmRevenueMetrics.pipelineValue}
        weightedForecast={ctx.proposalWeightedForecast}
        proposals={ctx.proposals}
        winRate={ctx.financial.winRate}
        wonThisMonth={ctx.financial.monthlyRevenue}
      />
    ),
  },
  nextActions: {
    isVisible: ownerOnly,
    render: (ctx, options) => (
      <DashboardNextActionsCard
        className={options?.className}
        proposals={ctx.proposals}
        extraActions={ctx.dashboardExtraActions}
        maxItems={5}
      />
    ),
  },
  projectControls: {
    isVisible: alwaysVisible,
    render: (ctx) => (
      <ProjectControlsCard
        testsDue={ctx.qcStats.qcTestsDue}
        testsOverdue={ctx.qcStats.qcTestsOverdue}
        totalRecords={ctx.totalQcRecords}
        deadlineCount={ctx.isOwner ? ctx.scheduleSnapshot?.upcomingDeadlines.length : undefined}
        projects={ctx.projects}
        proposals={ctx.proposals}
        fieldNotesProject={ctx.fieldNotesProject}
      />
    ),
  },
  projectRiskReview: {
    isVisible: alwaysVisible,
    render: (ctx) => (
      <ProjectHealthCard
        review={ctx.projectRiskReview}
        emptyMessage={queueEmptyMessage(ctx)}
      />
    ),
  },
  placementConditions: {
    isVisible: concreteOnly,
    render: (ctx) => (
      <FeaturedPlacementConditions
        snapshot={ctx.snapshot}
        hasPlacementsToday={ctx.snapshot.hasPlacementsToday}
      />
    ),
  },
  smartPourAssistant: {
    isVisible: concreteOnly,
    render: (ctx) => (
      <SmartPourAssistant
        projectId={ctx.prePlacement.projectId}
        projectName={ctx.prePlacement.projectName}
        pourDateLabel={ctx.prePlacement.pourDateLabel}
        checks={ctx.prePlacement.checks}
        attention={ctx.prePlacement.attention}
        emptyMessage={queueEmptyMessage(ctx)}
      />
    ),
  },
  concreteDeliverySchedule: {
    isVisible: concreteOnly,
    render: (ctx) => (
      <ConcreteDeliveryScheduleCard
        schedule={ctx.snapshot.deliverySchedule}
        timeline={ctx.snapshot.timeline}
        hasPlacementsToday={ctx.snapshot.hasPlacementsToday}
        nextPlacement={ctx.nextUpcomingPlacement}
        primaryProjectId={ctx.primaryPourTodayId}
        emptyMessage={queueEmptyMessage(ctx)}
      />
    ),
  },
};

function buildRegistry(): Record<DashboardCardId, DashboardCardDefinition> {
  const entries = (Object.keys(DASHBOARD_CARD_META) as DashboardCardId[]).map((id) => {
    const definition: DashboardCardDefinition = {
      ...DASHBOARD_CARD_META[id],
      ...CARD_BEHAVIOR[id],
    };
    return [id, definition] as const;
  });
  return Object.fromEntries(entries) as Record<DashboardCardId, DashboardCardDefinition>;
}

export const DASHBOARD_CARD_REGISTRY = buildRegistry();
