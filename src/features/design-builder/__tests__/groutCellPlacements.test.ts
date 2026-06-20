import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  buildLayoutJambGroutFillPlacementsFromBlocks,
  isBondBeamLintelType,
  isGroutableJambBlock,
  resolveGroutCellRenderDimensions,
  resolveGroutFillMeshDimensions,
  totalGroutCellVolumeCubicMeters,
} from '../domain/groutCellPlacements';
import { resolveCmuCoreGeometry } from '../domain/cmuCoreGeometry';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';
import type { ResolvedCmuOpening } from '../domain/cmuOpeningRules';

describe('groutCellPlacements', () => {
  it('does not classify jamb, half, cut, corner, or bond-beam blocks as groutable jamb cores', () => {
    expect(isGroutableJambBlock({ unitType: 'full' })).toBe(true);
    expect(isGroutableJambBlock({ unitType: 'jamb_block' })).toBe(false);
    expect(isGroutableJambBlock({ unitType: 'half_block' })).toBe(false);
    expect(isGroutableJambBlock({ unitType: 'cut_block' })).toBe(false);
    expect(isGroutableJambBlock({ unitType: 'corner_block' })).toBe(false);
    expect(isGroutableJambBlock({ unitType: 'bond_beam_block' })).toBe(false);
  });

  it('identifies bond-beam lintel type for groutable lintel cells only', () => {
    expect(isBondBeamLintelType('bond_beam')).toBe(true);
    expect(isBondBeamLintelType('precast_concrete')).toBe(false);
    expect(isBondBeamLintelType('none')).toBe(false);
  });

  it('uses CMU core void dimensions for jamb and lintel grout mesh sizing', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const core = resolveCmuCoreGeometry(preset.wall);
    const moduleConfig = resolveCmuModuleConfig(preset.wall);
    const dims = resolveGroutCellRenderDimensions(
      { kind: 'jamb_cell', heightMeters: moduleConfig.actualHeightMeters },
      core,
    );
    expect(dims.depthMeters).toBeLessThan(preset.wall.wallThicknessMeters);
    expect(dims.lengthMeters).toBeCloseTo(core.coreLengthMeters, 6);
  });

  it('uses placement dimensions for closure void grout mesh sizing', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const core = resolveCmuCoreGeometry(preset.wall);
    const dims = resolveGroutFillMeshDimensions(
      { kind: 'closure_void', lengthMeters: 0.08, heightMeters: 0.19, depthMeters: 0.19 },
      core,
    );
    expect(dims.lengthMeters).toBeCloseTo(0.08, 6);
    expect(dims.depthMeters).toBeCloseTo(0.19, 6);
  });

  it('produces zero jamb grout placements when no groutable full blocks exist at jambs', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const moduleConfig = resolveCmuModuleConfig(preset.wall);
    const core = resolveCmuCoreGeometry(preset.wall);
    const opening: ResolvedCmuOpening = {
      id: 'test-door',
      type: 'door',
      wallFace: 'south',
      actualWidthMeters: 0.9,
      actualHeightMeters: 2.1,
      actualAreaSquareMeters: 1.89,
      roughOpeningWidthMeters: 1,
      roughOpeningHeightMeters: 2.2,
      roughOpeningAreaSquareMeters: 2.2,
      roughStartAlongMeters: 2,
      roughEndAlongMeters: 3,
      roughBottomMeters: 0,
      roughTopMeters: 2.2,
      actualStartAlongMeters: 2.05,
      actualEndAlongMeters: 2.95,
      actualBottomMeters: 0,
      actualTopMeters: 2.1,
      lintelType: 'bond_beam',
      lintelBearingMeters: 0.2,
      lintelCourseCount: 1,
      lintelLengthMeters: 1.3,
      lintelHeightMeters: 0.19,
      jambGroutEnabled: true,
      jambRebarEnabled: false,
      groutCellsEachSide: 2,
      jambGroutCellCount: 4,
      groutCellsAboveOpening: 0,
      groutCellsBelowWindow: 0,
      openingFrameMaterial: 'none',
      wallSegmentId: preset.wallLayout.segments[0]?.id,
    } as ResolvedCmuOpening & { wallSegmentId?: string };

    const placements = buildLayoutJambGroutFillPlacementsFromBlocks({
      openings: [opening],
      framesById: new Map(),
      blocks: [],
      moduleLengthMeters: moduleConfig.moduleLengthMeters,
      moduleHeightMeters: moduleConfig.moduleHeightMeters,
      actualHeightMeters: moduleConfig.actualHeightMeters,
      core,
      wastePercent: 10,
    });

    expect(placements).toHaveLength(0);
  });

  it('layout geometry grout volume equals sum of grout fill placement net volumes', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: preset.wall,
        openings: preset.wall.openings,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const placementVolume = totalGroutCellVolumeCubicMeters(geometry.wallCmuLayout.groutFillPlacements);
    const summaryVolume =
      geometry.wallCmuLayout.openingGrout.jambGroutVolumeCubicMeters +
      geometry.wallCmuLayout.openingGrout.lintelGroutVolumeCubicMeters +
      (geometry.wallCmuLayout.openingGrout.sillGroutVolumeCubicMeters ?? 0) +
      geometry.wallCmuLayout.openingGrout.closureGroutVolumeCubicMeters;

    expect(placementVolume).toBeCloseTo(summaryVolume, 6);
  });

  it('closure grout placements only come from grout_fill closure classifications', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: preset.wall,
        openings: preset.wall.openings,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const groutFillClosures = geometry.wallCmuLayout.openingCourseClosures.filter(
      (closure) => closure.closureType === 'grout_fill',
    );
    const closurePlacements = geometry.wallCmuLayout.groutFillPlacements.filter(
      (placement) => placement.kind === 'closure_void',
    );

    expect(closurePlacements.every((placement) => placement.kind === 'closure_void')).toBe(true);
    expect(closurePlacements.length).toBeLessThanOrEqual(groutFillClosures.length);
    closurePlacements.forEach((placement) => {
      expect(
        groutFillClosures.some(
          (closure) =>
            closure.openingId === placement.openingId && closure.courseIndex === placement.courseIndex,
        ),
      ).toBe(true);
    });
  });

  it('clean modular closure with jamb grout disabled produces no jamb or closure grout', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const wall = {
      ...preset.wall,
      openings: preset.wall.openings.map((opening) => ({
        ...opening,
        jambGroutEnabled: false,
        groutCellsEachSide: 0,
      })),
    };
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: wall,
        openings: wall.openings,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const jambOrClosureGrout = geometry.wallCmuLayout.groutFillPlacements.filter(
      (placement) => placement.kind === 'jamb_cell' || placement.kind === 'closure_void',
    );

    expect(jambOrClosureGrout).toHaveLength(0);
  });
});
