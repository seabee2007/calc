import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Viewport } from '@xyflow/react';
import { Cpu, Download } from 'lucide-react';
import { exportLogicLinksToExcel } from '../../../export/logicNetworkExcelExport';
import { getMasterActivityCsiContext } from '../../../data/masterActivityIndex';
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
import LogicReviewPanel from '../../../scheduling/logic/LogicReviewPanel';
import type { SuggestedLogicLink } from '../../../scheduling/logic/logicTypes';
import {
  runAiLogicSequence,
  type AiSequenceValidationResult,
  type AiLogicSequenceInput,
} from '../../../scheduling/logic/aiSequenceService';
import EstimateLogicNetworkCanvas, {
  type LogicNetworkCanvasHandle,
} from './EstimateLogicNetworkCanvas';
import LogicNetworkWorkspaceOnboardingModal from './LogicNetworkWorkspaceOnboardingModal';
import AiSequenceReviewModal, { type CpmPreviewSummary } from './AiSequenceReviewModal';

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
  scheduleSettings?: ScheduleSettings;
  projectAvailableCrewSize?: number;
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
  activitySignature?: string;
  projectType?: string;
  projectLocation?: string;
  projectName?: string;
}

export default function LogicNetworkWorkspace({
  canvasKey,
  activitySignature = '',
  activities,
  onSaveLayout,
  scheduleSettings,
  projectAvailableCrewSize,
  projectType,
  projectLocation,
  projectName = 'project',
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

  // ── Live CPM preview state ────────────────────────────────────────────────
  const [livePreviewCpm, setLivePreviewCpm] = useState<CpmResult | null>(null);
  const [liveCpmBusy, setLiveCpmBusy] = useState(false);
  const [rcsOverloadedDays, setRcsOverloadedDays] = useState(0);
  const [rcsMovedCount, setRcsMovedCount] = useState(0);

  // ── AI sequence state ─────────────────────────────────────────────────────
  const [aiSequenceBusy, setAiSequenceBusy] = useState(false);
  const [showAiSequenceReview, setShowAiSequenceReview] = useState(false);
  const [aiSequenceValidation, setAiSequenceValidation] = useState<AiSequenceValidationResult | null>(null);
  const [aiSequenceApplying, setAiSequenceApplying] = useState(false);
  const [aiSequenceError, setAiSequenceError] = useState<string | null>(null);
  const [previewCpmSummary, setPreviewCpmSummary] = useState<CpmPreviewSummary | null>(null);

  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<LogicNetworkCanvasHandle>(null);
  const hasFitInitialViewRef = useRef(false);

  useEffect(() => {
    hasFitInitialViewRef.current = false;
    setViewport(INITIAL_LOGIC_NETWORK_VIEWPORT);
    // Clear live preview when the canvas resets (project/estimate changed)
    setLivePreviewCpm(null);
    setRcsOverloadedDays(0);
  }, [canvasKey]);

  // Clear live preview when logic links change externally
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
        if (isFullscreen) { event.preventDefault(); void exitFullscreen(); }
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
    return () => { document.body.style.overflow = prev; };
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

  // ── Live CPM calculation ──────────────────────────────────────────────────

  const handleRunLiveCpm = useCallback(
    (linksOverride?: CpmLogicLink[]) => {
      setLiveCpmBusy(true);
      try {
        const links = linksOverride ?? canvasProps.logicLinks;
        const result = calculateCpmByGraphKey(activities, links);
        setLivePreviewCpm(result);

        // RCS check
        const crewSize = projectAvailableCrewSize ?? scheduleSettings?.availableCrewSize ?? 0;
        if (crewSize > 0 && activities.length > 0) {
          const projectStartDate =
            scheduleSettings?.projectStartDate || new Date().toISOString().slice(0, 10);
          const rcs = resourceLevelSchedule({ activities, logicLinks: links, availableCrewSize: crewSize, projectStartDate });
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

  // ── AI sequence workflow ──────────────────────────────────────────────────

  const handleAiSequence = useCallback(async () => {
    if (aiSequenceBusy || activities.length === 0) return;
    setAiSequenceBusy(true);
    setAiSequenceError(null);
    try {
      const input: AiLogicSequenceInput = {
        activities: activities.map((a) => {
          const masterCsi = getMasterActivityCsiContext(a.masterActivityCode ?? a.activityCode);
          return {
            activityCode: a.activityCode,
            title: a.activityDescription,
            divisionCode: a.divisionCode,
            divisionName: a.divisionName,
            workPackageName: a.workPackageName,
            durationDays: a.durationDays,
            crewSize: a.crewSize,
            runtimeActivityId: getActivityGraphKey(a),
            displayCode: a.displayCode,
            masterActivityCode: a.masterActivityCode,
            isCustomActivity: a.isCustomActivity,
            activityType: a.activityType,
            sequencingCategory: a.sequencingCategory,
            logicAnchor: a.logicAnchor,
            primaryTrade: a.primaryTrade,
            csiDivisionCode: masterCsi.csiDivisionCode,
            csiSectionCode: masterCsi.csiSectionCode,
          };
        }),
        logicLinks: canvasProps.logicLinks,
        projectType,
        projectLocation,
        availableCrewSize: projectAvailableCrewSize ?? scheduleSettings?.availableCrewSize,
        templateContext: true,
      };

      const result = await runAiLogicSequence(input);
      setAiSequenceValidation(result);

      // Compute a CPM preview from the deterministic-only links (before user applies)
      if (result.valid.length > 0) {
        const previewLinks = [
          ...canvasProps.logicLinks,
          ...result.valid.filter((s) => s.source === 'deterministic').map((s) => ({
            predecessorActivityCode: s.predecessorActivityCode,
            successorActivityCode: s.successorActivityCode,
            relationshipType: s.relationshipType,
            lagDays: s.lagDays,
          })),
        ];
        const previewCpm = calculateCpmByGraphKey(activities, previewLinks);
        const criticalCount = previewCpm.activities.filter((a) => a.isCritical).length;
        const crewSize = projectAvailableCrewSize ?? scheduleSettings?.availableCrewSize ?? 0;
        let overloadedDays = 0;
        if (crewSize > 0) {
          const projectStartDate = scheduleSettings?.projectStartDate || new Date().toISOString().slice(0, 10);
          const rcs = resourceLevelSchedule({ activities, logicLinks: previewLinks, availableCrewSize: crewSize, projectStartDate });
          overloadedDays = rcs.resourceHistogramAfter.filter((d) => d.isOverallocated).length;
        }
        setPreviewCpmSummary({
          criticalCount,
          projectDurationDays: previewCpm.projectDurationDays,
          overloadedDays,
        });
      } else {
        setPreviewCpmSummary(null);
      }

      setShowAiSequenceReview(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'AI sequencing failed';
      setAiSequenceError(msg);
      console.error('[AI Sequence]', error);
    } finally {
      setAiSequenceBusy(false);
    }
  }, [
    aiSequenceBusy,
    activities,
    canvasProps.logicLinks,
    projectType,
    projectLocation,
    scheduleSettings,
  ]);

  const handleAiSequenceApply = useCallback(
    async (links: SuggestedLogicLink[]) => {
      if (aiSequenceApplying) return;
      setAiSequenceApplying(true);
      try {
        const newLinks: CpmLogicLink[] = links.map((l) => ({
          predecessorActivityCode: l.predecessorActivityCode,
          successorActivityCode: l.successorActivityCode,
          relationshipType: l.relationshipType,
          lagDays: l.lagDays,
        }));
        const combined = [...canvasProps.logicLinks, ...newLinks];
        canvasProps.onLinksChange(combined);
        setShowAiSequenceReview(false);
        // Run live CPM immediately after applying
        handleRunLiveCpm(combined);
        // Auto-layout and fit
        requestAnimationFrame(() => {
          canvasRef.current?.autoLayout();
          setTimeout(() => canvasRef.current?.fitView(), 300);
        });
      } finally {
        setAiSequenceApplying(false);
      }
    },
    [aiSequenceApplying, canvasProps, handleRunLiveCpm],
  );

  const toolbarButtonClass = isFullscreen ? FULLSCREEN_TOOLBAR_BUTTON_CLASS : TOOLBAR_BUTTON_CLASS;
  const viewMode = canvasProps.viewMode ?? 'logic-network';
  const isPrecedenceMode = viewMode === 'precedence-diagram';
  const isLogicMode = viewMode === 'logic-network';
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
            <>
              <button
                type="button"
                className={toolbarButtonClass}
                onClick={() => setShowLogicReview(true)}
              >
                Check logic
              </button>
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
              <button
                type="button"
                className={
                  aiSequenceBusy
                    ? disabledToolbarButtonClass
                    : 'inline-flex items-center gap-1.5 rounded-lg border border-violet-400 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 shadow-sm hover:bg-violet-100 dark:border-violet-600 dark:bg-violet-950 dark:text-violet-200 dark:hover:bg-violet-900'
                }
                disabled={aiSequenceBusy || activities.length === 0}
                onClick={() => void handleAiSequence()}
                title="Use AI + construction rules to suggest logic links for all activities"
              >
                <Cpu size={12} />
                {aiSequenceBusy ? 'Analysing…' : 'AI Sequence Activities'}
              </button>
            </>
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
          {isPrecedenceMode && canvasProps.cpmResult?.hasRunCpm ? (
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              CPM calculated · project duration {canvasProps.cpmResult.projectDurationDays} days
            </p>
          ) : null}
          {isLogicMode && livePreviewCpm ? (
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              Live CPM preview ·{' '}
              {livePreviewCpm.criticalPathActivityCodes.length} critical activities ·{' '}
              {livePreviewCpm.projectDurationDays} day duration
            </p>
          ) : null}
          {isLogicMode && aiSequenceError ? (
            <p className="text-xs text-red-600 dark:text-red-400">{aiSequenceError}</p>
          ) : null}
        </div>
      ) : null}

      {/* ── RCS overload warning ─────────────────────────────────────────── */}
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
          try { await canvasProps.onAddSuggestedLinks(links); }
          finally { setLogicReviewBusy(false); }
        }}
        onIgnoreWarning={async (warningId) => {
          setLogicReviewBusy(true);
          try { await canvasProps.onIgnoreLogicWarning(warningId); }
          finally { setLogicReviewBusy(false); }
        }}
        onRevertLastBatch={async () => {
          if (!canvasProps.onRevertLastLogicBatch) return;
          setLogicReviewBusy(true);
          try { await canvasProps.onRevertLastLogicBatch(); }
          finally { setLogicReviewBusy(false); }
        }}
        onClearAllLogicLinks={async () => {
          if (!canvasProps.onClearAllLogicLinks) return;
          setLogicReviewBusy(true);
          try { await canvasProps.onClearAllLogicLinks(); }
          finally { setLogicReviewBusy(false); }
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
            setLogicReviewBusy(false); }
        }}
        onNotify={(message, variant = 'success') => {
          setLayoutSaveToast({ message, variant });
        }}
      />

      {/* AI Sequence Review Modal */}
      {aiSequenceValidation ? (
        <AiSequenceReviewModal
          isOpen={showAiSequenceReview}
          onClose={() => setShowAiSequenceReview(false)}
          activityCount={activities.length}
          validationResult={aiSequenceValidation}
          onApplySuggested={handleAiSequenceApply}
          onApplyHighConfidence={handleAiSequenceApply}
          applying={aiSequenceApplying}
          previewCpmSummary={previewCpmSummary ?? undefined}
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
