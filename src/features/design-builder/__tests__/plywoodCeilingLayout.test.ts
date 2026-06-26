import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLYWOOD_CEILING_BRACE_SPACING_METERS,
  DEFAULT_PLYWOOD_SHEET_LENGTH_METERS,
  DEFAULT_PLYWOOD_SHEET_WIDTH_METERS,
} from '../domain/plywoodCeilingCatalog';
import { resolvePlywoodCeilingLayout } from '../domain/plywoodCeilingLayout';
import {
  createDefaultRcFrameFoundationSettings,
  normalizeRcFrameFoundationSettings,
} from '../domain/rcFrameFoundationMigration';
import { serializePersistedDesignBuilderState } from '../domain/designBuilderPersistence';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';

/** 20' × 40' interior (6.096 m × 12.192 m). */
const rectangle20x40: readonly { x: number; z: number }[] = [
  { x: 0, z: 0 },
  { x: 6.096, z: 0 },
  { x: 6.096, z: 12.192 },
  { x: 0, z: 12.192 },
];

describe('resolvePlywoodCeilingLayout', () => {
  it('returns disabled layout when plywood ceiling is off', () => {
    const layout = resolvePlywoodCeilingLayout({
      interiorFacePolygon: rectangle20x40,
      plywoodCeiling: { enabled: false },
    });
    expect(layout.enabled).toBe(false);
    expect(layout.frameMembers).toHaveLength(0);
    expect(layout.panelPlacements).toHaveLength(0);
  });

  it('returns disabled layout when footprint is too small', () => {
    const layout = resolvePlywoodCeilingLayout({
      interiorFacePolygon: [
        { x: 0, z: 0 },
        { x: 0.01, z: 0 },
        { x: 0.01, z: 0.02 },
      ],
      plywoodCeiling: { enabled: true },
    });
    expect(layout.enabled).toBe(false);
    expect(layout.warnings.length).toBeGreaterThan(0);
  });

  it('generates four perimeter tubes inside the footprint', () => {
    const layout = resolvePlywoodCeilingLayout({
      interiorFacePolygon: rectangle20x40,
      plywoodCeiling: { enabled: true, ceilingHeightMeters: 2.5 },
    });
    const perimeter = layout.frameMembers.filter((member) => member.kind === 'perimeter');
    expect(perimeter).toHaveLength(4);
    perimeter.forEach((member) => {
      expect(member.start.y).toBeCloseTo(member.end.y, 5);
      expect(member.start.y).toBeGreaterThan(2.5);
    });
  });

  it('spans cross braces across the short dimension and repeats along the long dimension', () => {
    const layout = resolvePlywoodCeilingLayout({
      interiorFacePolygon: rectangle20x40,
      plywoodCeiling: { enabled: true, ceilingHeightMeters: 2.5 },
    });
    expect(layout.longAxis).toBe('z');
    expect(layout.shortSpanMeters).toBeCloseTo(6.096 - layout.tubeSizeMeters, 2);
    expect(layout.longSpanMeters).toBeCloseTo(12.192 - layout.tubeSizeMeters, 2);

    const braces = layout.frameMembers.filter((member) => member.kind === 'cross_brace');
    expect(braces.length).toBeGreaterThan(1);

    const shortSpan = layout.shortSpanMeters;
    braces.forEach((brace) => {
      const dx = Math.abs(brace.end.x - brace.start.x);
      const dz = Math.abs(brace.end.z - brace.start.z);
      const span = layout.longAxis === 'z' ? dx : dz;
      expect(span).toBeCloseTo(shortSpan, 1);
    });

    const stations = braces.map((brace) => (layout.longAxis === 'z' ? brace.start.z : brace.start.x));
    stations.sort((left, right) => left - right);
    expect(stations[0]).toBeCloseTo(layout.longAxis === 'z' ? 0.0254 : 0.0254, 2);
    for (let index = 1; index < stations.length - 1; index += 1) {
      const delta = stations[index]! - stations[index - 1]!;
      expect(delta).toBeCloseTo(DEFAULT_PLYWOOD_CEILING_BRACE_SPACING_METERS, 1);
    }
  });

  it('covers the footprint with staggered plywood rows', () => {
    const layout = resolvePlywoodCeilingLayout({
      interiorFacePolygon: rectangle20x40,
      plywoodCeiling: { enabled: true, ceilingHeightMeters: 2.5 },
    });
    expect(layout.panelPlacements.length).toBeGreaterThan(0);
    expect(layout.totalPanelCount).toBe(layout.fullPanelCount + layout.cutPanelCount);

    const rowCenters = [
      ...new Set(layout.panelPlacements.map((panel) => panel.center.x.toFixed(3))),
    ].map(Number.parseFloat);
    expect(rowCenters.length).toBeGreaterThan(1);

    const panelsByRow = new Map<number, typeof layout.panelPlacements>();
    layout.panelPlacements.forEach((panel) => {
      const key = Number(panel.center.x.toFixed(3));
      const row = panelsByRow.get(key) ?? [];
      row.push(panel);
      panelsByRow.set(key, row);
    });
    const rowKeys = [...panelsByRow.keys()].sort((left, right) => left - right);
    const evenRowCentersZ = panelsByRow.get(rowKeys[0]!)!.map((panel) => panel.center.z).sort((a, b) => a - b);
    const oddRowCentersZ = panelsByRow.get(rowKeys[1]!)!.map((panel) => panel.center.z).sort((a, b) => a - b);
    expect(evenRowCentersZ[0]).not.toBeCloseTo(oddRowCentersZ[0]!, 1);

    const maxX = Math.max(...layout.panelPlacements.map((panel) => panel.center.x + panel.widthMeters / 2));
    const minX = Math.min(...layout.panelPlacements.map((panel) => panel.center.x - panel.widthMeters / 2));
    const maxZ = Math.max(...layout.panelPlacements.map((panel) => panel.center.z + panel.lengthMeters / 2));
    const minZ = Math.min(...layout.panelPlacements.map((panel) => panel.center.z - panel.lengthMeters / 2));
    expect(minX).toBeGreaterThanOrEqual(-0.05);
    expect(maxX).toBeLessThanOrEqual(6.096 + 0.05);
    expect(minZ).toBeGreaterThanOrEqual(-0.05);
    expect(maxZ).toBeLessThanOrEqual(12.192 + 0.05);
  });

  it('clips edge panels instead of extending past the footprint', () => {
    const layout = resolvePlywoodCeilingLayout({
      interiorFacePolygon: rectangle20x40,
      plywoodCeiling: { enabled: true, ceilingHeightMeters: 2.5 },
    });
    expect(layout.cutPanelCount).toBeGreaterThan(0);
    layout.panelPlacements.forEach((panel) => {
      expect(panel.widthMeters).toBeLessThanOrEqual(DEFAULT_PLYWOOD_SHEET_WIDTH_METERS + 0.01);
      expect(panel.lengthMeters).toBeLessThanOrEqual(DEFAULT_PLYWOOD_SHEET_LENGTH_METERS + 0.01);
    });
  });

  it('places plywood below the metal frame', () => {
    const layout = resolvePlywoodCeilingLayout({
      interiorFacePolygon: rectangle20x40,
      plywoodCeiling: { enabled: true, ceilingHeightMeters: 2.5 },
    });
    const frameBottomY = layout.frameBottomElevationMeters;
    layout.panelPlacements.forEach((panel) => {
      const panelTop = panel.center.y + panel.thicknessMeters / 2;
      expect(panelTop).toBeLessThan(frameBottomY);
    });
  });

  it('clamps ceiling height to the available interior clear height', () => {
    const layout = resolvePlywoodCeilingLayout({
      interiorFacePolygon: rectangle20x40,
      plywoodCeiling: { enabled: true, ceilingHeightMeters: 4 },
      maxCeilingHeightMeters: 2.8,
    });
    expect(layout.frameBottomElevationMeters).toBeCloseTo(2.8, 3);
    expect(layout.warnings.some((warning) => warning.includes('clamped'))).toBe(true);
  });
});

describe('plywood ceiling persistence', () => {
  it('round-trips plywood ceiling settings through foundation normalization and preset serialization', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const foundation = {
      ...createDefaultRcFrameFoundationSettings(),
      plywoodCeiling: {
        ...createDefaultRcFrameFoundationSettings().plywoodCeiling,
        enabled: true,
        ceilingHeightMeters: 2.65,
        plywoodColor: '#c8a882',
      },
    };
    const normalized = normalizeRcFrameFoundationSettings({
      ...foundation,
      plywoodCeiling: foundation.plywoodCeiling,
    });
    expect(normalized.plywoodCeiling.enabled).toBe(true);
    expect(normalized.plywoodCeiling.ceilingHeightMeters).toBe(2.65);
    expect(normalized.plywoodCeiling.plywoodColor).toBe('#c8a882');

    const serialized = serializePersistedDesignBuilderState(
      { ...preset, foundationSettings: normalized },
      { visualStyle: 'material_preview' },
    );
    expect(serialized.rcFrameFoundation?.plywoodCeiling?.enabled).toBe(true);
    expect(serialized.rcFrameFoundation?.plywoodCeiling?.plywoodColor).toBe('#c8a882');
  });
});
