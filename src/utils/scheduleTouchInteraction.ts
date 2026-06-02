export const MOBILE_SWIPE_THRESHOLD_PX = 70;
export const MOBILE_SWIPE_MAX_DURATION_MS = 900;
export const MOBILE_SWIPE_COOLDOWN_MS = 400;
export const MOBILE_SWIPE_AXIS_RATIO = 1.5;
export const MOBILE_TAP_MOVE_THRESHOLD_PX = 10;

export const SCHEDULE_INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [data-schedule-interactive="true"], [data-schedule-event="true"], [data-no-swipe="true"]';

export interface TouchPoint {
  x: number;
  y: number;
  time: number;
  blocked: boolean;
}

export function logScheduleTouchDebug(
  message: string,
  data?: Record<string, unknown>,
): void {
  if (import.meta.env.DEV) {
    console.log(`[schedule-touch] ${message}`, data ?? '');
  }
}

export function isScheduleInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(SCHEDULE_INTERACTIVE_SELECTOR);
}

export function createTouchPoint(
  clientX: number,
  clientY: number,
  target: EventTarget | null,
): TouchPoint {
  const blocked = isScheduleInteractiveTarget(target);
  return {
    x: clientX,
    y: clientY,
    time: Date.now(),
    blocked,
  };
}

export function evaluateHorizontalSwipe(
  start: TouchPoint,
  end: { x: number; y: number },
  lastSwipeAt: number,
  now = Date.now(),
): -1 | 1 | null {
  if (start.blocked) {
    logScheduleTouchDebug('swipe rejected: blocked start target');
    return null;
  }

  if (now - lastSwipeAt < MOBILE_SWIPE_COOLDOWN_MS) {
    logScheduleTouchDebug('swipe rejected: cooldown', { msSinceLast: now - lastSwipeAt });
    return null;
  }

  const elapsed = now - start.time;
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;

  if (elapsed > MOBILE_SWIPE_MAX_DURATION_MS) {
    logScheduleTouchDebug('swipe rejected: duration', { elapsed });
    return null;
  }

  if (Math.abs(deltaX) < MOBILE_SWIPE_THRESHOLD_PX) {
    logScheduleTouchDebug('swipe rejected: distance', { deltaX, deltaY, elapsed });
    return null;
  }

  if (Math.abs(deltaX) <= Math.abs(deltaY) * MOBILE_SWIPE_AXIS_RATIO) {
    logScheduleTouchDebug('swipe rejected: axis ratio', { deltaX, deltaY, elapsed });
    return null;
  }

  const direction = deltaX < 0 ? 1 : -1;
  logScheduleTouchDebug('swipe accepted', { deltaX, deltaY, elapsed, direction });
  return direction;
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
