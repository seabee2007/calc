export const ESTIMATE_WORKSPACE_HEADER_PINNED_KEY = 'estimate_workspace_header_pinned';

export function readEstimateWorkspaceHeaderPinned(): boolean {
  try {
    return localStorage.getItem(ESTIMATE_WORKSPACE_HEADER_PINNED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeEstimateWorkspaceHeaderPinned(pinned: boolean): void {
  try {
    localStorage.setItem(ESTIMATE_WORKSPACE_HEADER_PINNED_KEY, pinned ? 'true' : 'false');
  } catch {
    // ignore storage failures
  }
}
