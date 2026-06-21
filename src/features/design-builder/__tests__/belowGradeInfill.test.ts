import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { resolveFoundationElevations } from '../domain/foundationElevations';
import {
  resolveBelowGradeInfillPanelBoundsForLayout,
  resolveInfillPanelBoundsForLayout,
} from '../domain/infillPanelBoundsResolver';
import {
  deriveInfillPanelsForLayout,
  isAboveGradeInfillPanel,
  resolveInfillPanelsWithBounds,
  solveInfillPanelBlocks,
} from '../domain/cmuInfillPanelSolver';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
} from '../geometry/designGeometry';
import { resolveFoundationSettings } from '../domain/structureActions';

describe('below-grade CMU infill', () => {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
  const foundation = resolveFoundationSettings(preset);
  const elevations = resolveFoundationElevations({
    foundation,
    wallHeightMeters: preset.wallLayout.defaultWallHeightMeters,
  });

  it('creates below-grade panel bounds between tie beam top and plinth beam bottom', () => {
    const belowGrade = resolveBelowGradeInfillPanelBoundsForLayout({
      layout: preset.wallLayout,
      segmentFrames: frames,
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
      foundation,
    });
    expect(belowGrade.length).toBe(preset.wallLayout.segments.length);
    belowGrade.forEach((bounds) => {
      expect(bounds.bottomElevationMeters).toBeCloseTo(elevations.topOfTieBeamY, 6);
      expect(bounds.topElevationMeters).toBeCloseTo(elevations.bottomOfPlinthBeamY, 6);
      expect(bounds.clearHeightMeters).toBeGreaterThan(0.05);
    });
  });

  it('matches above-grade horizontal panel span per wall bay', () => {
    const aboveGrade = resolveInfillPanelBoundsForLayout({
      layout: preset.wallLayout,
      segmentFrames: frames,
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
    });
    const belowGrade = resolveBelowGradeInfillPanelBoundsForLayout({
      layout: preset.wallLayout,
      segmentFrames: frames,
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
      foundation,
    });

    aboveGrade.forEach((above) => {
      const below = belowGrade.find((candidate) => candidate.hostSegmentId === above.hostSegmentId)!;
      expect(below.startStationMeters).toBeCloseTo(above.startStationMeters, 6);
      expect(below.endStationMeters).toBeCloseTo(above.endStationMeters, 6);
      expect(below.clearWidthMeters).toBeCloseTo(above.clearWidthMeters, 6);
    });
  });

  it('generates CMU blocks for below-grade infill through the same solver pipeline', () => {
    const entries = resolveInfillPanelsWithBounds({
      layout: preset.wallLayout,
      segmentFrames: frames,
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
      wall: preset.wall,
      foundation,
    });
    const belowEntries = entries.filter((entry) => entry.panel.infillZone === 'below_grade');
    expect(belowEntries.length).toBe(preset.wallLayout.segments.length);

    belowEntries.forEach(({ panel, bounds }) => {
      const frame = frames.find((candidate) => candidate.segmentId === panel.hostSegmentId)!;
      const solved = solveInfillPanelBlocks({ panel, bounds, frame, wall: preset.wall });
      expect(solved.blocks.length).toBeGreaterThan(0);
      expect(solved.blocks.every((block) => block.y < elevations.topOfPlinthBeamY)).toBe(true);
      expect(
        solved.blocks.every((block) => block.y >= elevations.topOfTieBeamY - 0.001),
      ).toBe(true);
    });
  });

  it('adds below-grade blocks to frame infill geometry without changing bearing-wall mode', () => {
    const frameGeometry = generateDesignGeometry(
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
      }),
    );

    const belowGradeBlockCount = (frameGeometry.blockInstances ?? []).filter(
      (block) => (block.y ?? 0) < elevations.topOfPlinthBeamY - 0.001,
    ).length;
    expect(belowGradeBlockCount).toBeGreaterThan(0);
    expect(frameGeometry.infillSystem?.panels.filter((panel) => panel.infillZone === 'below_grade').length).toBe(
      preset.wallLayout.segments.length,
    );

    const bearingPreset = createFiveBySixCmuBuildingPreset();
    const bearingGeometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: bearingPreset.wallLayout,
        cmuSettings: bearingPreset.wall,
        slabSettings: bearingPreset.slab,
        roofSettings: bearingPreset.roof,
        trussSettings: bearingPreset.truss,
        buildingSystemMode: 'cmu_bearing_wall',
        frameSystem: bearingPreset.frameSystem,
      }),
    );
    expect(bearingGeometry.resolvedInfillPanelBounds ?? []).toHaveLength(0);
  });

  it('omits below-grade panels when tie beam is disabled', () => {
    const disabledTiePreset = applyAutoFrameLayout({
      ...createFiveBySixCmuBuildingPreset(),
      foundationSettings: {
        ...foundation,
        tieBeam: { ...foundation.tieBeam, enabled: false },
      },
    });
    const panels = deriveInfillPanelsForLayout({
      layout: disabledTiePreset.wallLayout,
      segmentFrames: getSegmentFramesForWallLayout(disabledTiePreset.wallLayout, disabledTiePreset.wall),
      columns: disabledTiePreset.frameSystem.columns,
      beams: disabledTiePreset.frameSystem.beams,
      wall: disabledTiePreset.wall,
      foundation: disabledTiePreset.foundationSettings,
    });
    expect(panels.filter((panel) => panel.infillZone === 'below_grade')).toHaveLength(0);
    expect(panels.filter((panel) => isAboveGradeInfillPanel(panel)).length).toBe(
      disabledTiePreset.wallLayout.segments.length,
    );
  });
});
