import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import { resolveLintelCourseIndex } from '../domain/openingAssemblySolver';
import { generateCmuLayout, buildDesignGeometryInputFromLayout, generateDesignGeometry } from '../geometry/designGeometry';

describe('opening jamb head joints', () => {
  const preset = createFiveBySixCmuBuildingPreset();
  const module = resolveCmuModuleConfig(preset.wall);
  const nominalModuleLength = module.moduleLengthMeters;
  const tolerance = 0.02;

  function blocksBelowLintelBesideOpening(
    layout: ReturnType<typeof generateCmuLayout>,
    opening: NonNullable<ReturnType<typeof generateCmuLayout>['roughOpenings'][number]>,
  ) {
    const lintelCourse = resolveLintelCourseIndex(opening.roughTopMeters, module.moduleHeightMeters);
    const hostFace = opening.wallFace ?? 'north';
    return layout.blocks.filter((block) => {
      if (block.face !== hostFace && block.segmentId !== opening.wallSegmentId) return false;
      const courseIndex = block.courseIndex ?? block.course;
      if (courseIndex >= lintelCourse) return false;
      const courseBottom = courseIndex * module.moduleHeightMeters;
      const courseTop = courseBottom + (block.heightMeters ?? module.actualHeightMeters ?? 0.19);
      if (courseBottom >= opening.roughTopMeters || courseTop <= opening.roughBottomMeters) return false;
      const start = block.startAlongMeters ?? block.stationMeters ?? 0;
      const end = block.endAlongMeters ?? start + (block.actualLengthMeters ?? block.lengthMeters);
      const leftOfOpening = end <= opening.roughStartAlongMeters + tolerance;
      const rightOfOpening = start >= opening.roughEndAlongMeters - tolerance;
      return leftOfOpening || rightOfOpening;
    });
  }

  it('retains individual full-block placements beside door and window rough openings', () => {
    const layout = generateCmuLayout(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');
    const window = layout.roughOpenings.find((opening) => opening.type === 'window');
    expect(door).toBeDefined();
    expect(window).toBeDefined();

    [door!, window!].forEach((opening) => {
      const besideBlocks = blocksBelowLintelBesideOpening(layout, opening);
      const fullRunBlocks = besideBlocks.filter(
        (block) =>
          block.source !== 'opening_jamb_closure' &&
          block.source !== 'lintel_closure' &&
          block.source !== 'opening_assembly_solver',
      );
      expect(fullRunBlocks.length).toBeGreaterThan(2);
      fullRunBlocks.forEach((block) => {
        const span =
          (block.endAlongMeters ?? 0) -
          (block.startAlongMeters ?? block.stationMeters ?? 0);
        expect(span).toBeLessThanOrEqual(nominalModuleLength + tolerance);
      });
    });
  });

  it('uses opening_jamb_closure only for units intersecting the rough opening interval', () => {
    const layout = generateCmuLayout(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');
    expect(door).toBeDefined();

    const jambClosures = layout.blocks.filter(
      (block) => block.source === 'opening_jamb_closure' && block.nearOpeningId === door?.id,
    );
    expect(jambClosures.length).toBeGreaterThan(0);
    jambClosures.forEach((block) => {
      const start = block.startAlongMeters ?? 0;
      const end = block.endAlongMeters ?? start + block.lengthMeters;
      const touchesVoidJamb =
        (block.adjacentTo === 'rough_opening_start' &&
          (Math.abs(end - door!.actualStartAlongMeters) <= tolerance ||
            Math.abs(end - door!.roughStartAlongMeters) <= tolerance)) ||
        (block.adjacentTo === 'rough_opening_end' &&
          (Math.abs(start - door!.actualEndAlongMeters) <= tolerance ||
            Math.abs(start - door!.roughEndAlongMeters) <= tolerance));
      expect(touchesVoidJamb).toBe(true);
      expect(block.heightMeters ?? module.actualHeightMeters).toBeCloseTo(
        module.actualHeightMeters ?? 0.19,
        3,
      );
      expect(block.depthMeters ?? preset.wall.wallThicknessMeters).toBeCloseTo(
        preset.wall.wallThicknessMeters,
        3,
      );
    });
  });

  it('does not emit merged opening_assembly_solver jamb spans beside ordinary courses', () => {
    const layout = generateCmuLayout(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');
    const lintelCourse = resolveLintelCourseIndex(door!.roughTopMeters, module.moduleHeightMeters);

    const mergedJambBlocks = layout.blocks.filter(
      (block) =>
        block.nearOpeningId === door?.id &&
        block.source === 'opening_assembly_solver' &&
        (block.closureRole === 'jamb_left' || block.closureRole === 'jamb_right') &&
        (block.courseIndex ?? block.course) < lintelCourse,
    );
    expect(mergedJambBlocks).toHaveLength(0);
  });

  it('preserves lintel course behavior for the preset door', () => {
    const layout = generateCmuLayout(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');
    const lintelCourse = resolveLintelCourseIndex(door!.roughTopMeters, module.moduleHeightMeters);

    expect(
      layout.blocks.some(
        (block) =>
          block.face === door?.wallFace &&
          block.course === lintelCourse &&
          block.source === 'lintel_closure',
      ),
    ).toBe(true);
    expect(layout.lintels.some((lintel) => lintel.openingId === door?.id)).toBe(true);
  });

  it('layout-graph wall preserves per-block placements beside the west door', () => {
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: preset.wall,
        openings: preset.wall.openings,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
        buildingSystemMode: preset.buildingSystemMode,
        frameSystem: preset.frameSystem,
        infillSystem: preset.infillSystem,
        gableEndSystem: preset.gableEndSystem,
      }),
    );
    const layout = geometry.wallCmuLayout;
    const door = layout.roughOpenings.find((opening) => opening.id === 'door-west-01');
    expect(door).toBeDefined();

    const lintelCourse = resolveLintelCourseIndex(door!.roughTopMeters, module.moduleHeightMeters);
    const besidePlacements = layout.unitPlacements.filter((placement) => {
      if (placement.segmentId !== door!.wallSegmentId) return false;
      if (placement.courseIndex >= lintelCourse) return false;
      const start = placement.startStationMeters ?? 0;
      const end = placement.endStationMeters ?? start + placement.nominalLengthMeters;
      return end <= door!.roughStartAlongMeters + tolerance || start >= door!.roughEndAlongMeters - tolerance;
    });

    expect(besidePlacements.length).toBeGreaterThan(4);
    const maxFullRunSpan = Math.max(
      0,
      ...besidePlacements
        .filter((placement) => placement.source !== 'opening_jamb_closure')
        .map((placement) => placement.endStationMeters! - (placement.startStationMeters ?? 0)),
    );
    expect(maxFullRunSpan).toBeLessThanOrEqual(nominalModuleLength + tolerance);
    expect(
      besidePlacements.every((placement) => {
        if (placement.source !== 'wall_run') return true;
        const span = (placement.endStationMeters ?? 0) - (placement.startStationMeters ?? 0);
        return span <= nominalModuleLength + tolerance;
      }),
    ).toBe(true);
  });
});
