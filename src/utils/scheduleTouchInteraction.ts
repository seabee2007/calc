export const MOBILE_SWIPE_THRESHOLD_PX = 100;
export const MOBILE_SWIPE_MAX_DURATION_MS = 600;
export const MOBILE_SWIPE_COOLDOWN_MS = 500;
export const MOBILE_SWIPE_AXIS_RATIO = 2;
export const MOBILE_TAP_MOVE_THRESHOLD_PX = 10;

export const SCHEDULE_INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [data-schedule-interactive="true"]';

export interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export function isScheduleInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(SCHEDULE_INTERACTIVE_SELECTOR);
}

export function evaluateHorizontalSwipe(
  start: TouchPoint,
  end: { x: number; y: number },
  lastSwipeAt: number,
  now = Date.now(),
): -1 | 1 | null {
  if (now - lastSwipeAt < MOBILE_SWIPE_COOLDOWN_MS) return null;

  const elapsed = now - start.time;
  if (elapsed > MOBILE_SWIPE_MAX_DURATION_MS) return null;

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;

  if (Math.abs(deltaX) < MOBILE_SWIPE_THRESHOLD_PX) return null;
  if (Math.abs(deltaX) <= Math.abs(deltaY) * MOBILE_SWIPE_AXIS_RATIO) return null;

  return deltaX < 0 ? 1 : -1;
}

export function isTapGesture(
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean {
  return (
    Math.abs(end.x - start.x) <= MOBILE_TAP_MOVE_THRESHOLD_PX &&
    Math.abs(end.y - start.y) <= MOBILE_TAP_MOVE_THRESHOLD_PX
  );
}
