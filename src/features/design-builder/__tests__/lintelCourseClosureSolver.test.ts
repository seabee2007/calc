import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import { resolveCmuOpenings } from '../domain/cmuOpeningRules';
import {
  assertNoOverlappingIntervals,
  buildCoursePatternContext,
  buildLintelCourseAssembly,
  classifyLintelClosureKind,
  collectLintelClosureCutBlockMetadata,
  countLintelClosureCutBlocks,
  cutCoursePatternAroundLintel,
  isLintelClosureGrout,
  LINTEL_COURSE_RECONCILE_TOLERANCE_METERS,
  resolveLintelAdjacentTrim,
} from '../domain/lintelCourseClosureSolver';
import { buildCmuBuildingEstimatePreview } from '../quantity/designQuantityFormulas';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';
import { generateCmuLayout } from '../geometry/designGeometry';
import {
  resolveEffectiveLintelSpan,
  resolveLintelCourseIndex,
  resolveLintelModuleSpan,
} from '../domain/openingAssemblySolver';

function buildRunningBondCourseUnits(params: {
  wallLengthMeters: number;
  moduleLengthMeters: number;
  courseIndex: number;
  runningBond: boolean;
}): Array<{ startAlongMeters: number; endAlongMeters: number }> {
  const halfModule = params.moduleLengthMeters / 2;
  const courseOffset = params.runningBond && params.courseIndex % 2 === 1 ? halfModule : 0;
  const units: Array<{ startAlongMeters: number; endAlongMeters: number }> = [];
  let cursor = 0;
  if (courseOffset > 0.005) {
    units.push({ startAlongMeters: 0, endAlongMeters: courseOffset });
    cursor = courseOffset;
  }
  while (cursor + params.moduleLengthMeters <= params.wallLengthMeters + 0.005) {
    units.push({
      startAlongMeters: cursor,
      endAlongMeters: cursor + params.moduleLengthMeters,
    });
    cursor += params.moduleLengthMeters;
  }
  const remaining = params.wallLengthMeters - cursor;
  if (remaining > 0.04) {
    units.push({ startAlongMeters: cursor, endAlongMeters: params.wallLengthMeters });
  }
  return units;
}

describe('lintel course closure solver', () => {
  it('creates one cut closure from the nearest head joint when lintel edge falls mid-block', () => {
    const moduleLength = 0.4;
    const trim = resolveLintelAdjacentTrim({
      unitStartMeters: 2.0,
      unitEndMeters: 2.4,
      lintelStartMeters: 2.13,
      lintelEndMeters: 2.93,
    });
    expect(trim).toHaveLength(1);
    expect(trim[0]?.adjacentTo).toBe('lintel_start');
    expect(trim[0]?.startAlongMeters).toBe(2.0);
    expect(trim[0]?.endAlongMeters).toBe(2.13);
    expect(trim[0]?.lengthMeters).toBeCloseTo(0.13, 3);
    expect(classifyLintelClosureKind(trim[0]!.lengthMeters, moduleLength)).toBe('cut_block');
  });

  it('creates no cut closure when lintel ends exactly on a head joint', () => {
    const trim = resolveLintelAdjacentTrim({
      unitStartMeters: 2.0,
      unitEndMeters: 2.4,
      lintelStartMeters: 2.0,
      lintelEndMeters: 2.8,
    });
    expect(trim).toHaveLength(0);
  });

  it('uses a half block when the remaining span equals a valid half module', () => {
    const moduleLength = 0.4;
    const trim = resolveLintelAdjacentTrim({
      unitStartMeters: 2.0,
      unitEndMeters: 2.4,
      lintelStartMeters: 2.2,
      lintelEndMeters: 2.9,
    });
    expect(trim).toHaveLength(1);
    expect(trim[0]?.lengthMeters).toBeCloseTo(0.2, 3);
    expect(classifyLintelClosureKind(trim[0]!.lengthMeters, moduleLength)).toBe('half_block');
  });

  it('keeps running-bond phase continuous across both sides of the lintel', () => {
    const moduleLength = 0.4;
    const courseUnits = buildRunningBondCourseUnits({
      wallLengthMeters: 6,
      moduleLengthMeters: moduleLength,
      courseIndex: 11,
      runningBond: true,
    });
    const pattern = buildCoursePatternContext({
      hostSegmentId: 'south',
      courseIndex: 11,
      courseUnits,
      moduleLengthMeters: moduleLength,
      runningBond: true,
    });
    expect(pattern.runningBondPhase).toBe('half_start');
    const { leftTrims, rightTrims } = cutCoursePatternAroundLintel({
      pattern,
      lintelStartMeters: 2.13,
      lintelEndMeters: 2.93,
      moduleLengthMeters: moduleLength,
    });
    [...leftTrims, ...rightTrims].forEach((trim) => {
      const hostUnit = pattern.nominalUnitIntervals.find(
        (unit) =>
          unit.startStationMeters === trim.courseUnitStartMeters
          && unit.endStationMeters === trim.courseUnitEndMeters,
      );
      expect(hostUnit).toBeDefined();
    });
  });

  it('does not restart running-bond packing independently on each lintel side', () => {
    const moduleLength = 0.4;
    const courseUnits = buildRunningBondCourseUnits({
      wallLengthMeters: 6,
      moduleLengthMeters: moduleLength,
      courseIndex: 11,
      runningBond: true,
    });
    const pattern = buildCoursePatternContext({
      hostSegmentId: 'south',
      courseIndex: 11,
      courseUnits,
      moduleLengthMeters: moduleLength,
      runningBond: true,
    });
    const { leftTrims, rightTrims } = cutCoursePatternAroundLintel({
      pattern,
      lintelStartMeters: 2.13,
      lintelEndMeters: 2.93,
      moduleLengthMeters: moduleLength,
    });
    const allTrims = [...leftTrims, ...rightTrims];
    expect(allTrims.every((trim) => trim.startAlongMeters === trim.courseUnitStartMeters || trim.endAlongMeters === trim.courseUnitEndMeters)).toBe(true);
    expect(allTrims.some((trim) => trim.lengthMeters > moduleLength - 0.01)).toBe(false);
  });

  it('changes lintel closure units when lintel bearing changes', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const baseLayout = generateCmuLayout(preset.wall);
    const widerBearingLayout = generateCmuLayout({
      ...preset.wall,
      lintelBearingMeters: (preset.wall.lintelBearingMeters ?? 0.2) + 0.08,
      openings: preset.wall.openings.map((opening) => ({
        ...opening,
        lintelBearingMeters: (opening.lintelBearingMeters ?? preset.wall.lintelBearingMeters ?? 0.2) + 0.08,
      })),
    });
    const door = baseLayout.roughOpenings.find((opening) => opening.type === 'door');
    const baseAssembly = baseLayout.lintelCourseAssemblies.find((assembly) => assembly.openingId === door?.id);
    const widerAssembly = widerBearingLayout.lintelCourseAssemblies.find(
      (assembly) => assembly.openingId === door?.id,
    );
    expect(baseAssembly).toBeDefined();
    expect(widerAssembly).toBeDefined();
    expect(widerAssembly!.lintelSpanMeters).toBeGreaterThan(baseAssembly!.lintelSpanMeters);
  });

  it('places solid CMU closure blocks at normal wall depth and course height', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const module = resolveCmuModuleConfig(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');
    const lintelClosures = layout.blocks.filter(
      (block) => block.nearOpeningId === door?.id && block.source === 'lintel_closure',
    );
    expect(lintelClosures.length).toBeGreaterThan(0);
    lintelClosures.forEach((block) => {
      expect(block.heightMeters).toBeCloseTo(module.actualHeightMeters ?? module.moduleHeightMeters, 3);
      expect(block.depthMeters).toBeCloseTo(preset.wall.wallThicknessMeters, 3);
      expect(block.blockType).not.toBe('grout');
    });
  });

  it('keeps lintel closure blocks from overlapping lintel geometry', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const module = resolveCmuModuleConfig(preset.wall);
    layout.lintelCourseAssemblies.forEach((assembly) => {
      const lintelSpan = {
        startAlongMeters: assembly.lintelStartMeters,
        endAlongMeters: assembly.lintelEndMeters,
      };
      const intervals = [
        ...assembly.leftPlacements,
        lintelSpan,
        ...assembly.rightPlacements,
      ];
      expect(assertNoOverlappingIntervals(intervals)).toBe(true);
      const opening = layout.roughOpenings.find((item) => item.id === assembly.openingId);
      if (!opening) return;
      const resolvedSpan = resolveEffectiveLintelSpan(
        opening,
        module.moduleLengthMeters,
        opening.wallFace === 'north' || opening.wallFace === 'south'
          ? preset.wall.lengthMeters
          : preset.wall.widthMeters,
      );
      expect(assembly.lintelStartMeters).toBeCloseTo(resolvedSpan.startAlongMeters, 3);
      expect(assembly.lintelEndMeters).toBeCloseTo(resolvedSpan.endAlongMeters, 3);
    });
  });

  it('reconciles every lintel course assembly without unexplained gaps beside the lintel', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    layout.lintelCourseAssemblies.forEach((assembly) => {
      expect(assembly.isFullyReconciled).toBe(true);
      const leftExpected = assembly.leftMasonrySpan.endMeters - assembly.leftMasonrySpan.startMeters;
      const rightExpected = assembly.rightMasonrySpan.endMeters - assembly.rightMasonrySpan.startMeters;
      const leftCovered = assembly.leftPlacements.reduce((sum, item) => sum + item.lengthMeters, 0);
      const rightCovered = assembly.rightPlacements.reduce((sum, item) => sum + item.lengthMeters, 0);
      expect(Math.abs(leftCovered - leftExpected)).toBeLessThanOrEqual(LINTEL_COURSE_RECONCILE_TOLERANCE_METERS);
      expect(Math.abs(rightCovered - rightExpected)).toBeLessThanOrEqual(LINTEL_COURSE_RECONCILE_TOLERANCE_METERS);
    });
  });

  it('does not generate grout placements for lintel closure blocks', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const lintelClosureGrout = layout.groutFillPlacements.filter(isLintelClosureGrout);
    expect(lintelClosureGrout).toHaveLength(0);
    layout.blocks
      .filter((block) => block.source === 'lintel_closure')
      .forEach((block) => {
        expect(isLintelClosureGrout({ source: block.source, kind: block.blockType })).toBe(false);
      });
  });

  it('tracks lintel closure cut blocks separately while hiding breakdown lines from the default preview', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const cutCount = countLintelClosureCutBlocks(layout.lintelCourseAssemblies);
    const metadata = collectLintelClosureCutBlockMetadata(layout.lintelCourseAssemblies);
    const preview = buildCmuBuildingEstimatePreview({
      designModelId: 'test-model',
      wallObjectId: 'wall-1',
      slabObjectId: 'slab-1',
      roofObjectId: 'roof-1',
      trussObjectId: 'truss-1',
      wall: preset.wall,
      slab: preset.slab,
      roof: preset.roof,
      truss: preset.truss,
    });
    const lintelCutLine = preview.find((line) => line.quantityType === 'cmu_lintel_closure_cut_blocks');
    const jambCutLine = preview.find((line) => line.quantityType === 'cmu_closure_cut_blocks');
    expect(metadata.every((item) => item.source === 'lintel_closure')).toBe(true);
    expect(metadata.length).toBe(cutCount);
    expect(lintelCutLine).toBeUndefined();
    expect(jambCutLine).toBeUndefined();
  });

  it('builds lintel course assemblies from the host course pattern and resolved lintel span', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const module = resolveCmuModuleConfig(preset.wall);
    const openings = resolveCmuOpenings(preset.wall);
    const door = openings.find((opening) => opening.type === 'door');
    expect(door).toBeDefined();
    const wallThickness = preset.wall.wallThicknessMeters;
    const frame = {
      segmentId: 'south',
      start: { x: preset.wall.lengthMeters / 2, z: preset.wall.widthMeters / 2 - wallThickness / 2 },
      tangent: { x: -1, z: 0 },
      inwardNormal: { x: 0, z: -1 },
      rotationY: Math.PI,
      lengthMeters: preset.wall.lengthMeters,
      wallThicknessMeters: wallThickness,
    };
    const resolvedSpans = new Map(
      openings.map((opening) => [
        opening.id,
        resolveLintelModuleSpan(opening, module.moduleLengthMeters, preset.wall.lengthMeters),
      ]),
    );
    const courseIndex = resolveLintelCourseIndex(door!.roughTopMeters, module.moduleHeightMeters);
    const courseUnits = buildRunningBondCourseUnits({
      wallLengthMeters: preset.wall.lengthMeters,
      moduleLengthMeters: module.moduleLengthMeters,
      courseIndex,
      runningBond: true,
    });
    const assembly = buildLintelCourseAssembly({
      opening: door!,
      hostSegmentId: door!.wallFace ?? 'south',
      frame,
      moduleLengthMeters: module.moduleLengthMeters,
      moduleHeightMeters: module.moduleHeightMeters,
      actualHeightMeters: module.actualHeightMeters ?? module.moduleHeightMeters,
      resolvedLintelSpans: resolvedSpans,
      courseUnits,
      runningBond: true,
    });
    expect(assembly).not.toBeNull();
    expect(assembly!.courseIndex).toBe(courseIndex);
    expect(assembly!.coursePattern.nominalUnitIntervals.length).toBeGreaterThan(0);
    expect(assembly!.lintelSpanMeters).toBeCloseTo(
      assembly!.lintelEndMeters - assembly!.lintelStartMeters,
      6,
    );
  });

  it('layout graph path produces lintel-side trims for the east window opening', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const input = buildDesignGeometryInputFromLayout({
      wallLayout: preset.wallLayout!,
      cmuSettings: preset.wall,
      slabSettings: preset.slab,
      roofSettings: preset.roof,
      trussSettings: preset.truss,
      buildingSystemMode: 'cmu_bearing_wall',
    });
    const geometry = generateDesignGeometry(input);
    const windowAssembly = geometry.wallCmuLayout.lintelCourseAssemblies.find((assembly) =>
      assembly.openingId.includes('window'),
    );
    expect(windowAssembly).toBeDefined();
    const sideClosureCount =
      (windowAssembly?.leftPlacements.length ?? 0) + (windowAssembly?.rightPlacements.length ?? 0);
    expect(sideClosureCount).toBeGreaterThan(0);
    expect(geometry.blockInstances.some((block) => block.source === 'lintel_closure')).toBe(true);

    const windowOpening = geometry.wallCmuLayout.roughOpenings.find((opening) => opening.type === 'window');
    const lintel = geometry.wallCmuLayout.lintels.find((item) => item.openingId === windowOpening?.id);
    const closureBlocks = geometry.wallCmuLayout.blocks.filter(
      (block) => block.source === 'lintel_closure' && block.nearOpeningId === windowOpening?.id,
    );
    expect(lintel).toBeDefined();
    expect(closureBlocks.length).toBeGreaterThan(0);
    closureBlocks.forEach((block) => {
      const dx = Math.abs(block.x - lintel!.x);
      const dz = Math.abs(block.z - lintel!.z);
      expect(Math.max(dx, dz)).toBeLessThan(lintel!.lengthMeters / 2 + block.lengthMeters / 2 + 0.25);
    });
    const leftClosure = closureBlocks.find((block) =>
      windowAssembly!.leftPlacements.some((placement) => placement.id === block.id),
    );
    const rightClosure = closureBlocks.find((block) =>
      windowAssembly!.rightPlacements.some((placement) => placement.id === block.id),
    );
    if (leftClosure) {
      expect(leftClosure.endAlongMeters).toBeCloseTo(windowAssembly!.lintelStartMeters, 3);
    }
    if (rightClosure) {
      expect(rightClosure.startAlongMeters).toBeCloseTo(windowAssembly!.lintelEndMeters, 3);
    }
  });

  it('layout graph path keeps closure blocks flush when window lintel bearing is non-modular', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const wall = {
      ...preset.wall,
      snapToModule: false,
      openings: preset.wall.openings.map((opening) =>
        opening.type === 'window'
          ? {
              ...opening,
              positionAlongSegment: 2.17,
              offsetMeters: 2.17,
              lintelBearingMeters: 0.25,
            }
          : opening,
      ),
    };
    const input = buildDesignGeometryInputFromLayout({
      wallLayout: preset.wallLayout!,
      cmuSettings: wall,
      slabSettings: preset.slab,
      roofSettings: preset.roof,
      trussSettings: preset.truss,
      buildingSystemMode: 'cmu_bearing_wall',
    });
    const geometry = generateDesignGeometry(input);
    const windowAssembly = geometry.wallCmuLayout.lintelCourseAssemblies.find((assembly) =>
      assembly.openingId.includes('window'),
    );
    expect(windowAssembly).toBeDefined();
    expect(windowAssembly!.leftPlacements.length + windowAssembly!.rightPlacements.length).toBeGreaterThan(0);
    const closureBlocks = geometry.wallCmuLayout.blocks.filter(
      (block) => block.source === 'lintel_closure' && block.nearOpeningId === windowAssembly!.openingId,
    );
    expect(closureBlocks.length).toBeGreaterThan(0);
    closureBlocks.forEach((block) => {
      const touchesLintelStart = Math.abs(block.endAlongMeters - windowAssembly!.lintelStartMeters) <= 0.003;
      const touchesLintelEnd = Math.abs(block.startAlongMeters - windowAssembly!.lintelEndMeters) <= 0.003;
      expect(touchesLintelStart || touchesLintelEnd).toBe(true);
    });
  });

  it('skips jamb closure blocks at the lintel course for layout openings', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');
    const module = resolveCmuModuleConfig(preset.wall);
    const lintelCourse = resolveLintelCourseIndex(door?.roughTopMeters ?? 0, module.moduleHeightMeters);
    const lintelCourseJambClosures = layout.blocks.filter(
      (block) =>
        block.nearOpeningId === door?.id &&
        block.source === 'opening_assembly_solver' &&
        (block.closureRole === 'jamb_left' || block.closureRole === 'jamb_right') &&
        (block.courseIndex ?? block.course) === lintelCourse,
    );
    expect(lintelCourseJambClosures).toHaveLength(0);
    const lintelCourseSideClosures = layout.blocks.filter(
      (block) =>
        block.nearOpeningId === door?.id &&
        block.source === 'lintel_closure' &&
        (block.courseIndex ?? block.course) === lintelCourse,
    );
    expect(lintelCourseSideClosures.length).toBeGreaterThan(0);
  });
});
