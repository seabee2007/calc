import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import type { ScheduleActivity } from '../../../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type {
  CpmLogicLink,
  CpmResult,
  ResourceHistogramDay,
  ScheduleSettings,
} from '../../../scheduling/cpmTypes';
import {
  exitBrowserFullscreen,
  isLevelThreeGanttFullscreenTipDismissed,
  isTypingTarget,
  LEVEL_THREE_GANTT_FULLSCREEN_CHART_WRAPPER_CLASS,
  LEVEL_THREE_GANTT_FULLSCREEN_OVERLAY_CLASS,
  requestBrowserFullscreen,
  setLevelThreeGanttFullscreenTipDismissed,
} from '../../../scheduling/levelThreeGanttFullscreen';
import {
  computeLevelThreeGanttWorkspaceSummary,
  formatLevelThreeGanttWorkspaceSummary,
} from '../../../scheduling/levelThreeGanttWorkspaceSummary';
import {
  DEFAULT_PIXELS_PER_DAY,
  LEFT_TABLE_WIDTH,
  ZOOM_LEVELS,
} from '../../../scheduling/levelThreeGanttGrid';
import type { EstimateDomainTask } from '../../../infrastructure/estimateDbTypes';
import LevelThreeGantt from './LevelThreeGantt';
import FeatureGate from '../../../../../components/subscription/FeatureGate';
import UpgradeRequiredCard from '../../../../../components/subscription/UpgradeRequiredCard';
import LevelThreeGanttExportMenu from './LevelThreeGanttExportMenu';
import type { GanttExportMode } from '../../../export/ganttExcelExport';
import LevelThreeGanttFullscreenToolbar from './LevelThreeGanttFullscreenToolbar';
import LevelThreeGanttLegend from './LevelThreeGanttLegend';
import LevelThreeGanttWorkspaceOnboardingModal from './LevelThreeGanttWorkspaceOnboardingModal';
import ResourceHistogram from './ResourceHistogram';

const TOOLBAR_BUTTON_CLASS =
  'rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

function GatedLevelThreeExportMenu({
  exportReady,
  hasLeveling,
  onExportPdf,
  onExportExcel,
  buttonClassName,
}: {
  exportReady: boolean;
  hasLeveling?: boolean;
  onExportPdf?: (mode: GanttExportMode) => void;
  onExportExcel?: (mode: GanttExportMode) => void;
  buttonClassName?: string;
}) {
  return (
    <FeatureGate
      feature="level_three_gantt_export"
      inline
      fallback={
        <UpgradeRequiredCard
          feature="level_three_gantt_export"
          className="max-w-md p-4"
          title="Export requires Business"
        />
      }
    >
      <LevelThreeGanttExportMenu
        exportReady={exportReady}
        hasLeveling={hasLeveling}
        onExportPdf={onExportPdf}
        onExportExcel={onExportExcel}
        buttonClassName={buttonClassName}
      />
    </FeatureGate>
  );
}

interface Props {
  activities: ScheduleActivity[];
  cpmResult: CpmResult | null;
  scheduleSettings: ScheduleSettings;
  leveledOffsets?: Record<string, number>;
  logicLinks?: CpmLogicLink[];
  lineItems?: EstimateDomainTask[];
  onEditActivity?: (activityCode: string) => void;
  onExportPdf?: (mode: GanttExportMode) => void;
  onExportExcel?: (mode: GanttExportMode) => void;
  exportReady?: boolean;
  chartExportRef?: Ref<HTMLDivElement>;
  resourceHistogram?: ResourceHistogramDay[];
  onResourceLevel?: () => void;
  onClearLeveling?: () => void;
  showClearLeveling?: boolean;
}

export default function LevelThreeGanttWorkspace({
  activities,
  cpmResult,
  scheduleSettings,
  leveledOffsets = {},
  logicLinks = [],
  lineItems = [],
  onEditActivity,
  onExportPdf,
  onExportExcel,
  exportReady = false,
  chartExportRef,
  resourceHistogram = [],
  onResourceLevel,
  onClearLeveling,
  showClearLeveling = false,
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !isLevelThreeGanttFullscreenTipDismissed(),
  );
  const [pixelsPerDay, setPixelsPerDay] = useState<number>(DEFAULT_PIXELS_PER_DAY);

  const shellRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const projectDuration = Math.max(cpmResult?.projectDurationDays ?? 0, resourceHistogram.length, 0);
  const scheduleSummary = useMemo(
    () => computeLevelThreeGanttWorkspaceSummary(activities, cpmResult, resourceHistogram),
    [activities, cpmResult, resourceHistogram],
  );
  const scheduleSummaryText = useMemo(
    () => formatLevelThreeGanttWorkspaceSummary(scheduleSummary),
    [scheduleSummary],
  );

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    setLevelThreeGanttFullscreenTipDismissed();
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

  const zoomIn = useCallback(() => {
    setPixelsPerDay((prev) => {
      const idx = ZOOM_LEVELS.indexOf(prev as (typeof ZOOM_LEVELS)[number]);
      if (idx === -1) {
        const next = ZOOM_LEVELS.find((z) => z > prev);
        return next ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
      }
      return idx < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[idx + 1] : prev;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setPixelsPerDay((prev) => {
      const idx = ZOOM_LEVELS.indexOf(prev as (typeof ZOOM_LEVELS)[number]);
      if (idx === -1) {
        const candidates = ZOOM_LEVELS.filter((z) => z < prev);
        return candidates.length > 0 ? candidates[candidates.length - 1] : ZOOM_LEVELS[0];
      }
      return idx > 0 ? ZOOM_LEVELS[idx - 1] : prev;
    });
  }, []);

  const fitChartWidth = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || projectDuration <= 0) return;
    const availableWidth = el.clientWidth - LEFT_TABLE_WIDTH;
    if (availableWidth <= 0) return;
    const fitted = availableWidth / projectDuration;
    const clamped = Math.max(ZOOM_LEVELS[0], Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], fitted));
    setPixelsPerDay(clamped);
    el.scrollLeft = 0;
  }, [projectDuration]);

  const scrollToToday = useCallback(
    (pxPerDay = pixelsPerDay) => {
      const el = scrollContainerRef.current;
      if (!el || !scheduleSettings.projectStartDate) return;
      const projectStart = new Date(scheduleSettings.projectStartDate);
      const today = new Date();
      const diffMs = today.getTime() - projectStart.getTime();
      const diffDays = diffMs / 86_400_000;
      if (diffDays < 0 || diffDays > projectDuration) return;
      const todayX = diffDays * pxPerDay + LEFT_TABLE_WIDTH;
      const half = el.clientWidth / 2;
      el.scrollLeft = Math.max(0, todayX - half);
    },
    [pixelsPerDay, projectDuration, scheduleSettings.projectStartDate],
  );

  const isAtMinZoom = pixelsPerDay <= ZOOM_LEVELS[0];
  const isAtMaxZoom = pixelsPerDay >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

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

  const hasChart = Boolean(cpmResult?.hasRunCpm && activities.length > 0);
  const showResourceHistogram = resourceHistogram.length > 0;

  const zoomControls = hasChart ? (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        className={TOOLBAR_BUTTON_CLASS}
        onClick={zoomOut}
        disabled={isAtMinZoom}
        title="Zoom out"
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        type="button"
        className={TOOLBAR_BUTTON_CLASS}
        onClick={zoomIn}
        disabled={isAtMaxZoom}
        title="Zoom in"
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        className={TOOLBAR_BUTTON_CLASS}
        onClick={fitChartWidth}
        title="Fit full project duration into view"
      >
        Fit width
      </button>
      <button
        type="button"
        className={TOOLBAR_BUTTON_CLASS}
        onClick={() => scrollToToday()}
        title="Scroll to today"
      >
        Today
      </button>
    </div>
  ) : null;

  const embeddedHeader = hasChart ? (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Level III Gantt
            </h2>
            <button
              type="button"
              className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
              title="Sorted by early start · Press F for full screen · Click ? for workspace tips"
              aria-label="Show Level III Gantt workspace tips"
              onClick={() => setShowOnboarding(true)}
            >
              ?
            </button>
          </div>
          <p
            className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400"
            data-testid="level-three-gantt-summary"
          >
            {scheduleSummaryText}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {zoomControls}
          <button
            type="button"
            className={TOOLBAR_BUTTON_CLASS}
            onClick={() => void enterFullscreen()}
          >
            Full screen
          </button>
          <GatedLevelThreeExportMenu
            exportReady={exportReady}
            hasLeveling={Object.keys(leveledOffsets).length > 0}
            onExportPdf={onExportPdf}
            onExportExcel={onExportExcel}
          />
        </div>
      </div>
      <LevelThreeGanttLegend />
    </div>
  ) : null;

  const shell = (
    <div
      ref={shellRef}
      className={isFullscreen ? LEVEL_THREE_GANTT_FULLSCREEN_OVERLAY_CLASS : 'flex w-full flex-col gap-2'}
      data-level-three-gantt-workspace
      data-level-three-gantt-fullscreen={isFullscreen ? 'true' : 'false'}
    >
      {isFullscreen ? (
        <>
          <LevelThreeGanttFullscreenToolbar
            exportReady={exportReady}
            hasLeveling={Object.keys(leveledOffsets).length > 0}
            onExportPdf={onExportPdf}
            onExportExcel={onExportExcel}
            onFitWidth={fitChartWidth}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onScrollToToday={() => scrollToToday()}
            isAtMinZoom={isAtMinZoom}
            isAtMaxZoom={isAtMaxZoom}
            onExitFullscreen={() => void exitFullscreen()}
          />
          {hasChart ? (
            <LevelThreeGanttLegend className="shrink-0 border-b border-slate-300 px-4 py-1.5 dark:border-slate-800" />
          ) : null}
        </>
      ) : (
        embeddedHeader
      )}

      <div
        className={
          isFullscreen
            ? `${LEVEL_THREE_GANTT_FULLSCREEN_CHART_WRAPPER_CLASS} flex flex-col`
            : 'space-y-3'
        }
      >
        <div className={isFullscreen ? 'min-h-0 flex-1 overflow-auto' : undefined}>
          <LevelThreeGantt
            ref={chartExportRef}
            activities={activities}
            cpmResult={cpmResult}
            scheduleSettings={scheduleSettings}
            leveledOffsets={leveledOffsets}
            logicLinks={logicLinks}
            lineItems={lineItems}
            onEditActivity={onEditActivity}
            fullscreen={isFullscreen}
            chromeless
            pixelsPerDay={pixelsPerDay}
            scrollContainerRef={scrollContainerRef}
          />
        </div>

        {showResourceHistogram ? (
          <div className={isFullscreen ? 'shrink-0 border-t border-slate-300 px-4 py-2 dark:border-slate-800' : undefined}>
            <ResourceHistogram
              histogram={resourceHistogram}
              projectDurationDays={projectDuration}
              onResourceLevel={onResourceLevel}
              onClearLeveling={onClearLeveling}
              showClearLeveling={showClearLeveling}
            />
          </div>
        ) : null}
      </div>

      {showOnboarding ? (
        <LevelThreeGanttWorkspaceOnboardingModal
          onContinue={dismissOnboarding}
          onEnterFullscreen={handleEnterFromModal}
        />
      ) : null}
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(shell, document.body);
  }

  return shell;
}
