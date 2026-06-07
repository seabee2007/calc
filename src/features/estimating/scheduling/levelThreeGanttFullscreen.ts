export {
  exitBrowserFullscreen,
  isTypingTarget,
  requestBrowserFullscreen,
} from './logicNetworkFullscreen';

export const LEVEL_THREE_GANTT_FULLSCREEN_TIP_DISMISSED_KEY =
  'levelThreeGanttFullscreenTipDismissed';

export const LEVEL_THREE_GANTT_FULLSCREEN_OVERLAY_CLASS =
  'fixed inset-0 z-[9999] flex flex-col bg-slate-950';

export const LEVEL_THREE_GANTT_FULLSCREEN_CHART_WRAPPER_CLASS =
  'min-h-0 flex-1 w-full overflow-hidden';

export function isLevelThreeGanttFullscreenTipDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(LEVEL_THREE_GANTT_FULLSCREEN_TIP_DISMISSED_KEY) === 'true';
}

export function setLevelThreeGanttFullscreenTipDismissed(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LEVEL_THREE_GANTT_FULLSCREEN_TIP_DISMISSED_KEY, 'true');
}
