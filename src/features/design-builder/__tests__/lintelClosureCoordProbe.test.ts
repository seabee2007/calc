import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { generateCmuLayoutFromWallLayout, resolveWallLayoutGeometry } from '../geometry/designGeometry';
import { resolveLintelCourseIndex } from '../domain/openingAssemblySolver';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import { LINTEL_COURSE_RECONCILE_TOLERANCE_METERS } from '../domain/lintelCourseClosureSolver';

describe('lintel closure course continuity', () => {
  it('fills the gap between placed masonry and the lintel bearing faces on the east window course', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const resolved = resolveWallLayoutGeometry(preset.wallLayout!, preset.wall);
    const layout = generateCmuLayoutFromWallLayout(preset.wallLayout!, preset.wall, resolved);
    const module = resolveCmuModuleConfig(preset.wall);
    const mortarJointMeters = module.mortarJointMeters;
    const window = layout.roughOpenings.find((opening) => opening.type === 'window');
    const assembly = layout.lintelCourseAssemblies.find((item) => item.openingId === window?.id);
    expect(window).toBeDefined();
    expect(assembly).toBeDefined();

    const lintelCourse = resolveLintelCourseIndex(window!.roughTopMeters, module.moduleHeightMeters);
    const courseBlocks = layout.blocks
      .filter(
        (block) =>
          block.segmentId === assembly!.hostSegmentId &&
          (block.courseIndex ?? block.course) === lintelCourse,
      )
      .map((block) => ({
        start: block.startAlongMeters ?? 0,
        end: block.endAlongMeters ?? 0,
        source: block.source,
      }))
      .sort((left, right) => left.start - right.start);

    const leftSide = courseBlocks.filter((block) => block.end <= assembly!.lintelStartMeters + LINTEL_COURSE_RECONCILE_TOLERANCE_METERS);
    const rightSide = courseBlocks.filter((block) => block.start >= assembly!.lintelEndMeters - LINTEL_COURSE_RECONCILE_TOLERANCE_METERS);

    for (let index = 1; index < leftSide.length; index += 1) {
      const gap = leftSide[index].start - leftSide[index - 1].end;
      expect(gap).toBeLessThanOrEqual(mortarJointMeters + LINTEL_COURSE_RECONCILE_TOLERANCE_METERS);
    }
    for (let index = 1; index < rightSide.length; index += 1) {
      const gap = rightSide[index].start - rightSide[index - 1].end;
      expect(gap).toBeLessThanOrEqual(mortarJointMeters + LINTEL_COURSE_RECONCILE_TOLERANCE_METERS);
    }

    const leftClosure = leftSide.find((block) => block.source === 'lintel_closure');
    expect(leftClosure).toBeDefined();
    const leftClosureIndex = leftSide.findIndex((block) => block.source === 'lintel_closure');
    expect(leftClosureIndex).toBeGreaterThan(0);
    expect(leftClosure!.start).toBeCloseTo(leftSide[leftClosureIndex - 1]!.end, 3);
    expect(leftClosure!.end).toBeCloseTo(assembly!.lintelStartMeters, 3);

    const rightClosure = rightSide.find((block) => block.source === 'lintel_closure');
    expect(rightClosure).toBeDefined();
    const rightClosureIndex = rightSide.findIndex((block) => block.source === 'lintel_closure');
    expect(rightClosureIndex).toBeGreaterThanOrEqual(0);
    expect(rightClosureIndex).toBeLessThan(rightSide.length - 1);
    expect(rightClosure!.start).toBeCloseTo(assembly!.lintelEndMeters, 3);
    expect(rightClosure!.end).toBeCloseTo(rightSide[rightClosureIndex + 1]!.start, 3);
  });
});
