import type { ReactNode } from 'react';
import type { EstimateWorkspaceSaveStatusValue } from '../estimateWorkspaceSaveStatus';
import {
  ESTIMATE_WORKSPACE_HEADER_COLLAPSE_MARKER,
  ESTIMATE_WORKSPACE_HEADER_PORTAL_ID,
  useEstimateWorkspaceHeaderCollapse,
  type EstimateWorkspaceHeaderMiniStatus,
} from '../EstimateWorkspaceHeaderCollapseContext';

const COMPACT_BAR_HEIGHT_PX = 44;
const HEADER_TRANSITION_CLASS = 'transition-[max-height,opacity] duration-300 ease-out';

interface Props {
  plannerHeader: ReactNode;
}

export default function EstimateWorkspaceCollapsibleHeader({ plannerHeader }: Props) {
  const header = useEstimateWorkspaceHeaderCollapse();

  const enabled = header?.enabled ?? false;
  const focusMode = header?.focusMode ?? false;

  if (!enabled || !header) {
    return (
      <>
        {plannerHeader}
        <div id={ESTIMATE_WORKSPACE_HEADER_PORTAL_ID} ref={header?.attachPortalTarget} />
      </>
    );
  }

  return (
    <div className="shrink-0" data-testid={ESTIMATE_WORKSPACE_HEADER_COLLAPSE_MARKER}>
      <div
        className={[
          HEADER_TRANSITION_CLASS,
          'overflow-hidden',
          focusMode ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[2400px] opacity-100',
        ].join(' ')}
        aria-hidden={focusMode}
      >
        {plannerHeader}
        <div
          id={ESTIMATE_WORKSPACE_HEADER_PORTAL_ID}
          ref={header.attachPortalTarget}
          data-testid="estimate-workspace-header-portal"
        />
      </div>

      <div
        className={[
          HEADER_TRANSITION_CLASS,
          'overflow-hidden',
          focusMode ? 'opacity-100' : 'max-h-0 opacity-0 pointer-events-none',
        ].join(' ')}
        style={{ maxHeight: focusMode ? COMPACT_BAR_HEIGHT_PX : 0 }}
        aria-hidden={!focusMode}
      >
        <EstimateWorkspaceFocusHeaderBar
          miniStatus={header.miniStatus}
          onExpand={() => header.setFocusMode(false)}
        />
      </div>
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

function EstimateWorkspaceFocusHeaderBar({
  miniStatus,
  onExpand,
}: {
  miniStatus: EstimateWorkspaceHeaderMiniStatus | null;
  onExpand: () => void;
}) {
  return (
    <div
      className="relative flex h-11 items-center gap-2 border-b border-cyan-500/30 bg-white px-3 text-xs shadow-sm dark:bg-slate-900"
      data-testid="estimate-workspace-focus-header-bar"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-500/70 via-cyan-400/50 to-cyan-500/70" />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-medium text-slate-700 dark:text-slate-200">
          {miniStatus?.estimateTypeLabel ?? 'Estimate workspace'}
        </span>
        <span className="hidden text-slate-300 sm:inline" aria-hidden>
          •
        </span>
        <span className="hidden truncate text-slate-500 dark:text-slate-400 sm:inline">
          {miniStatus?.activeTabLabel ?? 'Workspace'}
        </span>
        <span
          className={[
            'ml-auto truncate font-medium sm:ml-0',
            saveStatusTone(
              miniStatus?.saveStatus ?? 'saved',
              miniStatus?.hasPendingEstimateChanges ?? false,
            ),
          ].join(' ')}
        >
          {miniStatus?.saveStatusLabel ?? 'Saved'}
        </span>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={onExpand}
      >
        Expand
      </button>
    </div>
  );
}
