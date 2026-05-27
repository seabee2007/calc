import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import { useProjectStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { useTrackedProposals } from '../hooks/useTrackedProposals';
import { useToolsModalStore } from '../store/toolsModalStore';
import { workflowQuery } from '../utils/workflow';
import { buildOperationsSnapshot } from '../utils/operationsDashboard';
import DashboardHero from '../components/dashboard/DashboardHero';
import FeaturedPlacementConditions from '../components/dashboard/FeaturedPlacementConditions';
import ConcreteDeliveryScheduleCard from '../components/dashboard/ConcreteDeliveryScheduleCard';
import SmartPourAssistant from '../components/dashboard/SmartPourAssistant';
import PourTimelinePanel from '../components/dashboard/PourTimelinePanel';
import ActiveProjectsPanel from '../components/dashboard/ActiveProjectsPanel';
import ProposalPipelineCard from '../components/dashboard/ProposalPipelineCard';
import FinancialSnapshotCard from '../components/dashboard/FinancialSnapshotCard';
import UpcomingPlacementsCard from '../components/dashboard/UpcomingPlacementsCard';
import ProjectHealthCard from '../components/dashboard/ProjectHealthCard';
import QcAlertsCard from '../components/dashboard/QcAlertsCard';
import Button from '../components/ui/Button';

const OPS_SHELL =
  'dark text-white isolation-auto rounded-xl min-h-[200px]';

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
  const totalQcRecords = projects.reduce(
    (s, p) => s + (p.qcRecords?.length ?? 0),
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
        <UpcomingPlacementsCard placements={snapshot.upcomingPlacements} />
        <PourTimelinePanel
          events={snapshot.timeline}
          projectName={primaryPourToday?.name}
          hasPlacementsToday={snapshot.hasPlacementsToday}
          primaryProjectId={primaryPourToday?.id}
        />
        <ActiveProjectsPanel projects={snapshot.projects} compact />
        <ProposalPipelineCard
          pipeline={pipeline}
          pendingRevenue={financial.pendingRevenue}
        />
        <FinancialSnapshotCard financial={financial} />
        <SmartPourAssistant
          readinessScore={snapshot.globalReadiness}
          weatherRisk={snapshot.weatherRisk}
          issues={snapshot.primaryReadinessIssues}
          hasPlacementsToday={snapshot.hasPlacementsToday}
        />
      </section>

      <section className="hidden lg:grid lg:grid-cols-3 gap-5">
        <FeaturedPlacementConditions
          snapshot={snapshot}
          hasPlacementsToday={snapshot.hasPlacementsToday}
        />
        <ConcreteDeliveryScheduleCard
          schedule={snapshot.deliverySchedule}
          hasPlacementsToday={snapshot.hasPlacementsToday}
          primaryProjectId={primaryPourToday?.id}
        />
        <SmartPourAssistant
          readinessScore={snapshot.globalReadiness}
          weatherRisk={snapshot.weatherRisk}
          issues={snapshot.primaryReadinessIssues}
          hasPlacementsToday={snapshot.hasPlacementsToday}
        />
      </section>

      <section className="hidden lg:grid lg:grid-cols-3 gap-5">
        <ProposalPipelineCard
          pipeline={pipeline}
          pendingRevenue={financial.pendingRevenue}
        />
        <FinancialSnapshotCard financial={financial} />
        <UpcomingPlacementsCard placements={snapshot.upcomingPlacements} />
      </section>

      <section className="hidden lg:grid lg:grid-cols-3 gap-5">
        <PourTimelinePanel
          events={snapshot.timeline}
          projectName={primaryPourToday?.name}
          hasPlacementsToday={snapshot.hasPlacementsToday}
          primaryProjectId={primaryPourToday?.id}
        />
        <ProjectHealthCard score={snapshot.globalHealthScore} />
        <QcAlertsCard
          testsDue={snapshot.qcTestsDue}
          totalRecords={totalQcRecords}
        />
      </section>

      <section className="hidden lg:grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ActiveProjectsPanel projects={snapshot.projects} />
        </div>
        <ConcreteDeliveryScheduleCard
          schedule={snapshot.deliverySchedule}
          hasPlacementsToday={snapshot.hasPlacementsToday}
          primaryProjectId={primaryPourToday?.id}
        />
      </section>

      <section className="hidden md:grid md:grid-cols-2 lg:hidden gap-4">
        <FinancialSnapshotCard financial={financial} />
        <ProposalPipelineCard
          pipeline={pipeline}
          pendingRevenue={financial.pendingRevenue}
        />
        <UpcomingPlacementsCard placements={snapshot.upcomingPlacements} />
        <ProjectHealthCard score={snapshot.globalHealthScore} />
      </section>

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
