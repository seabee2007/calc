import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { EstimateGroupRollup } from '../../domain/estimateLineItemTree';
import {
  formatDivisionRollupHeader,
  formatScopeRollupHeader,
} from '../estimateLineItemDisplay';
import {
  ESTIMATE_DIVISION_BLOCK,
  ESTIMATE_DIVISION_BODY,
  ESTIMATE_DIVISION_HEADER,
  ESTIMATE_SCOPE_BLOCK,
  ESTIMATE_SCOPE_BODY,
  ESTIMATE_SCOPE_HEADER,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../estimateWorkspaceTheme';

interface Props {
  title: string;
  rollup: EstimateGroupRollup;
  level: 'division' | 'scope';
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  defaultOpen?: boolean;
  children?: ReactNode;
}

export default function EstimateGroupTotalsRow({
  title,
  rollup,
  level,
  isOpen,
  onOpenChange,
  defaultOpen = true,
  children,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);
  const expanded = isOpen ?? isExpanded;

  const rollupLabel =
    level === 'division'
      ? formatDivisionRollupHeader(rollup)
      : formatScopeRollupHeader(rollup);

  const detailsClass = level === 'division' ? ESTIMATE_DIVISION_BLOCK : ESTIMATE_SCOPE_BLOCK;
  const summarySurfaceClass =
    level === 'division' ? ESTIMATE_DIVISION_HEADER : ESTIMATE_SCOPE_HEADER;

  const titleClass =
    level === 'division'
      ? `min-w-0 truncate text-sm font-semibold ${TEXT_FOREGROUND}`
      : `min-w-0 truncate text-sm font-medium ${TEXT_FOREGROUND}`;

  return (
    <details
      open={expanded}
      className={detailsClass}
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        if (isOpen == null) {
          setIsExpanded(nextOpen);
        }
        onOpenChange?.(nextOpen);
      }}
    >
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden ${summarySurfaceClass} ${TEXT_FOREGROUND}`}
      >
        {expanded ? (
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-300"
            aria-hidden
          />
        ) : (
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-300"
            aria-hidden
          />
        )}
        <span className={`min-w-0 flex-1 truncate ${titleClass}`}>{title}</span>
        <span className={`shrink-0 text-xs tabular-nums dark:text-slate-300 ${TEXT_MUTED}`}>
          {rollupLabel}
        </span>
      </summary>
      {children ? (
        <div className={level === 'division' ? ESTIMATE_DIVISION_BODY : ESTIMATE_SCOPE_BODY}>
          {children}
        </div>
      ) : null}
    </details>
  );
}
