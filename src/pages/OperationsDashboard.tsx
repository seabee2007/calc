import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { FolderKanban, LayoutGrid } from 'lucide-react';
import { useProjectStore } from '../store';
import { useTrackedProposals } from '../hooks/useTrackedProposals';
import { buildOperationsSnapshot, buildQcDashboardStats, resolveNextUpcomingPlacement } from '../utils/operationsDashboard';
import {
  buildProjectRiskReview,
  resolveFeaturedRiskProject,
} from '../utils/projectRiskReview';
import { isProjectClosedOut } from '../utils/projectWorkflow';

const QUEUE_EMPTY_MESSAGE =
  'No projects scheduled — closed jobs are out of the queue.';
import DashboardHero from '../components/dashboard/DashboardHero';
import FeaturedPlacementConditions from '../components/dashboard/FeaturedPlacementConditions';
import ConcreteDeliveryScheduleCard from '../components/dashboard/ConcreteDeliveryScheduleCard';
import SmartPourAssistant from '../components/dashboard/SmartPourAssistant';
import ActiveProjectsPanel from '../components/dashboard/ActiveProjectsPanel';
import ProposalPipelineCard from '../components/dashboard/ProposalPipelineCard';
import FinancialSnapshotCard from '../components/dashboard/FinancialSnapshotCard';
import ProjectHealthCard from '../components/dashboard/ProjectHealthCard';
import QcAlertsCard from '../components/dashboard/QcAlertsCard';
import OwnerFieldSummaryCards from '../components/owner/OwnerFieldSummaryCards';
import OwnerActivityFeed from '../components/owner/OwnerActivityFeed';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import {
  OPS_EMPTY_STATE,
  OPS_MUTED,
  OPS_SHELL,
  OPS_STRIP,
} from '../components/dashboard/opsTheme';

function parseIsoMaybe(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatPourDateLabel(d: Date): string {
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  const monthDay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${weekday}, ${monthDay} • ${time}`;
}

const OperationsDashboard: React.FC = () => {
  const { isOwner } = useAuth();
  const { projects, loadProjects } = useProjectStore();
  const location = useLocation();
  const { proposals, refresh: refreshProposals } = useTrackedProposals();
  const navigate = useNavigate();

  useEffect(() => {
    if (projects.length === 0) {
      void loadProjects();
    }
  }, [projects.length, loadProjects]);

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

  const allProjectsClosedOut =
    projects.length > 0 && operationalProjects.length === 0;

  const snapshot = useMemo(
    () =>
      buildOperationsSnapshot(operationalProjects, {
        proposals,
        allProjectsForQc: projects,
      }),
    [operationalProjects, projects, proposals],
  );

  const qcStats = useMemo(
    () => buildQcDashboardStats(projects, proposals),
    [projects, proposals],
  );

  const { pipeline, pipelineRevenue, financial } = snapshot.proposalMetrics;
  const primaryPourToday = snapshot.todayPours[0];
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
    const pourDate = parseIsoMaybe(project.pourDate as string | undefined);
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
      pourDateLabel: pourDate ? formatPourDateLabel(pourDate) : undefined,
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`${OPS_SHELL} space-y-4 sm:space-y-5 pb-24 md:pb-8`}
    >
      <DashboardHero
        activeProjects={snapshot.activeProjectCount}
        placementsToday={snapshot.todayPourCount}
        proposalsSent={snapshot.proposalsSentCount}
        onStartProject={() => navigate('/projects', { state: { openCreate: true } })}
        onQuickQuote={() => navigate('/proposal-generator')}
      />

      {isOwner && (
        <section className="space-y-4">
          <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${OPS_STRIP}`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
                Field Planner
              </p>
              <p className={`mt-1 text-sm ${OPS_MUTED}`}>
                Manage tasks, RFIs, and field updates across all active projects.
              </p>
            </div>
            <Button
              size="sm"
              className="!bg-cyan-600 !text-white hover:!bg-cyan-500 shrink-0"
              icon={<LayoutGrid className="h-4 w-4" />}
              onClick={() => navigate('/planner/hub')}
            >
              Open Planner Hub
            </Button>
          </div>
          <OwnerFieldSummaryCards />
          <OwnerActivityFeed limit={8} />
        </section>
      )}

      <section className="space-y-4 lg:hidden">
        <FinancialSnapshotCard financial={financial} />
        <ActiveProjectsPanel projects={snapshot.projects} compact />
        <ProposalPipelineCard
          pipeline={pipeline}
          pendingRevenue={financial.pendingRevenue}
          weightedForecast={financial.weightedForecast}
          pipelineRevenue={pipelineRevenue}
        />
        <FeaturedPlacementConditions
          snapshot={snapshot}
          hasPlacementsToday={snapshot.hasPlacementsToday}
        />
        <ConcreteDeliveryScheduleCard
          schedule={snapshot.deliverySchedule}
          timeline={snapshot.timeline}
          hasPlacementsToday={snapshot.hasPlacementsToday}
          nextPlacement={nextUpcomingPlacement}
          primaryProjectId={primaryPourToday?.id}
          emptyMessage={allProjectsClosedOut ? QUEUE_EMPTY_MESSAGE : undefined}
        />
        <SmartPourAssistant
          projectId={prePlacement.projectId}
          projectName={prePlacement.projectName}
          pourDateLabel={prePlacement.pourDateLabel}
          checks={prePlacement.checks}
          attention={prePlacement.attention}
          emptyMessage={allProjectsClosedOut ? QUEUE_EMPTY_MESSAGE : undefined}
        />
        <ProjectHealthCard
          review={projectRiskReview}
          emptyMessage={allProjectsClosedOut ? QUEUE_EMPTY_MESSAGE : undefined}
        />
        <QcAlertsCard
          testsDue={qcStats.qcTestsDue}
          testsOverdue={qcStats.qcTestsOverdue}
          totalRecords={totalQcRecords}
        />
      </section>

      <div className="hidden lg:block space-y-5">
        <section>
          <FinancialSnapshotCard financial={financial} />
        </section>
        <section className="grid grid-cols-2 gap-5">
          <ActiveProjectsPanel projects={snapshot.projects} />
          <ProposalPipelineCard
            pipeline={pipeline}
            pendingRevenue={financial.pendingRevenue}
            weightedForecast={financial.weightedForecast}
            pipelineRevenue={pipelineRevenue}
          />
        </section>
        <section className="grid grid-cols-2 gap-5">
          <FeaturedPlacementConditions
            snapshot={snapshot}
            hasPlacementsToday={snapshot.hasPlacementsToday}
          />
          <ConcreteDeliveryScheduleCard
            schedule={snapshot.deliverySchedule}
            timeline={snapshot.timeline}
            hasPlacementsToday={snapshot.hasPlacementsToday}
            nextPlacement={nextUpcomingPlacement}
            primaryProjectId={primaryPourToday?.id}
            emptyMessage={allProjectsClosedOut ? QUEUE_EMPTY_MESSAGE : undefined}
          />
        </section>
        <section className="grid grid-cols-3 gap-5">
          <SmartPourAssistant
            projectId={prePlacement.projectId}
            projectName={prePlacement.projectName}
            pourDateLabel={prePlacement.pourDateLabel}
            checks={prePlacement.checks}
            attention={prePlacement.attention}
            emptyMessage={allProjectsClosedOut ? QUEUE_EMPTY_MESSAGE : undefined}
          />
          <ProjectHealthCard
            review={projectRiskReview}
            emptyMessage={allProjectsClosedOut ? QUEUE_EMPTY_MESSAGE : undefined}
          />
          <QcAlertsCard
            testsDue={qcStats.qcTestsDue}
            testsOverdue={qcStats.qcTestsOverdue}
            totalRecords={totalQcRecords}
          />
        </section>
      </div>

      {projects.length === 0 && (
        <div className={OPS_EMPTY_STATE}>
          <FolderKanban className="h-10 w-10 mx-auto text-slate-500 mb-3" />
          <p className="font-medium text-gray-900 dark:text-slate-200">No active projects</p>
          <p className="text-sm text-slate-600 dark:text-slate-500 mt-1 mb-4">
            Start a project to populate placement risk, delivery schedule, and proposal
            pipeline.
          </p>
          <Button
            onClick={() => navigate('/projects', { state: { openCreate: true } })}
          >
            Start Project
          </Button>
        </div>
      )}
    </motion.div>
  );
};

export default OperationsDashboard;
