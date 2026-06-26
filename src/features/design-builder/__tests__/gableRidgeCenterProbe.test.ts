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
import {
  resolveGableRidgeStationMeters,
  solveGableEndMasonryBlocks,
} from '../domain/gableEndMasonrySolver';

describe('gable ridge vs panel center probe', () => {
  it('reports ridge offset and top block center drift', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);
    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'gable' as const,
      gable: { ...createDefaultRoofSystemSettings().gable, enabled: true, rakedConcreteCapEnabled: true },
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

    const gableSegmentId = geometry.resolvedRoofSystem!.gableEndSegmentIds[0]!;
    const frame = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall).find(
      (entry) => entry.segmentId === gableSegmentId,
    )!;
    const bounds = geometry.resolvedInfillPanelBounds?.find(
      (entry) => entry.hostSegmentId === gableSegmentId && entry.bottomElevationMeters === 0,
    )!;
    expect(bounds).toBeDefined();

    const panelCenter = (bounds!.startStationMeters + bounds!.endStationMeters) / 2;
    const segmentCenter = frame.lengthMeters / 2;
    const gableBlocks = geometry.blockInstances.filter(
      (block) => block.segmentId === gableSegmentId && block.source === 'gable_end_solver',
    );
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
    const roofBeamTop =
      preset.frameSystem.beams.find((beam) => beam.kind === 'roof_beam')?.topElevationMeters ?? 2.8;
    const directResult = solveGableEndMasonryBlocks({
      panel: gablePanel,
      frame,
      wall: preset.wall,
      roofSystem,
      resolvedRoof: geometry.resolvedRoofSystem!,
      roofBeamTopElevationMeters: roofBeamTop,
    });
    const ridgeStation = resolveGableRidgeStationMeters({
      frame,
      resolvedRoof: geometry.resolvedRoofSystem!,
    });
    const ridgeMid =
      geometry.resolvedRoofSystem!.claddingRidgeStart &&
      geometry.resolvedRoofSystem!.claddingRidgeEnd
        ? {
            x:
              (geometry.resolvedRoofSystem!.claddingRidgeStart.x +
                geometry.resolvedRoofSystem!.claddingRidgeEnd.x) /
              2,
            z:
              (geometry.resolvedRoofSystem!.claddingRidgeStart.z +
                geometry.resolvedRoofSystem!.claddingRidgeEnd.z) /
              2,
          }
        : null;
    const projectedRoofRidgeStation =
      ridgeMid != null
        ? (ridgeMid.x - frame.centerlineStart.x) * frame.tangent.x +
          (ridgeMid.z - frame.centerlineStart.z) * frame.tangent.z
        : NaN;
    const topCourseIndex = Math.max(...gableBlocks.map((block) => block.courseIndex ?? 0));
    const topBlocks = gableBlocks.filter((block) => (block.courseIndex ?? 0) === topCourseIndex);
    const topCenters = topBlocks.map((block) => {
      const start = block.stationMeters ?? block.startAlongMeters ?? 0;
      const length = block.nominalLengthMeters ?? block.lengthMeters;
      return start + length / 2;
    });
    const topSpanCenter =
      topCenters.length > 0
        ? (Math.min(...topBlocks.map((b) => b.stationMeters ?? 0)) +
            Math.max(
              ...topBlocks.map(
                (b) =>
                  (b.stationMeters ?? 0) + (b.nominalLengthMeters ?? b.lengthMeters),
              ),
            )) /
          2
        : NaN;

    const report = {
      panelStart: bounds!.startStationMeters,
      panelEnd: bounds!.endStationMeters,
      panelCenter,
      segmentCenter,
      ridgeStation,
      projectedRoofRidgeStation,
      panelVsSegmentCenterDelta: panelCenter - segmentCenter,
      gableBlockCount: gableBlocks.length,
      directBlockCount: directResult.blocks.length,
      topSpanCenter,
      topCenterVsPanelRidge: topSpanCenter - panelCenter,
      topCenterVsRidgeStation: topSpanCenter - ridgeStation,
      topCenterVsSegmentCenter: topSpanCenter - segmentCenter,
    };

    console.log(JSON.stringify(report, null, 2));
    // Top gable blocks should align with the projected roof ridge, not the panel midpoint.
    expect(Math.abs(report.topCenterVsRidgeStation)).toBeLessThan(0.025);
    expect(Math.abs(report.ridgeStation - report.projectedRoofRidgeStation)).toBeLessThan(0.002);
    // Asymmetric column trim can shift panel center away from segment center; that is expected.
    expect(report.panelVsSegmentCenterDelta).not.toBe(0);
  });
});
