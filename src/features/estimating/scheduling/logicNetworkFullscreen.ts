export const LOGIC_NETWORK_FULLSCREEN_TIP_DISMISSED_KEY = 'logicNetworkFullscreenTipDismissed';

export const LOGIC_NETWORK_FULLSCREEN_OVERLAY_CLASS =
  'fixed inset-0 z-[9999] flex flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100';

export const LOGIC_NETWORK_FULLSCREEN_CANVAS_WRAPPER_CLASS = 'min-h-0 flex-1 w-full';

export function isLogicNetworkFullscreenTipDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(LOGIC_NETWORK_FULLSCREEN_TIP_DISMISSED_KEY) === 'true';
}

export function setLogicNetworkFullscreenTipDismissed(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LOGIC_NETWORK_FULLSCREEN_TIP_DISMISSED_KEY, 'true');
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

export async function requestBrowserFullscreen(element?: HTMLElement | null): Promise<boolean> {
  const el = element ?? document.documentElement;
  try {
    await el.requestFullscreen?.();
    return Boolean(document.fullscreenElement);
  } catch {
    return false;
  }
}

export async function exitBrowserFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
    }
  } catch {
    // Browser fullscreen is optional; app overlay still exits via state.
  }
}
