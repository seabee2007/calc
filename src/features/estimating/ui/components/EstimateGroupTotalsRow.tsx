import type { ReactNode } from 'react';
import type { EstimateGroupRollup } from '../../domain/estimateLineItemTree';
import { formatGroupRollupCompact } from '../estimateLineItemDisplay';
import { PLANNER_MUTED, PLANNER_SECTION_TITLE, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

interface Props {
  title: string;
  subtitle?: string;
  rollup: EstimateGroupRollup;
  level: 'division' | 'scope';
  defaultOpen?: boolean;
  children?: ReactNode;
}

export default function EstimateGroupTotalsRow({
  title,
  subtitle,
  rollup,
  level,
  defaultOpen = true,
  children,
}: Props) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/80"
    >
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 sm:px-4 [&::-webkit-details-marker]:hidden ${TEXT_FOREGROUND}`}
      >
        <div className="min-w-0">
          <p
            className={
              level === 'division'
                ? PLANNER_SECTION_TITLE
                : `text-sm font-semibold ${TEXT_FOREGROUND}`
            }
          >
            {title}
          </p>
          {subtitle ? <p className={`text-xs ${PLANNER_MUTED}`}>{subtitle}</p> : null}
        </div>
        <span className={`shrink-0 text-xs tabular-nums sm:text-sm ${PLANNER_MUTED}`}>
          {formatGroupRollupCompact(rollup)}
        </span>
      </summary>
      {children ? <div className="space-y-2 border-t border-slate-100 p-2 dark:border-slate-700/80 sm:p-3">{children}</div> : null}
    </details>
  );
}
