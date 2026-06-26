import { describe, expect, it, vi } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { resolveFoundationElevations } from '../domain/foundationElevations';
import { applyAutoFrameLayout, resolveFoundationSettings } from '../domain/structureActions';
import { resolveCmuModuleDefinition } from '../domain/cmuModuleRules';
import type { ResolvedCmuOpening } from '../domain/cmuOpeningRules';
import { resolveInfillPanelsWithBounds, solveInfillPanelBlocks } from '../domain/cmuInfillPanelSolver';
import {
  blockOverlapsOpeningAssembly,
  resolveLintelModuleSpan,
  resolveOpeningBlockVoidBounds,
} from '../domain/openingAssemblySolver';
import {
  openingsForFrameFitMasonry,
  panelAdjustedOpeningsForElevation,
  solveOpeningAwareMasonryPanel,
} from '../domain/openingAwareMasonryPanelSolver';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
} from '../geometry/designGeometry';
import type { CmuInfillPanel } from '../types';

const PANEL_START_STATION_METERS = 0.175;
const PANEL_END_STATION_METERS = 5.825;
const DOOR_ROUGH_START = 2.0;
const DOOR_ROUGH_END = 3.6;
const DOOR_BOTTOM = 0.0;
const DOOR_TOP = 2.2;

function fixtureDoorOpening(hostSegmentId: string): ResolvedCmuOpening {
  const opening: ResolvedCmuOpening & { wallSegmentId: string } = {
    id: 'rc-door-test',
    type: 'door',
    wallFace: 'south',
    wallSegmentId: hostSegmentId,
    actualWidthMeters: 1.6,
    actualHeightMeters: 2.1,
    actualAreaSquareMeters: 3.36,
    roughOpeningWidthMeters: DOOR_ROUGH_END - DOOR_ROUGH_START,
    roughOpeningHeightMeters: DOOR_TOP - DOOR_BOTTOM,
    roughOpeningAreaSquareMeters: (DOOR_ROUGH_END - DOOR_ROUGH_START) * (DOOR_TOP - DOOR_BOTTOM),
    roughStartAlongMeters: DOOR_ROUGH_START,
    roughEndAlongMeters: DOOR_ROUGH_END,
    roughBottomMeters: DOOR_BOTTOM,
    roughTopMeters: DOOR_TOP,
    actualStartAlongMeters: 2.05,
    actualEndAlongMeters: 3.55,
    actualBottomMeters: DOOR_BOTTOM,
    actualTopMeters: 2.1,
    lintelType: 'bond_beam',
    lintelBearingMeters: 0.2,
    lintelCourseCount: 1,
    lintelLengthMeters: 2.0,
    lintelHeightMeters: 0.2032,
    jambGroutEnabled: true,
    jambRebarEnabled: false,
    groutCellsEachSide: 1,
    jambGroutCellCount: 2,
    groutCellsAboveOpening: 0,
    groutCellsBelowWindow: 0,
    openingFrameMaterial: 'hollow_metal',
  };
  return opening;
}

function fixturePanel(
  hostSegmentId: string,
  panelBottomElevationMeters: number,
  panelTopElevationMeters: number,
): CmuInfillPanel {
  return {
    id: 'infill-test-panel',
    hostSegmentId,
    infillZone: 'above_grade',
    leftSupportType: 'rc_column',
    rightSupportType: 'rc_column',
    bottomSupportType: 'plinth_beam',
    topSupportType: 'roof_beam',
    startStationMeters: PANEL_START_STATION_METERS,
    endStationMeters: PANEL_END_STATION_METERS,
    bottomElevationMeters: panelBottomElevationMeters,
    topElevationMeters: panelTopElevationMeters,
    masonrySettings: { bondPattern: 'running_bond' },
  };
}

describe('RC frame opening masonry', () => {
  const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
  const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
  const southFrame = frames.find((frame) => frame.segmentId === preset.wallLayout.segments[0]?.id)!;
  const module = resolveCmuModuleDefinition(preset.wall);
  const door = fixtureDoorOpening(southFrame.segmentId);

  it('creates a true rough opening with jamb cuts, lintel, and panel-bounded CMU', () => {
    const panelBottom = 0.45;
    const panelTop = panelBottom + 2.8;
    const panel = fixturePanel(southFrame.segmentId, panelBottom, panelTop);
    const withoutOpening = solveOpeningAwareMasonryPanel({
      panelKind: 'rc_frame_infill',
      panel,
      frame: southFrame,
      panelStartStationMeters: PANEL_START_STATION_METERS,
      panelEndStationMeters: PANEL_END_STATION_METERS,
      panelBottomElevationMeters: panelBottom,
      panelTopElevationMeters: panelTop,
      openings: [],
      wall: preset.wall,
    });
    const withOpening = solveOpeningAwareMasonryPanel({
      panelKind: 'rc_frame_infill',
      panel,
      frame: southFrame,
      panelStartStationMeters: PANEL_START_STATION_METERS,
      panelEndStationMeters: PANEL_END_STATION_METERS,
      panelBottomElevationMeters: panelBottom,
      panelTopElevationMeters: panelTop,
      openings: [door],
      wall: preset.wall,
    });

    expect(withOpening.blocks.length).toBeLessThan(withoutOpening.blocks.length);
    expect(door.actualBottomMeters).toBe(DOOR_BOTTOM);
    expect(door.actualTopMeters).toBe(2.1);

    const adjustedOpenings = openingsForFrameFitMasonry(panelAdjustedOpeningsForElevation([door], panelBottom));
    const voidBounds = resolveOpeningBlockVoidBounds(adjustedOpenings[0]!);
    const expectedLintelCourseIndex = Math.max(
      0,
      Math.ceil(DOOR_TOP / Math.max(0.01, module.nominalModuleHeightMeters)),
    );
    const expectedLintelCenterY =
      panelBottom +
      expectedLintelCourseIndex * module.nominalModuleHeightMeters +
      module.actualBlockHeightMeters / 2;

    withOpening.blocks.forEach((block) => {
      const courseIndex = block.courseIndex ?? block.course ?? 0;
      const courseBottom = panelBottom + courseIndex * module.nominalModuleHeightMeters;
      const courseTop = courseBottom + (block.physicalHeightMeters ?? block.heightMeters ?? module.actualBlockHeightMeters);
      const startAlong = block.startAlongMeters ?? block.stationMeters ?? 0;
      const endAlong = block.endAlongMeters ?? startAlong + block.lengthMeters;
      const centerAlong = (startAlong + endAlong) / 2;
      const centerY = block.y;

      expect(
        blockOverlapsOpeningAssembly({
          opening: adjustedOpenings[0]!,
          startAlongMeters: startAlong,
          endAlongMeters: endAlong,
          courseIndex,
          courseBottomMeters: courseBottom,
          courseTopMeters: courseTop,
          moduleHeightMeters: module.nominalModuleHeightMeters,
          moduleLengthMeters: module.nominalModuleLengthMeters,
          wallLengthMeters: southFrame.lengthMeters,
          courseIndexElevationDatumMeters: panelBottom,
        }),
      ).toBe(false);

      const insideVoidHorizontal = startAlong < voidBounds.endAlongMeters && endAlong > voidBounds.startAlongMeters;
      const insideVoidVertical = courseBottom < voidBounds.topMeters && courseTop > voidBounds.bottomMeters;
      expect(insideVoidHorizontal && insideVoidVertical).toBe(false);
      expect(
        centerAlong > voidBounds.startAlongMeters &&
          centerAlong < voidBounds.endAlongMeters &&
          centerY > voidBounds.bottomMeters &&
          centerY < voidBounds.topMeters,
      ).toBe(false);

      expect(startAlong).toBeGreaterThanOrEqual(PANEL_START_STATION_METERS - 0.001);
      expect(endAlong).toBeLessThanOrEqual(PANEL_END_STATION_METERS + 0.001);
    });

    const jambBlocks = withOpening.blocks.filter((block) => block.source === 'opening_jamb_closure');
    expect(jambBlocks.length).toBeGreaterThan(0);

    const blocksAboveOpening = withOpening.blocks.filter((block) => {
      const courseBottom = panelBottom + (block.courseIndex ?? 0) * module.nominalModuleHeightMeters;
      return courseBottom >= DOOR_TOP - 0.001;
    });
    expect(blocksAboveOpening.length).toBeGreaterThan(0);

    expect(withOpening.lintels).toHaveLength(1);
    const lintel = withOpening.lintels[0]!;
    expect(lintel.openingId).toBe(door.id);
    expect(lintel.segmentId).toBe(southFrame.segmentId);
    expect(lintel.courseIndex).toBe(expectedLintelCourseIndex);
    expect(lintel.y).toBeCloseTo(expectedLintelCenterY, 6);
    const lintelSpan = resolveLintelModuleSpan(
      adjustedOpenings[0]!,
      module.nominalModuleLengthMeters,
      southFrame.lengthMeters,
    );

    const blocksInLintelSpan = withOpening.blocks.filter((block) => {
      const startAlong = block.startAlongMeters ?? block.stationMeters ?? 0;
      const endAlong = block.endAlongMeters ?? startAlong + block.lengthMeters;
      return (
        (block.courseIndex ?? 0) === expectedLintelCourseIndex &&
        startAlong < lintelSpan.endAlongMeters &&
        endAlong > lintelSpan.startAlongMeters
      );
    });
    expect(blocksInLintelSpan).toHaveLength(0);

    const lintelCourseClosures = withOpening.blocks.filter(
      (block) =>
        block.source === 'lintel_closure' &&
        block.nearOpeningId === door.id &&
        (block.courseIndex ?? 0) === expectedLintelCourseIndex,
    );
    expect(lintelCourseClosures.length).toBeGreaterThan(0);
    expect(
      lintelCourseClosures.some(
        (block) => Math.abs(block.endAlongMeters - lintelSpan.startAlongMeters) <= 0.003,
      ),
    ).toBe(true);
    expect(
      lintelCourseClosures.some(
        (block) => Math.abs(block.startAlongMeters - lintelSpan.endAlongMeters) <= 0.003,
      ),
    ).toBe(true);
    lintelCourseClosures.forEach((block) => {
      expect(block.blockType === 'cut' || block.blockType === 'half' || block.blockType === 'full').toBe(true);
      expect(block.source).toBe('lintel_closure');
    });

    // eslint-disable-next-line no-console
    console.info(
      `[rcFrameOpeningMasonry] door panel blocks without opening=${withoutOpening.blocks.length}, with opening=${withOpening.blocks.length}`,
    );
  });

  it('keeps rough openings out of below-grade infill on the same RC segment', () => {
    const foundation = resolveFoundationSettings(preset);
    const elevations = resolveFoundationElevations({
      foundation,
      wallHeightMeters: preset.wallLayout.defaultWallHeightMeters,
    });
    const entries = resolveInfillPanelsWithBounds({
      layout: preset.wallLayout,
      segmentFrames: frames,
      columns: preset.frameSystem.columns,
      beams: preset.frameSystem.beams,
      wall: preset.wall,
      foundation,
    });
    const belowEntry = entries.find(
      (entry) => entry.panel.hostSegmentId === southFrame.segmentId && entry.panel.infillZone === 'below_grade',
    );
    expect(belowEntry).toBeDefined();

    const solvedBelowGrade = solveInfillPanelBlocks({
      panel: belowEntry!.panel,
      bounds: belowEntry!.bounds,
      frame: southFrame,
      wall: preset.wall,
      openings: [door],
    });
    expect(solvedBelowGrade.lintels).toHaveLength(0);
    expect(solvedBelowGrade.blocks.some((block) => block.source === 'opening_jamb_closure')).toBe(false);
    expect(
      solvedBelowGrade.blocks.some(
        (block) => block.startAlongMeters < DOOR_ROUGH_END && block.endAlongMeters > DOOR_ROUGH_START,
      ),
    ).toBe(true);

    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => undefined);
    let geometry: ReturnType<typeof generateDesignGeometry>;
    try {
      geometry = generateDesignGeometry(
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
    } finally {
      tableSpy.mockRestore();
    }

    const belowGradeBlocks = geometry.wallCmuLayout.blocks.filter(
      (block) => block.segmentId === southFrame.segmentId && block.infillBand === 'below_grade',
    );
    expect(belowGradeBlocks.length).toBeGreaterThan(0);
    expect(belowGradeBlocks.every((block) => block.y < elevations.topOfPlinthBeamY)).toBe(true);
    expect(belowGradeBlocks.every((block) => block.source !== 'opening_jamb_closure')).toBe(true);
    expect(geometry.wallCmuLayout.lintels.every((lintel) => lintel.y >= elevations.topOfPlinthBeamY)).toBe(true);

    const segmentOpeningIds = geometry.wallCmuLayout.roughOpenings
      .filter(
        (opening) => (opening as ResolvedCmuOpening & { wallSegmentId?: string }).wallSegmentId === southFrame.segmentId,
      )
      .map((opening) => opening.id);
    expect(segmentOpeningIds.length).toBeGreaterThan(0);
    segmentOpeningIds.forEach((openingId) => {
      expect(geometry.wallCmuLayout.lintels.filter((lintel) => lintel.openingId === openingId)).toHaveLength(1);
    });
  });

  it('leaves bearing-wall opening tests behavior unchanged via generateCmuLayout', async () => {
    const { generateCmuLayout } = await import('../geometry/designGeometry');
    const layout = generateCmuLayout(preset.wall);
    const doorOpening = layout.roughOpenings.find((opening) => opening.type === 'door');
    expect(doorOpening).toBeDefined();
    expect(layout.lintels.some((lintel) => lintel.openingId === doorOpening?.id)).toBe(true);
  });
});
