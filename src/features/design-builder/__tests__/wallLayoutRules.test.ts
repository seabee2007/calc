import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { generateWallCorners } from '../domain/cornerBondEngine';
import {
  applyWallLayoutCommand,
  createWallLayoutHistory,
  redoWallLayoutHistory,
  undoWallLayoutHistory,
} from '../domain/wallLayoutHistory';
import {
  canGenerateSlabAndRoof,
  layoutFromPreset,
  syncPresetFromLayout,
} from '../domain/layoutWallAdapter';
import {
  addWallSegment,
  closeFootprint,
  createOutsideFaceRectangleLayout,
  deriveExteriorBounds,
  detectClosedFootprint,
  removeLastSegment,
  deleteWallSegment,
  segmentLength,
  summarizeSegmentModuleFit,
} from '../domain/wallLayoutRules';
import { createEmptyWallLayout } from '../domain/wallLayoutRules';

describe('wallLayoutRules', () => {
  it('creates connected segments from consecutive clicks', () => {
    let layout = createEmptyWallLayout();
    const first = { id: 'node-a', x: 0, z: 0 };
    layout = { ...layout, nodes: [first] };
    layout = addWallSegment(layout, first.id, 6, 0);
    layout = addWallSegment(layout, layout.nodes[layout.nodes.length - 1].id, 6, 5);
    expect(layout.segments).toHaveLength(2);
    expect(layout.nodes.length).toBeGreaterThanOrEqual(3);
  });

  it('reports outside-face rectangle dimensions as 6m x 5m', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const bounds = deriveExteriorBounds(layout);
    expect(bounds?.exteriorLengthMeters).toBeCloseTo(6, 6);
    expect(bounds?.exteriorWidthMeters).toBeCloseTo(5, 6);
    expect(layout.isFootprintClosed).toBe(true);
  });

  it('closes footprint and detects closed loop', () => {
    let layout = createEmptyWallLayout();
    const a = { id: 'a', x: 0, z: 0 };
    layout = { ...layout, nodes: [a] };
    layout = addWallSegment(layout, a.id, 5, 0);
    layout = addWallSegment(layout, layout.nodes[1].id, 5, 4);
    layout = addWallSegment(layout, layout.nodes[2].id, 0, 4);
    layout = closeFootprint(layout);
    expect(detectClosedFootprint(layout)).toBe(true);
  });

  it('supports exact segment length input', () => {
    const layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    const next = addWallSegment(layout, 'a', 10, 0, { exactLengthMeters: 6 });
    const segment = next.segments[0];
    expect(segmentLength(segment, next.nodes)).toBeCloseTo(6, 6);
  });

  it('removes the last segment while drawing', () => {
    let layout = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    layout = addWallSegment(layout, 'a', 3, 0);
    layout = removeLastSegment(layout);
    expect(layout.segments).toHaveLength(0);
  });

  it('removes a segment by id and orphan nodes', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const segmentId = layout.segments[0].id;
    const next = deleteWallSegment(layout, segmentId);
    expect(next.segments).toHaveLength(3);
    expect(next.segments.some((segment) => segment.id === segmentId)).toBe(false);
  });
});

describe('cornerBondEngine', () => {
  it('classifies outside corners on a closed rectangle', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    const corners = generateWallCorners(layout);
    expect(corners).toHaveLength(4);
    expect(corners.every((corner) => corner.cornerType === 'outside')).toBe(true);
    expect(corners.every((corner) => corner.bondStrategy === 'interlock')).toBe(true);
  });
});

describe('wallLayoutHistory', () => {
  it('supports undo and redo for layout commands', () => {
    const initial = createEmptyWallLayout({ nodes: [{ id: 'a', x: 0, z: 0 }] });
    let state = createWallLayoutHistory(initial);
    state = applyWallLayoutCommand(state, {
      type: 'set_layout',
      label: 'add segment',
      layout: addWallSegment(initial, 'a', 5, 0),
    });
    expect(state.present.segments).toHaveLength(1);
    state = undoWallLayoutHistory(state);
    expect(state.present.segments).toHaveLength(0);
    state = redoWallLayoutHistory(state);
    expect(state.present.segments).toHaveLength(1);
  });
});

describe('layoutWallAdapter', () => {
  it('converts preset example into layout graph source data', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    expect(preset.wallLayout.segments).toHaveLength(4);
    expect(preset.wall.openings.every((opening) => opening.wallSegmentId)).toBe(true);
    const bounds = deriveExteriorBounds(preset.wallLayout);
    expect(bounds?.exteriorLengthMeters).toBeCloseTo(6, 6);
    expect(bounds?.exteriorWidthMeters).toBeCloseTo(5, 6);
  });

  it('disables slab/roof generation until footprint is closed', () => {
    let layout = createEmptyWallLayout();
    layout = addWallSegment({ ...layout, nodes: [{ id: 'a', x: 0, z: 0 }] }, 'a', 5, 0);
    expect(canGenerateSlabAndRoof(layout)).toBe(false);
    const closed = createOutsideFaceRectangleLayout({ lengthMeters: 6, widthMeters: 5 });
    expect(canGenerateSlabAndRoof(closed)).toBe(true);
  });

  it('calculates module fit from drawn wall segments', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const fit = summarizeSegmentModuleFit(preset.wallLayout.segments[0], preset.wallLayout, preset.wall);
    expect(fit.lengthMeters).toBeCloseTo(6, 6);
    expect(['full', 'half', 'cut']).toContain(fit.fit.fit);
  });

  it('syncs preset dimensions from layout graph', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const synced = syncPresetFromLayout(preset, preset.wallLayout);
    expect(synced.footprint.lengthMeters).toBeCloseTo(6, 6);
    expect(synced.footprint.widthMeters).toBeCloseTo(5, 6);
    expect(layoutFromPreset(synced).segments).toHaveLength(4);
  });
});
