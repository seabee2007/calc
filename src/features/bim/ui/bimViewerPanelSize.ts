export const BIM_VIEWER_MIN_HEIGHT = 360;
export const BIM_VIEWER_DEFAULT_HEIGHT = 520;
export const BIM_VIEWER_MIN_RIGHT_PANEL_WIDTH = 320;
export const BIM_VIEWER_DEFAULT_RIGHT_PANEL_WIDTH = 360;
export const BIM_VIEWER_MAX_RIGHT_PANEL_WIDTH = 480;

export type BimViewerHeightPreset = 'fit' | '60' | '80' | 'full';

export interface BimViewerPanelSize {
  height: number;
  rightPanelWidth: number;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getMaxViewerHeight(focusMode: boolean, viewportHeight = window.innerHeight): number {
  const reserved = focusMode ? 116 : 260;
  return Math.max(BIM_VIEWER_MIN_HEIGHT, viewportHeight - reserved);
}

export function resolveViewerHeightPreset(
  preset: BimViewerHeightPreset,
  focusMode: boolean,
  viewportHeight = window.innerHeight,
): number {
  const maxHeight = getMaxViewerHeight(focusMode, viewportHeight);
  switch (preset) {
    case 'fit':
      return clampNumber(BIM_VIEWER_DEFAULT_HEIGHT, BIM_VIEWER_MIN_HEIGHT, maxHeight);
    case '60':
      return clampNumber(Math.round(viewportHeight * 0.6), BIM_VIEWER_MIN_HEIGHT, maxHeight);
    case '80':
      return clampNumber(Math.round(viewportHeight * 0.8), BIM_VIEWER_MIN_HEIGHT, maxHeight);
    case 'full':
      return maxHeight;
    default:
      return clampNumber(BIM_VIEWER_DEFAULT_HEIGHT, BIM_VIEWER_MIN_HEIGHT, maxHeight);
  }
}

export function viewerSizeStorageKey(
  estimateId: string | null | undefined,
  projectId: string,
  mode: 'normal' | 'focus',
): string {
  return `arden:3dTakeoff:viewerSize:${estimateId ?? projectId}:${mode}`;
}

export function readViewerPanelSize(
  key: string,
  focusMode: boolean,
): BimViewerPanelSize {
  const fallback: BimViewerPanelSize = {
    height: resolveViewerHeightPreset(focusMode ? 'full' : 'fit', focusMode),
    rightPanelWidth: BIM_VIEWER_DEFAULT_RIGHT_PANEL_WIDTH,
  };

  if (typeof localStorage === 'undefined') return fallback;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<BimViewerPanelSize>;
    return {
      height: clampNumber(
        Number(parsed.height) || fallback.height,
        BIM_VIEWER_MIN_HEIGHT,
        getMaxViewerHeight(focusMode),
      ),
      rightPanelWidth: clampNumber(
        Number(parsed.rightPanelWidth) || fallback.rightPanelWidth,
        BIM_VIEWER_MIN_RIGHT_PANEL_WIDTH,
        BIM_VIEWER_MAX_RIGHT_PANEL_WIDTH,
      ),
    };
  } catch {
    return fallback;
  }
}

export function writeViewerPanelSize(key: string, size: BimViewerPanelSize): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(size));
}
