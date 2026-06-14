export const ESTIMATE_WORKSPACE_FOCUS_MODE_KEY = 'estimate_workspace_focus_mode';

export function readEstimateWorkspaceFocusMode(): boolean {
  try {
    return localStorage.getItem(ESTIMATE_WORKSPACE_FOCUS_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeEstimateWorkspaceFocusMode(enabled: boolean): void {
  try {
    localStorage.setItem(ESTIMATE_WORKSPACE_FOCUS_MODE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage failures
  }
}
