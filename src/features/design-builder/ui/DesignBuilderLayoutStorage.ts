type ViewerHeightPreset = 'fit' | '60' | '80' | 'full';

export const VIEWER_MIN_HEIGHT = 360;
const VIEWER_DEFAULT_HEIGHT = 560;
export const RIGHT_PANEL_DEFAULT_WIDTH = 360;
export const RIGHT_PANEL_MIN_WIDTH = 320;
export const RIGHT_PANEL_MAX_WIDTH = 520;

export function leftPanelCollapsedKey(projectId: string, estimateId: string | null): string {
  return `arden:designBuilder:leftPanelCollapsed:${projectId}:${estimateId ?? 'project'}`;
}

export function rightPanelCollapsedKey(projectId: string, estimateId: string | null): string {
  return `arden:designBuilder:rightPanelCollapsed:${projectId}:${estimateId ?? 'project'}`;
}

function viewerSizeKey(projectId: string, estimateId: string | null, focusMode: boolean): string {
  return `arden:designBuilder:viewerSize:${projectId}:${estimateId ?? 'project'}:${focusMode ? 'focus' : 'normal'}`;
}

export function readBooleanStorage(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    return stored == null ? fallback : stored === 'true';
  } catch {
    return fallback;
  }
}

export function writeBooleanStorage(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures.
  }
}

export function maxViewerHeight(focusMode: boolean): number {
  const viewport = typeof window === 'undefined' ? 900 : window.innerHeight;
  return Math.max(VIEWER_MIN_HEIGHT, viewport - (focusMode ? 172 : 280));
}

export function resolveViewerHeightPreset(preset: ViewerHeightPreset, focusMode: boolean): number {
  const viewport = typeof window === 'undefined' ? 900 : window.innerHeight;
  const max = maxViewerHeight(focusMode);
  if (preset === '60') return clampNumber(Math.round(viewport * 0.6), VIEWER_MIN_HEIGHT, max);
  if (preset === '80') return clampNumber(Math.round(viewport * 0.8), VIEWER_MIN_HEIGHT, max);
  if (preset === 'full') return max;
  return clampNumber(VIEWER_DEFAULT_HEIGHT, VIEWER_MIN_HEIGHT, max);
}

export function readViewerSize(projectId: string, estimateId: string | null, focusMode: boolean) {
  const fallback = {
    height: resolveViewerHeightPreset(focusMode ? 'full' : 'fit', focusMode),
    rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH,
  };
  try {
    const raw = localStorage.getItem(viewerSizeKey(projectId, estimateId, focusMode));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<typeof fallback>;
    return {
      height: clampNumber(Number(parsed.height) || fallback.height, VIEWER_MIN_HEIGHT, maxViewerHeight(focusMode)),
      rightPanelWidth: clampNumber(Number(parsed.rightPanelWidth) || fallback.rightPanelWidth, RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH),
    };
  } catch {
    return fallback;
  }
}

export function writeViewerSize(projectId: string, estimateId: string | null, focusMode: boolean, size: { height: number; rightPanelWidth: number }) {
  try {
    localStorage.setItem(viewerSizeKey(projectId, estimateId, focusMode), JSON.stringify(size));
  } catch {
    // Ignore storage failures.
  }
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
