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
import { resolvePanelVerticalCourses } from '../domain/cmuInfillPanelSolver';

describe('gable vertical alignment probe', () => {
  it('reports first gable course vs roof beam and infill top', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);
    const roofSystem = {
      ...createDefaultRoofSystemSettings(),
      roofType: 'gable' as const,
      gable: { ...createDefaultRoofSystemSettings().gable, enabled: true },
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
    const roofBeam = preset.frameSystem.beams.find((beam) => beam.kind === 'roof_beam')!;
    const module = resolveCmuModuleDefinition(preset.wall);
    const segmentFrames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const panelEntries = resolveInfillPanelsWithBounds({
      layout: preset.wallLayout,
      segmentFrames,
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

    const infillBlocks = geometry.blockInstances.filter(
      (block) => block.segmentId === gableSegmentId && block.source === 'rc_frame_infill',
    );
    const gableBlocks = geometry.blockInstances.filter(
      (block) => block.segmentId === gableSegmentId && block.source === 'gable_end_solver',
    );
    const infillVertical = resolvePanelVerticalCourses({
      panelBottomElevationMeters: gablePanel.bottomElevationMeters,
      panelTopElevationMeters: gablePanel.topElevationMeters,
      nominalCourseHeightMeters: module.nominalModuleHeightMeters,
    });
    const beamTopVertical = resolvePanelVerticalCourses({
      panelBottomElevationMeters: gablePanel.bottomElevationMeters,
      panelTopElevationMeters: roofBeam.topElevationMeters,
      nominalCourseHeightMeters: module.nominalModuleHeightMeters,
    });

    const lastInfillTop = Math.max(
      ...infillBlocks.map((block) => {
        const h = block.physicalHeightMeters ?? block.heightMeters ?? 0;
        return block.y + h / 2;
      }),
    );
    const firstGableBottom = Math.min(
      ...gableBlocks.map((block) => {
        const h = block.physicalHeightMeters ?? block.heightMeters ?? 0;
        return block.y - h / 2;
      }),
    );
    const firstGableCourseIndex = Math.min(...gableBlocks.map((block) => block.courseIndex ?? 0));

    const report = {
      panelTopElevationMeters: gablePanel.topElevationMeters,
      roofBeamBottomMeters: roofBeam.baseElevationMeters,
      roofBeamTopMeters: roofBeam.topElevationMeters,
      infillCourseCount:
        infillVertical.fullCourseCount + (infillVertical.hasTopClosureCourse ? 1 : 0),
      solverFirstGableCourseIndex: beamTopVertical.fullCourseCount,
      actualFirstGableCourseIndex: firstGableCourseIndex,
      lastInfillTopY: lastInfillTop,
      firstGableBottomY: firstGableBottom,
      firstGableBottomVsPanelTop: firstGableBottom - gablePanel.topElevationMeters,
      firstGableBottomVsRoofBeamBottom: firstGableBottom - roofBeam.baseElevationMeters,
      bondPattern: gablePanel.masonrySettings.bondPattern,
      firstGableStations: gableBlocks
        .filter((block) => (block.courseIndex ?? 0) === firstGableCourseIndex)
        .map((block) => block.stationMeters),
    };

    console.log(JSON.stringify(report, null, 2));
    expect(firstGableBottom).toBeGreaterThanOrEqual(gablePanel.topElevationMeters - 0.01);
    expect(firstGableBottom).toBeLessThan(gablePanel.topElevationMeters + 0.05);
    expect(firstGableBottom).toBeLessThan(roofBeam.topElevationMeters);
    expect(firstGableCourseIndex).toBe(
      infillVertical.fullCourseCount + (infillVertical.hasTopClosureCourse ? 1 : 0),
    );
  });
});
