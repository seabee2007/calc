import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import { computeCellCoreVolumeCubicMeters, resolveCmuCoreGeometry } from '../domain/cmuCoreGeometry';
import {
  blockOverlapsOpeningAssembly,
  buildLegacyJambGroutFillPlacements,
  buildLegacyLintelBearingSupportBlocks,
  buildLegacyLintelSolidPlacements,
  buildLintelGroutFillPlacements,
  buildSillGroutFillPlacements,
  classifySupportBlockLength,
  deduplicateGroutFillPlacements,
  isAlongModuleBoundary,
  lintelSolidOccupiesSameVolumeAsBlock,
  resolveLintelCourseIndex,
  resolveOpeningUnitDisposition,
  resolveLintelModuleSpan,
  summarizeGroutFillPlacements,
} from '../domain/openingAssemblySolver';
import { generateCmuLayout } from '../geometry/designGeometry';
import { resolveCmuOpenings } from '../domain/cmuOpeningRules';

describe('opening assembly solver', () => {
  it('places lintel as a solid volume with block-height and wall-depth dimensions', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const module = resolveCmuModuleConfig(preset.wall);
    const openings = resolveCmuOpenings(preset.wall);
    const lintels = buildLegacyLintelSolidPlacements(preset.wall, openings);

    expect(lintels).toHaveLength(preset.wall.openings.length);
    expect(lintels[0].heightMeters).toBeCloseTo(module.actualHeightMeters ?? 0.19, 6);
    expect(lintels[0].depthMeters).toBeCloseTo(preset.wall.wallThicknessMeters, 6);
    expect(lintels[0].source).toBe('opening_assembly_solver');
    expect(lintels[0].kind).toBe('bond_beam_lintel');
  });

  it('removes CMU blocks from lintel course so no duplicate solid occupies the same volume', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');
    const lintel = layout.lintels.find((lintel) => lintel.openingId === door?.id);
    const module = resolveCmuModuleConfig(preset.wall);
    const lintelCourse = resolveLintelCourseIndex(door?.roughTopMeters ?? 0, module.moduleHeightMeters);

    const overlappingBlocks = layout.blocks.filter(
      (block) =>
        block.face === door?.wallFace &&
        block.course === lintelCourse &&
        block.source !== 'opening_assembly_solver' &&
        block.startAlongMeters < (door?.actualEndAlongMeters ?? 0) + (door?.lintelBearingMeters ?? 0) &&
        block.endAlongMeters > (door?.actualStartAlongMeters ?? 0) - (door?.lintelBearingMeters ?? 0),
    );

    expect(lintel).toBeDefined();
    expect(overlappingBlocks).toHaveLength(0);
  });

  it('generates jamb grout course-by-course at actual cell positions', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');
    const doorJambFills = layout.groutFillPlacements.filter(
      (fill) => fill.openingId === door?.id && fill.kind === 'jamb_cell',
    );

    expect(doorJambFills.length).toBeGreaterThan(1);
    expect(new Set(doorJambFills.map((fill) => fill.courseIndex)).size).toBeGreaterThan(1);
    doorJambFills.forEach((fill) => {
      expect(fill.depthMeters).toBeCloseTo(preset.wall.wallThicknessMeters, 6);
      expect(fill.grossVolumeCubicMeters).toBeGreaterThan(0);
    });
  });

  it('uses core cavity volume for lintel grout, not outer lintel bounding-box volume', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const openings = resolveCmuOpenings(preset.wall);
    const module = resolveCmuModuleConfig(preset.wall);
    const core = resolveCmuCoreGeometry(preset.wall);
    const wallInset = preset.wall.wallThicknessMeters / 2;
    const lintelFills = buildLintelGroutFillPlacements(preset.wall, openings, (opening, along, y) => {
      const wallFace = opening.wallFace ?? 'north';
      const wallLength = wallFace === 'north' || wallFace === 'south' ? preset.wall.lengthMeters : preset.wall.widthMeters;
      const centeredAlong = along - wallLength / 2;
      return {
        hostSegmentId: wallFace,
        center: {
          x: wallFace === 'east' ? preset.wall.lengthMeters / 2 - wallInset : centeredAlong,
          y,
          z: wallFace === 'north' ? -preset.wall.widthMeters / 2 + wallInset : centeredAlong,
        },
        rotationY: 0,
        depthMeters: preset.wall.wallThicknessMeters,
      };
    });
    const expectedCellVolume = computeCellCoreVolumeCubicMeters(core, module.actualHeightMeters);

    expect(lintelFills.length).toBeGreaterThan(0);
    lintelFills.forEach((fill) => {
      expect(fill.grossVolumeCubicMeters).toBeCloseTo(expectedCellVolume, 6);
      const boundingBoxVolume = fill.lengthMeters * fill.heightMeters * fill.depthMeters;
      expect(fill.grossVolumeCubicMeters).toBeLessThan(boundingBoxVolume);
    });
  });

  it('generates window sill grout only when sill condition is enabled', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const withoutSill = generateCmuLayout(preset.wall);
    const withSill = generateCmuLayout({
      ...preset.wall,
      openings: preset.wall.openings.map((opening) =>
        opening.type === 'window' ? { ...opening, sillCondition: 'grouted_sill_course' as const } : opening,
      ),
    });

    expect(withoutSill.groutFillPlacements.filter((fill) => fill.kind === 'sill_cell')).toHaveLength(0);
    expect(withSill.groutFillPlacements.filter((fill) => fill.kind === 'sill_cell').length).toBeGreaterThan(0);
  });

  it('deduplicates overlapping lintel and bond-beam grout fills', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const openings = resolveCmuOpenings(preset.wall);
    const jambFills = buildLegacyJambGroutFillPlacements(preset.wall, openings, 10);
    const lintelFills = buildLintelGroutFillPlacements(preset.wall, openings, () => ({
      hostSegmentId: 'north',
      center: { x: 0, y: 1, z: -2 },
      rotationY: 0,
      depthMeters: 0.19,
    }));
    const duplicateBondBeam = lintelFills.map((fill) => ({
      ...fill,
      id: `${fill.id}-dup`,
      kind: 'bond_beam_cell' as const,
    }));
    const { overlapDeduplicationCubicMeters } = deduplicateGroutFillPlacements([
      ...jambFills,
      ...lintelFills,
      ...duplicateBondBeam,
    ]);

    expect(overlapDeduplicationCubicMeters).toBeGreaterThan(0);
  });

  it('detects lintel/block volume overlap for regression guard', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const openings = resolveCmuOpenings(preset.wall);
    const lintel = buildLegacyLintelSolidPlacements(preset.wall, openings)[0];
    expect(
      lintelSolidOccupiesSameVolumeAsBlock({
        lintel,
        blockCenter: lintel.center,
        blockSize: {
          lengthMeters: lintel.lengthMeters,
          heightMeters: lintel.heightMeters,
          depthMeters: lintel.depthMeters,
        },
      }),
    ).toBe(true);
  });

  it('classifies lintel course overlap separately from rough opening void', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const opening = resolveCmuOpenings(preset.wall)[0];
    const module = resolveCmuModuleConfig(preset.wall);
    const lintelCourse = resolveLintelCourseIndex(opening.roughTopMeters, module.moduleHeightMeters);
    const overlapsLintelOnly = blockOverlapsOpeningAssembly({
      opening,
      startAlongMeters: opening.actualStartAlongMeters - opening.lintelBearingMeters,
      endAlongMeters: opening.actualStartAlongMeters,
      courseIndex: lintelCourse,
      courseBottomMeters: lintelCourse * module.moduleHeightMeters,
      courseTopMeters: lintelCourse * module.moduleHeightMeters + (module.actualHeightMeters ?? 0.19),
      moduleHeightMeters: module.moduleHeightMeters,
    });

    expect(overlapsLintelOnly).toBe(true);
  });

  it('trims jamb-adjacent units instead of removing the whole block', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const opening = resolveCmuOpenings(preset.wall)[0];
    const module = resolveCmuModuleConfig(preset.wall);
    const courseBottomMeters = 0;
    const courseTopMeters = module.actualHeightMeters ?? 0.19;

    const leftTrim = resolveOpeningUnitDisposition({
      opening,
      startAlongMeters: opening.actualStartAlongMeters - 0.195,
      endAlongMeters: opening.actualStartAlongMeters + 0.195,
      courseIndex: 0,
      courseBottomMeters,
      courseTopMeters,
      moduleHeightMeters: module.moduleHeightMeters,
    });
    const fullyInside = resolveOpeningUnitDisposition({
      opening,
      startAlongMeters: opening.actualStartAlongMeters + 0.1,
      endAlongMeters: opening.actualEndAlongMeters - 0.1,
      courseIndex: 0,
      courseBottomMeters,
      courseTopMeters,
      moduleHeightMeters: module.moduleHeightMeters,
    });

    expect(leftTrim.action).toBe('trim');
    if (leftTrim.action === 'trim') {
      expect(leftTrim.side).toBe('left');
      expect(leftTrim.endAlongMeters).toBeCloseTo(opening.actualStartAlongMeters, 3);
      expect(leftTrim.lengthMeters).toBeGreaterThanOrEqual(0.02);
    }
    expect(fullyInside.action).toBe('skip');
  });

  it('buildSillGroutFillPlacements returns empty without grouted sill condition', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const openings = resolveCmuOpenings(preset.wall);
    const fills = buildSillGroutFillPlacements(preset.wall, openings, preset.wall.openings, () => ({
      hostSegmentId: 'east',
      center: { x: 0, y: 0, z: 0 },
      rotationY: 0,
      depthMeters: 0.19,
    }));
    expect(fills).toHaveLength(0);
  });

  it('resolves non-modular lintel ends with explicit bearing support blocks', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const openings = resolveCmuOpenings(preset.wall);
    const door = openings.find((opening) => opening.type === 'door');
    const module = resolveCmuModuleConfig(preset.wall);
    const wallLength = preset.wall.lengthMeters;
    const resolvedSpans = new Map(
      openings.map((opening) => [
        opening.id,
        resolveLintelModuleSpan(opening, module.moduleLengthMeters, wallLength),
      ]),
    );
    const doorSpan = resolvedSpans.get(door?.id ?? '');

    expect(doorSpan).toBeDefined();
    expect(isAlongModuleBoundary(doorSpan?.requestedStartAlongMeters ?? 0, module.moduleLengthMeters)).toBe(false);

    const supportBlocks = buildLegacyLintelBearingSupportBlocks(preset.wall, openings, resolvedSpans);
    const doorSupports = supportBlocks.filter((block) => block.openingId === door?.id);

    expect(doorSupports.length).toBeGreaterThan(0);
    expect(doorSupports.some((block) => block.side === 'left')).toBe(true);
    doorSupports.forEach((block) => {
      expect(block.lengthMeters).toBeGreaterThan(0);
      expect(block.lengthMeters).toBeLessThanOrEqual(module.moduleLengthMeters);
    });
  });

  it('extends lintel to module boundary when bearing residual is below support minimum', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const module = resolveCmuModuleConfig(preset.wall);
    const baseOpening = resolveCmuOpenings(preset.wall).find((opening) => opening.type === 'door');
    const opening: ResolvedCmuOpening = {
      ...baseOpening!,
      lintelLengthMeters: 1.48,
      roughStartAlongMeters: 2.35,
      roughEndAlongMeters: 3.35,
    };
    const span = resolveLintelModuleSpan(opening, module.moduleLengthMeters, preset.wall.lengthMeters);

    expect(span.requestedEndAlongMeters).toBeCloseTo(3.59, 2);
    expect(span.extendedRight).toBe(true);
    expect(span.endAlongMeters).toBeCloseTo(3.6, 6);
    expect(isAlongModuleBoundary(span.endAlongMeters, module.moduleLengthMeters)).toBe(true);
  });

  it('derives opening support metadata with grout cell roles and volumes', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');

    expect(layout.derivedOpeningSupports.length).toBeGreaterThan(0);
    const doorSupport = layout.derivedOpeningSupports.find((support) => support.openingId === door?.id);
    expect(doorSupport).toBeDefined();
    expect(doorSupport?.lintel.actualLength).toBeGreaterThan(0);
    expect(doorSupport?.groutCells.some((cell) => cell.role === 'left_jamb' || cell.role === 'right_jamb')).toBe(true);
    expect(doorSupport?.groutCells.some((cell) => cell.role === 'lintel')).toBe(true);
    expect(doorSupport?.groutCells.every((cell) => cell.volume >= 0)).toBe(true);
  });

  it('counts lintel grout cells separately from jamb grout cells', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const lintelCells = layout.groutFillPlacements.filter(
      (fill) => fill.kind === 'lintel_cell' || fill.kind === 'bond_beam_cell',
    );

    expect(layout.openingGrout.lintelGroutedCellCount).toBe(lintelCells.length);
    expect(layout.openingGrout.lintelGroutedCellCount).toBeGreaterThan(0);
    expect(layout.openingGrout.openingGroutVolumeCubicMeters).toBeGreaterThan(0);
    expect(layout.openingGrout.openingGroutVolumeCubicMeters).toBeLessThan(
      layout.openingGrout.roughOpeningAreaSquareMeters * preset.wall.wallThicknessMeters,
    );
  });

  it('classifies bearing support lengths as half or cut blocks', () => {
    const moduleLength = 0.4;
    expect(classifySupportBlockLength(0.2, moduleLength)).toBe('half_block');
    expect(classifySupportBlockLength(0.15, moduleLength)).toBe('cut_block');
  });

  it('summarizeGroutFillPlacements reports lintel grouted cell count', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const openings = resolveCmuOpenings(preset.wall);
    const jambFills = buildLegacyJambGroutFillPlacements(preset.wall, openings, 10);
    const lintelFills = buildLintelGroutFillPlacements(preset.wall, openings, () => ({
      hostSegmentId: 'north',
      center: { x: 0, y: 1, z: -2 },
      rotationY: 0,
      depthMeters: 0.19,
    }));
    const summary = summarizeGroutFillPlacements({
      placements: [...jambFills, ...lintelFills],
      overlapDeduplicationCubicMeters: 0,
      coreGeometry: resolveCmuCoreGeometry(preset.wall),
    });

    expect(summary.lintelGroutedCellCount).toBe(lintelFills.length);
    expect(summary.jambGroutCellCount).toBe(jambFills.length);
  });
});
