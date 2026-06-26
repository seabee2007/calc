import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { addWallSegment, createOutsideFaceRectangleLayout } from '../domain/wallLayoutRules';
import { resolveOpeningFrameCenterWorld } from '../domain/openingFrame3dGraphics';
import { resolveOpeningBlockVoidBounds } from '../domain/openingAssemblySolver';
import {
  openingsForFrameFitMasonry,
  panelAdjustedOpeningsForElevation,
} from '../domain/openingAwareMasonryPanelSolver';
import { resolveCmuModuleDefinition } from '../domain/cmuModuleRules';
import {
  resolveInfillPlasterPanelPlacements,
  totalInfillPlasterAreaSquareMeters,
} from '../domain/infillPlaster';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
  getSegmentFramesForWallLayout,
  resolveSegmentWallLayoutStart,
} from '../geometry/designGeometry';

describe('opening alignment on interior partitions', () => {
  it('centers CMU blocks and door frame on the partition wall centerline', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const baseLayout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 5,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const layoutWithPartition = addWallSegment(baseLayout, baseLayout.segments[3]!.startNodeId, 0, 0);
    const interiorSegment = layoutWithPartition.segments.at(-1)!;
    const frames = getSegmentFramesForWallLayout(layoutWithPartition, preset.wall);
    const interiorFrame = frames.find((frame) => frame.segmentId === interiorSegment.id)!;
    const centerStation = interiorFrame.lengthMeters / 2;
    const wall = {
      ...preset.wall,
      openings: [
        {
          id: 'door-partition',
          type: 'door' as const,
          wallSegmentId: interiorSegment.id,
          positionAlongSegment: centerStation,
          placementUsesCenterStation: true,
          widthMeters: 0.9,
          heightMeters: 2.1,
          roughOpeningAllowanceMeters: 0.05,
        },
      ],
    };

    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: layoutWithPartition,
        cmuSettings: wall,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
        buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
        frameSystem: preset.frameSystem,
        infillSystem: preset.infillSystem,
        gableEndSystem: preset.gableEndSystem,
        roofSystem: preset.roofSystem,
      }),
    );

    const door = geometry.wallCmuLayout.roughOpenings.find((opening) => opening.id === 'door-partition') as
      | (typeof geometry.wallCmuLayout.roughOpenings[number] & { worldX?: number; worldZ?: number })
      | undefined;
    expect(door).toBeDefined();

    const frameCenter = resolveOpeningFrameCenterWorld(door!, interiorFrame);
    expect(door!.worldX).toBeCloseTo(frameCenter.x, 3);
    expect(door!.worldZ).toBeCloseTo(frameCenter.z, 3);

    const actualCenter = (door!.actualStartAlongMeters + door!.actualEndAlongMeters) / 2;
    const layoutStart = resolveSegmentWallLayoutStart(interiorFrame);
    const expectedBlockCenter = {
      x:
        layoutStart.x +
        interiorFrame.tangent.x * actualCenter +
        interiorFrame.inwardNormal.x * (interiorFrame.wallThicknessMeters / 2),
      z:
        layoutStart.z +
        interiorFrame.tangent.z * actualCenter +
        interiorFrame.inwardNormal.z * (interiorFrame.wallThicknessMeters / 2),
    };
    expect(expectedBlockCenter.x).toBeCloseTo(frameCenter.x, 3);
    expect(expectedBlockCenter.z).toBeCloseTo(frameCenter.z, 3);

    const jambBlocks = geometry.blockInstances.filter(
      (block) =>
        block.segmentId === interiorSegment.id &&
        block.courseIndex <= 1 &&
        block.stationMeters >= door!.actualStartAlongMeters - 0.05 &&
        block.stationMeters <= door!.actualEndAlongMeters + 0.05,
    );
    expect(jambBlocks.length).toBeGreaterThan(0);
    jambBlocks.forEach((block) => {
      const depthOffset =
        (block.x - frameCenter.x) * interiorFrame.inwardNormal.x +
        (block.z - frameCenter.z) * interiorFrame.inwardNormal.z;
      expect(Math.abs(depthOffset)).toBeLessThan(0.005);
    });

    const module = resolveCmuModuleDefinition(wall);
    const panelBounds = geometry.resolvedInfillPanelBounds?.find(
      (bounds) => bounds.hostSegmentId === interiorSegment.id && bounds.bottomElevationMeters === 0,
    );
    expect(panelBounds).toBeDefined();
    const adjustedOpenings = openingsForFrameFitMasonry(
      panelAdjustedOpeningsForElevation([door!], panelBounds!.bottomElevationMeters),
    );
    const voidBounds = resolveOpeningBlockVoidBounds(adjustedOpenings[0]!);

    const aboveGradeBlocks = geometry.blockInstances.filter(
      (block) =>
        block.segmentId === interiorSegment.id &&
        block.y >= 0 &&
        block.source !== 'below_grade_rc_infill',
    );
    const voidInvadingBlocks = aboveGradeBlocks.filter((block) => {
      const blockHeight = block.physicalHeightMeters ?? block.heightMeters ?? module.actualBlockHeightMeters;
      const courseBottom = block.y - blockHeight / 2;
      const courseTop = block.y + blockHeight / 2;
      const startAlong = block.startAlongMeters ?? block.stationMeters ?? 0;
      const endAlong = block.endAlongMeters ?? startAlong + block.lengthMeters;
      const inVoidHorizontal = startAlong < voidBounds.endAlongMeters && endAlong > voidBounds.startAlongMeters;
      const inVoidVertical = courseBottom < voidBounds.topMeters && courseTop > voidBounds.bottomMeters;
      return inVoidHorizontal && inVoidVertical && block.source !== 'opening_jamb_closure';
    });
    expect(voidInvadingBlocks).toHaveLength(0);

    const jambClosures = aboveGradeBlocks.filter((block) => block.source === 'opening_jamb_closure');
    expect(jambClosures.length).toBeGreaterThan(0);

    const plasterPlacements = resolveInfillPlasterPanelPlacements({
      infillSystem: geometry.infillSystem,
      panelBounds: geometry.resolvedInfillPanelBounds ?? [],
      openings: geometry.wallCmuLayout.roughOpenings,
      wallThicknessMeters: wall.wallThicknessMeters,
      exteriorSegmentIds: new Set(
        (geometry.resolvedFootprint?.orderedPerimeterSegments ?? []).map((segment) => segment.segmentId),
      ),
    });
    const interiorPartitionPlaster = plasterPlacements.filter(
      (placement) => placement.hostSegmentId === interiorSegment.id && placement.side === 'interior',
    );
    expect(interiorPartitionPlaster.length).toBeGreaterThan(0);
    expect(totalInfillPlasterAreaSquareMeters(interiorPartitionPlaster)).toBeGreaterThan(0);

    const exteriorSideInteriorFinish = plasterPlacements.filter(
      (placement) =>
        placement.hostSegmentId === interiorSegment.id &&
        placement.side === 'exterior' &&
        placement.finish === geometry.infillSystem!.plaster.interiorFinish,
    );
    expect(exteriorSideInteriorFinish.length).toBeGreaterThan(0);
  });
});
