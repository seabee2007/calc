import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import { useProjectStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { useTrackedProposals } from '../hooks/useTrackedProposals';
import { useToolsModalStore } from '../store/toolsModalStore';
import { workflowQuery } from '../utils/workflow';
import { buildOperationsSnapshot, resolveNextUpcomingPlacement } from '../utils/operationsDashboard';
import {
  buildProjectRiskReview,
  resolveFeaturedRiskProject,
} from '../utils/projectRiskReview';
import DashboardHero from '../components/dashboard/DashboardHero';
import FeaturedPlacementConditions from '../components/dashboard/FeaturedPlacementConditions';
import ConcreteDeliveryScheduleCard from '../components/dashboard/ConcreteDeliveryScheduleCard';
import SmartPourAssistant from '../components/dashboard/SmartPourAssistant';
import ActiveProjectsPanel from '../components/dashboard/ActiveProjectsPanel';
import ProposalPipelineCard from '../components/dashboard/ProposalPipelineCard';
import FinancialSnapshotCard from '../components/dashboard/FinancialSnapshotCard';
import ProjectHealthCard from '../components/dashboard/ProjectHealthCard';
import QcAlertsCard from '../components/dashboard/QcAlertsCard';
import Button from '../components/ui/Button';

const OPS_SHELL =
  'dark text-white isolation-auto rounded-xl min-h-[200px]';

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

function resolveDisplayName(
  user: ReturnType<typeof useAuth>['user'],
): string {
  const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const full = meta?.full_name ?? meta?.name;
  if (typeof full === 'string' && full.trim()) {
    return full.trim().split(/\s+/)[0] ?? 'there';
  }
  const email = user?.email;
  if (email) return email.split('@')[0] ?? 'there';
  return 'there';
}

const OperationsDashboard: React.FC = () => {
  const { projects, loading: projectsLoading } = useProjectStore();
  const { user } = useAuth();
  const { proposals, loading: proposalsLoading } = useTrackedProposals();
  const navigate = useNavigate();
  const openTools = useToolsModalStore((s) => s.open);

  const snapshot = useMemo(
    () => buildOperationsSnapshot(projects, { proposals }),
    [projects, proposals],
  );

  const { pipeline, financial } = snapshot.proposalMetrics;
  const primaryPourToday = snapshot.todayPours[0];
  const nextUpcomingPlacement = resolveNextUpcomingPlacement(
    snapshot.upcomingPlacements,
    snapshot.hasPlacementsToday,
  );
  const featuredRiskProject = useMemo(
    () => resolveFeaturedRiskProject(projects),
    [projects],
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

  const totalQcRecords = projects.reduce(
    (s, p) => s + (((p as any).qcRecords?.length as number | undefined) ?? 0),
    0,
  );

  const loading = projectsLoading || proposalsLoading;

  if (loading) {
    return (
      <div className={`${OPS_SHELL} text-center py-16`}>
        <p className="text-lg text-slate-200">Loading operations…</p>
      </div>
    );
  }

  return (
    <div className={`${OPS_SHELL} space-y-4 sm:space-y-5 pb-24 md:pb-8`}>
      <DashboardHero
        displayName={resolveDisplayName(user)}
        activeProjects={snapshot.activeProjectCount}
        placementsToday={snapshot.todayPourCount}
        proposalsSent={snapshot.proposalsSentCount}
        onStartProject={() => navigate(`/projects${workflowQuery()}`)}
        onQuickQuote={() => navigate(`/proposals${workflowQuery()}`)}
        onTools={openTools}
      />

      <section className="space-y-4 lg:hidden">
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
        />
        <SmartPourAssistant
          projectId={prePlacement.projectId}
          projectName={prePlacement.projectName}
          pourDateLabel={prePlacement.pourDateLabel}
          checks={prePlacement.checks}
          attention={prePlacement.attention}
        />
        <ProjectHealthCard review={projectRiskReview} />
        <QcAlertsCard
          testsDue={snapshot.qcTestsDue}
          totalRecords={totalQcRecords}
        />
        <FinancialSnapshotCard financial={financial} />
        <ActiveProjectsPanel projects={snapshot.projects} compact />
        <ProposalPipelineCard
          pipeline={pipeline}
          pendingRevenue={financial.pendingRevenue}
        />
      </section>

      <div className="hidden lg:block space-y-5">
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
          />
        </section>
        <section className="grid grid-cols-3 gap-5">
          <SmartPourAssistant
            projectId={prePlacement.projectId}
            projectName={prePlacement.projectName}
            pourDateLabel={prePlacement.pourDateLabel}
            checks={prePlacement.checks}
            attention={prePlacement.attention}
          />
          <ProjectHealthCard review={projectRiskReview} />
          <QcAlertsCard
            testsDue={snapshot.qcTestsDue}
            totalRecords={totalQcRecords}
          />
        </section>
        <section>
          <FinancialSnapshotCard financial={financial} />
        </section>
        <section className="grid grid-cols-2 gap-5">
          <ActiveProjectsPanel projects={snapshot.projects} />
          <ProposalPipelineCard
            pipeline={pipeline}
            pendingRevenue={financial.pendingRevenue}
          />
        </section>
      </div>

      {projects.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-600 bg-slate-800/90 p-8 text-center">
          <FolderKanban className="h-10 w-10 mx-auto text-slate-500 mb-3" />
          <p className="font-medium text-slate-200">No active projects</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Start a project to populate placement risk, delivery schedule, and proposal
            pipeline.
          </p>
          <Button onClick={() => navigate(`/projects${workflowQuery()}`)}>
            Start Project
          </Button>
        </div>
      )}
    </div>
  );
};

export default OperationsDashboard;
