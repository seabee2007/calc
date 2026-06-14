import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pin, PinOff } from 'lucide-react';
import type { EstimateWorkspaceSaveStatusValue } from '../estimateWorkspaceSaveStatus';
import {
  ESTIMATE_WORKSPACE_HEADER_COLLAPSE_MARKER,
  ESTIMATE_WORKSPACE_HEADER_PORTAL_ID,
  useEstimateWorkspaceHeaderCollapse,
  type EstimateWorkspaceHeaderMiniStatus,
} from '../EstimateWorkspaceHeaderCollapseContext';

const REVEAL_HEIGHT_PX = 12;
const COLLAPSED_BAR_HEIGHT_PX = 40;

interface Props {
  plannerHeader: ReactNode;
}

export default function EstimateWorkspaceCollapsibleHeader({ plannerHeader }: Props) {
  const collapse = useEstimateWorkspaceHeaderCollapse();
  const headerInnerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);

  const enabled = collapse?.enabled ?? false;
  const isCollapsed = collapse?.isCollapsed ?? false;
  const isMobile = collapse?.isMobile ?? false;

  useEffect(() => {
    if (!enabled || !headerInnerRef.current) return;
    const node = headerInnerRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setHeaderHeight(Math.ceil(entry.contentRect.height));
      }
    });
    observer.observe(node);
    setHeaderHeight(Math.ceil(node.getBoundingClientRect().height));
    return () => observer.disconnect();
  }, [enabled, isCollapsed]);

  if (!enabled || !collapse) {
    return (
      <>
        {plannerHeader}
        <div id={ESTIMATE_WORKSPACE_HEADER_PORTAL_ID} ref={collapse?.attachPortalTarget} />
      </>
    );
  }

  const showCollapsedChrome = isCollapsed && !isMobile;
  const shellHeight =
    showCollapsedChrome && headerHeight != null ? COLLAPSED_BAR_HEIGHT_PX : headerHeight ?? undefined;

  return (
    <div
      className="relative shrink-0 overflow-hidden transition-[height] duration-500 ease-out will-change-[height]"
      style={{ height: shellHeight }}
      data-testid={ESTIMATE_WORKSPACE_HEADER_COLLAPSE_MARKER}
      onMouseEnter={collapse.handlePointerEnter}
      onMouseLeave={collapse.handlePointerLeave}
      onFocusCapture={() => collapse.setIsFocusedWithin(true)}
      onBlurCapture={(event) => {
        const next = event.currentTarget;
        if (!next.contains(event.relatedTarget as Node | null)) {
          collapse.setIsFocusedWithin(false);
        }
      }}
    >
      <div
        ref={headerInnerRef}
        className="transition-transform duration-500 ease-out will-change-transform"
        style={{
          transform: showCollapsedChrome
            ? `translateY(calc(-100% + ${REVEAL_HEIGHT_PX}px))`
            : 'translateY(0)',
        }}
      >
        {plannerHeader}
        <div
          id={ESTIMATE_WORKSPACE_HEADER_PORTAL_ID}
          ref={collapse.attachPortalTarget}
          data-testid="estimate-workspace-header-portal"
        />
      </div>

      {showCollapsedChrome ? (
        <EstimateWorkspaceCollapsedStatusBar
          miniStatus={collapse.miniStatus}
          isPinned={collapse.isPinned}
          onExpand={collapse.expand}
          onTogglePinned={() => collapse.setPinned(!collapse.isPinned)}
        />
      ) : null}
    </div>
  );
}

function saveStatusTone(
  status: EstimateWorkspaceSaveStatusValue,
  hasPendingEstimateChanges: boolean,
): string {
  if (status === 'error') {
    return 'text-red-700 dark:text-red-300';
  }
  if (status === 'saving') {
    return 'text-amber-700 dark:text-amber-300';
  }
  if (hasPendingEstimateChanges || status === 'dirty') {
    return 'text-cyan-700 dark:text-cyan-300';
  }
  return 'text-emerald-700 dark:text-emerald-300';
}

function EstimateWorkspaceCollapsedStatusBar({
  miniStatus,
  isPinned,
  onExpand,
  onTogglePinned,
}: {
  miniStatus: EstimateWorkspaceHeaderMiniStatus | null;
  isPinned: boolean;
  onExpand: () => void;
  onTogglePinned: () => void;
}) {
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-10 flex h-10 items-center gap-2 border-t border-cyan-500/30 bg-white/95 px-3 text-xs shadow-sm backdrop-blur-sm dark:bg-slate-900/95"
      data-testid="estimate-workspace-collapsed-header-bar"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-cyan-500/80 via-cyan-400/60 to-cyan-500/80" />
      <button
        type="button"
        className="group flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={onExpand}
        title="Show estimate controls"
      >
        <span className="truncate font-medium text-slate-700 dark:text-slate-200">
          {miniStatus?.estimateTypeLabel ?? 'Estimate workspace'}
        </span>
        <span
          className={[
            'hidden truncate sm:inline',
            saveStatusTone(
              miniStatus?.saveStatus ?? 'saved',
              miniStatus?.hasPendingEstimateChanges ?? false,
            ),
          ].join(' ')}
        >
          {miniStatus?.saveStatusLabel ?? 'Saved'}
        </span>
        <span className="hidden truncate text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 md:inline">
          Show estimate controls
        </span>
      </button>
      <button
        type="button"
        className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        onClick={onExpand}
      >
        Expand
      </button>
      <button
        type="button"
        className="shrink-0 rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label={isPinned ? 'Keep header visible' : 'Auto-hide header'}
        title={isPinned ? 'Keep header visible' : 'Auto-hide header'}
        onClick={onTogglePinned}
      >
        {isPinned ? <Pin className="h-3.5 w-3.5" aria-hidden /> : <PinOff className="h-3.5 w-3.5" aria-hidden />}
      </button>
    </div>
  );
}
