import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { EstimateGroupRollup } from '../../domain/estimateLineItemTree';
import {
  formatDivisionRollupHeader,
  formatScopeRollupHeader,
} from '../estimateLineItemDisplay';
import { PLANNER_MUTED, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

interface Props {
  title: string;
  rollup: EstimateGroupRollup;
  level: 'division' | 'scope';
  defaultOpen?: boolean;
  children?: ReactNode;
}

export default function EstimateGroupTotalsRow({
  title,
  rollup,
  level,
  defaultOpen = true,
  children,
}: Props) {
  const rollupLabel =
    level === 'division'
      ? formatDivisionRollupHeader(rollup)
      : formatScopeRollupHeader(rollup);

  const containerClass =
    level === 'division'
      ? 'group border-b border-slate-200/90 last:border-b-0 dark:border-slate-700/80'
      : 'group ml-2 border-l border-slate-200/80 pl-2 dark:border-slate-700/70 sm:ml-3 sm:pl-3';

  const titleClass =
    level === 'division'
      ? `min-w-0 truncate text-sm font-semibold ${TEXT_FOREGROUND}`
      : `min-w-0 truncate text-sm font-medium ${TEXT_FOREGROUND}`;

  return (
    <details open={defaultOpen} className={containerClass}>
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 px-1 py-1.5 sm:px-2 sm:py-2 [&::-webkit-details-marker]:hidden ${TEXT_FOREGROUND}`}
      >
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-slate-400 group-open:hidden dark:text-slate-500"
          aria-hidden
        />
        <ChevronDown
          className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 group-open:block dark:text-slate-500"
          aria-hidden
        />
        <span className={`min-w-0 flex-1 truncate ${titleClass}`}>{title}</span>
        <span className={`shrink-0 text-xs tabular-nums ${PLANNER_MUTED}`}>{rollupLabel}</span>
      </summary>
      {children ? <div className="pb-1">{children}</div> : null}
    </details>
  );
}
