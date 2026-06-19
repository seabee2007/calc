import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Viewport } from '@xyflow/react';
import { Download } from 'lucide-react';
import { exportLogicLinksToExcel } from '../../../export/logicNetworkExcelExport';
import {
  getActivityGraphKey,
  type ScheduleActivity,
} from '../../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type {
  CpmLogicLink,
  CpmResult,
  LogicNetworkLayout,
  LogicNetworkViewMode,
  ScheduleSettings,
} from '../../../scheduling/cpmTypes';
import { calculateCpm } from '../../../scheduling/cpm/calculateCpm';
import type { EffectiveScheduleAnalysis } from '../../../scheduling/effectiveSchedule';
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
import { resourceLevelSchedule } from '../../../scheduling/resources/resourceLevelSchedule';
import EstimateWorkspaceToast, {
  type EstimateWorkspaceToastVariant,
} from '../EstimateWorkspaceToast';
import EstimateLogicNetworkCanvas, {
  type LogicNetworkCanvasHandle,
} from './EstimateLogicNetworkCanvas';
import LogicNetworkWorkspaceOnboardingModal from './LogicNetworkWorkspaceOnboardingModal';

/**
 * Re-keys activities and links by their stable graph key (runtime id when present)
 * so CPM treats repeated activity codes as distinct nodes. Returns a result whose
 * activities are keyed by graph key, matching the canvas node identity.
 */
function calculateCpmByGraphKey(
  activities: ScheduleActivity[],
  logicLinks: CpmLogicLink[],
  projectStartDay?: number,
): CpmResult {
  const codeToGraphKey = new Map<string, string>();
  for (const activity of activities) {
    if (!codeToGraphKey.has(activity.activityCode)) {
      codeToGraphKey.set(activity.activityCode, getActivityGraphKey(activity));
    }
  }
  const keyedActivities = activities.map((activity) => ({
    ...activity,
    activityCode: getActivityGraphKey(activity),
  }));
  const keyedLinks = logicLinks.map((link) => ({
    ...link,
    predecessorActivityCode:
      link.predecessorRuntimeId?.trim() ||
      codeToGraphKey.get(link.predecessorActivityCode) ||
      link.predecessorActivityCode,
    successorActivityCode:
      link.successorRuntimeId?.trim() ||
      codeToGraphKey.get(link.successorActivityCode) ||
      link.successorActivityCode,
  }));
  return calculateCpm({ activities: keyedActivities, logicLinks: keyedLinks, projectStartDay });
}

const TOOLBAR_BUTTON_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

const FULLSCREEN_TOOLBAR_BUTTON_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

const MODE_TAB_ACTIVE_CLASS =
  'rounded-lg border border-cyan-600 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 dark:border-cyan-500 dark:bg-cyan-950 dark:text-cyan-100';

const MODE_TAB_INACTIVE_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';

interface Props {
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  cpmResult: CpmResult | null;
  layout: LogicNetworkLayout[];
  scheduleSettings?: ScheduleSettings;
  projectAvailableCrewSize?: number;
  onLinksChange: (links: CpmLogicLink[]) => void;
  onLayoutChange: (layout: LogicNetworkLayout[]) => void;
  onSaveLayout: (layout: LogicNetworkLayout[]) => Promise<void>;
  logicNetworkInitialized?: boolean;
  viewMode?: LogicNetworkViewMode;
  onViewModeChange?: (mode: LogicNetworkViewMode) => void | Promise<void>;
  cpmReadiness?: CpmReadinessResult;
  onRunCpm?: () => void | Promise<void>;
  runCpmBusy?: boolean;
  saving?: boolean;
  canvasKey: string;
  activitySignature?: string;
  projectName?: string;
  /** True when resource leveling offsets are applied to the committed CPM. */
  levelingApplied?: boolean;
  /** Effective project duration after resource leveling (activity-days). */
  leveledDurationDays?: number | null;
  /** Resource-leveled effective schedule analysis (controlling path, offsets). */
  effectiveAnalysis?: EffectiveScheduleAnalysis | null;
}

export default function LogicNetworkWorkspace({
  canvasKey,
  activitySignature = '',
  activities,
  onSaveLayout,
  scheduleSettings,
  projectAvailableCrewSize,
  projectName = 'project',
  levelingApplied = false,
  leveledDurationDays = null,
  effectiveAnalysis = null,
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
  const [viewport, setViewport] = useState<Viewport>(INITIAL_LOGIC_NETWORK_VIEWPORT);

  // ── Resource-leveled overlay view (Logic Network) ─────────────────────────
  // Defaults to the leveled view whenever leveling is applied; the user can
  // switch back to the CPM baseline. CPM dependency logic itself is unchanged.
  const [showLeveledView, setShowLeveledView] = useState(levelingApplied);
  const previousLevelingAppliedRef = useRef(levelingApplied);
  useEffect(() => {
    if (previousLevelingAppliedRef.current !== levelingApplied) {
      previousLevelingAppliedRef.current = levelingApplied;
      setShowLeveledView(levelingApplied);
    }
  }, [levelingApplied]);

  // ── Live CPM preview state ────────────────────────────────────────────────
  const [livePreviewCpm, setLivePreviewCpm] = useState<CpmResult | null>(null);
  const [liveCpmBusy, setLiveCpmBusy] = useState(false);
  const [rcsOverloadedDays, setRcsOverloadedDays] = useState(0);
  const [rcsMovedCount, setRcsMovedCount] = useState(0);

  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<LogicNetworkCanvasHandle>(null);
  const hasFitInitialViewRef = useRef(false);

  useEffect(() => {
    hasFitInitialViewRef.current = false;
    setViewport(INITIAL_LOGIC_NETWORK_VIEWPORT);
    setLivePreviewCpm(null);
    setRcsOverloadedDays(0);
  }, [canvasKey]);

  useEffect(() => {
    setLivePreviewCpm(null);
    setRcsOverloadedDays(0);
  }, [canvasProps.logicLinks]);

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
      if (!document.fullscreenElement) setIsFullscreen(false);
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
        if (showOnboarding) dismissOnboarding();
        void enterFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dismissOnboarding, enterFullscreen, exitFullscreen, isFullscreen, showOnboarding]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFullscreen]);

  const handleSaveLayout = useCallback(async () => {
    if (isSavingLayout) return;
    setIsSavingLayout(true);
    setLayoutSaveToast(null);
    try {
      const layout = canvasRef.current?.collectCurrentLayout() ?? [];
      await onSaveLayout(layout);
      setLayoutSaveToast({ message: LOGIC_NETWORK_LAYOUT_SAVE_SUCCESS_MESSAGE, variant: 'success' });
    } catch (error) {
      console.error('[Logic Network] Save layout failed', error);
      setLayoutSaveToast({ message: LOGIC_NETWORK_LAYOUT_SAVE_ERROR_MESSAGE, variant: 'error' });
    } finally {
      setIsSavingLayout(false);
    }
  }, [isSavingLayout, onSaveLayout]);

  const handleRunLiveCpm = useCallback(
    (linksOverride?: CpmLogicLink[]) => {
      setLiveCpmBusy(true);
      try {
        const links = linksOverride ?? canvasProps.logicLinks;
        const result = calculateCpmByGraphKey(activities, links);
        setLivePreviewCpm(result);

        const crewSize = projectAvailableCrewSize ?? scheduleSettings?.availableCrewSize ?? 0;
        if (crewSize > 0 && activities.length > 0) {
          const projectStartDate =
            scheduleSettings?.projectStartDate || new Date().toISOString().slice(0, 10);
          const rcs = resourceLevelSchedule({
            activities,
            logicLinks: links,
            availableCrewSize: crewSize,
            projectStartDate,
          });
          const overloaded = rcs.resourceHistogramAfter.filter((d) => d.isOverallocated).length;
          setRcsOverloadedDays(overloaded);
          setRcsMovedCount(rcs.movedActivities.length);
        } else {
          setRcsOverloadedDays(0);
          setRcsMovedCount(0);
        }
      } finally {
        setLiveCpmBusy(false);
      }
    },
    [activities, canvasProps.logicLinks, scheduleSettings, projectAvailableCrewSize],
  );

  const toolbarButtonClass = isFullscreen ? FULLSCREEN_TOOLBAR_BUTTON_CLASS : TOOLBAR_BUTTON_CLASS;
  const viewMode = canvasProps.viewMode ?? 'logic-network';
  const isPrecedenceMode = viewMode === 'precedence-diagram';
  const isLogicMode = viewMode === 'logic-network';
  const hasRunCpm = canvasProps.cpmResult?.hasRunCpm ?? false;
  const leveledToggleAvailable = isPrecedenceMode && hasRunCpm && levelingApplied;
  const leveledViewActive = leveledToggleAvailable && showLeveledView;
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
          isFullscreen ? 'shrink-0 border-b border-slate-300 px-4 py-3 dark:border-slate-800' : ''
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {isFullscreen ? (
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Logic Network</span>
          ) : (
            <button type="button" className={toolbarButtonClass} onClick={() => void enterFullscreen()}>
              Full screen
            </button>
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
            className={viewMode === 'precedence-diagram' ? MODE_TAB_ACTIVE_CLASS : MODE_TAB_INACTIVE_CLASS}
            onClick={() => void canvasProps.onViewModeChange?.('precedence-diagram')}
          >
            Precedence Diagram
          </button>
          {leveledToggleAvailable ? (
            <div className="ml-1 inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-semibold ${
                  showLeveledView
                    ? 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
                    : 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-100'
                }`}
                onClick={() => setShowLeveledView(false)}
                title="Show original CPM critical path and float"
              >
                CPM Baseline
              </button>
              <button
                type="button"
                className={`border-l border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-600 ${
                  showLeveledView
                    ? 'bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-100'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
                }`}
                onClick={() => setShowLeveledView(true)}
                title="Show the effective controlling path after resource leveling"
              >
                Resource-Leveled
              </button>
            </div>
          ) : null}
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
              className={
                liveCpmBusy
                  ? disabledToolbarButtonClass
                  : 'rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm hover:bg-indigo-100 dark:border-indigo-600 dark:bg-indigo-950 dark:text-indigo-200 dark:hover:bg-indigo-900'
              }
              disabled={liveCpmBusy}
              onClick={() => handleRunLiveCpm()}
              title="Calculate CPM and show ES, EF, LS, LF, TF on activity cards"
            >
              {liveCpmBusy ? 'Calculating…' : livePreviewCpm ? 'Recalculate CPM' : 'Calculate CPM'}
            </button>
          )}
          <button type="button" className={toolbarButtonClass} onClick={() => canvasRef.current?.autoLayout()}>
            Auto layout
          </button>
          <button type="button" className={toolbarButtonClass} onClick={() => canvasRef.current?.fitView()}>
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
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 ${
              canvasProps.logicLinks.length === 0 ? disabledToolbarButtonClass : toolbarButtonClass
            }`}
            disabled={canvasProps.logicLinks.length === 0}
            title={
              canvasProps.logicLinks.length === 0
                ? 'Add logic links before exporting'
                : `Export ${canvasProps.logicLinks.length} logic links to Excel${livePreviewCpm ? ' (includes CPM data)' : ''}`
            }
            onClick={() =>
              exportLogicLinksToExcel(
                {
                  projectName,
                  activities,
                  logicLinks: canvasProps.logicLinks,
                  livePreviewCpm,
                },
                projectName,
              )
            }
          >
            <Download size={12} />
            Export logic
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
          {isPrecedenceMode && canvasProps.cpmResult?.hasRunCpm && !levelingApplied ? (
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              CPM calculated · project duration {canvasProps.cpmResult.projectDurationDays} days
            </p>
          ) : null}
          {isPrecedenceMode &&
          canvasProps.cpmResult?.hasRunCpm &&
          levelingApplied &&
          leveledDurationDays != null ? (
            <>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                CPM baseline · {canvasProps.cpmResult.projectDurationDays} days
                {'  ·  '}
                <span className="font-semibold text-orange-700 dark:text-orange-300">
                  Resource-leveled schedule · {leveledDurationDays} days
                </span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {leveledViewActive
                  ? 'Showing the effective leveled logic used by the Gantt. Original CPM logic is preserved in Baseline mode.'
                  : 'Showing the CPM baseline critical path and float. Switch to Resource-Leveled to see the crew-constrained schedule path.'}
              </p>
            </>
          ) : null}
          {isLogicMode && livePreviewCpm ? (
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              Live CPM preview ·{' '}
              {livePreviewCpm.criticalPathActivityCodes.length} critical activities ·{' '}
              {livePreviewCpm.projectDurationDays} day duration
            </p>
          ) : null}
        </div>
      ) : null}

      {isLogicMode && rcsOverloadedDays > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Resource overload: <strong>{rcsOverloadedDays}</strong> days exceed the{' '}
          <strong>{projectAvailableCrewSize ?? scheduleSettings?.availableCrewSize ?? '?'}-person</strong> crew limit.
          {rcsMovedCount > 0
            ? ` ${rcsMovedCount} float activities can be re-sequenced to reduce overload.`
            : ' Overload cannot be resolved within existing float — consider adding crew or extending the schedule.'}
        </div>
      ) : null}

      <EstimateLogicNetworkCanvas
        ref={canvasRef}
        canvasKey={canvasKey}
        activitySignature={activitySignature}
        logicNetworkInitialized={canvasProps.logicNetworkInitialized}
        viewMode={viewMode}
        activities={activities}
        livePreviewCpm={livePreviewCpm}
        fullscreen={isFullscreen}
        chromeless
        viewport={viewport}
        onViewportChange={setViewport}
        hasFitInitialViewRef={hasFitInitialViewRef}
        effectiveAnalysis={effectiveAnalysis}
        leveledViewActive={leveledViewActive}
        {...canvasProps}
      />

      {showOnboarding ? (
        <LogicNetworkWorkspaceOnboardingModal
          onContinue={dismissOnboarding}
          onEnterFullscreen={handleEnterFromModal}
        />
      ) : null}
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
