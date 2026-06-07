import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Viewport } from '@xyflow/react';
import type { ScheduleActivity } from '../../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type {
  CpmLogicLink,
  CpmResult,
  LogicNetworkLayout,
  LogicNetworkViewMode,
} from '../../../scheduling/cpmTypes';
import type { CpmReadinessResult } from '../../../scheduling/logic/validateCpmReadiness';
import {
  exitBrowserFullscreen,
  isLogicNetworkFullscreenTipDismissed,
  isTypingTarget,
  LOGIC_NETWORK_FULLSCREEN_OVERLAY_CLASS,
  requestBrowserFullscreen,
  setLogicNetworkFullscreenTipDismissed,
} from '../../../scheduling/logicNetworkFullscreen';
import {
  LOGIC_NETWORK_LAYOUT_SAVE_ERROR_MESSAGE,
  LOGIC_NETWORK_LAYOUT_SAVE_SUCCESS_MESSAGE,
  LOGIC_NETWORK_LAYOUT_SAVE_TOAST_DURATION_MS,
  LOGIC_NETWORK_LAYOUT_SAVE_TOAST_Z_INDEX_CLASS,
} from '../../../scheduling/logicNetworkSaveLayout';
import { INITIAL_LOGIC_NETWORK_VIEWPORT } from '../../../scheduling/logicNetworkViewportPolicy';
import EstimateWorkspaceToast, {
  type EstimateWorkspaceToastVariant,
} from '../EstimateWorkspaceToast';
import LogicReviewPanel from '../../../scheduling/logic/LogicReviewPanel';
import type { SuggestedLogicLink } from '../../../scheduling/logic/logicTypes';
import EstimateLogicNetworkCanvas, {
  type LogicNetworkCanvasHandle,
} from './EstimateLogicNetworkCanvas';
import LogicNetworkWorkspaceOnboardingModal from './LogicNetworkWorkspaceOnboardingModal';

const TOOLBAR_BUTTON_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

const FULLSCREEN_TOOLBAR_BUTTON_CLASS =
  'rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-sm hover:bg-slate-700';

const MODE_TAB_ACTIVE_CLASS =
  'rounded-lg border border-cyan-600 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 dark:border-cyan-500 dark:bg-cyan-950 dark:text-cyan-100';

const MODE_TAB_INACTIVE_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';

interface Props {
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  cpmResult: CpmResult | null;
  layout: LogicNetworkLayout[];
  logicReviewIgnored: string[];
  onLinksChange: (links: CpmLogicLink[]) => void;
  onLayoutChange: (layout: LogicNetworkLayout[]) => void;
  onSaveLayout: (layout: LogicNetworkLayout[]) => Promise<void>;
  onAddSuggestedLinks: (links: SuggestedLogicLink[]) => Promise<void>;
  onIgnoreLogicWarning: (warningId: string) => Promise<void>;
  hasLogicBatch?: boolean;
  logicBatchAddedCount?: number;
  onRevertLastLogicBatch?: () => Promise<void>;
  onClearAllLogicLinks?: () => Promise<void>;
  logicNetworkInitialized?: boolean;
  viewMode?: LogicNetworkViewMode;
  onViewModeChange?: (mode: LogicNetworkViewMode) => void | Promise<void>;
  cpmReadiness?: CpmReadinessResult;
  onRunCpm?: () => void | Promise<void>;
  runCpmBusy?: boolean;
  saving?: boolean;
  canvasKey: string;
  /** Changes when the scheduled activity set changes — prunes stale canvas nodes. */
  activitySignature?: string;
}

export default function LogicNetworkWorkspace({
  canvasKey,
  activitySignature = '',
  activities,
  onSaveLayout,
  ...canvasProps
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !isLogicNetworkFullscreenTipDismissed(),
  );
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [layoutSaveToast, setLayoutSaveToast] = useState<{
    message: string;
    variant: EstimateWorkspaceToastVariant;
  } | null>(null);
  const [showLogicReview, setShowLogicReview] = useState(false);
  const [logicReviewBusy, setLogicReviewBusy] = useState(false);
  const [viewport, setViewport] = useState<Viewport>(INITIAL_LOGIC_NETWORK_VIEWPORT);
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<LogicNetworkCanvasHandle>(null);
  const hasFitInitialViewRef = useRef(false);

  useEffect(() => {
    hasFitInitialViewRef.current = false;
    setViewport(INITIAL_LOGIC_NETWORK_VIEWPORT);
  }, [canvasKey]);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    setLogicNetworkFullscreenTipDismissed();
  }, []);

  const enterFullscreen = useCallback(async () => {
    setIsFullscreen(true);
    await requestBrowserFullscreen(shellRef.current);
  }, []);

  const exitFullscreen = useCallback(async () => {
    await exitBrowserFullscreen();
    setIsFullscreen(false);
  }, []);

  const handleEnterFromModal = useCallback(() => {
    dismissOnboarding();
    void enterFullscreen();
  }, [dismissOnboarding, enterFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isFullscreen) {
          event.preventDefault();
          void exitFullscreen();
        }
        return;
      }

      if ((event.key === 'f' || event.key === 'F') && !isTypingTarget(event.target)) {
        event.preventDefault();
        if (showOnboarding) {
          dismissOnboarding();
        }
        void enterFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dismissOnboarding, enterFullscreen, exitFullscreen, isFullscreen, showOnboarding]);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  const handleSaveLayout = useCallback(async () => {
    if (isSavingLayout) return;

    setIsSavingLayout(true);
    setLayoutSaveToast(null);

    try {
      const layout = canvasRef.current?.collectCurrentLayout() ?? [];
      await onSaveLayout(layout);
      setLayoutSaveToast({
        message: LOGIC_NETWORK_LAYOUT_SAVE_SUCCESS_MESSAGE,
        variant: 'success',
      });
    } catch (error) {
      console.error('[Logic Network] Save layout failed', error);
      setLayoutSaveToast({
        message: LOGIC_NETWORK_LAYOUT_SAVE_ERROR_MESSAGE,
        variant: 'error',
      });
    } finally {
      setIsSavingLayout(false);
    }
  }, [isSavingLayout, onSaveLayout]);

  const toolbarButtonClass = isFullscreen ? FULLSCREEN_TOOLBAR_BUTTON_CLASS : TOOLBAR_BUTTON_CLASS;
  const viewMode = canvasProps.viewMode ?? 'logic-network';
  const isPrecedenceMode = viewMode === 'precedence-diagram';
  const cpmReadiness = canvasProps.cpmReadiness;
  const canRunCpm = cpmReadiness?.canRunCpm ?? false;
  const runCpmDisabledReason = cpmReadiness?.disabledReasons[0];
  const disabledToolbarButtonClass = `${toolbarButtonClass} cursor-not-allowed opacity-60`;

  const layoutSaveToastPortal =
    layoutSaveToast && typeof document !== 'undefined'
      ? createPortal(
          <EstimateWorkspaceToast
            message={layoutSaveToast.message}
            variant={layoutSaveToast.variant}
            zIndexClass={LOGIC_NETWORK_LAYOUT_SAVE_TOAST_Z_INDEX_CLASS}
            durationMs={LOGIC_NETWORK_LAYOUT_SAVE_TOAST_DURATION_MS}
            onDismiss={() => setLayoutSaveToast(null)}
          />,
          document.body,
        )
      : null;

  const shell = (
    <div
      ref={shellRef}
      className={isFullscreen ? LOGIC_NETWORK_FULLSCREEN_OVERLAY_CLASS : 'flex w-full flex-col gap-2'}
      data-logic-network-workspace
      data-logic-network-fullscreen={isFullscreen ? 'true' : 'false'}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${
          isFullscreen ? 'shrink-0 border-b border-slate-800 px-4 py-3' : ''
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {isFullscreen ? (
            <span className="text-sm font-semibold text-slate-100">Logic Network</span>
          ) : (
            <>
              <button type="button" className={toolbarButtonClass} onClick={() => void enterFullscreen()}>
                Full screen
              </button>
              <button
                type="button"
                className={toolbarButtonClass}
                title="Workspace tips"
                aria-label="Show Logic Network workspace tips"
                onClick={() => setShowOnboarding(true)}
              >
                ?
              </button>
            </>
          )}
          <button
            type="button"
            className={viewMode === 'logic-network' ? MODE_TAB_ACTIVE_CLASS : MODE_TAB_INACTIVE_CLASS}
            onClick={() => void canvasProps.onViewModeChange?.('logic-network')}
          >
            Logic Network
          </button>
          <button
            type="button"
            className={
              viewMode === 'precedence-diagram' ? MODE_TAB_ACTIVE_CLASS : MODE_TAB_INACTIVE_CLASS
            }
            onClick={() => void canvasProps.onViewModeChange?.('precedence-diagram')}
          >
            Precedence Diagram
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPrecedenceMode ? (
            <button
              type="button"
              className={
                canRunCpm && !canvasProps.runCpmBusy
                  ? 'rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900'
                  : `${disabledToolbarButtonClass} opacity-100`
              }
              disabled={!canRunCpm || canvasProps.runCpmBusy}
              title={!canRunCpm ? runCpmDisabledReason : undefined}
              onClick={() => void canvasProps.onRunCpm?.()}
            >
              {canvasProps.runCpmBusy ? 'Running CPM…' : 'Run CPM'}
            </button>
          ) : (
            <button
              type="button"
              className={toolbarButtonClass}
              onClick={() => setShowLogicReview(true)}
            >
              Check logic
            </button>
          )}
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => canvasRef.current?.autoLayout()}
          >
            Auto layout
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => canvasRef.current?.fitView()}
          >
            Fit view
          </button>
          <button
            type="button"
            className={isSavingLayout ? disabledToolbarButtonClass : toolbarButtonClass}
            disabled={isSavingLayout}
            onClick={() => void handleSaveLayout()}
          >
            {isSavingLayout ? 'Saving...' : 'Save layout'}
          </button>
          {isFullscreen ? (
            <button type="button" className={toolbarButtonClass} onClick={() => void exitFullscreen()}>
              Exit full screen
            </button>
          ) : null}
        </div>
      </div>

      {!isFullscreen ? (
        <div className="space-y-1">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isPrecedenceMode
              ? `${activities.length} activities · Run CPM to calculate ES, EF, LS, LF, TF, and FF`
              : `${activities.length} activities · drag blocks to reposition · connect handles to wire logic`}
          </p>
          {isPrecedenceMode && !canRunCpm && runCpmDisabledReason ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">{runCpmDisabledReason}</p>
          ) : null}
          {isPrecedenceMode && canRunCpm && (cpmReadiness?.softWarnings.length ?? 0) > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {cpmReadiness?.softWarnings[0]}
            </p>
          ) : null}
          {isPrecedenceMode && canvasProps.cpmResult?.hasRunCpm ? (
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              CPM calculated · project duration {canvasProps.cpmResult.projectDurationDays} days
            </p>
          ) : null}
        </div>
      ) : null}

      <EstimateLogicNetworkCanvas
        ref={canvasRef}
        canvasKey={canvasKey}
        activitySignature={activitySignature}
        logicNetworkInitialized={canvasProps.logicNetworkInitialized}
        viewMode={viewMode}
        activities={activities}
        fullscreen={isFullscreen}
        chromeless
        viewport={viewport}
        onViewportChange={setViewport}
        hasFitInitialViewRef={hasFitInitialViewRef}
        {...canvasProps}
      />

      {showOnboarding ? (
        <LogicNetworkWorkspaceOnboardingModal
          onContinue={dismissOnboarding}
          onEnterFullscreen={handleEnterFromModal}
        />
      ) : null}

      <LogicReviewPanel
        isOpen={showLogicReview}
        onClose={() => setShowLogicReview(false)}
        activities={activities}
        logicLinks={canvasProps.logicLinks}
        ignoredWarningIds={canvasProps.logicReviewIgnored}
        busy={logicReviewBusy}
        hasLogicBatch={canvasProps.hasLogicBatch}
        logicBatchAddedCount={canvasProps.logicBatchAddedCount}
        onAddSuggestedLinks={async (links) => {
          setLogicReviewBusy(true);
          try {
            await canvasProps.onAddSuggestedLinks(links);
          } finally {
            setLogicReviewBusy(false);
          }
        }}
        onIgnoreWarning={async (warningId) => {
          setLogicReviewBusy(true);
          try {
            await canvasProps.onIgnoreLogicWarning(warningId);
          } finally {
            setLogicReviewBusy(false);
          }
        }}
        onRevertLastBatch={async () => {
          if (!canvasProps.onRevertLastLogicBatch) return;
          setLogicReviewBusy(true);
          try {
            await canvasProps.onRevertLastLogicBatch();
          } finally {
            setLogicReviewBusy(false);
          }
        }}
        onClearAllLogicLinks={async () => {
          if (!canvasProps.onClearAllLogicLinks) return;
          setLogicReviewBusy(true);
          try {
            await canvasProps.onClearAllLogicLinks();
          } finally {
            setLogicReviewBusy(false);
          }
        }}
        onRemoveLogicLink={async (link) => {
          setLogicReviewBusy(true);
          try {
            const nextLinks = canvasProps.logicLinks.filter(
              (candidate) =>
                !(
                  candidate.predecessorActivityCode === link.predecessorActivityCode &&
                  candidate.successorActivityCode === link.successorActivityCode &&
                  candidate.relationshipType === link.relationshipType &&
                  candidate.lagDays === link.lagDays
                ),
            );
            await canvasProps.onLinksChange(nextLinks);
          } finally {
            setLogicReviewBusy(false);
          }
        }}
        onNotify={(message, variant = 'success') => {
          setLayoutSaveToast({ message, variant });
        }}
      />
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return (
      <>
        {createPortal(shell, document.body)}
        {layoutSaveToastPortal}
      </>
    );
  }

  return (
    <>
      {shell}
      {layoutSaveToastPortal}
    </>
  );
}
