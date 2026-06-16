import { PLAN_DISPLAY_NAMES, type PlanId } from '../../lib/entitlements';

const PLAN_BADGE_STYLES: Record<PlanId, string> = {
  free: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
  starter:
    'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
  professional:
    'border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-500/40 dark:bg-cyan-950/40 dark:text-cyan-200',
  business:
    'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-500/40 dark:bg-violet-950/40 dark:text-violet-200',
};

interface PlanBadgeProps {
  plan: PlanId;
  className?: string;
}

export default function PlanBadge({ plan, className = '' }: PlanBadgeProps) {
  const label = PLAN_DISPLAY_NAMES[plan].short;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${PLAN_BADGE_STYLES[plan]} ${className}`}
      data-testid={`plan-badge-${plan}`}
    >
      {label}
    </span>
  );
}
