import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import { buildDesignGeometryInputFromLayout, generateDesignGeometry } from '../geometry/designGeometry';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import {
  masonryTopEnvelopeYAtStation,
  roofToCapClearanceAtStation,
  solveRakedCapPlacementsWithWarnings,
} from '../domain/rakedCapSolver';
import {
  capTopYAtStation,
  purlinBottomYAtStation,
  rakedCapTopYAtStation,
  roofCladdingUndersideYAtStation,
  allowedMasonryTopYAtStation,
} from '../domain/roofGableSolver';
import { PURLIN_BOTTOM_INSET_FROM_ROOF_TOP_METERS } from '../domain/roofFramingResolver';
import { resolveCmuModuleDefinition } from '../domain/cmuModuleRules';
import { resolveGableRidgeStationMeters } from '../domain/gableEndMasonrySolver';
import {
  buildRakedCapStripRenderSegments,
  RAKED_CAP_STRIP_STATION_GAP_TOLERANCE_METERS,
} from '../geometry/roofRenderingGeometry';

function expectDefined<T>(value: T | null | undefined): asserts value is T {
  expect(value).toBeDefined();
}

function gableGeometry(overrides: Partial<import('../types').RoofSystemSettings> = {}) {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);
  const roofSystem = {
    ...createDefaultRoofSystemSettings(),
    roofType: 'gable' as const,
    gable: { ...createDefaultRoofSystemSettings().gable, enabled: true, rakedConcreteCapEnabled: true },
    ...overrides,
  };
  return {
    preset,
    geometry: generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: preset.wall,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
        buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
        frameSystem: preset.frameSystem,
        foundationSettings: foundation,
        infillSystem: preset.infillSystem,
        gableEndSystem: preset.gableEndSystem,
        roofSystem,
      }),
    ),
    roofSystem,
  };
}

describe('rakedCapSolver — purlin contact and minimum depth', () => {
  it('uses purlin bottom inset from roof top surface', () => {
    expect(PURLIN_BOTTOM_INSET_FROM_ROOF_TOP_METERS).toBeCloseTo(0.082, 3);
  });

  it('places cap top flush with purlin bottom when purlins are enabled', () => {
    const { geometry, roofSystem } = gableGeometry();
    const roof = geometry.resolvedRoofSystem!;
    const frames = geometry.wallCmuLayout.segmentFrames ?? [];
    for (const cap of geometry.rakedCapPlacements ?? []) {
      const frame = frames.find((entry) => entry.segmentId === cap.gableEndSegmentId)!;
      const panel = geometry.infillSystem?.panels.find((entry) => entry.hostSegmentId === cap.gableEndSegmentId);
      expectDefined(panel);
      for (const station of [cap.startStationMeters, cap.endStationMeters]) {
        const capTopY = station === cap.startStationMeters ? cap.startTopY : cap.endTopY;
        const clearance = roofToCapClearanceAtStation({
          capTopY,
          resolvedRoof: roof,
          roofSystem,
          frame,
          stationMeters: station,
          panelStartStation: panel.startStationMeters,
          panelEndStation: panel.endStationMeters,
        });
        expect(clearance).toBeGreaterThanOrEqual(-0.001);
        expect(clearance).toBeLessThanOrEqual(0.002);
      }
    }
  });

  it('does not lower cap top when minimum rake depth increases', () => {
    const tight = gableGeometry({ gable: { ...createDefaultRoofSystemSettings().gable, enabled: true, rakeClearanceMeters: 0.08, rakedConcreteCapEnabled: true } });
    const loose = gableGeometry({ gable: { ...createDefaultRoofSystemSettings().gable, enabled: true, rakeClearanceMeters: 0.25, rakedConcreteCapEnabled: true } });
    const gableSegmentId = tight.geometry.resolvedRoofSystem!.gableEndSegmentIds[0]!;
    const frame = (tight.geometry.wallCmuLayout.segmentFrames ?? []).find((entry) => entry.segmentId === gableSegmentId)!;
    const panel = tight.geometry.infillSystem?.panels.find((entry) => entry.hostSegmentId === gableSegmentId);
    expectDefined(panel);
    const station = (panel.startStationMeters + panel.endStationMeters) / 2;
    const tightTop = rakedCapTopYAtStation({
      resolvedRoof: tight.geometry.resolvedRoofSystem!,
      roofSystem: tight.roofSystem,
      frame,
      stationMeters: station,
      panelStartStation: panel.startStationMeters,
      panelEndStation: panel.endStationMeters,
    });
    const looseTop = rakedCapTopYAtStation({
      resolvedRoof: loose.geometry.resolvedRoofSystem!,
      roofSystem: loose.roofSystem,
      frame,
      stationMeters: station,
      panelStartStation: panel.startStationMeters,
      panelEndStation: panel.endStationMeters,
    });
    expect(tightTop).toBeCloseTo(looseTop, 4);
  });

  it('does not warn when increased gable concrete fill exceeds the default 4 in cover', () => {
    const { geometry } = gableGeometry({
      gable: {
        ...createDefaultRoofSystemSettings().gable,
        enabled: true,
        rakeClearanceMeters: 1.3,
        rakedConcreteCapEnabled: true,
      },
    });
    const warnings =
      geometry.resolvedRoofSystem?.gableEnds.flatMap((gableEnd) => gableEnd.warnings) ?? [];

    expect(
      warnings.filter((warning) => warning.code === 'insufficient_raked_cap_depth'),
    ).toHaveLength(0);
  });

  it('sets cap bottom to resolved CMU envelope and cap top to rakedCapTopYAtStation', () => {
    const { geometry, roofSystem, preset } = gableGeometry();
    const gableBlocks = geometry.blockInstances.filter((block) => block.source === 'gable_end_solver');
    const gableSegmentId = geometry.resolvedRoofSystem!.gableEndSegmentIds[0]!;
    const frame = (geometry.wallCmuLayout.segmentFrames ?? []).find((entry) => entry.segmentId === gableSegmentId)!;
    const panel = geometry.infillSystem?.panels.find((entry) => entry.hostSegmentId === gableSegmentId);
    expectDefined(panel);
    const module = resolveCmuModuleDefinition(preset.wall);
    const { placements } = solveRakedCapPlacementsWithWarnings({
      gableEndSegmentId: gableSegmentId,
      panelId: panel.id,
      frame,
      panelStartStation: panel.startStationMeters,
      panelEndStation: panel.endStationMeters,
      panelBottomElevationMeters: panel.bottomElevationMeters,
      blocks: gableBlocks,
      roofSystem,
      resolvedRoof: geometry.resolvedRoofSystem!,
      wallDepthMeters: frame.wallThicknessMeters ?? module.blockDepthMeters,
      moduleHeightMeters: module.nominalModuleHeightMeters,
    });
    expect(placements.length).toBeGreaterThan(0);
    for (const cap of placements) {
      expect(cap.startTopY).toBeCloseTo(
        rakedCapTopYAtStation({
          resolvedRoof: geometry.resolvedRoofSystem!,
          roofSystem,
          frame,
          stationMeters: cap.startStationMeters,
          panelStartStation: panel.startStationMeters,
          panelEndStation: panel.endStationMeters,
        }),
        4,
      );
    }
  });

  it('fills too-small ridge CMU remainder with raked concrete cap', () => {
    const { geometry, roofSystem, preset } = gableGeometry();
    const roof = geometry.resolvedRoofSystem!;
    const gableSegmentId = roof.gableEndSegmentIds[0]!;
    const frame = (geometry.wallCmuLayout.segmentFrames ?? []).find((entry) => entry.segmentId === gableSegmentId)!;
    const panel = geometry.infillSystem?.panels.find((entry) => entry.hostSegmentId === gableSegmentId);
    expectDefined(panel);
    const module = resolveCmuModuleDefinition(preset.wall);
    const ridgeStation = resolveGableRidgeStationMeters({ frame, resolvedRoof: roof });
    const gableBlocks = geometry.blockInstances.filter(
      (block) => block.segmentId === gableSegmentId && block.source === 'gable_end_solver',
    );
    const ridgeBlocks = gableBlocks.filter((block) => {
      const start = block.startAlongMeters ?? block.stationMeters ?? 0;
      const end = block.endAlongMeters ?? start + (block.nominalLengthMeters ?? block.lengthMeters);
      return start <= ridgeStation + 0.001 && end >= ridgeStation - 0.001;
    });
    const topCourseIndex = Math.max(
      ...gableBlocks.map((block) => block.courseIndex ?? 0),
    );
    const ridgeMasonryTop = masonryTopEnvelopeYAtStation({
      blocks: gableBlocks,
      stationMeters: ridgeStation,
    });
    const caps = (geometry.rakedCapPlacements ?? []).filter(
      (cap) => cap.gableEndSegmentId === gableSegmentId,
    );
    const leftCap = caps
      .filter((cap) => cap.slope === 'left')
      .sort((left, right) => right.endStationMeters - left.endStationMeters)[0];
    const rightCap = caps
      .filter((cap) => cap.slope === 'right')
      .sort((left, right) => left.startStationMeters - right.startStationMeters)[0];
    const capTopAtRidge = capTopYAtStation({
      resolvedRoof: roof,
      roofSystem,
      frame,
      stationMeters: ridgeStation,
      panelStartStation: panel.startStationMeters,
      panelEndStation: panel.endStationMeters,
    });

    expect(ridgeBlocks.length).toBeGreaterThan(0);
    expect(
      ridgeBlocks.some(
        (block) =>
          (block.courseIndex ?? 0) < topCourseIndex &&
          block.kind === 'cut_height_block' &&
          (block.physicalHeightMeters ?? block.heightMeters ?? 0) <
            module.actualBlockHeightMeters - 0.01,
      ),
    ).toBe(false);
    expect(leftCap).toBeDefined();
    expect(rightCap).toBeDefined();
    expect(leftCap!.endStationMeters).toBeCloseTo(ridgeStation, 3);
    expect(rightCap!.startStationMeters).toBeCloseTo(ridgeStation, 3);
    expect(leftCap!.endBottomY).toBeCloseTo(ridgeMasonryTop - 0.001, 3);
    expect(rightCap!.startBottomY).toBeCloseTo(ridgeMasonryTop - 0.001, 3);
    expect(capTopAtRidge - leftCap!.endBottomY).toBeGreaterThanOrEqual(
      roofSystem.gable.rakeClearanceMeters - 0.002,
    );
    expect(capTopAtRidge - ridgeMasonryTop).toBeGreaterThan(
      module.actualBlockHeightMeters / 2,
    );
  });

  it('keeps cap top at purlin bottom when assembly thickness changes', () => {
    const thin = gableGeometry({ roofAssemblyThicknessMeters: 0.12 });
    const thick = gableGeometry({ roofAssemblyThicknessMeters: 0.22 });
    const thinTop = thin.geometry.rakedCapPlacements?.[0]?.startTopY ?? 0;
    const thickTop = thick.geometry.rakedCapPlacements?.[0]?.startTopY ?? 0;
    expect(thickTop).toBeCloseTo(thinTop, 4);
  });

  it('keeps cap top at purlin bottom and above cladding underside when purlins enabled', () => {
    const { geometry, roofSystem } = gableGeometry({ eaveOverhangMeters: 0.5 });
    const roof = geometry.resolvedRoofSystem!;
    const frames = geometry.wallCmuLayout.segmentFrames ?? [];
    for (const cap of geometry.rakedCapPlacements ?? []) {
      const frame = frames.find((entry) => entry.segmentId === cap.gableEndSegmentId)!;
      const panel = geometry.infillSystem?.panels.find((entry) => entry.hostSegmentId === cap.gableEndSegmentId);
      expectDefined(panel);
      const undersideStart = roofCladdingUndersideYAtStation({
        resolvedRoof: roof,
        frame,
        stationMeters: cap.startStationMeters,
        panelStartStation: panel.startStationMeters,
        panelEndStation: panel.endStationMeters,
      });
      const purlinBottomStart = purlinBottomYAtStation({
        resolvedRoof: roof,
        frame,
        stationMeters: cap.startStationMeters,
        panelStartStation: panel.startStationMeters,
        panelEndStation: panel.endStationMeters,
        roofSystem,
      });
      expect(cap.startTopY).toBeGreaterThanOrEqual(undersideStart - 0.001);
      expect(cap.startTopY).toBeCloseTo(purlinBottomStart, 4);
      expect(capTopYAtStation({
        resolvedRoof: roof,
        roofSystem,
        frame,
        stationMeters: cap.startStationMeters,
        panelStartStation: panel.startStationMeters,
        panelEndStation: panel.endStationMeters,
      })).toBeCloseTo(cap.startTopY, 4);
    }
  });

  it('falls back to cladding underside when purlins are disabled', () => {
    const { geometry, roofSystem } = gableGeometry({ purlins: { enabled: false, maxSpacingMeters: 1.2, profileLabel: 'Conceptual C-channel purlin' } });
    const roof = geometry.resolvedRoofSystem!;
    expect(roof.purlinPlacements.length).toBe(0);
    const gableSegmentId = roof.gableEndSegmentIds[0]!;
    const frame = (geometry.wallCmuLayout.segmentFrames ?? []).find((entry) => entry.segmentId === gableSegmentId)!;
    const panel = geometry.infillSystem?.panels.find((entry) => entry.hostSegmentId === gableSegmentId);
    expectDefined(panel);
    const cap = geometry.rakedCapPlacements?.[0];
    expect(cap).toBeDefined();
    const underside = roofCladdingUndersideYAtStation({
      resolvedRoof: roof,
      frame,
      stationMeters: cap!.startStationMeters,
      panelStartStation: panel!.startStationMeters,
      panelEndStation: panel!.endStationMeters,
    });
    expect(cap!.startTopY).toBeCloseTo(underside, 4);
    expect(rakedCapTopYAtStation({
      resolvedRoof: roof,
      roofSystem,
      frame,
      stationMeters: cap!.startStationMeters,
      panelStartStation: panel!.startStationMeters,
      panelEndStation: panel!.endStationMeters,
    })).toBeCloseTo(underside, 4);
  });

  it('renders separated masonry cap spans as one continuous concrete strip', () => {
    const { geometry } = gableGeometry();
    const capsBySide = new Map<string, typeof geometry.rakedCapPlacements>();

    for (const cap of geometry.rakedCapPlacements ?? []) {
      const key = `${cap.gableEndSegmentId}:${cap.slope}`;
      const caps = capsBySide.get(key) ?? [];
      caps.push(cap);
      capsBySide.set(key, caps);
    }

    const sideWithStationGaps = [...capsBySide.values()].find((caps) =>
      [...(caps ?? [])]
        .sort((left, right) => left.startStationMeters - right.startStationMeters)
        .some((cap, index, sortedCaps) => {
          const prior = sortedCaps[index - 1];
          return (
            prior !== undefined &&
            cap.startStationMeters - prior.endStationMeters >
              RAKED_CAP_STRIP_STATION_GAP_TOLERANCE_METERS
          );
        }),
    );

    expect(sideWithStationGaps).toBeDefined();

    const sortedCaps = [...(sideWithStationGaps ?? [])].sort(
      (left, right) => left.startStationMeters - right.startStationMeters,
    );
    const strip = buildRakedCapStripRenderSegments(sortedCaps);
    const expectedLength =
      sortedCaps[sortedCaps.length - 1]!.endStationMeters -
      sortedCaps[0]!.startStationMeters;
    const renderedLength =
      strip?.segments.reduce(
        (sum, segment) => sum + segment.spanMeters,
        0,
      ) ?? 0;

    expect(strip).toBeDefined();
    expect(strip?.startStationMeters).toBeCloseTo(
      sortedCaps[0]!.startStationMeters,
      4,
    );
    expect(renderedLength).toBeCloseTo(expectedLength, 4);
    expect(strip?.segments.length).toBeGreaterThan(sortedCaps.length);
  });

  it('drops terminal raked cap ends to the roof beam top at each eave', () => {
    const { geometry } = gableGeometry();
    const roof = geometry.resolvedRoofSystem!;

    for (const gableSegmentId of roof.gableEndSegmentIds) {
      const panel = geometry.infillSystem?.panels.find(
        (entry) => entry.hostSegmentId === gableSegmentId,
      );
      expect(panel).toBeDefined();

      const caps = (geometry.rakedCapPlacements ?? []).filter(
        (cap) => cap.gableEndSegmentId === gableSegmentId,
      );
      const leftStartCap = caps
        .filter((cap) => cap.slope === 'left')
        .sort((a, b) => a.startStationMeters - b.startStationMeters)[0];
      const rightEndCap = caps
        .filter((cap) => cap.slope === 'right')
        .sort((a, b) => b.endStationMeters - a.endStationMeters)[0];

      expect(leftStartCap).toBeDefined();
      expect(rightEndCap).toBeDefined();
      expect(leftStartCap!.startStationMeters).toBeCloseTo(
        panel!.startStationMeters,
        3,
      );
      expect(rightEndCap!.endStationMeters).toBeCloseTo(
        panel!.endStationMeters,
        3,
      );
      expect(leftStartCap!.startBottomY).toBeCloseTo(
        roof.roofBeamTopElevationMeters,
        3,
      );
      expect(rightEndCap!.endBottomY).toBeCloseTo(
        roof.roofBeamTopElevationMeters,
        3,
      );
      expect(leftStartCap!.startTopY).toBeGreaterThan(
        leftStartCap!.startBottomY,
      );
      expect(rightEndCap!.endTopY).toBeGreaterThan(
        rightEndCap!.endBottomY,
      );
    }
  });

  it('fills eave terminal gaps when gable CMU begins inboard of the roof beam end', () => {
    const { geometry } = gableGeometry({
      gable: {
        ...createDefaultRoofSystemSettings().gable,
        enabled: true,
        rakeClearanceMeters: 0.35,
        rakedConcreteCapEnabled: true,
      },
    });
    const roof = geometry.resolvedRoofSystem!;

    for (const gableSegmentId of roof.gableEndSegmentIds) {
      const panel = geometry.infillSystem?.panels.find(
        (entry) => entry.hostSegmentId === gableSegmentId,
      );
      expect(panel).toBeDefined();

      const blocks = geometry.blockInstances.filter(
        (block) =>
          block.segmentId === gableSegmentId &&
          block.source === 'gable_end_solver',
      );
      const leftmostBlockStart = Math.min(
        ...blocks.map((block) => block.startAlongMeters ?? block.stationMeters ?? 0),
      );
      const rightmostBlockEnd = Math.max(
        ...blocks.map(
          (block) =>
            block.endAlongMeters ??
            (block.startAlongMeters ?? block.stationMeters ?? 0) +
              (block.nominalLengthMeters ?? block.lengthMeters),
        ),
      );
      expect(leftmostBlockStart).toBeGreaterThan(
        panel!.startStationMeters + 0.01,
      );
      expect(rightmostBlockEnd).toBeLessThan(
        panel!.endStationMeters - 0.01,
      );

      const caps = (geometry.rakedCapPlacements ?? []).filter(
        (cap) => cap.gableEndSegmentId === gableSegmentId,
      );
      const leftStartCap = caps
        .filter((cap) => cap.slope === 'left')
        .sort((a, b) => a.startStationMeters - b.startStationMeters)[0];
      const rightEndCap = caps
        .filter((cap) => cap.slope === 'right')
        .sort((a, b) => b.endStationMeters - a.endStationMeters)[0];

      expect(leftStartCap).toBeDefined();
      expect(rightEndCap).toBeDefined();
      expect(leftStartCap!.startStationMeters).toBeCloseTo(
        panel!.startStationMeters,
        3,
      );
      expect(leftStartCap!.endStationMeters).toBeCloseTo(
        leftmostBlockStart,
        2,
      );
      expect(rightEndCap!.startStationMeters).toBeCloseTo(
        rightmostBlockEnd,
        2,
      );
      expect(rightEndCap!.endStationMeters).toBeCloseTo(
        panel!.endStationMeters,
        3,
      );
      expect(leftStartCap!.startBottomY).toBeCloseTo(
        roof.roofBeamTopElevationMeters,
        3,
      );
      expect(leftStartCap!.endBottomY).toBeCloseTo(
        roof.roofBeamTopElevationMeters,
        3,
      );
      expect(rightEndCap!.startBottomY).toBeCloseTo(
        roof.roofBeamTopElevationMeters,
        3,
      );
      expect(rightEndCap!.endBottomY).toBeCloseTo(
        roof.roofBeamTopElevationMeters,
        3,
      );
    }
  });

  it('lowers CMU cutoff when minimum rake depth increases without changing roof-to-cap clearance', () => {
    const tight = gableGeometry({ gable: { ...createDefaultRoofSystemSettings().gable, enabled: true, rakeClearanceMeters: 0.08, rakedConcreteCapEnabled: true } });
    const loose = gableGeometry({ gable: { ...createDefaultRoofSystemSettings().gable, enabled: true, rakeClearanceMeters: 0.25, rakedConcreteCapEnabled: true } });
    const tightBlocks = tight.geometry.blockInstances.filter((block) => block.source === 'gable_end_solver');
    const looseBlocks = loose.geometry.blockInstances.filter((block) => block.source === 'gable_end_solver');
    const tightMaxTop = Math.max(...tightBlocks.map((block) => block.y + (block.physicalHeightMeters ?? block.heightMeters ?? 0) / 2));
    const looseMaxTop = Math.max(...looseBlocks.map((block) => block.y + (block.physicalHeightMeters ?? block.heightMeters ?? 0) / 2));
    expect(looseMaxTop).toBeLessThanOrEqual(tightMaxTop + 0.01);
  });
});

describe('allowedMasonryTopYAtStation vs rakedCapTopYAtStation', () => {
  it('separates CMU ceiling from cap top by at least minimum rake depth', () => {
    const { geometry, roofSystem } = gableGeometry();
    const roof = geometry.resolvedRoofSystem!;
    const gableSegmentId = roof.gableEndSegmentIds[0]!;
    const frame = (geometry.wallCmuLayout.segmentFrames ?? []).find((entry) => entry.segmentId === gableSegmentId)!;
    const panel = geometry.infillSystem?.panels.find((entry) => entry.hostSegmentId === gableSegmentId);
    expectDefined(panel);
    const station = (panel.startStationMeters + panel.endStationMeters) / 2;
    const masonryCeiling = allowedMasonryTopYAtStation({
      resolvedRoof: roof,
      roofSystem,
      frame,
      stationMeters: station,
      panelStartStation: panel.startStationMeters,
      panelEndStation: panel.endStationMeters,
      minRakeCapDepthMeters: roofSystem.gable.rakeClearanceMeters,
    });
    const capTop = rakedCapTopYAtStation({
      resolvedRoof: roof,
      roofSystem,
      frame,
      stationMeters: station,
      panelStartStation: panel.startStationMeters,
      panelEndStation: panel.endStationMeters,
    });
    expect(capTop - masonryCeiling).toBeGreaterThanOrEqual(roofSystem.gable.rakeClearanceMeters - 0.01);
  });
});
