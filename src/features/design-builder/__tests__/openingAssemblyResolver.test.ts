import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import {
  layoutResolvedOpeningFromAssembly,
  openingAnchorFromResolvedPlacement,
  openingDraftFromAnchor,
  resolveOpeningAssembly,
  stationAlongSegmentAxis,
} from '../domain/openingAssemblyResolver';
import { blockOverlapsOpeningAssembly } from '../domain/openingAssemblySolver';
import {
  openingDraftFromResolvedPlacement,
  resolveOpeningPlacementFromWallHit,
} from '../domain/openingPlacementResolver';
import { generateCmuLayoutFromWallLayout, getSegmentFramesForWallLayout, resolveWallLayoutGeometry } from '../geometry/designGeometry';

function createStraightWallLayout(lengthMeters = 8) {
  const preset = createFiveBySixCmuBuildingPreset();
  const southFrame = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall).find(
    (frame) => frame.lengthMeters === preset.footprint.lengthMeters,
  )!;
  return {
    preset,
    frame: southFrame,
    lengthMeters,
  };
}

describe('openingAssemblyResolver regression', () => {
  it('keeps preview, saved anchor, frame, rough cutout, and lintel on one station at 25% segment length', () => {
    const { preset, frame } = createStraightWallLayout();
    const previewStation = frame.lengthMeters * 0.25;
    const hitPoint = {
      x: frame.exteriorStart.x + frame.tangent.x * previewStation,
      z: frame.exteriorStart.z + frame.tangent.z * previewStation,
    };
    const openingDefinition = {
      type: 'door' as const,
      widthMeters: 0.9,
      heightMeters: 2.1,
      roughOpeningAllowanceMeters: 0.05,
    };
    const resolved = resolveOpeningPlacementFromWallHit({
      hitPoint,
      hostSegmentId: frame.segmentId,
      segmentFrame: frame,
      openingDefinition,
      snapMode: 'off',
      wall: { ...preset.wall, snapToModule: false },
    });
    const previewAnchor = openingAnchorFromResolvedPlacement(resolved, openingDefinition, 'door-regression');
    const committedDraft = openingDraftFromAnchor(
      previewAnchor,
      { ...openingDefinition, id: 'door-regression', openingFrameMaterial: 'hollow_metal' },
      preset.wall,
      preset.wallLayout,
    );

    expect(committedDraft.placementUsesCenterStation).toBe(true);
    expect(committedDraft.positionAlongSegment).toBeCloseTo(previewStation, 2);

    const assembly = resolveOpeningAssembly({
      anchor: previewAnchor,
      hostSegment: frame,
      masonrySettings: preset.wall,
      openingSettings: openingDefinition,
    });
    const layoutOpening = layoutResolvedOpeningFromAssembly(assembly, preset.wall, openingDefinition);
    const layout = generateCmuLayoutFromWallLayout(
      preset.wallLayout,
      { ...preset.wall, openings: [committedDraft], snapToModule: false },
      resolveWallLayoutGeometry(preset.wallLayout, preset.wall),
    );
    const rough = layout.roughOpenings.find((opening) => opening.id === 'door-regression');
    const lintel = layout.lintels.find((item) => item.openingId === 'door-regression');

    expect(rough).toBeTruthy();
    expect(lintel).toBeTruthy();

    const roughCenterStation = (rough!.roughStartAlongMeters + rough!.roughEndAlongMeters) / 2;
    const frameStation = stationAlongSegmentAxis(frame, {
      x: layoutOpening.worldX,
      z: layoutOpening.worldZ,
    });
    const lintelStation = stationAlongSegmentAxis(frame, { x: lintel!.x, z: lintel!.z });

    expect(roughCenterStation).toBeCloseTo(resolved.positionAlongSegmentMeters, 3);
    expect(frameStation).toBeCloseTo(resolved.positionAlongSegmentMeters, 3);
    expect(lintelStation).toBeCloseTo(resolved.positionAlongSegmentMeters, 3);
    expect(assembly.roughOpening.centerStationMeters).toBeCloseTo(resolved.positionAlongSegmentMeters, 3);

    const intactCourseBlockTypes = new Set(['full', 'half', 'cut', 'corner', 'end']);
    const overlappingKept = layout.blocks.filter((block) => {
      if (
        block.segmentId !== frame.segmentId ||
        block.source === 'opening_assembly_solver' ||
        !intactCourseBlockTypes.has(block.blockType)
      ) {
        return false;
      }
      const start = block.startAlongMeters ?? block.stationMeters ?? 0;
      const end = block.endAlongMeters ?? start + block.lengthMeters;
      const courseIndex = block.courseIndex ?? block.course ?? 0;
      const courseBottom = courseIndex * preset.wall.blockHeightMeters;
      const courseTop = courseBottom + preset.wall.blockHeightMeters;
      const overlapsVoidStation = end > rough!.actualStartAlongMeters && start < rough!.actualEndAlongMeters;
      const overlapsVoidHeight = courseBottom < rough!.actualTopMeters && courseTop > rough!.actualBottomMeters;
      return overlapsVoidStation && overlapsVoidHeight;
    });
    expect(overlappingKept.length).toBe(0);

    const cutoutBlocks = layout.blocks.filter((block) => {
      if (
        block.segmentId !== frame.segmentId ||
        block.source === 'opening_assembly_solver' ||
        !intactCourseBlockTypes.has(block.blockType)
      ) {
        return false;
      }
      const start = block.startAlongMeters ?? block.stationMeters ?? 0;
      const end = block.endAlongMeters ?? start + block.lengthMeters;
      const moduleHeight = resolveCmuModuleConfig(preset.wall).moduleHeightMeters;
      return blockOverlapsOpeningAssembly({
        opening: rough!,
        startAlongMeters: start,
        endAlongMeters: end,
        courseIndex: block.courseIndex ?? block.course ?? 0,
        courseBottomMeters: (block.courseIndex ?? block.course ?? 0) * moduleHeight,
        courseTopMeters: ((block.courseIndex ?? block.course ?? 0) + 1) * moduleHeight,
        moduleHeightMeters: moduleHeight,
      });
    });
    expect(cutoutBlocks.length).toBe(0);

    const foreignCutouts = layout.blocks.filter((block) => {
      if (block.segmentId !== frame.segmentId) return false;
      const start = block.startAlongMeters ?? block.stationMeters ?? 0;
      const end = block.endAlongMeters ?? start + block.lengthMeters;
      const overlapsRough =
        end > rough!.roughStartAlongMeters && start < rough!.roughEndAlongMeters;
      const center = (start + end) / 2;
      const centerDelta = Math.abs(center - resolved.positionAlongSegmentMeters);
      return !overlapsRough && centerDelta < 0.05;
    });
    expect(foreignCutouts.length).toBe(0);
  });

  it('aligns placement on horizontal, vertical, and reversed segment directions', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const frames = getSegmentFramesForWallLayout(preset.wallLayout, preset.wall);
    const cases = [
      frames.find((item) => item.tangent.x > 0.9),
      frames.find((item) => Math.abs(item.tangent.z) > 0.9),
      frames.find((item) => item.tangent.x < -0.9),
    ].filter((item): item is (typeof frames)[number] => item != null);

    cases.forEach((segmentFrame) => {
      const station = segmentFrame.lengthMeters * 0.4;
      const resolved = resolveOpeningPlacementFromWallHit({
        hitPoint: {
          x: segmentFrame.exteriorStart.x + segmentFrame.tangent.x * station,
          z: segmentFrame.exteriorStart.z + segmentFrame.tangent.z * station,
        },
        hostSegmentId: segmentFrame.segmentId,
        segmentFrame,
        openingDefinition: {
          type: 'window',
          widthMeters: 1.2,
          heightMeters: 0.9,
          sillHeightMeters: 1,
          roughOpeningAllowanceMeters: 0.05,
        },
        snapMode: 'off',
        wall: { ...preset.wall, snapToModule: false },
      });
      const draft = openingDraftFromResolvedPlacement(
        resolved,
        {
          type: 'window',
          widthMeters: 1.2,
          heightMeters: 0.9,
          sillHeightMeters: 1,
          roughOpeningAllowanceMeters: 0.05,
        },
        preset.wall,
        preset.wallLayout,
        `window-${segmentFrame.segmentId}`,
      );
      const layout = generateCmuLayoutFromWallLayout(
        preset.wallLayout,
        { ...preset.wall, openings: [draft], snapToModule: false },
        resolveWallLayoutGeometry(preset.wallLayout, preset.wall),
      );
      const rough = layout.roughOpenings.find((opening) => opening.id === `window-${segmentFrame.segmentId}`);
      expect(rough).toBeTruthy();
      const roughCenter = (rough!.roughStartAlongMeters + rough!.roughEndAlongMeters) / 2;
      expect(roughCenter).toBeCloseTo(resolved.positionAlongSegmentMeters, 3);
      if ('worldX' in rough! && 'worldZ' in rough!) {
        const frameStation = stationAlongSegmentAxis(segmentFrame, {
          x: (rough as { worldX: number }).worldX,
          z: (rough as { worldZ: number }).worldZ,
        });
        expect(frameStation).toBeCloseTo(resolved.positionAlongSegmentMeters, 3);
      }
    });
  });
});
