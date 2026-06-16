import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator,
  CalendarClock,
  FileText,
  FolderPlus,
  HelpCircle,
  LayoutDashboard,
  Mail,
  Receipt,
  Wrench,
} from 'lucide-react';
import OpsCard from '../OpsCard';
import Button from '../../ui/Button';
import FeatureGate from '../../subscription/FeatureGate';
import UpgradeRequiredCard from '../../subscription/UpgradeRequiredCard';
import ModalShell from '../../ui/ModalShell';
import ConstructionCalculator from '../../../features/tools/construction-calculator/ui/ConstructionCalculator';
import type { CalculatorFunctionTab } from '../../../features/tools/construction-calculator/domain/constructionCalculatorTypes';
import { SUPPORT_EMAIL } from '../../../config/brand';
import { projectLimitUpgradeMessage } from '../../../lib/entitlements';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { normalizeWorkflowStageForDisplay } from '../../../utils/projectWorkflow';
import { OPS_MUTED, OPS_OUTLINE_BTN, OPS_TITLE } from '../opsTheme';
import { isCompactDashboardCard } from '../layout/dashboardCardLayout';
import type { DashboardCardContext } from '../layout/dashboardData';

interface WidgetShellProps {
  title: string;
  hint?: string;
  children: React.ReactNode;
}

function WidgetShell({ title, hint, children }: WidgetShellProps) {
  return (
    <OpsCard>
      <header className="mb-3">
        <h3 className={`font-semibold ${OPS_TITLE}`}>{title}</h3>
        {hint ? <p className={`mt-0.5 text-xs ${OPS_MUTED}`}>{hint}</p> : null}
      </header>
      {children}
    </OpsCard>
  );
}

interface CompactProps {
  compact?: boolean;
}

/** Project-limit upgrade state when the user cannot create another active project. */
function ProjectLimitUpgradeCard({ plan }: { plan: ReturnType<typeof useSubscription>['plan'] }) {
  const navigate = useNavigate();
  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/30"
      data-testid="project-limit-upgrade"
    >
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Upgrade required</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{projectLimitUpgradeMessage(plan)}</p>
      <Button
        variant="accent"
        size="sm"
        className="mt-3 whitespace-nowrap"
        onClick={() => navigate('/settings/billing')}
      >
        View plans
      </Button>
    </div>
  );
}

// Tab mapping for Arden Calc widget shortcut buttons.
// 'rebar' doesn't have its own tab in ConstructionCalculator (it's a separate
// calculator page), so it defaults to 'core'. TODO: add a rebar module tab.
const ARDEN_CALC_SHAPES: {
  label: string;
  short: string;
  tab: CalculatorFunctionTab;
}[] = [
  { label: 'Slab', short: 'Slab', tab: 'concrete' },
  { label: 'Footing', short: 'Foot', tab: 'concrete' },
  { label: 'Column', short: 'Col', tab: 'concrete' },
  { label: 'Sidewalk', short: 'Walk', tab: 'concrete' },
  { label: 'Rebar', short: 'Rebar', tab: 'core' /* TODO: add rebar module tab */ },
];

/** Arden Calc — opens the field calculator in a dashboard modal (no route change). */
export function ArdenCalcWidget({ compact }: CompactProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<CalculatorFunctionTab>('core');

  function openCalc(tab: CalculatorFunctionTab = 'core') {
    setInitialTab(tab);
    setModalOpen(true);
  }

  return (
    <FeatureGate feature="calculators" inline>
      <WidgetShell title="Arden Calc" hint="Open calculator tools without leaving the dashboard.">
        <Button
          variant="accent"
          size="sm"
          className="mb-3 whitespace-nowrap"
          onClick={() => openCalc('core')}
          icon={<Wrench className="h-4 w-4" />}
          data-testid="arden-calc-open"
        >
          {compact ? 'Open Calc' : 'Open Arden Calc'}
        </Button>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ARDEN_CALC_SHAPES.map((s) => (
            <Button
              key={s.label}
              variant="outline"
              size="sm"
              className={`${OPS_OUTLINE_BTN} whitespace-nowrap`}
              onClick={() => openCalc(s.tab)}
              data-testid={`arden-calc-shape-${s.label.toLowerCase()}`}
            >
              {compact ? s.short : s.label}
            </Button>
          ))}
        </div>
      </WidgetShell>

      {/* Modal — renders over the dashboard; URL never changes. */}
      <ModalShell
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Arden Calc"
        subtitle="Field calculator tools without leaving the dashboard."
        size="2xl"
      >
        {/*
         * Constrain to 740px so the two-column grid (minmax(0,1fr) | 320px
         * tape, gap-6 24px) leaves the calculator column at ~396px →
         * keypad ~348px → buttons ~82px × 40px (real calculator proportions).
         *
         * Using `w-full overflow-x-hidden` prevents any residual overflow from
         * reaching the ModalShell body's scroll container (which has
         * overflow-y-auto → overflow-x-auto per CSS spec).
         *
         * Key on initialTab so re-opening with a different tab resets state.
         */}
        <div className="mx-auto w-full max-w-[740px] overflow-x-hidden">
          <ConstructionCalculator
            key={initialTab}
            layout="desktop"
            initialTab={initialTab}
          />
        </div>
      </ModalShell>
    </FeatureGate>
  );
}

/** Quick Estimate — launches the quick estimate workflow. */
export function QuickEstimateLauncherWidget({ ctx, compact }: { ctx: DashboardCardContext } & CompactProps) {
  const navigate = useNavigate();
  const estimatingProject = ctx.snapshot.projects.find((p) => {
    const stage = normalizeWorkflowStageForDisplay(p.workflowStage);
    return stage === 'estimating' || stage === 'created';
  });

  return (
    <FeatureGate feature="quick_estimates" inline>
      <WidgetShell title="Quick Estimate" hint="Fast ballpark sizing for early project decisions.">
        {estimatingProject ? (
          <p className={`mb-3 text-sm ${OPS_MUTED}`}>
            Continue estimate for <span className="font-medium">{estimatingProject.name}</span>.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="accent"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => navigate('/calculator')}
            icon={<Calculator className="h-4 w-4" />}
          >
            {estimatingProject
              ? compact
                ? 'Continue'
                : 'Continue estimate'
              : compact
                ? 'Estimate'
                : 'Start estimate'}
          </Button>
        </div>
      </WidgetShell>
    </FeatureGate>
  );
}

/** New Project — respects active project tier limit. */
export function NewProjectShortcutWidget({ ctx }: { ctx: DashboardCardContext }) {
  const navigate = useNavigate();
  const { plan, canCreateProject } = useSubscription();
  const activeCount = ctx.snapshot.activeProjectCount;
  const allowed = canCreateProject(activeCount);

  if (!allowed) {
    return (
      <WidgetShell title="New Project" hint="Create a new active project.">
        <ProjectLimitUpgradeCard plan={plan} />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title="New Project" hint="Create a new active project.">
      <Button
        variant="accent"
        size="sm"
        className="whitespace-nowrap"
        onClick={() => navigate('/projects', { state: { openCreate: true } })}
        icon={<FolderPlus className="h-4 w-4" />}
        data-testid="new-project-shortcut-action"
      >
        New Project
      </Button>
    </WidgetShell>
  );
}

/** New Proposal — gated by proposals entitlement. */
export function NewProposalShortcutWidget({ compact }: CompactProps) {
  const navigate = useNavigate();

  return (
    <FeatureGate feature="proposals" inline>
      <WidgetShell title="New Proposal" hint="Draft a client proposal.">
        <Button
          variant="accent"
          size="sm"
          className="whitespace-nowrap"
          onClick={() => navigate('/proposal-generator')}
          icon={<FileText className="h-4 w-4" />}
        >
          {compact ? 'Proposal' : 'New Proposal'}
        </Button>
      </WidgetShell>
    </FeatureGate>
  );
}

/** Open Planner Hub — gated by global_planner_hub (Business). */
export function PlannerHubShortcutWidget({ compact }: CompactProps) {
  const navigate = useNavigate();

  return (
    <FeatureGate feature="global_planner_hub" inline>
      <WidgetShell title="Planner Hub" hint="Global view across all project planners.">
        <Button
          variant="accent"
          size="sm"
          className="whitespace-nowrap"
          onClick={() => navigate('/planner/hub')}
          icon={<LayoutDashboard className="h-4 w-4" />}
        >
          {compact ? 'Planner' : 'Open Planner Hub'}
        </Button>
      </WidgetShell>
    </FeatureGate>
  );
}

/** Open Schedule — owner shortcut to the schedule workspace. */
export function ScheduleShortcutWidget({ compact }: CompactProps) {
  const navigate = useNavigate();

  return (
    <WidgetShell title="Open Schedule" hint="Calendar and schedule workspace.">
      <Button
        variant="accent"
        size="sm"
        className="whitespace-nowrap"
        onClick={() => navigate('/planner/schedule')}
        icon={<CalendarClock className="h-4 w-4" />}
      >
        {compact ? 'Schedule' : 'Open Schedule'}
      </Button>
    </WidgetShell>
  );
}

/** Accounting & Tax — Business-only launcher. */
export function AccountingTaxLauncherWidget({ compact }: CompactProps) {
  const navigate = useNavigate();
  const { hasFeature } = useSubscription();

  if (!hasFeature('accounting_exports')) {
    return (
      <WidgetShell title="Accounting & Tax">
        <UpgradeRequiredCard feature="accounting_exports" className="shadow-none" />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell title="Accounting & Tax" hint="Export accounting and tax reports.">
      <Button
        variant="accent"
        size="sm"
        className="whitespace-nowrap"
        onClick={() => navigate('/accounting-tax')}
        icon={<Receipt className="h-4 w-4" />}
      >
        {compact ? 'Accounting' : 'Open Accounting & Tax'}
      </Button>
    </WidgetShell>
  );
}

/** Support & Help — available to all tiers. */
export function SupportHelpWidget({ compact }: CompactProps) {
  const navigate = useNavigate();

  return (
    <WidgetShell title="Support & Help" hint="Get help or contact the Arden team.">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className={`${OPS_OUTLINE_BTN} whitespace-nowrap`}
          onClick={() => navigate('/contact')}
          icon={<HelpCircle className="h-4 w-4" />}
        >
          {compact ? 'Contact' : 'Contact page'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={`${OPS_OUTLINE_BTN} whitespace-nowrap`}
          onClick={() => {
            window.location.href = `mailto:${SUPPORT_EMAIL}`;
          }}
          icon={<Mail className="h-4 w-4" />}
        >
          {compact ? 'Email' : 'Email support'}
        </Button>
      </div>
    </WidgetShell>
  );
}

/** Shared compact-label helper for registry render functions. */
export function widgetCompact(cardWidth?: number, isMobile?: boolean): boolean {
  return isCompactDashboardCard(cardWidth, isMobile);
}
