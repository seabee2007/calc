import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { formatEstimateCurrency, formatEstimateNumber } from '../../estimating/ui/estimateFormatters';
import type { ResourceHistogramDay } from '../../estimating/scheduling/cpmTypes';
import {
  PLANNER_FORM_PANEL,
  PLANNER_LINK,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
  TEXT_FOREGROUND,
} from '../../estimating/ui/estimateWorkspaceTheme';
import {
  projectChartsChangeOrdersHref,
  projectChartsCostHealthHref,
  projectChartsLaborDemandHref,
  projectChartsQcRiskHref,
  projectChartsRfiHref,
  projectChartsScheduleReadinessHref,
  projectChartsScopeHref,
} from './projectChartLinks';
import type { ProjectChartsSnapshot } from './projectChartsTypes';

function ProjectChartCard({
  title,
  description,
  href,
  children,
  testId,
}: {
  title: string;
  description: string;
  href: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <section className={`${PLANNER_FORM_PANEL} flex h-full flex-col`} data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={PLANNER_SECTION_TITLE}>{title}</h3>
          <p className={`mt-1 text-sm ${PLANNER_MUTED}`}>{description}</p>
        </div>
        <Link to={href} className={PLANNER_LINK}>
          Open <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-[140px] items-center justify-center rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center dark:border-slate-600"
      data-testid="project-chart-empty-state"
    >
      <p className={`text-sm ${PLANNER_MUTED}`}>{message}</p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 px-3 py-2 dark:border-slate-700">
      <dt className={PLANNER_MUTED}>{label}</dt>
      <dd className={`font-medium tabular-nums ${TEXT_BODY}`}>{value}</dd>
    </div>
  );
}

function SimpleBarChart({
  items,
  valueFormatter,
}: {
  items: Array<{ label: string; value: number; detail?: string }>;
  valueFormatter: (value: number) => string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className={`font-medium ${TEXT_FOREGROUND}`}>{item.label}</span>
            <span className={`tabular-nums ${TEXT_BODY}`}>{valueFormatter(item.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-2 rounded-full bg-cyan-600 dark:bg-cyan-400"
              style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0)}%` }}
            />
          </div>
          {item.detail ? <p className={`mt-1 text-xs ${PLANNER_MUTED}`}>{item.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}

function MiniCrewDemandHistogram({
  histogram,
  availableCrew,
}: {
  histogram: ResourceHistogramDay[];
  availableCrew: number;
}) {
  const sample = histogram.slice(0, 14);
  const maxDemand = Math.max(...sample.map((day) => day.requiredCrew), availableCrew, 1);

  return (
    <div className="space-y-3" data-testid="project-chart-labor-demand-histogram">
      <div className="flex items-end gap-1" style={{ minHeight: 96 }}>
        {sample.map((day) => {
          const height = `${Math.max((day.requiredCrew / maxDemand) * 100, day.requiredCrew > 0 ? 6 : 0)}%`;
          return (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="relative flex h-24 w-full items-end rounded-sm bg-slate-100 dark:bg-slate-800">
                <div
                  className={`w-full rounded-sm ${
                    day.isOverallocated ? 'bg-red-500' : 'bg-cyan-600 dark:bg-cyan-400'
                  }`}
                  style={{ height }}
                  title={`${day.date}: ${day.requiredCrew} crew`}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 border-t border-dashed border-amber-500"
                  style={{ bottom: `${(availableCrew / maxDemand) * 100}%` }}
                  aria-hidden
                />
              </div>
              <span className={`truncate text-[10px] ${PLANNER_MUTED}`}>
                {day.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
      <p className={`text-xs ${PLANNER_MUTED}`}>
        Dashed line = available crew ({availableCrew}). Red bars = overallocated days.
      </p>
    </div>
  );
}

function CostHealthCard({
  projectId,
  snapshot,
}: {
  projectId: string;
  snapshot: ProjectChartsSnapshot;
}) {
  const { costHealth } = snapshot;

  return (
    <ProjectChartCard
      title="Cost Health"
      description="Estimate cost rollups from construction activities and Costs & Markup."
      href={projectChartsCostHealthHref(projectId)}
      testId="project-chart-cost-health"
    >
      {!costHealth.hasActivities ? (
        <ChartEmptyState message="Add construction activities in Estimate to populate cost health." />
      ) : (
        <dl className="grid grid-cols-1 gap-2 text-sm">
          <MetricRow label="Labor" value={formatEstimateCurrency(costHealth.laborCost)} />
          <MetricRow label="Material" value={formatEstimateCurrency(costHealth.materialCost)} />
          <MetricRow label="Equipment" value={formatEstimateCurrency(costHealth.equipmentCost)} />
          <MetricRow
            label="Subcontractor"
            value={formatEstimateCurrency(costHealth.subcontractorCost)}
          />
          <MetricRow
            label="Direct cost subtotal"
            value={formatEstimateCurrency(costHealth.directCostSubtotal)}
          />
          {costHealth.finalSellPrice != null ? (
            <MetricRow
              label="Final sell price"
              value={formatEstimateCurrency(costHealth.finalSellPrice)}
            />
          ) : null}
        </dl>
      )}
    </ProjectChartCard>
  );
}

function ScopeByDivisionCard({
  projectId,
  snapshot,
}: {
  projectId: string;
  snapshot: ProjectChartsSnapshot;
}) {
  const { scopeByDivision } = snapshot;

  return (
    <ProjectChartCard
      title="Scope by Division"
      description="Activity count, man-hours, and labor cost grouped by CSI division."
      href={projectChartsScopeHref(projectId)}
      testId="project-chart-scope-by-division"
    >
      {scopeByDivision.totalActivities === 0 ? (
        <ChartEmptyState message="Add construction activities to see scope by division." />
      ) : (
        <SimpleBarChart
          items={scopeByDivision.divisions.map((division) => ({
            label: `${division.divisionCode} ${division.divisionName}`,
            value: division.laborCost,
            detail: `${division.activityCount} activities · ${formatEstimateNumber(division.totalManHours, { decimals: 1 })} MH`,
          }))}
          valueFormatter={(value) => formatEstimateCurrency(value)}
        />
      )}
    </ProjectChartCard>
  );
}

function LaborDemandCard({
  projectId,
  snapshot,
}: {
  projectId: string;
  snapshot: ProjectChartsSnapshot;
}) {
  const { laborDemand } = snapshot;

  return (
    <ProjectChartCard
      title="Labor Demand"
      description="Peak crew and daily demand from Level III Gantt / CPM."
      href={projectChartsLaborDemandHref(projectId)}
      testId="project-chart-labor-demand"
    >
      {!laborDemand.hasCpm ? (
        <ChartEmptyState message="Run CPM to generate labor demand charts." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <MetricRow label="Peak crew" value={String(laborDemand.peakCrew)} />
            <MetricRow label="Available crew" value={String(laborDemand.availableCrew)} />
            <MetricRow label="Overallocated days" value={String(laborDemand.overallocatedDays)} />
          </div>
          <MiniCrewDemandHistogram
            histogram={laborDemand.histogram}
            availableCrew={laborDemand.availableCrew}
          />
        </div>
      )}
    </ProjectChartCard>
  );
}

function ScheduleReadinessCard({
  projectId,
  snapshot,
}: {
  projectId: string;
  snapshot: ProjectChartsSnapshot;
}) {
  const { scheduleReadiness } = snapshot;

  return (
    <ProjectChartCard
      title="Schedule Readiness"
      description="Logic, CPM, and schedule-enabled activity readiness."
      href={projectChartsScheduleReadinessHref(projectId)}
      testId="project-chart-schedule-readiness"
    >
      {scheduleReadiness.totalActivities === 0 ? (
        <ChartEmptyState message="Add construction activities to assess schedule readiness." />
      ) : !scheduleReadiness.hasCpm ? (
        <ChartEmptyState message="Build logic and run CPM to generate schedule health." />
      ) : (
        <dl className="grid grid-cols-1 gap-2 text-sm">
          <MetricRow
            label="Scheduled activities"
            value={`${scheduleReadiness.scheduledActivities} / ${scheduleReadiness.totalActivities}`}
          />
          <MetricRow
            label="Activities missing logic"
            value={String(scheduleReadiness.activitiesMissingLogic)}
          />
          <MetricRow
            label="Critical activities"
            value={String(scheduleReadiness.criticalActivityCount ?? 0)}
          />
          <MetricRow
            label="Project duration"
            value={
              scheduleReadiness.projectDurationDays != null
                ? `${formatEstimateNumber(scheduleReadiness.projectDurationDays, { decimals: 0 })} days`
                : '—'
            }
          />
          {scheduleReadiness.cpmStale ? (
            <p className={`text-xs text-amber-700 dark:text-amber-300 ${PLANNER_MUTED}`}>
              Saved CPM is stale. Run CPM again in Logic Network.
            </p>
          ) : null}
        </dl>
      )}
    </ProjectChartCard>
  );
}

function QcRiskSnapshotCard({
  projectId,
  snapshot,
}: {
  projectId: string;
  snapshot: ProjectChartsSnapshot;
}) {
  const { qcRisk } = snapshot;

  return (
    <ProjectChartCard
      title="QC / Risk Snapshot"
      description="QC records, break-test alerts, and open RFIs."
      href={projectChartsQcRiskHref(projectId)}
      testId="project-chart-qc-risk"
    >
      {!qcRisk.hasAnyData ? (
        <ChartEmptyState message="No QC records, alerts, or RFIs yet for this project." />
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <MetricRow label="QC records" value={String(qcRisk.qcRecordCount)} />
            <MetricRow label="Due QC items" value={String(qcRisk.dueQcItems)} />
            <MetricRow label="Overdue QC items" value={String(qcRisk.overdueQcItems)} />
            <MetricRow label="Open RFIs" value={String(qcRisk.openRfiCount)} />
            {qcRisk.riskLabel ? (
              <MetricRow label="Project stage" value={qcRisk.riskLabel} />
            ) : null}
          </dl>
          {qcRisk.openRfiCount > 0 ? (
            <Link to={projectChartsRfiHref(projectId)} className={PLANNER_LINK}>
              View RFIs <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      )}
    </ProjectChartCard>
  );
}

function ChangeOrderImpactCard({
  projectId,
  snapshot,
}: {
  projectId: string;
  snapshot: ProjectChartsSnapshot;
}) {
  const { changeOrders } = snapshot;

  return (
    <ProjectChartCard
      title="Change Order Impact"
      description="Pending, approved, and declined change order value."
      href={projectChartsChangeOrdersHref(projectId)}
      testId="project-chart-change-orders"
    >
      {changeOrders.totalCount === 0 ? (
        <ChartEmptyState message="No change orders yet for this project." />
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <MetricRow label="Pending value" value={formatEstimateCurrency(changeOrders.pendingValue)} />
            <MetricRow
              label="Approved value"
              value={formatEstimateCurrency(changeOrders.approvedValue)}
            />
            <MetricRow
              label="Declined value"
              value={formatEstimateCurrency(changeOrders.declinedValue)}
            />
          </dl>
          <SimpleBarChart
            items={changeOrders.statusCounts.map((entry) => ({
              label: entry.status,
              value: entry.count,
              detail: formatEstimateCurrency(entry.value),
            }))}
            valueFormatter={(value) => String(value)}
          />
        </div>
      )}
    </ProjectChartCard>
  );
}

interface Props {
  projectId: string;
  snapshot: ProjectChartsSnapshot;
}

export default function ProjectChartsDashboard({ projectId, snapshot }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="project-charts-dashboard">
      <CostHealthCard projectId={projectId} snapshot={snapshot} />
      <ScopeByDivisionCard projectId={projectId} snapshot={snapshot} />
      <LaborDemandCard projectId={projectId} snapshot={snapshot} />
      <ScheduleReadinessCard projectId={projectId} snapshot={snapshot} />
      <QcRiskSnapshotCard projectId={projectId} snapshot={snapshot} />
      <ChangeOrderImpactCard projectId={projectId} snapshot={snapshot} />
    </div>
  );
}

export {
  ChartEmptyState,
  CostHealthCard,
  ScopeByDivisionCard,
  LaborDemandCard,
  ScheduleReadinessCard,
  QcRiskSnapshotCard,
  ChangeOrderImpactCard,
};
