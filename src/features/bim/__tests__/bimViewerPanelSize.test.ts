import { beforeEach, describe, expect, it } from 'vitest';
import {
  BIM_VIEWER_DEFAULT_RIGHT_PANEL_WIDTH,
  BIM_VIEWER_MIN_HEIGHT,
  BIM_VIEWER_MIN_RIGHT_PANEL_WIDTH,
  getMaxViewerHeight,
  readViewerPanelSize,
  resolveViewerHeightPreset,
  viewerSizeStorageKey,
  writeViewerPanelSize,
} from '../ui/bimViewerPanelSize';

describe('bimViewerPanelSize', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses project/estimate scoped storage keys with normal and focus modes', () => {
    expect(viewerSizeStorageKey('estimate-1', 'project-1', 'normal')).toBe(
      'arden:3dTakeoff:viewerSize:estimate-1:normal',
    );
    expect(viewerSizeStorageKey(null, 'project-1', 'focus')).toBe(
      'arden:3dTakeoff:viewerSize:project-1:focus',
    );
  });

  it('resolves height presets within viewport bounds', () => {
    expect(resolveViewerHeightPreset('60', false, 1000)).toBe(600);
    expect(resolveViewerHeightPreset('80', false, 1000)).toBe(740);
    expect(resolveViewerHeightPreset('full', true, 1000)).toBe(884);
    expect(resolveViewerHeightPreset('fit', false, 500)).toBe(BIM_VIEWER_MIN_HEIGHT);
  });

  it('calculates max height with reserved page chrome', () => {
    expect(getMaxViewerHeight(false, 1000)).toBe(740);
    expect(getMaxViewerHeight(true, 1000)).toBe(884);
  });

  it('persists and restores viewer size', () => {
    const key = viewerSizeStorageKey('estimate-1', 'project-1', 'normal');
    writeViewerPanelSize(key, { height: 480, rightPanelWidth: 420 });

    expect(readViewerPanelSize(key, false)).toEqual({
      height: 480,
      rightPanelWidth: 420,
    });
  });

  it('clamps restored viewer size to safe bounds', () => {
    const key = viewerSizeStorageKey('estimate-1', 'project-1', 'normal');
    writeViewerPanelSize(key, { height: 10, rightPanelWidth: 100 });

    expect(readViewerPanelSize(key, false)).toEqual({
      height: BIM_VIEWER_MIN_HEIGHT,
      rightPanelWidth: BIM_VIEWER_MIN_RIGHT_PANEL_WIDTH,
    });
  });

  it('falls back to defaults when no stored size exists', () => {
    expect(readViewerPanelSize('missing', false).rightPanelWidth).toBe(
      BIM_VIEWER_DEFAULT_RIGHT_PANEL_WIDTH,
    );
    expect(readViewerPanelSize('missing', false).height).toBeGreaterThanOrEqual(
      BIM_VIEWER_MIN_HEIGHT,
    );
  });
});
