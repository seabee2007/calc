import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOOR_THINSET_THICKNESS_METERS } from '../domain/floorTileCatalog';
import { computeTileRenderBounds, pointInPolygon, resolveFloorTileLayout } from '../domain/floorTileLayout';

const rectangle4x5: readonly { x: number; z: number }[] = [
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 5 },
  { x: 0, z: 5 },
];

const lShape: readonly { x: number; z: number }[] = [
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 2 },
  { x: 2, z: 2 },
  { x: 2, z: 5 },
  { x: 0, z: 5 },
];

describe('resolveFloorTileLayout', () => {
  it('returns disabled layout when floor tile finish is off', () => {
    const layout = resolveFloorTileLayout({
      interiorFacePolygon: rectangle4x5,
      floorTileFinish: { enabled: false },
      interiorFloorSlabEnabled: true,
    });
    expect(layout.enabled).toBe(false);
    expect(layout.placements).toHaveLength(0);
    expect(layout.fullTileCount).toBe(0);
  });

  it('returns disabled layout when interior floor slab is off', () => {
    const layout = resolveFloorTileLayout({
      interiorFacePolygon: rectangle4x5,
      floorTileFinish: { enabled: true },
      interiorFloorSlabEnabled: false,
    });
    expect(layout.enabled).toBe(false);
  });

  it('places top-edge cut tiles flush to the wall', () => {
    const depthPolygon: readonly { x: number; z: number }[] = [
      { x: -3, z: -2.31 },
      { x: 3, z: -2.31 },
      { x: 3, z: 2.31 },
      { x: -3, z: 2.31 },
    ];
    const bounds = computeTileRenderBounds({
      center: { x: 0, z: 2.412 },
      widthMeters: 0.6,
      depthMeters: 0.6,
      polygon: depthPolygon,
    });
    expect(bounds).not.toBeNull();
    expect(bounds!.renderCenter.z + bounds!.renderDepthMeters / 2).toBeCloseTo(2.31, 3);
    expect(bounds!.renderDepthMeters).toBeLessThan(0.6);

    const layout = resolveFloorTileLayout({
      interiorFacePolygon: depthPolygon,
      floorTileFinish: {
        enabled: true,
        tileSizeKey: '600x600',
        groutJointWidth: '1/8',
      },
      interiorFloorSlabEnabled: true,
    });
    const maxRenderZ = Math.max(
      ...layout.placements.map((placement) => placement.renderCenter.z + placement.renderDepthMeters / 2),
    );
    expect(maxRenderZ).toBeCloseTo(2.31, 2);
  });

  it('clips a left-edge tile while keeping the field-side module width', () => {
    const bounds = computeTileRenderBounds({
      center: { x: 0.191, z: 2.5 },
      widthMeters: 0.6,
      depthMeters: 0.6,
      polygon: rectangle4x5,
    });
    expect(bounds).not.toBeNull();
    expect(bounds!.renderWidthMeters).toBeLessThan(0.6);
    expect(bounds!.renderDepthMeters).toBeCloseTo(0.6, 3);
    expect(bounds!.renderCenter.x).toBeGreaterThan(0.191 - 0.3);
  });

  it('lays rectangular rooms from center with cut tiles at walls', () => {
    const layout = resolveFloorTileLayout({
      interiorFacePolygon: rectangle4x5,
      floorTileFinish: {
        enabled: true,
        tileSizeKey: '600x600',
        groutJointWidth: '1/8',
      },
      interiorFloorSlabEnabled: true,
    });
    expect(layout.enabled).toBe(true);
    expect(layout.fullTileCount).toBeGreaterThan(0);
    expect(layout.cutTileCount).toBeGreaterThan(0);
    expect(layout.totalTileCount).toBe(layout.fullTileCount + layout.cutTileCount);
    expect(layout.installedAreaSquareMeters).toBeCloseTo(20, 0);
    expect(layout.thinsetThicknessMeters).toBeCloseTo(DEFAULT_FLOOR_THINSET_THICKNESS_METERS, 4);
  });

  it('uses wider grout joints to change grout pitch metadata', () => {
    const narrow = resolveFloorTileLayout({
      interiorFacePolygon: rectangle4x5,
      floorTileFinish: { enabled: true, tileSizeKey: '600x600', groutJointWidth: '1/16' },
      interiorFloorSlabEnabled: true,
    });
    const wide = resolveFloorTileLayout({
      interiorFacePolygon: rectangle4x5,
      floorTileFinish: { enabled: true, tileSizeKey: '600x600', groutJointWidth: '1/4' },
      interiorFloorSlabEnabled: true,
    });
    expect(wide.groutJointMeters).toBeGreaterThan(narrow.groutJointMeters);
  });

  it('classifies only perimeter cuts on an L-shaped floor', () => {
    const layout = resolveFloorTileLayout({
      interiorFacePolygon: lShape,
      floorTileFinish: { enabled: true, tileSizeKey: '600x600', groutJointWidth: '1/8' },
      interiorFloorSlabEnabled: true,
    });
    expect(layout.enabled).toBe(true);
    expect(layout.cutTileCount).toBeGreaterThan(0);
    expect(layout.fullTileCount).toBeGreaterThan(0);
    for (const placement of layout.placements) {
      expect(['full', 'cut']).toContain(placement.kind);
    }
  });

  it('clips perimeter tiles on the wall side only, preserving field-side grout spacing', () => {
    const layout = resolveFloorTileLayout({
      interiorFacePolygon: rectangle4x5,
      floorTileFinish: {
        enabled: true,
        tileSizeKey: '600x600',
        groutJointWidth: '1/8',
      },
      interiorFloorSlabEnabled: true,
    });
    const cutPlacements = layout.placements.filter((placement) => placement.kind === 'cut');
    expect(cutPlacements.length).toBeGreaterThan(0);

    const leftWallCuts = cutPlacements.filter(
      (placement) => placement.renderCenter.x > placement.center.x,
    );
    expect(leftWallCuts.length).toBeGreaterThan(0);
    const leftWallEdgeCuts = leftWallCuts.filter(
      (placement) => placement.renderDepthMeters >= placement.depthMeters - 0.001,
    );
    expect(leftWallEdgeCuts.length).toBeGreaterThan(0);
    for (const placement of leftWallEdgeCuts) {
      expect(placement.renderDepthMeters).toBeCloseTo(placement.depthMeters, 3);
      expect(placement.renderWidthMeters).toBeLessThan(placement.widthMeters);
      expect(placement.renderCenter.x).toBeGreaterThan(placement.center.x - placement.widthMeters / 2);
    }

    const cornerCuts = cutPlacements.filter(
      (placement) =>
        placement.renderWidthMeters < placement.widthMeters - 0.001 &&
        placement.renderDepthMeters < placement.depthMeters - 0.001,
    );
    expect(cornerCuts.length).toBeGreaterThan(0);

    for (const placement of cutPlacements) {
      expect(placement.renderWidthMeters).toBeLessThanOrEqual(placement.widthMeters + 0.001);
      expect(placement.renderDepthMeters).toBeLessThanOrEqual(placement.depthMeters + 0.001);
      expect(placement.installedAreaSquareMeters).toBeLessThan(placement.widthMeters * placement.depthMeters);
    }
    const fullPlacements = layout.placements.filter((placement) => placement.kind === 'full');
    expect(fullPlacements.length).toBeGreaterThan(0);
    for (const placement of fullPlacements) {
      expect(placement.renderWidthMeters).toBeCloseTo(placement.widthMeters, 3);
      expect(placement.renderDepthMeters).toBeCloseTo(placement.depthMeters, 3);
    }
  });

  it('pointInPolygon detects interior and exterior points', () => {
    expect(pointInPolygon({ x: 2, z: 2.5 }, rectangle4x5)).toBe(true);
    expect(pointInPolygon({ x: -1, z: 2.5 }, rectangle4x5)).toBe(false);
  });

  it('clips corner tiles on both wall-facing sides', () => {
    const bounds = computeTileRenderBounds({
      center: { x: 0.191, z: 4.912 },
      widthMeters: 0.6,
      depthMeters: 0.6,
      polygon: rectangle4x5,
    });
    expect(bounds).not.toBeNull();
    expect(bounds!.renderWidthMeters).toBeLessThan(0.6);
    expect(bounds!.renderDepthMeters).toBeLessThan(0.6);
    expect(bounds!.renderCenter.x - bounds!.renderWidthMeters / 2).toBeCloseTo(0, 3);
    expect(bounds!.renderCenter.z + bounds!.renderDepthMeters / 2).toBeCloseTo(5, 3);

    const layout = resolveFloorTileLayout({
      interiorFacePolygon: rectangle4x5,
      floorTileFinish: {
        enabled: true,
        tileSizeKey: '600x600',
        groutJointWidth: '1/8',
      },
      interiorFloorSlabEnabled: true,
    });
    const cornerCuts = layout.placements.filter(
      (placement) =>
        placement.renderWidthMeters < placement.widthMeters - 0.001 &&
        placement.renderDepthMeters < placement.depthMeters - 0.001,
    );
    expect(cornerCuts.length).toBe(4);
  });
});
