import { describe, expect, it } from 'vitest';
import {
  computeDebugOverlayLayout,
  DEBUG_OVERLAY_GAP,
  DEBUG_OVERLAY_INSET,
} from '../ui/debugOverlayLayout';

describe('computeDebugOverlayLayout', () => {
  it('arranges roof debug panels in a right column and persistence panels on the left', () => {
    const layout = computeDebugOverlayLayout({
      containerWidth: 960,
      containerHeight: 640,
      panels: [
        { id: 'roof-reference-perimeters', width: 280, height: 168 },
        { id: 'truss-inspector', width: 280, height: 178 },
        { id: 'roof-framing-guides', width: 280, height: 198 },
        { id: 'gable-end-overhang', width: 280, height: 88 },
        { id: 'design-persistence', width: 280, height: 175 },
        { id: 'gable-rake-geometry', width: 280, height: 320 },
        { id: 'geometry-revision', width: 280, height: 52 },
      ],
    });

    expect(layout['roof-reference-perimeters']).toEqual({
      left: 960 - DEBUG_OVERLAY_INSET - 280,
      top: DEBUG_OVERLAY_INSET,
    });
    expect(layout['truss-inspector']?.top).toBe(DEBUG_OVERLAY_INSET + 168 + DEBUG_OVERLAY_GAP);
    expect(layout['design-persistence']).toEqual({
      left: DEBUG_OVERLAY_INSET,
      top: DEBUG_OVERLAY_INSET,
    });
    expect(layout['gable-rake-geometry']?.left).toBe(DEBUG_OVERLAY_INSET);
    expect(layout['gable-rake-geometry']?.top).toBe(640 - DEBUG_OVERLAY_INSET - 320);
    expect(layout['geometry-revision']?.top).toBe(640 - DEBUG_OVERLAY_INSET - 52);
    expect(layout['geometry-revision']?.left).toBe((960 - 280) / 2);
  });
});
