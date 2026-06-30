import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { createDefaultRoofSystemSettings } from '../domain/roofSystemDefaults';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
} from '../geometry/designGeometry';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import { resolveCmuModuleDefinition } from '../domain/cmuModuleRules';
import { resolveInfillPanelsWithBounds } from '../domain/cmuInfillPanelSolver';
import { resolveGableRidgeStationMeters } from '../domain/gableEndMasonrySolver';
import { capTopYAtStation } from '../domain/roofGableSolver';

describe('gable full alignment probe', () => {
  it('reports world ridge, cap top, purlin, and block center alignment', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);
    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'gable' as const,
      gable: {
        ...createDefaultRoofSystemSettings().gable,
        enabled: true,
        rakedConcreteCapEnabled: true,
      },
      purlins: { ...createDefaultRoofSystemSettings().purlins, enabled: true },
    };
    const geometry = generateDesignGeometry(
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
    );

    const resolvedRoof = geometry.resolvedRoofSystem!;
    const gableSegmentId = resolvedRoof.gableEndSegmentIds[0]!;
    const frame = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall).find(
      (entry) => entry.segmentId === gableSegmentId,
    )!;
    const roofBeam = preset.frameSystem.beams.find(
      (beam) => beam.kind === 'roof_beam' && beam.hostSegmentId === gableSegmentId,
    )!;
    const panelEntries = resolveInfillPanelsWithBounds({
      layout: preset.wallLayout,
      segmentFrames: getSegmentFramesForWallLayout(preset.wallLayout, preset.wall),
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
      wall: preset.wall,
      foundation,
      existingPanels: preset.infillSystem.panels,
    });
    const gablePanel = panelEntries.find(
      (entry) =>
        entry.panel.hostSegmentId === gableSegmentId && entry.panel.infillZone === 'above_grade',
    )!.panel;

    const gableBlocks = geometry.blockInstances.filter(
      (block) => block.segmentId === gableSegmentId && block.source === 'gable_end_solver',
    );
    const topCourseIndex = Math.max(...gableBlocks.map((block) => block.courseIndex ?? 0));
    const bottomCourseIndex = Math.min(...gableBlocks.map((block) => block.courseIndex ?? 0));
    const topBlocks = gableBlocks.filter((block) => (block.courseIndex ?? 0) === topCourseIndex);
    const bottomBlocks = gableBlocks.filter(
      (block) => (block.courseIndex ?? 0) === bottomCourseIndex,
    );
    const spanCenterFor = (courseBlocks: typeof gableBlocks) => {
      const spanStart = Math.min(...courseBlocks.map((b) => b.stationMeters ?? 0));
      const spanEnd = Math.max(
        ...courseBlocks.map(
          (b) => (b.stationMeters ?? 0) + (b.nominalLengthMeters ?? b.lengthMeters),
        ),
      );
      return (spanStart + spanEnd) / 2;
    };
    const topSpanCenterStation = spanCenterFor(topBlocks);
    const bottomSpanCenterStation = spanCenterFor(bottomBlocks);

    const ridgeStation = resolveGableRidgeStationMeters({ frame, resolvedRoof });
    const ridgeMid = resolvedRoof.claddingRidgeStart &&
      resolvedRoof.claddingRidgeEnd && {
        x: (resolvedRoof.claddingRidgeStart.x + resolvedRoof.claddingRidgeEnd.x) / 2,
        z: (resolvedRoof.claddingRidgeStart.z + resolvedRoof.claddingRidgeEnd.z) / 2,
      };
    const ridgeOnWallStation =
      ridgeMid != null
        ? (ridgeMid.x - frame.centerlineStart.x) * frame.tangent.x +
          (ridgeMid.z - frame.centerlineStart.z) * frame.tangent.z
        : NaN;

    const firstGableBottom = Math.min(
      ...gableBlocks.map((block) => {
        const h = block.physicalHeightMeters ?? block.heightMeters ?? 0;
        return block.y - h / 2;
      }),
    );

    const caps = geometry.rakedCapPlacements?.filter(
      (cap) => cap.gableEndSegmentId === gableSegmentId,
    ) ?? [];
    const leftCap = caps.filter((cap) => cap.slope === 'left').sort((a, b) => b.endStationMeters - a.endStationMeters)[0];
    const rightCap = caps.filter((cap) => cap.slope === 'right').sort((a, b) => a.startStationMeters - b.startStationMeters)[0];
    const capRidgeTopY = Math.max(leftCap?.endTopY ?? -Infinity, rightCap?.startTopY ?? -Infinity);
    const capTopAtRidge = capTopYAtStation({
      resolvedRoof,
      frame,
      stationMeters: ridgeStation,
      panelStartStation: gablePanel.startStationMeters,
      panelEndStation: gablePanel.endStationMeters,
      roofSystem,
    });
    const leftEndVsRidge = leftCap ? leftCap.endStationMeters - ridgeStation : NaN;
    const rightStartVsRidge = rightCap ? rightCap.startStationMeters - ridgeStation : NaN;

    const report = {
      ridgeStationSegmentCenter: ridgeStation,
      ridgeOnWallFromCladdingMidpoint: ridgeOnWallStation,
      topSpanCenterStation,
      bottomSpanCenterStation,
      topCenterVsRidgeStation: topSpanCenterStation - ridgeStation,
      bottomCenterVsRidgeStation: bottomSpanCenterStation - ridgeStation,
      topCenterVsCladdingRidgeStation: topSpanCenterStation - ridgeOnWallStation,
      leftCapEndVsRidge: leftEndVsRidge,
      rightCapStartVsRidge: rightStartVsRidge,
      firstGableBottomY: firstGableBottom,
      roofBeamTopY: roofBeam.topElevationMeters,
      roofBeamBottomY: roofBeam.baseElevationMeters,
      firstGableBottomVsBeamTop: firstGableBottom - roofBeam.topElevationMeters,
      capRidgeTopY,
      capTopAtRidgeStation: capTopAtRidge,
      capRidgeGapToPurlinReference: capRidgeTopY - capTopAtRidge,
    };

    console.log(JSON.stringify(report, null, 2));
    expect(gablePanel.topElevationMeters).toBeCloseTo(roofBeam.baseElevationMeters, 6);
    expect(firstGableBottom).toBeCloseTo(roofBeam.topElevationMeters, 3);
    expect(firstGableBottom).toBeGreaterThanOrEqual(roofBeam.topElevationMeters - 0.001);
    expect(Math.abs(report.topCenterVsRidgeStation)).toBeLessThan(0.05);
    expect(Math.abs(report.bottomCenterVsRidgeStation)).toBeLessThan(0.05);
    expect(Math.abs(report.ridgeStationSegmentCenter - report.ridgeOnWallFromCladdingMidpoint)).toBeLessThan(0.002);
    expect(Math.abs(report.capRidgeGapToPurlinReference)).toBeLessThan(0.002);
    expect(Math.abs(report.leftCapEndVsRidge)).toBeLessThan(0.002);
    expect(Math.abs(report.rightCapStartVsRidge)).toBeLessThan(0.002);
  });
});
