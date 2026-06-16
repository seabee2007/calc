import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, FolderKanban, LayoutGrid, RotateCcw } from 'lucide-react';
import { useProjectStore } from '../store';
import { useTrackedProposals } from '../hooks/useTrackedProposals';
import { buildOperationsSnapshot, buildQcDashboardStats, resolveNextUpcomingPlacement } from '../utils/operationsDashboard';
import {
  buildProjectRiskReview,
  resolveFeaturedRiskProject,
} from '../utils/projectRiskReview';
import { isProjectClosedOut } from '../utils/projectWorkflow';
import { type DashboardExtraAction } from '../components/dashboard/DashboardNextActionsCard';
import { buildCrmRevenueMetrics } from '../utils/proposalCrm';
import { fetchChangeOrdersForProjectIds } from '../services/changeOrderService';
import {
  enrichEventsWithProjectNames,
  fetchScheduleEventsInDateRange,
} from '../services/scheduleEventService';
import { buildScheduleDashboardSnapshot } from '../utils/scheduleDashboard';
import { addDays, toIsoDate } from '../utils/scheduleEventUtils';
import type { ChangeOrder } from '../types/changeOrder';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { OPS_SHELL } from '../components/dashboard/opsTheme';
import { PREMIUM_PAGE_MAX_WIDTH, PAGE_GUTTER } from '../theme/appTheme';
import { formatPlacementPourDateTime } from '../utils/placementPourDate';
import type { DashboardCardContext } from '../components/dashboard/layout/dashboardData';
import DashboardGrid from '../components/dashboard/layout/DashboardGrid';
import { useDashboardLayout } from '../components/dashboard/layout/useDashboardLayout';

const OperationsDashboard: React.FC = () => {
  const { isOwner, user } = useAuth();
  const { projects, loadProjects } = useProjectStore();
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [scheduleSnapshot, setScheduleSnapshot] = useState<ReturnType<
    typeof buildScheduleDashboardSnapshot
  > | null>(null);
  const location = useLocation();
  const { proposals, refresh: refreshProposals } = useTrackedProposals();
  const navigate = useNavigate();

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (
      location.pathname === '/' ||
      location.pathname === '/dispatch' ||
      location.pathname === '/qc'
    ) {
      void refreshProposals();
    }
  }, [location.pathname, refreshProposals]);
  const operationalProjects = useMemo(
    () => projects.filter((p) => !isProjectClosedOut(p)),
    [projects],
  );

  useEffect(() => {
    if (!isOwner || !user || operationalProjects.length === 0) {
      setChangeOrders([]);
      return;
    }
    const ids = operationalProjects.map((p) => p.id);
    void fetchChangeOrdersForProjectIds(ids).then(setChangeOrders).catch(() => setChangeOrders([]));
  }, [isOwner, user, operationalProjects]);

  useEffect(() => {
    if (!isOwner || operationalProjects.length === 0) {
      setScheduleSnapshot(null);
      return;
    }
    const ids = operationalProjects.map((p) => p.id);
    const today = toIsoDate(new Date());
    const from = addDays(today, -7);
    const to = addDays(today, 30);
    const names = new Map(operationalProjects.map((p) => [p.id, p.name]));
    void fetchScheduleEventsInDateRange(ids, from, to)
      .then((rows) => enrichEventsWithProjectNames(rows, names))
      .then((events) => buildScheduleDashboardSnapshot(events, today))
      .then(setScheduleSnapshot)
      .catch(() => setScheduleSnapshot(null));
  }, [isOwner, operationalProjects]);

  const allProjectsClosedOut =
    projects.length > 0 && operationalProjects.length === 0;

  const snapshot = useMemo(
    () =>
      buildOperationsSnapshot(operationalProjects, {
        proposals,
        changeOrders,
        allProjectsForQc: projects,
      }),
    [operationalProjects, projects, proposals, changeOrders],
  );

  const qcStats = useMemo(
    () => buildQcDashboardStats(projects, proposals),
    [projects, proposals],
  );

  const { pipeline, financial } = snapshot.proposalMetrics;
  const { financial: coFinancial } = snapshot.changeOrderMetrics;
  const proposalWeightedForecast = financial.weightedForecast - coFinancial.weightedForecast;

  const crmRevenueMetrics = useMemo(
    () => buildCrmRevenueMetrics(proposals, financial.winRate, financial.monthlyRevenue),
    [proposals, financial.winRate, financial.monthlyRevenue],
  );

  const dashboardExtraActions = useMemo((): DashboardExtraAction[] => {
    const actions: DashboardExtraAction[] = [];
    if (qcStats.qcTestsOverdue > 0) {
      actions.push({
        id: 'qc-overdue',
        title: 'Review overdue QC tests',
        detail: `${qcStats.qcTestsOverdue} test(s) overdue`,
        onClick: () => navigate('/'),
      });
    }
    const todayEventCount = scheduleSnapshot?.todayEvents.length ?? 0;
    if (todayEventCount > 0) {
      actions.push({
        id: 'schedule-today',
        title: "Open today's schedule",
        detail: `${todayEventCount} event(s) scheduled today`,
        onClick: () => navigate('/planner/schedule'),
      });
    }
    return actions;
  }, [navigate, qcStats.qcTestsOverdue, scheduleSnapshot?.todayEvents.length]);
  const primaryPourToday = snapshot.todayPours[0];
  const hasAnyConcreteWork =
    snapshot.hasPlacementsToday ||
    snapshot.todayPourCount > 0 ||
    snapshot.upcomingPlacements.length > 0;
  const nextUpcomingPlacement = resolveNextUpcomingPlacement(
    snapshot.upcomingPlacements,
    snapshot.hasPlacementsToday,
  );
  const featuredRiskProject = useMemo(
    () => resolveFeaturedRiskProject(operationalProjects),
    [operationalProjects],
  );

  const projectRiskReview = useMemo(
    () =>
      buildProjectRiskReview(featuredRiskProject, {
        heatRisk: snapshot.heatRisk,
        rainRisk: snapshot.rainRisk,
        windRisk: snapshot.windRisk,
        evaporationRisk: snapshot.evaporationRisk,
        weatherRisk: snapshot.weatherRisk,
      }, proposals),
    [
      featuredRiskProject,
      snapshot.heatRisk,
      snapshot.rainRisk,
      snapshot.windRisk,
      snapshot.evaporationRisk,
      snapshot.weatherRisk,
      proposals,
    ],
  );

  const selectedPrePlacementProject = featuredRiskProject;

  const prePlacement = useMemo(() => {
    if (!selectedPrePlacementProject) {
      return {
        projectId: undefined,
        projectName: undefined,
        pourDateLabel: undefined,
        checks: {
          mixSelected: false,
          volumeCalculated: false,
          weatherAcceptable: false,
          pourDateScheduled: false,
          batchPlantAssigned: false,
          truckSpacingEntered: false,
          curingMethodSelected: false,
          callSheetReady: false,
        },
        attention: [] as string[],
      };
    }

    const project = selectedPrePlacementProject as any;
    const order = project.placementOrder as
      | { batchPlantName?: string; batchPlantAddress?: string; summaryLines?: string[]; callSheet?: Record<string, unknown> }
      | undefined;
    const pourDateLabel = formatPlacementPourDateTime(project.pourDate as string | undefined);
    const volumeYd = (project.calculations ?? []).reduce(
      (s: number, c: any) => s + ((c.result?.volume as number) ?? 0),
      0,
    );

    const mixSelected = Boolean(
      order?.callSheet?.mixDesignNumber ||
        order?.callSheet?.waterCementRatio ||
        order?.callSheet?.mixDesignNumber === '',
    );
    const volumeCalculated = volumeYd > 0;
    const weatherAcceptable = snapshot.weatherRisk !== 'high';
    const pourDateScheduled = Boolean(project.pourDate);
    const batchPlantAssigned = Boolean(order?.batchPlantName?.trim() || order?.batchPlantAddress?.trim());
    const truckSpacingEntered = Boolean(
      order?.summaryLines?.some((l: string) => /Truck Spacing/i.test(l)),
    );
    const curingMethodSelected = Boolean(project.mixProfile);
    const callSheetReady = Boolean(order?.summaryLines?.length);

    const attention: string[] = [];
    if (!batchPlantAssigned) attention.push('Batch plant not assigned');
    if (!truckSpacingEntered) attention.push('Truck spacing missing');
    if (!curingMethodSelected) attention.push('No curing method selected');
    if (!mixSelected) attention.push('Mix not selected');
    if (!volumeCalculated) attention.push('Volume not calculated');
    if (!callSheetReady) attention.push('Call sheet incomplete');

    return {
      projectId: project.id as string,
      projectName: project.name as string,
      pourDateLabel: pourDateLabel ?? undefined,
      checks: {
        mixSelected,
        volumeCalculated,
        weatherAcceptable,
        pourDateScheduled,
        batchPlantAssigned,
        truckSpacingEntered,
        curingMethodSelected,
        callSheetReady,
      },
      attention: attention.slice(0, 6),
    };
  }, [selectedPrePlacementProject, snapshot.weatherRisk]);

  const totalQcRecords = qcStats.totalRecords;

  const fieldNotesProject = useMemo(() => {
    const match = snapshot.projects.find((p) => p.nextAction.kind === 'scroll_to_qc');
    return match ? { id: match.id, name: match.name } : null;
  }, [snapshot.projects]);

  const {
    orderedItems,
    customizing,
    setCustomizing,
    applyPositions,
    setCardWidth,
    setCardHeight,
    resetLayout,
  } = useDashboardLayout();

  const cardContext: DashboardCardContext = {
    isOwner: Boolean(isOwner),
    projects,
    proposals,
    snapshot,
    qcStats,
    scheduleSnapshot,
    projectRiskReview,
    crmRevenueMetrics,
    prePlacement,
    financial,
    pipeline,
    proposalWeightedForecast,
    totalQcRecords,
    hasAnyConcreteWork,
    allProjectsClosedOut,
    nextUpcomingPlacement,
    primaryPourTodayId: primaryPourToday?.id,
    fieldNotesProject,
    dashboardExtraActions,
    onStartProject: () => navigate('/projects', { state: { openCreate: true } }),
    onQuickQuote: () => navigate('/proposal-generator'),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`${OPS_SHELL} ${PREMIUM_PAGE_MAX_WIDTH} ${PAGE_GUTTER} space-y-4 sm:space-y-5 pb-24 md:pb-8`}
    >
      <div
        className="flex flex-wrap items-center justify-end gap-2"
        data-testid="dashboard-customize-controls"
      >
        {customizing ? (
          <Button
            variant="outline"
            size="sm"
            icon={<RotateCcw size={16} />}
            onClick={resetLayout}
            data-testid="dashboard-reset-layout"
          >
            Reset layout
          </Button>
        ) : null}
        <Button
          variant={customizing ? 'accent' : 'outline'}
          size="sm"
          icon={customizing ? <Check size={16} /> : <LayoutGrid size={16} />}
          onClick={() => setCustomizing(!customizing)}
          data-testid="dashboard-customize-toggle"
        >
          {customizing ? 'Done' : 'Customize dashboard'}
        </Button>
      </div>

      <DashboardGrid
        ctx={cardContext}
        items={orderedItems}
        customizing={customizing}
        onApplyPositions={applyPositions}
        onWidthChange={setCardWidth}
        onMeasureHeight={setCardHeight}
      />

      {projects.length === 0 && (
        <EmptyState
          icon={<FolderKanban className="h-10 w-10" />}
          title="No active projects"
          description="Start a project to populate placement risk, delivery schedule, and proposal pipeline."
          action={{
            label: 'Start Project',
            onClick: () => navigate('/projects', { state: { openCreate: true } }),
          }}
        />
      )}
    </motion.div>
  );
};

export default OperationsDashboard;
