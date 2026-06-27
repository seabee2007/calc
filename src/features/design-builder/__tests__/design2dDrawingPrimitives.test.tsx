import { describe, expect, it } from 'vitest';
import { renderDrawingPrimitive, resolve2dDrawingStyle } from '../domain/design2dDrawingPrimitives';

describe('design2dDrawingPrimitives', () => {
  it('resolves architectural mode to paper and neutral drafting linework', () => {
    const style = resolve2dDrawingStyle('architectural');

    expect(style.sheetFill).toBe('#f8fafc');
    expect(style.lineStroke).toBe('#111827');
    expect(style.previewStroke).toBe('#06b6d4');
    expect(style.selectionStroke).toBe('#0891b2');
  });

  it('renders shared primitive data attributes for 2D drawing layers', () => {
    const primitive = renderDrawingPrimitive(
      {
        kind: 'dimension',
        key: 'test-dimension',
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0,
        offsetY: 24,
        label: '1000',
        data: { 'data-drawing-annotation': 'dimension' },
      },
      resolve2dDrawingStyle('architectural'),
    );

    expect(primitive).toMatchObject({
      key: 'test-dimension',
      props: expect.objectContaining({
        'data-drawing-annotation': 'dimension',
      }),
    });
  });
});
