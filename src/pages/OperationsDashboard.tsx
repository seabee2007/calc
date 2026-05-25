import React, { useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Calendar,
  CloudSun,
  ClipboardCheck,
  FolderKanban,
  Gauge,
  Truck,
  Layers,
  Calculator,
  ArrowRight,
} from 'lucide-react';
import { useProjectStore } from '../store';
import { buildOperationsSnapshot } from '../utils/operationsDashboard';
import OpsStatCard from '../components/dashboard/OpsStatCard';
import PourTimelinePanel from '../components/dashboard/PourTimelinePanel';
import PlacementRiskPanel from '../components/dashboard/PlacementRiskPanel';
import ActiveProjectsPanel from '../components/dashboard/ActiveProjectsPanel';
import DispatchTrackerPanel from '../components/dashboard/DispatchTrackerPanel';
import QcOpsPanel from '../components/dashboard/QcOpsPanel';
import SmartPourAssistant from '../components/dashboard/SmartPourAssistant';
import Button from '../components/ui/Button';

type DashboardTab = 'overview' | 'dispatch' | 'qc';

interface OperationsDashboardProps {
  initialTab?: DashboardTab;
}

const OperationsDashboard: React.FC<OperationsDashboardProps> = ({
  initialTab = 'overview',
}) => {
  const { projects, loading } = useProjectStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromPath: DashboardTab | null =
    location.pathname === '/dispatch'
      ? 'dispatch'
      : location.pathname === '/qc'
        ? 'qc'
        : null;
  const tab =
    tabFromPath ??
    ((searchParams.get('tab') as DashboardTab) || initialTab);

  const snapshot = useMemo(
    () => buildOperationsSnapshot(projects),
    [projects],
  );

  const primaryPourToday = snapshot.todayPours[0];
  const hasPlacementsToday = snapshot.hasPlacementsToday;
  const totalQcRecords = projects.reduce(
    (s, p) => s + (p.qcRecords?.length ?? 0),
    0,
  );
  const projectsWithQc = projects.filter((p) => (p.qcRecords?.length ?? 0) > 0).length;

  const setTab = (t: DashboardTab) => {
    setSearchParams(t === 'overview' ? {} : { tab: t });
  };

  if (loading) {
    return (
      <div className="text-center py-16 text-white">
        <p className="text-lg">Loading operations…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      <header className="rounded-xl border border-slate-700/80 bg-slate-950/90 p-6 text-white shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400 mb-2">
          
                  </p>
        <h1 className="text-2xl sm:text-3xl font-bold">
          Your Dashboard
        </h1>
        <p className="text-slate-400 mt-2 max-w-2xl text-sm sm:text-base">
          View Upcoming tasks
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button size="sm" variant="outline" className="border-slate-600 text-white hover:bg-slate-800" onClick={() => navigate('/pour-planner')}>
            Placement planner
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/calculator')}
            className="border-slate-600 text-white hover:bg-slate-800">
            Calculator
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['overview', 'Overview'],
            ['dispatch', 'Dispatch'],
            ['qc', 'QC'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Today's operations — always visible */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-3">
          Today&apos;s operations
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <OpsStatCard
            label="Today's placements"
            value={String(snapshot.todayPourCount)}
            sub={
              snapshot.upcomingPourCount > 0
                ? `+${snapshot.upcomingPourCount} upcoming`
                : undefined
            }
            icon={<Calendar className="h-6 w-6 text-cyan-400" />}
            accent="cyan"
          />
          <OpsStatCard
            label="Total concrete"
            value={
              snapshot.totalCyScheduled > 0
                ? `${snapshot.totalCyScheduled.toFixed(0)} CY`
                : '—'
            }
            icon={<Layers className="h-6 w-6 text-blue-400" />}
            accent="blue"
          />
          <OpsStatCard
            label="Weather risk"
            value={snapshot.weatherRiskLabel}
            icon={<CloudSun className="h-6 w-6 text-amber-400" />}
            accent="amber"
          />
          <OpsStatCard
            label="Next truck ETA"
            value={snapshot.nextTruckEtaLabel}
            icon={<Truck className="h-6 w-6 text-blue-400" />}
            accent="blue"
          />
          <OpsStatCard
            label="QC alerts"
            value={String(snapshot.qcTestsDue)}
            icon={<ClipboardCheck className="h-6 w-6 text-emerald-400" />}
            accent="green"
          />
          <OpsStatCard
            label="Pump today"
            value={snapshot.pumpScheduledToday ? 'YES' : 'NO'}
            icon={<Gauge className="h-6 w-6 text-violet-400" />}
            accent="slate"
          />
        </div>
      </section>

      {tab === 'overview' && (
        <>
          <SmartPourAssistant
            tips={snapshot.smartTips}
            readinessScore={snapshot.globalReadiness}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PourTimelinePanel
              events={snapshot.timeline}
              projectName={primaryPourToday?.name}
              hasPlacementsToday={hasPlacementsToday}
            />
            <PlacementRiskPanel snapshot={snapshot} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActiveProjectsPanel projects={snapshot.projects} />
            <DispatchTrackerPanel
              trucks={snapshot.dispatchTrucks}
              batchPlantName={primaryPourToday?.batchPlantName}
              deliveryLabel={snapshot.deliveryStatusLabel}
              hasPlacementsToday={hasPlacementsToday}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <QuickLink
              title="Placement planner"
              desc="Weather, risk, call sheets"
              onClick={() => navigate('/pour-planner')}
            />
            <QuickLink
              title="Projects"
              desc="QC, tickets, calcs"
              onClick={() => navigate('/projects')}
            />
            <QuickLink
              title="Calculators"
              desc="Volume, rebar, mix"
              onClick={() => navigate('/calculator')}
            />
            <QuickLink
              title="Proposals"
              desc="Estimates & bids"
              onClick={() => navigate('/proposals')}
            />
          </div>
        </>
      )}

      {tab === 'dispatch' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DispatchTrackerPanel
            trucks={snapshot.dispatchTrucks}
            batchPlantName={primaryPourToday?.batchPlantName}
            deliveryLabel={snapshot.deliveryStatusLabel}
            hasPlacementsToday={hasPlacementsToday}
          />
          <PourTimelinePanel
            events={snapshot.timeline}
            projectName={primaryPourToday?.name}
            hasPlacementsToday={hasPlacementsToday}
          />
          <div className="lg:col-span-2">
            <ActiveProjectsPanel
              projects={snapshot.projects.filter(
                (p) => p.orderStatus || p.volumeYd > 0,
              )}
            />
          </div>
        </div>
      )}

      {tab === 'qc' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QcOpsPanel
            testsDue={snapshot.qcTestsDue}
            totalRecords={totalQcRecords}
            projectsWithQc={projectsWithQc}
          />
          <PlacementRiskPanel snapshot={snapshot} />
          <div className="lg:col-span-2">
            <ActiveProjectsPanel projects={snapshot.projects} />
          </div>
        </div>
      )}

      {projects.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-600 p-8 text-center text-slate-300">
          <FolderKanban className="h-10 w-10 mx-auto text-slate-500 mb-3" />
          <p className="font-medium">No active projects</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Create a project, run the placement planner, and save your order to populate
            this dashboard.
          </p>
          <Button onClick={() => navigate('/projects')}>Go to projects</Button>
        </div>
      )}
    </div>
  );
};

function QuickLink({
  title,
  desc,
  onClick,
}: {
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-4 rounded-xl bg-slate-900/90 border border-slate-700 hover:border-cyan-600/50 transition-colors group"
    >
      <div className="flex items-center justify-between">
        <Calculator className="h-5 w-5 text-cyan-500" />
        <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-400" />
      </div>
      <p className="font-semibold text-white mt-2 text-sm">{title}</p>
      <p className="text-xs text-slate-500">{desc}</p>
    </button>
  );
}

export default OperationsDashboard;
