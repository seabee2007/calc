import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import { resolveCmuOpenings } from '../domain/cmuOpeningRules';
import {
  buildLegacyLintelBearingSupportBlocks,
  resolveLintelModuleSpan,
} from '../domain/openingAssemblySolver';
import {
  classifyClosureGapLength,
  closureClassificationToBlockType,
  computeOpeningJambGapsForCourse,
} from '../domain/openingCourseClosureSolver';
import { generateCmuLayout } from '../geometry/designGeometry';

describe('opening course closure solver', () => {
  it('classifies non-modular gaps as cut blocks instead of default half blocks', () => {
    const moduleLength = 0.4;
    expect(classifyClosureGapLength(0.15, moduleLength, false)).toBe('cut_block');
    expect(classifyClosureGapLength(0.2, moduleLength, false)).toBe('half_block');
    expect(closureClassificationToBlockType('cut_block')).toBe('cut');
  });

  it('does not place non-modular cut closure blocks beside module-snapped door jambs', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');
    const module = resolveCmuModuleConfig(preset.wall);

    const cutClosures = layout.blocks.filter(
      (block) =>
        block.nearOpeningId === door?.id &&
        block.blockType === 'cut' &&
        block.source === 'opening_assembly_solver' &&
        (block.closureRole === 'jamb_left' || block.closureRole === 'jamb_right'),
    );

    expect(cutClosures).toHaveLength(0);
    const startRemainder = (door?.roughStartAlongMeters ?? 0) % module.moduleLengthMeters;
    expect(Math.min(startRemainder, module.moduleLengthMeters - startRemainder)).toBeCloseTo(0, 6);
    expect(layout.openingCourseClosures.some((closure) => closure.openingId === door?.id && closure.closureType === 'cut_block')).toBe(false);
  });

  it('updates lintel bearing support cut width when bearing changes', () => {
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

    const baseSupport = baseLayout.blocks.find(
      (block) => block.nearOpeningId === door?.id && block.closureRole === 'lintel_left_bearing',
    );
    const widerSupport = widerBearingLayout.blocks.find(
      (block) => block.nearOpeningId === door?.id && block.closureRole === 'lintel_left_bearing',
    );

    expect(baseSupport).toBeDefined();
    expect(widerSupport).toBeDefined();
    expect(widerSupport!.lengthMeters).not.toBeCloseTo(baseSupport!.lengthMeters, 3);
  });

  it('does not leave fake half-block jamb placeholders at opening edges', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const module = resolveCmuModuleConfig(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');

    const fakeHalfJambs = layout.blocks.filter(
      (block) =>
        block.nearOpeningId === door?.id &&
        block.blockType === 'jamb' &&
        Math.abs(block.lengthMeters - module.moduleLengthMeters / 2) <= 0.001,
    );

    expect(fakeHalfJambs).toHaveLength(0);
  });

  it('generates no unnecessary cut unit for modular opening width in a synthetic course', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const module = resolveCmuModuleConfig(preset.wall);
    const openings = resolveCmuOpenings(preset.wall);
    const door = openings.find((opening) => opening.type === 'door');
    const resolvedSpans = new Map(
      openings.map((opening) => [
        opening.id,
        resolveLintelModuleSpan(opening, module.moduleLengthMeters, preset.wall.lengthMeters),
      ]),
    );
    const supportBlocks = buildLegacyLintelBearingSupportBlocks(preset.wall, openings, resolvedSpans);
    const moduleLength = module.moduleLengthMeters;
    const courseUnits = Array.from({ length: Math.floor(preset.wall.lengthMeters / moduleLength) }, (_, index) => ({
      startAlongMeters: index * moduleLength,
      endAlongMeters: (index + 1) * moduleLength,
    }));

    const modularOpening: typeof door = {
      ...door!,
      roughStartAlongMeters: 2.4,
      roughEndAlongMeters: 3.2,
      roughOpeningWidthMeters: 0.8,
      actualWidthMeters: 0.8,
    };

    const gaps = computeOpeningJambGapsForCourse({
      opening: modularOpening,
      courseIndex: 2,
      courseBottomMeters: 0.4,
      courseTopMeters: 0.6,
      courseUnits: [
        ...courseUnits.slice(0, 5),
        { startAlongMeters: 2.15, endAlongMeters: 2.55 },
        ...courseUnits.slice(6),
      ],
      moduleLengthMeters: module.moduleLengthMeters,
      moduleHeightMeters: module.moduleHeightMeters,
      wallLengthMeters: preset.wall.lengthMeters,
      groutEnabled: false,
      resolvedLintelSpans: resolvedSpans,
    });

    const leftGap = gaps.find((gap) => gap.side === 'left');
    expect(leftGap).toBeUndefined();
    expect(supportBlocks.some((block) => block.openingId === door?.id)).toBe(true);
  });
});
