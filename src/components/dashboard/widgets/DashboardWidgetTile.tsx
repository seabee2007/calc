import React from 'react';
import { Check, Lock, Plus } from 'lucide-react';
import type { DashboardCardMeta } from '../../../lib/dashboardLayout';
import type { PlanId } from '../../../lib/entitlements';
import { PLAN_DISPLAY_NAMES } from '../../../lib/entitlements';
import {
  getLockedWidgetExplanation,
  getRequiredUpgradePlan,
  getUpgradeButtonLabel,
} from './dashboardWidgetUpgrade';
import { requiredPlanForWidget, widgetCategoryIcon } from './dashboardWidgetCategories';

export type WidgetTileStatus = 'add' | 'added' | 'locked';

interface DashboardWidgetTileProps {
  meta: DashboardCardMeta;
  status: WidgetTileStatus;
  onAdd: () => void;
  onUpgrade?: (requiredPlan: PlanId) => void;
  upgrading?: boolean;
  isPastDue?: boolean;
}

/** Single catalog tile: icon, title, description, category + plan pills, action. */
const DashboardWidgetTile: React.FC<DashboardWidgetTileProps> = ({
  meta,
  status,
  onAdd,
  onUpgrade,
  upgrading = false,
  isPastDue = false,
}) => {
  const Icon = widgetCategoryIcon(meta.category);
  const requiredPlan = requiredPlanForWidget(meta);
  const upgradePlan = getRequiredUpgradePlan(meta);
  const planLabel = requiredPlan ? PLAN_DISPLAY_NAMES[requiredPlan].short : null;

  const addLabel = 'Add';
  const addedLabel = 'Added';
  const lockedLabel = upgrading
    ? 'Opening checkout…'
    : isPastDue && upgradePlan
      ? 'Manage billing'
      : upgradePlan
        ? getUpgradeButtonLabel(upgradePlan)
        : 'Upgrade required';

  const actionLabel = status === 'add' ? addLabel : status === 'added' ? addedLabel : lockedLabel;

  const handleAction = () => {
    if (status === 'add') {
      onAdd();
      return;
    }
    if (status === 'locked' && upgradePlan && onUpgrade && !upgrading) {
      onUpgrade(upgradePlan);
    }
  };

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
      data-testid={`widget-tile-${meta.id}`}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900 dark:text-white">{meta.title}</h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{meta.description}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700/70 dark:text-slate-300">
          {meta.category}
        </span>
        {planLabel ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            {status === 'locked' ? `${planLabel} required` : planLabel}
          </span>
        ) : null}
      </div>

      {status === 'locked' && upgradePlan ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {getLockedWidgetExplanation(upgradePlan)}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleAction}
          disabled={status === 'added' || (status === 'locked' && (!upgradePlan || upgrading))}
          aria-label={`${actionLabel} ${meta.title}`}
          aria-busy={status === 'locked' && upgrading}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
            status === 'add'
              ? 'bg-cyan-600 text-white hover:bg-cyan-500'
              : status === 'added'
                ? 'cursor-default border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border border-amber-300/60 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-70 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20'
          }`}
        >
          {status === 'add' ? <Plus className="h-4 w-4" aria-hidden /> : null}
          {status === 'added' ? <Check className="h-4 w-4" aria-hidden /> : null}
          {status === 'locked' ? <Lock className="h-4 w-4" aria-hidden /> : null}
          {actionLabel}
        </button>
      </div>
    </div>
  );
};

export default DashboardWidgetTile;
