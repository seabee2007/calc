import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardCheck,
  FileText,
  FolderPlus,
  Calculator,
  LayoutDashboard,
  ArrowRight,
} from 'lucide-react';
import OpsCard from '../OpsCard';
import Button from '../../ui/Button';
import { OPS_LIST_ROW, OPS_MUTED, OPS_OUTLINE_BTN, OPS_TITLE } from '../opsTheme';
import { normalizeWorkflowStageForDisplay } from '../../../utils/projectWorkflow';
import type { DashboardCardContext } from '../layout/dashboardData';

function WidgetHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="mb-3">
      <h3 className={`font-semibold ${OPS_TITLE}`}>{title}</h3>
      {hint ? <p className={`mt-0.5 text-xs ${OPS_MUTED}`}>{hint}</p> : null}
    </header>
  );
}

/** Shortcuts widget — one-tap launchers. Pure navigation, no app data. */
export function QuickActionsWidget({ ctx }: { ctx: DashboardCardContext }) {
  const navigate = useNavigate();
  const actions = [
    { label: 'New Project', icon: FolderPlus, onClick: ctx.onStartProject },
    { label: 'New Proposal', icon: FileText, onClick: () => navigate('/proposal-generator') },
    { label: 'Quick Estimate', icon: Calculator, onClick: ctx.onQuickQuote },
    { label: 'Planner Hub', icon: LayoutDashboard, onClick: () => navigate('/planner/hub') },
  ];
  return (
    <OpsCard>
      <WidgetHeader title="Quick Actions" hint="Jump straight into common tasks." />
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <Button
            key={a.label}
            variant="outline"
            size="sm"
            className={`${OPS_OUTLINE_BTN} justify-start whitespace-nowrap`}
            onClick={a.onClick}
            icon={<a.icon className="h-4 w-4" />}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </OpsCard>
  );
}

/** Projects still in takeoff/estimating that need pricing. */
export function ProjectsNeedingEstimateWidget({ ctx }: { ctx: DashboardCardContext }) {
  const navigate = useNavigate();
  const needing = ctx.snapshot.projects.filter((p) => {
    const lifecycle = normalizeWorkflowStageForDisplay(p.workflowStage);
    return lifecycle === 'created' || lifecycle === 'estimating';
  });

  return (
    <OpsCard>
      <WidgetHeader title="Projects Needing Estimate" />
      {needing.length === 0 ? (
        <p className={`text-sm ${OPS_MUTED}`}>Every active project has pricing underway.</p>
      ) : (
        <ul className="space-y-2">
          {needing.slice(0, 5).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className={`flex w-full items-center justify-between rounded-lg p-2.5 text-left ${OPS_LIST_ROW}`}
              >
                <span className={`truncate text-sm font-medium ${OPS_TITLE}`}>{p.name}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-cyan-500" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </OpsCard>
  );
}

/** Sent proposals that have gone quiet and need follow-up. */
export function ProposalsFollowUpWidget({ ctx }: { ctx: DashboardCardContext }) {
  const navigate = useNavigate();
  const { needFollowUpCount, oldestFollowUpDays } = ctx.crmRevenueMetrics;

  return (
    <OpsCard>
      <WidgetHeader title="Proposals Needing Follow-up" />
      <div className="flex items-end gap-3">
        <span className={`text-3xl font-bold ${OPS_TITLE}`}>{needFollowUpCount}</span>
        <span className={`pb-1 text-sm ${OPS_MUTED}`}>
          {needFollowUpCount === 1 ? 'proposal' : 'proposals'} awaiting a nudge
        </span>
      </div>
      {oldestFollowUpDays != null && needFollowUpCount > 0 ? (
        <p className={`mt-2 text-xs ${OPS_MUTED}`}>
          Oldest waiting {oldestFollowUpDays} day{oldestFollowUpDays === 1 ? '' : 's'}.
        </p>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        className={`${OPS_OUTLINE_BTN} mt-3 whitespace-nowrap`}
        onClick={() => navigate('/proposals')}
        icon={<FileText className="h-4 w-4" />}
      >
        Review proposals
      </Button>
    </OpsCard>
  );
}

/** Quality-control tests due and overdue across projects. */
export function QcDueWidget({ ctx }: { ctx: DashboardCardContext }) {
  const navigate = useNavigate();
  const { qcTestsDue, qcTestsOverdue } = ctx.qcStats;

  return (
    <OpsCard>
      <WidgetHeader title="QC Due" />
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-lg p-3 ${OPS_LIST_ROW}`}>
          <p className={`text-xs ${OPS_MUTED}`}>Tests due</p>
          <p className={`mt-1 text-2xl font-bold ${OPS_TITLE}`}>{qcTestsDue}</p>
        </div>
        <div className={`rounded-lg p-3 ${OPS_LIST_ROW}`}>
          <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            {qcTestsOverdue > 0 ? <AlertTriangle className="h-3 w-3" aria-hidden /> : null}
            Overdue
          </p>
          <p className={`mt-1 text-2xl font-bold ${qcTestsOverdue > 0 ? 'text-amber-600 dark:text-amber-400' : OPS_TITLE}`}>
            {qcTestsOverdue}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className={`${OPS_OUTLINE_BTN} mt-3 whitespace-nowrap`}
        onClick={() => navigate('/')}
        icon={<ClipboardCheck className="h-4 w-4" />}
      >
        Open QC
      </Button>
    </OpsCard>
  );
}
