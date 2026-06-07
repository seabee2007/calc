import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
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
import type { EstimateDomainTask } from '../../../infrastructure/estimateDbTypes';
import Button from '../../../../../components/ui/Button';
import LevelThreeGantt from './LevelThreeGantt';
import LevelThreeGanttFullscreenToolbar from './LevelThreeGanttFullscreenToolbar';
import LevelThreeGanttWorkspaceOnboardingModal from './LevelThreeGanttWorkspaceOnboardingModal';
import ResourceHistogram from './ResourceHistogram';

const TOOLBAR_BUTTON_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

interface Props {
  activities: ScheduleActivity[];
  cpmResult: CpmResult | null;
  scheduleSettings: ScheduleSettings;
  leveledOffsets?: Record<string, number>;
  logicLinks?: CpmLogicLink[];
  lineItems?: EstimateDomainTask[];
  onEditActivity?: (activityCode: string) => void;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  exportReady?: boolean;
  chartExportRef?: Ref<HTMLDivElement>;
  resourceHistogram?: ResourceHistogramDay[];
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
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !isLevelThreeGanttFullscreenTipDismissed(),
  );
  const shellRef = useRef<HTMLDivElement>(null);
  const chartScrollRef = useRef<HTMLDivElement>(null);

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

  const fitChartWidth = useCallback(() => {
    const scrollEl = chartScrollRef.current;
    if (!scrollEl) return;
    scrollEl.scrollLeft = 0;
    scrollEl.scrollTop = 0;
  }, []);

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

  const shell = (
    <div
      ref={shellRef}
      className={isFullscreen ? LEVEL_THREE_GANTT_FULLSCREEN_OVERLAY_CLASS : 'flex w-full flex-col gap-3'}
      data-level-three-gantt-workspace
      data-level-three-gantt-fullscreen={isFullscreen ? 'true' : 'false'}
    >
      {isFullscreen ? (
        <LevelThreeGanttFullscreenToolbar
          exportReady={exportReady}
          onExportPdf={onExportPdf}
          onExportExcel={onExportExcel}
          onFitWidth={fitChartWidth}
          onExitFullscreen={() => void exitFullscreen()}
        />
      ) : hasChart ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Level III Gantt
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Activities sorted by early start · Press F for full screen
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASS}
              onClick={() => void enterFullscreen()}
            >
              Full screen
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!exportReady}
              title={!exportReady ? 'Run CPM before exporting.' : undefined}
              onClick={onExportPdf}
            >
              Export PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!exportReady}
              title={!exportReady ? 'Run CPM before exporting.' : undefined}
              onClick={onExportExcel}
            >
              Export Excel
            </Button>
            <button
              type="button"
              className={TOOLBAR_BUTTON_CLASS}
              title="Workspace tips"
              aria-label="Show Level III Gantt workspace tips"
              onClick={() => setShowOnboarding(true)}
            >
              ?
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={
          isFullscreen
            ? `${LEVEL_THREE_GANTT_FULLSCREEN_CHART_WRAPPER_CLASS} flex flex-col`
            : 'space-y-6'
        }
      >
        <div
          ref={chartScrollRef}
          className={isFullscreen ? 'min-h-0 flex-1 overflow-auto' : undefined}
        >
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
          />
        </div>

        {showResourceHistogram ? (
          <div className={isFullscreen ? 'shrink-0 border-t border-slate-800 px-4 py-3' : undefined}>
            <ResourceHistogram
              histogram={resourceHistogram}
              projectDurationDays={cpmResult?.projectDurationDays ?? 0}
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
