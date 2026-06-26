import { describe, expect, it } from 'vitest';
import { createBlankCmuBuildingPreset, createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { applyAutoFrameLayout } from '../domain/structureActions';
import { normalizeRcFrameFoundationSettings } from '../domain/rcFrameFoundationMigration';
import {
  buildClockwisePerimeter,
  buildCmuCoursePlans,
  buildDesignGeometryInputFromLayout,
  createCmuBlockPlacement,
  createMasonryCourseContext,
  findExteriorFootprintBoundaryViolations,
  generateCmuBlockInstances,
  generateCmuLayout,
  generateDesignGeometry,
  resolveWallLayoutGeometry,
  validateSegmentCoursePlacement,
} from '../geometry/designGeometry';
import { resolveCmuModuleConfig } from '../domain/cmuModuleRules';
import { addWallSegment, createOutsideFaceRectangleLayout, moveWallNode } from '../domain/wallLayoutRules';

describe('Design Builder generated geometry', () => {
  it('uses blank source path without legacy geometry for an empty blank layout', () => {
    const preset = createBlankCmuBuildingPreset();
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: { ...preset.wall, openings: [], manualMasonryCourseRuns: [] },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );

    expect(geometry.sourcePath).toBe('blank');
    expect(geometry.wallSegments).toHaveLength(0);
    expect(geometry.blockInstances).toHaveLength(0);
    expect(geometry.wallCmuLayout.blocks).toHaveLength(0);
    expect(geometry.blockCount).toBe(0);
  });

  it('uses manual masonry source path without legacy geometry when only manual runs exist', () => {
    const preset = createBlankCmuBuildingPreset();
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: {
          ...preset.wall,
          openings: [],
          manualMasonryCourseRuns: [
            {
              id: 'run-1',
              wallSegmentId: 'manual-plan-course',
              origin: { x: 0, y: 0, z: 0 },
              tangent: { x: 1, z: 0 },
              courseIndex: 0,
              startModuleIndex: 0,
              unitType: 'full_block',
              count: 3,
              moduleLengthMeters: 0.4,
              moduleHeightMeters: 0.2,
              wallThicknessMeters: 0.19,
              direction: 'forward',
              source: 'manual_3d_brush',
              originX: 0,
              originZ: 0,
              orientation: 'east',
            },
          ],
        },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );

    expect(geometry.sourcePath).toBe('manual_masonry');
    expect(geometry.wallSegments).toHaveLength(0);
    expect(geometry.blockInstances).toHaveLength(0);
    expect(geometry.wallCmuLayout.blocks).toHaveLength(0);
  });

  it('generates CMU block instances from wall parameters without storing per-block source objects', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const instances = generateCmuBlockInstances(preset.wall);

    expect(instances.length).toBeGreaterThan(0);
    expect(instances.some((instance) => instance.id.startsWith('south-'))).toBe(true);
    expect(instances.some((instance) => instance.id.startsWith('east-'))).toBe(true);
  });

  it('does not generate block instances inside door and window openings', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const instances = generateCmuBlockInstances(preset.wall);
    const layout = generateCmuLayout(preset.wall);
    const doorOpening = layout.roughOpenings.find((opening) => opening.id === 'door-west-01')!;
    const windowOpening = layout.roughOpenings.find((opening) => opening.id === 'window-east-01')!;

    const doorBlocks = instances.filter(
      (instance) =>
        instance.blockType !== 'jamb' &&
        instance.id.startsWith('south-') &&
        instance.x >= -preset.wall.lengthMeters / 2 + doorOpening.actualStartAlongMeters &&
        instance.x <= -preset.wall.lengthMeters / 2 + doorOpening.actualEndAlongMeters &&
        instance.y >= doorOpening.actualBottomMeters &&
        instance.y <= doorOpening.actualTopMeters,
    );
    const windowBlocks = instances.filter(
      (instance) =>
        instance.blockType !== 'jamb' &&
        instance.id.startsWith('east-') &&
        instance.z >= -preset.wall.widthMeters / 2 + windowOpening.actualStartAlongMeters &&
        instance.z <= -preset.wall.widthMeters / 2 + windowOpening.actualEndAlongMeters &&
        instance.y >= windowOpening.actualBottomMeters &&
        instance.y <= windowOpening.actualTopMeters,
    );

    expect(doorBlocks).toHaveLength(0);
    expect(windowBlocks).toHaveLength(0);
  });

  it('returns no generated blocks when individual block display is off', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    expect(generateCmuBlockInstances({ ...preset.wall, showIndividualBlocks: false })).toHaveLength(0);
  });

  it('generates CMU courses and running bond special units', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);

    expect(layout.courseCount).toBeGreaterThan(1);
    expect(new Set(layout.blocks.map((block) => block.course)).size).toBe(layout.courseCount);
    expect(layout.counts.full).toBeGreaterThan(0);
    expect(layout.counts.half + layout.counts.corner + layout.counts.jamb + layout.counts.cut).toBeGreaterThan(0);
  });

  it('generates lintels above openings with default bearing', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);

    expect(layout.lintels).toHaveLength(preset.wall.openings.length);
    expect(layout.lintels[0].lengthMeters).toBeCloseTo(layout.roughOpenings[0].lintelLengthMeters, 6);
    expect(layout.counts.lintel_bond_beam).toBe(preset.wall.openings.length);
  });

  it('running bond alternates courses by a half module', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout({ ...preset.wall, openings: [], bondPattern: 'running_bond' });
    const courseZero = layout.blocks.find((block) => block.face === 'north' && block.course === 0);
    const courseOne = layout.blocks.find((block) => block.face === 'north' && block.course === 1);

    expect(courseZero?.blockType).not.toBe('half');
    expect(courseOne?.blockType).toBe('half');
    expect(courseOne?.lengthMeters).toBeCloseTo((preset.wall.blockModule?.actualLengthMeters ?? 0.39) / 2, 6);
  });

  it('places CMU courses upward on Y by module height and bed joint', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout({ ...preset.wall, openings: [], bondPattern: 'running_bond' });
    const courseZero = layout.blocks.find((block) => block.face === 'north' && block.course === 0);
    const courseOne = layout.blocks.find((block) => block.face === 'north' && block.course === 1);

    expect(courseZero).toBeTruthy();
    expect(courseOne).toBeTruthy();
    expect((courseOne?.y ?? 0) - (courseZero?.y ?? 0)).toBeCloseTo(preset.wall.blockModule?.moduleHeightMeters ?? 0.2, 6);
  });

  it('running bond and stack bond use distinct station offsets', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const running = generateCmuLayout({ ...preset.wall, openings: [], bondPattern: 'running_bond' });
    const stack = generateCmuLayout({ ...preset.wall, openings: [], bondPattern: 'stack_bond' });
    const runningCourseZero = running.blocks.find((block) => block.face === 'north' && block.course === 0);
    const runningCourseOne = running.blocks.find((block) => block.face === 'north' && block.course === 1);
    const stackCourseZero = stack.blocks.find((block) => block.face === 'north' && block.course === 0);
    const stackCourseOne = stack.blocks.find((block) => block.face === 'north' && block.course === 1);

    expect(runningCourseZero?.startAlongMeters).toBeCloseTo(stackCourseZero?.startAlongMeters ?? -1, 6);
    expect(runningCourseOne?.lengthMeters).toBeCloseTo((preset.wall.blockModule?.actualLengthMeters ?? 0.39) / 2, 6);
    expect(stackCourseZero?.startAlongMeters).toBeCloseTo(stackCourseOne?.startAlongMeters ?? -1, 6);
    expect(stackCourseZero?.lengthMeters).toBeCloseTo(stackCourseOne?.lengthMeters ?? -1, 6);
  });

  it('uses one shared masonry course phase across a closed footprint', () => {
    const courseZero = createMasonryCourseContext({
      courseIndex: 0,
      moduleHeightMeters: 0.2,
      nominalModuleLengthMeters: 0.4,
      bondPattern: 'running_bond',
      orderedPerimeterSegmentIds: ['a', 'b', 'c', 'd'],
    });
    const courseOne = createMasonryCourseContext({
      courseIndex: 1,
      moduleHeightMeters: 0.2,
      nominalModuleLengthMeters: 0.4,
      bondPattern: 'running_bond',
      orderedPerimeterSegmentIds: ['a', 'b', 'c', 'd'],
    });
    const stackCourseOne = createMasonryCourseContext({
      courseIndex: 1,
      moduleHeightMeters: 0.2,
      nominalModuleLengthMeters: 0.4,
      bondPattern: 'stack_bond',
      orderedPerimeterSegmentIds: ['a', 'b', 'c', 'd'],
    });

    expect(courseZero.coursePhase).toBe(0);
    expect(courseZero.globalJointOffset).toBe(0);
    expect(courseOne.coursePhase).toBe(1);
    expect(courseOne.globalJointOffset).toBeCloseTo(0.2, 6);
    expect(stackCourseOne.globalJointOffset).toBe(0);
    expect(courseOne.orderedPerimeterSegmentIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('creates block placement with local X length, Y height, and Z wall thickness convention', () => {
    const placement = createCmuBlockPlacement({
      segmentId: 'segment-1',
      courseIndex: 2,
      moduleIndex: 3,
      unitType: 'full',
      stationMeters: 1.2,
      nominalLengthMeters: 0.4,
      actualLengthMeters: 0.39,
      heightMeters: 0.19,
      depthMeters: 0.19,
      wallStart: { x: 0, z: 0 },
      tangent: { x: 1, z: 0 },
      inwardNormal: { x: 0, z: 1 },
      moduleHeightMeters: 0.2,
      rotationY: 0,
    });

    expect(placement.lengthMeters).toBeCloseTo(0.39, 6);
    expect(placement.nominalLengthMeters).toBeCloseTo(0.4, 6);
    expect(placement.actualLengthMeters).toBeCloseTo(0.39, 6);
    expect(placement.heightMeters).toBeCloseTo(0.19, 6);
    expect(placement.depthMeters).toBeCloseTo(0.19, 6);
    expect(placement.center.x).toBeCloseTo(1.4, 6);
    expect(placement.center.y).toBeCloseTo(0.495, 6);
    expect(placement.center.z).toBeCloseTo(0.095, 6);
  });

  it('wall rotation changes tangent direction without rotating block height away from Y', () => {
    const placement = createCmuBlockPlacement({
      segmentId: 'segment-1',
      courseIndex: 1,
      moduleIndex: 0,
      unitType: 'full',
      stationMeters: 0,
      nominalLengthMeters: 0.4,
      actualLengthMeters: 0.39,
      heightMeters: 0.19,
      depthMeters: 0.19,
      wallStart: { x: 0, z: 0 },
      tangent: { x: 0, z: 1 },
      inwardNormal: { x: -1, z: 0 },
      moduleHeightMeters: 0.2,
      rotationY: -Math.PI / 2,
    });

    expect(placement.center.x).toBeCloseTo(-0.095, 6);
    expect(placement.center.z).toBeCloseTo(0.2, 6);
    expect(placement.center.y).toBeCloseTo(0.295, 6);
    expect(placement.rotationY).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('does not generate legacy CMU blocks for zero-dimension blank walls', () => {
    const preset = createBlankCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);

    expect(layout.blocks).toHaveLength(0);
    expect(layout.totalBlocks).toBe(0);
  });

  it('generates 3D wall geometry from the wall layout graph when present', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const input = buildDesignGeometryInputFromLayout({
      wallLayout: preset.wallLayout,
      cmuSettings: preset.wall,
      openings: preset.wall.openings,
      slabSettings: preset.slab,
      roofSettings: preset.roof,
      trussSettings: preset.truss,
    });
    const geometry = generateDesignGeometry(input);

    expect(geometry.sourcePath).toBe('layout_graph');
    expect(geometry.wallSegments).toHaveLength(preset.wallLayout.segments.length);
    expect(geometry.bondPattern).toBe('running_bond');
    expect(geometry.blockCount).toBeGreaterThan(0);
    expect(geometry.blockInstances).toHaveLength(geometry.wallCmuLayout.blocks.length);
    expect(geometry.wallCmuLayout.roughOpenings.every((opening) => 'worldX' in opening && 'worldZ' in opening)).toBe(true);
  });

  it('layout graph path derives rendered blocks from layout wallCmuLayout only', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: { ...preset.wall, openings: [], bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );

    expect(geometry.sourcePath).toBe('layout_graph');
    expect(geometry.wallCmuLayout.blocks.map((block) => block.id)).toEqual(geometry.blockInstances.map((block) => block.id));
    expect(geometry.wallCmuLayout.blocks.every((block) => block.segmentId)).toBe(true);
    expect(geometry.wallCmuLayout.roughOpenings).toHaveLength(0);
  });

  it('derived placement list accounts for every rendered CMU unit', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: { ...preset.wall, openings: [], bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );

    expect(geometry.wallCmuLayout.unitPlacements).toHaveLength(geometry.blockInstances.length);
    expect(geometry.wallCmuLayout.unitPlacements.map((placement) => placement.id)).toEqual(
      geometry.blockInstances.map((block) => block.id),
    );
    expect(
      geometry.wallCmuLayout.unitPlacements.every((placement) =>
        placement.source === 'corner_assembly' ||
        placement.source === 'wall_run' ||
        placement.source === 'terminal_closure',
      ),
    ).toBe(true);
  });

  it('layout-generated opening, lintel, and jamb geometry comes from wallSegmentId', () => {
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
    const windowOpening = geometry.wallCmuLayout.roughOpenings.find((opening) => opening.id === 'window-east-01') as
      | (typeof geometry.wallCmuLayout.roughOpenings[number] & { wallSegmentId?: string; worldX?: number; worldZ?: number; rotationY?: number })
      | undefined;
    const doorOpening = geometry.wallCmuLayout.roughOpenings.find((opening) => opening.id === 'door-west-01');
    const windowLintel = geometry.wallCmuLayout.lintels.find((lintel) => lintel.openingId === 'window-east-01');
    const doorLintel = geometry.wallCmuLayout.lintels.find((lintel) => lintel.openingId === 'door-west-01');
    const windowGrout = geometry.wallCmuLayout.jambGroutCells.filter((cell) => cell.openingId === 'window-east-01');
    const moduleConfig = resolveCmuModuleConfig(preset.wall);

    expect(windowOpening?.wallSegmentId).toBe(preset.wall.openings.find((opening) => opening.id === 'window-east-01')?.wallSegmentId);
    expect(windowOpening?.worldX).toBeCloseTo(windowLintel?.x ?? 0, 6);
    expect(windowOpening?.worldZ).toBeCloseTo(windowLintel?.z ?? 0, 6);
    expect(windowLintel?.segmentId).toBe(windowOpening?.wallSegmentId);
    expect(windowLintel?.heightMeters).toBeCloseTo(moduleConfig.actualHeightMeters, 6);
    expect(windowLintel?.depthMeters).toBeCloseTo(preset.wall.wallThicknessMeters, 6);
    expect(windowLintel?.lengthMeters).toBeCloseTo(
      (windowOpening?.actualWidthMeters ?? 0) + (windowOpening?.lintelBearingMeters ?? 0) * 2,
      6,
    );
    expect(windowLintel?.courseIndex).toBe(Math.ceil((windowOpening?.roughTopMeters ?? 0) / moduleConfig.moduleHeightMeters));
    expect(windowLintel?.y).toBeCloseTo(
      (windowLintel?.courseIndex ?? 0) * moduleConfig.moduleHeightMeters + moduleConfig.actualHeightMeters / 2,
      6,
    );
    expect(windowOpening?.actualTopMeters).toBeCloseTo(doorOpening?.actualTopMeters ?? 0, 6);
    expect(windowLintel?.courseIndex).toBe(doorLintel?.courseIndex);
    expect(windowLintel?.y).toBeCloseTo(doorLintel?.y ?? 0, 6);
    expect(windowGrout.every((cell) => cell.segmentId === windowOpening?.wallSegmentId)).toBe(true);
  });

  it('layout-graph door void and frame share the same segment station frame', () => {
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
    const door = geometry.wallCmuLayout.roughOpenings.find((opening) => opening.id === 'door-west-01') as
      | (typeof geometry.wallCmuLayout.roughOpenings[number] & { wallSegmentId?: string; worldX?: number; worldZ?: number })
      | undefined;
    const moduleHeight = resolveCmuModuleConfig(preset.wall).moduleHeightMeters;
    const segmentId = door?.wallSegmentId;
    const voidBlocks = geometry.blockInstances.filter((block) => {
      if (block.segmentId !== segmentId) return false;
      const start = block.stationMeters ?? 0;
      const end = start + (block.actualLengthMeters ?? block.lengthMeters);
      const inActual = end > (door?.actualStartAlongMeters ?? 0) && start < (door?.actualEndAlongMeters ?? 0);
      const courseBottom = (block.courseIndex ?? block.course) * moduleHeight;
      const courseTop = courseBottom + moduleHeight;
      const inHeight = courseBottom < (door?.actualTopMeters ?? 0) && courseTop > (door?.actualBottomMeters ?? 0);
      return inActual && inHeight;
    });

    expect(door?.worldX).toBeDefined();
    expect(voidBlocks).toHaveLength(0);
    const nearestVoidEdge = geometry.blockInstances
      .filter((block) => block.segmentId === segmentId)
      .map((block) => Math.min(
        Math.abs((block.stationMeters ?? 0) - (door?.actualStartAlongMeters ?? 0)),
        Math.abs((block.stationMeters ?? 0) + (block.actualLengthMeters ?? block.lengthMeters) - (door?.actualEndAlongMeters ?? 0)),
      ))
      .sort((left, right) => left - right)[0];
    expect(nearestVoidEdge).toBeLessThan(0.05);
  });

  it('moving a wall segment moves its attached opening and lintel with the segment frame', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const windowSegmentId = preset.wall.openings.find((opening) => opening.id === 'window-east-01')?.wallSegmentId;
    const windowSegment = preset.wallLayout.segments.find((segment) => segment.id === windowSegmentId)!;
    const movedOnce = moveWallNode(preset.wallLayout, windowSegment.startNodeId, 3.4, -2.5);
    const movedLayout = moveWallNode(movedOnce, windowSegment.endNodeId, 3.4, 2.5);
    const base = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: preset.wall,
        openings: preset.wall.openings,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const moved = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: movedLayout,
        cmuSettings: preset.wall,
        openings: preset.wall.openings,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const baseWindow = base.wallCmuLayout.roughOpenings.find((opening) => opening.id === 'window-east-01') as
      | (typeof base.wallCmuLayout.roughOpenings[number] & { worldX?: number; worldZ?: number })
      | undefined;
    const movedWindow = moved.wallCmuLayout.roughOpenings.find((opening) => opening.id === 'window-east-01') as
      | (typeof moved.wallCmuLayout.roughOpenings[number] & { worldX?: number; worldZ?: number })
      | undefined;
    const movedLintel = moved.wallCmuLayout.lintels.find((lintel) => lintel.openingId === 'window-east-01');

    expect(movedWindow?.worldX).not.toBeCloseTo(baseWindow?.worldX ?? 0, 6);
    expect(movedWindow?.worldX).toBeCloseTo(movedLintel?.x ?? 0, 6);
    expect(movedWindow?.worldZ).toBeCloseTo(movedLintel?.z ?? 0, 6);
  });

  it('newly drawn layout segments appear in generated 3D wall geometry', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const startNodeId = preset.wallLayout.segments.at(-1)!.endNodeId;
    const drawnLayout = addWallSegment(preset.wallLayout, startNodeId, -3, -3.4, {
      wallHeightMeters: preset.wall.heightMeters,
    });
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: drawnLayout,
        cmuSettings: preset.wall,
        openings: preset.wall.openings,
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );

    expect(geometry.wallSegments).toHaveLength(drawnLayout.segments.length);
    expect(geometry.wallSegments.at(-1)?.lengthMeters).toBeGreaterThan(0);
  });

  it('layout graph running bond offsets alternating segment courses while stack bond stays aligned', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 4,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const moduleLength = preset.wall.blockModule?.moduleLengthMeters ?? 0.4;
    const running = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: layout,
        cmuSettings: { ...preset.wall, openings: [], bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const stacked = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: layout,
        cmuSettings: { ...preset.wall, openings: [], bondPattern: 'stack_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const firstNonZeroStart = (geometry: typeof running, course: number) =>
      geometry.blockInstances
        .filter((block) => block.course === course && (block.stationMeters ?? 0) > moduleLength / 4)
        .sort((a, b) => (a.stationMeters ?? 0) - (b.stationMeters ?? 0))[0]?.stationMeters;
    const firstStart = (geometry: typeof running, course: number) =>
      geometry.blockInstances
        .filter((block) => block.course === course)
        .sort((a, b) => a.stationMeters - b.stationMeters)[0]?.stationMeters;

    expect(firstStart(running, 0)).toBeCloseTo(0, 2);
    expect(firstNonZeroStart(running, 0)).toBeCloseTo(moduleLength, 1);
    expect(firstStart(running, 1)).toBeCloseTo(moduleLength / 2, 1);
    expect(firstNonZeroStart(stacked, 0)).toBeCloseTo(moduleLength, 1);
    expect(firstNonZeroStart(stacked, 1)).toBeCloseTo(moduleLength, 1);
  });

  it('closed rectangle uses one global running-bond phase instead of per-wall restarts', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: { ...preset.wall, openings: [], bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const courseZeroCorners = geometry.wallCmuLayout.cornerAssemblies?.filter((assembly) => assembly.courseIndex === 0) ?? [];
    const courseOneCorners = geometry.wallCmuLayout.cornerAssemblies?.filter((assembly) => assembly.courseIndex === 1) ?? [];
    const courseZeroStarts = geometry.blockInstances.filter(
      (block) => block.course === 0 && (block.stationMeters ?? 0) <= 0.01,
    );
    const courseOneStarts = geometry.blockInstances.filter(
      (block) => block.course === 1 && (block.stationMeters ?? 0) <= 0.01,
    );
    const moduleLength = preset.wall.blockModule?.moduleLengthMeters ?? 0.4;
    const firstCourseStarts = geometry.blockInstances
      .filter((block) => block.course === 0)
      .map((block) => block.stationMeters);

    expect(new Set(courseZeroCorners.map((corner) => corner.phase))).toEqual(new Set([0]));
    expect(new Set(courseOneCorners.map((corner) => corner.phase))).toEqual(new Set([1]));
    expect(courseZeroStarts).toHaveLength(4);
    expect(courseOneStarts).toHaveLength(0);
    expect(firstCourseStarts.filter((station) => station <= 0.01)).toHaveLength(4);
  });

  it('closed rectangle creates outside corner weave layouts that alternate ownership', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: { ...preset.wall, openings: [], bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const courseZero = geometry.cornerCourseLayouts.filter((corner) => corner.courseIndex === 0);
    const courseOne = geometry.cornerCourseLayouts.filter((corner) => corner.courseIndex === 1);

    expect(courseZero).toHaveLength(4);
    expect(geometry.wallCmuLayout.cornerAssemblies?.filter((assembly) => assembly.courseIndex === 0)).toHaveLength(4);
    expect(courseZero.every((corner) => corner.cornerType === 'outside')).toBe(true);
    expect(courseZero.every((corner) => corner.strategy === 'interlocked_running_bond')).toBe(true);
    expect(courseZero[0].ownerSegmentId).not.toBe(courseOne[0].ownerSegmentId);
    expect(courseZero[0].buttingStartTrim).toBeCloseTo((preset.wall.blockModule?.moduleLengthMeters ?? 0.4) / 2, 6);
  });

  it('layout corner weave generates corner and end units without duplicate corner blocks', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 4,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: layout,
        cmuSettings: { ...preset.wall, lengthMeters: 6, widthMeters: 4, openings: [], bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const firstCourseBySegment = new Map<string, typeof geometry.blockInstances>();
    geometry.blockInstances
      .filter((block) => block.course === 0)
      .forEach((block) => {
        const segmentId = block.segmentId ?? block.face;
        firstCourseBySegment.set(segmentId, [...(firstCourseBySegment.get(segmentId) ?? []), block]);
      });

    expect(firstCourseBySegment.size).toBe(4);
    firstCourseBySegment.forEach((blocks) => {
      expect(blocks.filter((block) => block.blockType === 'half')).toHaveLength(0);
      expect(blocks.some((block) => block.blockType === 'corner')).toBe(true);
    });
  });

  it('does not place half blocks at both ends of clean first-course rectangle spans', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: { ...preset.wall, openings: [], bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );

    expect(firstCourseDoubleHalfSegments(geometry.blockInstances)).toHaveLength(0);
    expect(geometry.wallCmuLayout.warnings.some((warning) => /redundant half blocks/i.test(warning))).toBe(false);
  });

  it('prefers full stretchers on a 6m by 4m running-bond rectangle first course', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 4,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: layout,
        cmuSettings: { ...preset.wall, openings: [], lengthMeters: 6, widthMeters: 4, bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );

    expect(firstCourseDoubleHalfSegments(geometry.blockInstances)).toHaveLength(0);
    expect(geometry.wallCmuLayout.blocks.filter((block) => block.course === 0 && block.blockType === 'cut').length).toBeGreaterThan(0);
    expect(geometry.wallCmuLayout.terminalClosures).toHaveLength(0);
    expect(geometry.boundaryViolations).toHaveLength(0);
  });

  it('records closed-loop placement provenance and station spans for generated units', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 4,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: layout,
        cmuSettings: { ...preset.wall, openings: [], lengthMeters: 6, widthMeters: 4, bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const placements = geometry.wallCmuLayout.unitPlacements.filter((placement) => placement.courseIndex < 4);

    expect(placements.length).toBeGreaterThan(0);
    expect(placements.every((placement) => placement.startStationMeters != null && placement.endStationMeters != null)).toBe(true);
    expect(placements.every((placement) => placement.kind != null)).toBe(true);
    expect(Array.from(new Set(placements.map((placement) => placement.source)))).toEqual(
      expect.arrayContaining(['corner_assembly', 'wall_run']),
    );
    expect(
      placements
        .filter((placement) => placement.source === 'wall_run')
        .every((placement) => placement.kind === 'stretcher' || placement.kind === 'cut_block'),
    ).toBe(true);
  });

  it('generates a 10m by 6m metric CMU rectangle with staggered structural cut units', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 10,
      widthMeters: 6,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: layout,
        cmuSettings: { ...preset.wall, openings: [], lengthMeters: 10, widthMeters: 6, bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );

    expect(geometry.wallCmuLayout.counts.cut).toBeGreaterThan(0);
    expect(geometry.wallCmuLayout.terminalClosures).toHaveLength(0);
    expect(firstCourseDoubleHalfSegments(geometry.blockInstances)).toHaveLength(0);
    expect(geometry.blockInstances.some((block) => block.blockType === 'cut' || block.blockType === 'end')).toBe(true);
    expect(geometry.boundaryViolations).toHaveLength(0);
    expect(geometry.exteriorFootprint).toEqual(geometry.resolvedFootprint?.exteriorFacePolygon);
  });

  it('uses full-dominant wall runs for the first four courses of modular rectangles', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const cases = [
      { lengthMeters: 6, widthMeters: 4 },
      { lengthMeters: 10, widthMeters: 6 },
    ];

    cases.forEach(({ lengthMeters, widthMeters }) => {
      const layout = createOutsideFaceRectangleLayout({
        lengthMeters,
        widthMeters,
        wallHeightMeters: preset.wall.heightMeters,
        wallThicknessMeters: preset.wall.wallThicknessMeters,
      });
      const geometry = generateDesignGeometry(
        buildDesignGeometryInputFromLayout({
          wallLayout: layout,
          cmuSettings: { ...preset.wall, openings: [], lengthMeters, widthMeters, bondPattern: 'running_bond' },
          openings: [],
          slabSettings: preset.slab,
          roofSettings: preset.roof,
          trussSettings: preset.truss,
        }),
      );
      const firstFourRunUnits = geometry.wallCmuLayout.unitPlacements.filter(
        (placement) => placement.courseIndex < 4 && placement.source === 'wall_run',
      );
      const firstFourCorners = geometry.wallCmuLayout.cornerAssemblies?.filter((assembly) => assembly.courseIndex < 4) ?? [];

      expect(firstFourRunUnits.length).toBeGreaterThan(0);
      expect(firstFourRunUnits.every((placement) => placement.kind === 'stretcher' || placement.kind === 'cut_block')).toBe(true);
      expect(firstFourCorners).toHaveLength(16);
      for (let course = 0; course < 4; course += 1) {
        const segmentIds = new Set(
          geometry.wallCmuLayout.unitPlacements
            .filter((placement) => placement.courseIndex === course)
            .map((placement) => placement.segmentId),
        );
        segmentIds.forEach((segmentId) => {
          const cornerHalfCount = geometry.wallCmuLayout.unitPlacements.filter(
            (placement) => placement.courseIndex === course && placement.segmentId === segmentId && placement.kind === 'half_block' && placement.source === 'corner_assembly',
          ).length;
          expect(cornerHalfCount).toBe(0);
        });
      }
      firstFourCorners
        .filter((assembly) => assembly.courseIndex < 3)
        .forEach((assembly) => {
          const nextCourse = firstFourCorners.find(
            (candidate) => candidate.cornerId === assembly.cornerId && candidate.courseIndex === assembly.courseIndex + 1,
          );
          expect(nextCourse?.ownerSegmentId).not.toBe(assembly.ownerSegmentId);
        });
    });
  });

  it('resolves exterior footprint when an interior partition creates a T-junction', () => {
    const preset = applyAutoFrameLayout(createFiveBySixCmuBuildingPreset());
    const foundation = normalizeRcFrameFoundationSettings(preset.foundationSettings);
    const baseLayout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 5,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const layoutWithPartition = addWallSegment(baseLayout, baseLayout.segments[3]!.startNodeId, 0, 0);
    expect(layoutWithPartition.segments.length).toBe(5);

    const framedPreset = applyAutoFrameLayout({ ...preset, wallLayout: layoutWithPartition });
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: framedPreset.wallLayout,
        cmuSettings: { ...preset.wall, openings: [], lengthMeters: 6, widthMeters: 5, bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
        buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
        frameSystem: framedPreset.frameSystem,
        foundationSettings: foundation,
        infillSystem: framedPreset.infillSystem,
        gableEndSystem: framedPreset.gableEndSystem,
        roofSystem: framedPreset.roofSystem,
      }),
    );

    expect(geometry.resolvedFootprint).not.toBeNull();
    expect(geometry.resolvedFootprint?.interiorFacePolygon.length).toBeGreaterThanOrEqual(3);
    expect(geometry.exteriorFootprint.length).toBeGreaterThanOrEqual(3);
    expect(geometry.wallCmuLayout.segmentFrames?.length).toBe(5);
    expect(framedPreset.frameSystem.columns.length).toBe(4);
    expect(geometry.resolvedRoofSystem?.gableEndSegmentIds.every((id) =>
      layoutWithPartition.segments.some((segment) => segment.id === id),
    )).toBe(true);
    const interiorSegmentId = layoutWithPartition.segments.at(-1)!.id;
    expect(geometry.resolvedRoofSystem?.gableEndSegmentIds).not.toContain(interiorSegmentId);
    expect(
      geometry.blockInstances.some(
        (block) => block.segmentId === interiorSegmentId && block.source === 'gable_end_solver',
      ),
    ).toBe(false);
  });

  it('stair-steps wall-run cuts near the middle without using terminal closures', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 4,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: layout,
        cmuSettings: { ...preset.wall, openings: [], lengthMeters: 6, widthMeters: 4, bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );

    expect(geometry.wallCmuLayout.terminalClosures).toHaveLength(0);
    expect(geometry.wallCmuLayout.counts.cut).toBeGreaterThan(0);
    expect(geometry.wallCmuLayout.unitPlacements.every((placement) => placement.source !== 'terminal_closure')).toBe(true);
    const segmentId = geometry.wallCmuLayout.unitPlacements
      .filter((placement) => placement.courseIndex === 0)
      .reduce<string | undefined>((bestSegmentId, placement) => {
        const currentLength = Math.max(
          ...geometry.wallCmuLayout.unitPlacements
            .filter((candidate) => candidate.segmentId === placement.segmentId && candidate.courseIndex === 0)
            .map((candidate) => candidate.endStationMeters ?? 0),
        );
        const bestLength = bestSegmentId
          ? Math.max(
            ...geometry.wallCmuLayout.unitPlacements
              .filter((candidate) => candidate.segmentId === bestSegmentId && candidate.courseIndex === 0)
              .map((candidate) => candidate.endStationMeters ?? 0),
          )
          : 0;
        return currentLength > bestLength ? placement.segmentId : bestSegmentId;
      }, undefined);
    expect(segmentId).toBeTruthy();
    const segmentCuts = geometry.wallCmuLayout.unitPlacements
      .filter((placement) => placement.segmentId === segmentId && placement.kind === 'cut_block')
      .sort((a, b) => a.courseIndex - b.courseIndex);
    const firstFourCuts = [0, 1, 2, 3]
      .map((courseIndex) => segmentCuts.find((placement) => placement.courseIndex === courseIndex))
      .filter((placement): placement is NonNullable<typeof placement> => placement != null);
    const segmentWallLength = Math.max(
      ...geometry.wallCmuLayout.unitPlacements
        .filter((placement) => placement.segmentId === segmentId && placement.courseIndex === 0)
        .map((placement) => placement.endStationMeters ?? 0),
    );
    expect(firstFourCuts).toHaveLength(4);
    firstFourCuts.forEach((cut) => {
      expect(cut.startStationMeters).toBeGreaterThan(segmentWallLength * 0.25);
      expect(cut.endStationMeters).toBeLessThan(segmentWallLength * 0.75);
    });
    [0, 1, 2, 3].forEach((courseIndex) => {
      const courseCuts = segmentCuts
        .filter((cut) => cut.courseIndex === courseIndex)
        .sort((a, b) => (a.startStationMeters ?? 0) - (b.startStationMeters ?? 0));
      for (let index = 1; index < courseCuts.length; index += 1) {
        expect(courseCuts[index].startStationMeters).toBeGreaterThan((courseCuts[index - 1].endStationMeters ?? 0) + 0.05);
      }
    });
    expect(new Set(firstFourCuts.map((cut) => cut.startStationMeters?.toFixed(3))).size).toBeGreaterThan(1);
    expect(geometry.wallCmuLayout.warnings.some((warning) => warning.includes('Stacked CMU head joint'))).toBe(false);
  });

  it('chases non-modular exact dimensions with staggered wall-run cuts', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 10.3,
      widthMeters: 4.3,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: layout,
        cmuSettings: { ...preset.wall, openings: [], lengthMeters: 10.3, widthMeters: 4.3, bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const xs = geometry.resolvedFootprint?.exteriorFacePolygon.map((point) => point.x) ?? [];
    const zs = geometry.resolvedFootprint?.exteriorFacePolygon.map((point) => point.z) ?? [];
    const courseZeroCuts = geometry.blockInstances.filter((block) => block.course === 0 && block.blockType === 'cut');

    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(10.3, 6);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(4.3, 6);
    expect(courseZeroCuts.length).toBeGreaterThan(0);
    expect(new Set(courseZeroCuts.map((cut) => cut.segmentId)).size).toBe(4);
    expect(geometry.wallCmuLayout.terminalClosures).toHaveLength(0);
    expect(firstCourseDoubleHalfSegments(geometry.blockInstances)).toHaveLength(0);
    courseZeroCuts.forEach((cut) => {
      const segmentBlocks = geometry.blockInstances.filter((block) => block.segmentId === cut.segmentId && block.course === cut.course);
      const ordered = [...segmentBlocks].sort((a, b) => (a.stationMeters ?? 0) - (b.stationMeters ?? 0));
      expect(cut.kind).toBe('cut_block');
      expect(cut.source).toBe('wall_run');
      expect(ordered.filter((block) => block.blockType === 'cut')).toHaveLength(1);
    });
  });

  it('keeps exact dimensions with staggered cuts instead of terminal closures', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 10.24,
      widthMeters: 4.24,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: layout,
        cmuSettings: { ...preset.wall, openings: [], lengthMeters: 10.24, widthMeters: 4.24, bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const firstCut = geometry.blockInstances.find((block) => block.course === 0 && block.blockType === 'cut');

    expect(firstCut?.source).toBe('wall_run');
    expect(geometry.wallCmuLayout.terminalClosures).toHaveLength(0);
  });

  it('keeps layout-graph CMU units inside the exterior footprint boundary', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: { ...preset.wall, openings: [], bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );

    expect(geometry.exteriorFootprint).toHaveLength(4);
    expect(geometry.boundaryViolations).toHaveLength(0);
    expect(geometry.blockInstances).toHaveLength(geometry.wallCmuLayout.blocks.length);
    expect(
      findExteriorFootprintBoundaryViolations(
        geometry.blockInstances,
        geometry.exteriorFootprint,
        preset.wall.wallThicknessMeters,
      ),
    ).toHaveLength(0);
  });

  it('uses the same exterior-boundary guard for drawn rectangle layouts', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const drawnLayout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 5,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: drawnLayout,
        cmuSettings: { ...preset.wall, openings: [], bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );

    expect(geometry.sourcePath).toBe('layout_graph');
    expect(geometry.exteriorFootprint).toHaveLength(4);
    expect(geometry.boundaryViolations).toHaveLength(0);
  });

  it('resolves a 6m by 5m outside-face rectangle to exact exterior extents', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 5,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: 0.2,
    });
    const resolved = resolveWallLayoutGeometry(layout, { wallThicknessMeters: 0.2 });
    const xs = resolved.exteriorFacePolygon.map((point) => point.x);
    const zs = resolved.exteriorFacePolygon.map((point) => point.z);

    expect(resolved.dimensionBasis).toBe('outside_face');
    expect(Math.min(...xs)).toBeCloseTo(-3, 6);
    expect(Math.max(...xs)).toBeCloseTo(3, 6);
    expect(Math.min(...zs)).toBeCloseTo(-2.5, 6);
    expect(Math.max(...zs)).toBeCloseTo(2.5, 6);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(6, 6);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(5, 6);
  });

  it('normalizes a closed rectangle to one deterministic clockwise perimeter', () => {
    const layout = createOutsideFaceRectangleLayout({ lengthMeters: 10, widthMeters: 6 });
    const resolved = resolveWallLayoutGeometry(layout, { wallThicknessMeters: 0.19 });
    const perimeter = buildClockwisePerimeter(resolved);

    expect(perimeter?.winding).toBe('clockwise');
    expect(perimeter?.segments).toHaveLength(4);
    expect(perimeter?.segments[0].exteriorStart.x).toBeCloseTo(-5, 6);
    expect(perimeter?.segments[0].exteriorStart.z).toBeCloseTo(-3, 6);
    expect(perimeter?.segments.every((segment) => segment.lengthMeters > 0)).toBe(true);
  });

  it('builds complete course plans before creating CMU placements', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 10,
      widthMeters: 6,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const resolved = resolveWallLayoutGeometry(layout, { wallThicknessMeters: preset.wall.wallThicknessMeters });
    const perimeter = buildClockwisePerimeter(resolved);
    expect(perimeter).toBeTruthy();

    const plans = buildCmuCoursePlans({
      perimeter: perimeter!,
      courseCount: 2,
      moduleLength: 0.4,
      actualFullLength: 0.39,
      moduleHeight: 0.2,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
      bondPattern: 'running_bond',
    });

    expect(plans).toHaveLength(2);
    expect(plans[0].segmentPlans).toHaveLength(4);
    expect(plans[0].cornerAssemblies).toHaveLength(4);
    expect(plans[0].phase).toBe(0);
    expect(plans[1].phase).toBe(1);
    expect(plans[0].cornerAssemblies[0].ownerSegmentId).not.toBe(plans[1].cornerAssemblies[0].ownerSegmentId);
    plans.forEach((course) => {
      course.segmentPlans.forEach((plan) => {
        const length = perimeter?.segments.find((segment) => segment.segmentId === plan.segmentId)?.lengthMeters ?? 0;
        const startSetBack = plan.startStationMeters > 0;
        const endSetBack = plan.endStationMeters < length;
        expect(startSetBack === endSetBack).toBe(false);
      });
    });
  });

  it('rejects redundant half blocks at both ends of an uninterrupted segment span', () => {
    const validation = validateSegmentCoursePlacement({
      segmentId: 'segment-bad',
      courseIndex: 0,
      startStationMeters: 0,
      endStationMeters: 1.2,
      ownerAtStart: false,
      ownerAtEnd: false,
      buttingAtStart: false,
      buttingAtEnd: false,
      units: [
        { unitType: 'half', nominalStartMeters: 0, nominalLengthMeters: 0.2, startAlongMeters: 0, endAlongMeters: 0.2, lengthMeters: 0.195 },
        { unitType: 'full', nominalStartMeters: 0.2, nominalLengthMeters: 0.4, startAlongMeters: 0.2, endAlongMeters: 0.6, lengthMeters: 0.39 },
        { unitType: 'full', nominalStartMeters: 0.6, nominalLengthMeters: 0.4, startAlongMeters: 0.6, endAlongMeters: 1, lengthMeters: 0.39 },
        { unitType: 'half', nominalStartMeters: 1, nominalLengthMeters: 0.2, startAlongMeters: 1, endAlongMeters: 1.2, lengthMeters: 0.195 },
      ],
      score: { cutUnits: 0, halfUnits: 2, fullUnits: 2, cornerIntegrityPenalty: 0 },
      validation: { valid: true, warnings: [] },
    });

    expect(validation.valid).toBe(false);
    expect(validation.warnings[0]).toMatch(/redundant half blocks/i);
  });

  it('exposes one resolved footprint for walls and foundation geometry', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 5,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: layout,
        cmuSettings: { ...preset.wall, openings: [] },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );

    expect(geometry.resolvedFootprint?.dimensionBasis).toBe('outside_face');
    expect(geometry.resolvedFootprint?.exteriorFacePolygon).toEqual(geometry.exteriorFootprint);
    expect(geometry.wallSegments.map((segment) => segment.lengthMeters)).toEqual(expect.arrayContaining([6, 5]));
  });

  it('moving a layout node updates wall and foundation footprint together', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 5,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const movedLayout = {
      ...layout,
      nodes: layout.nodes.map((node) => (node.x > 0 ? { ...node, x: 3.4 } : node)),
    };
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: movedLayout,
        cmuSettings: { ...preset.wall, openings: [] },
        openings: [],
        slabSettings: { ...preset.slab, lengthMeters: 1, widthMeters: 1 },
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const xs = geometry.resolvedFootprint?.exteriorFacePolygon.map((point) => point.x) ?? [];

    expect(Math.max(...xs)).toBeCloseTo(3.4, 6);
    expect(geometry.exteriorFootprint).toEqual(geometry.resolvedFootprint?.exteriorFacePolygon);
  });

  it('derives centerline and interior dimensions from outside-face basis and wall thickness', () => {
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 5,
      wallThicknessMeters: 0.2,
    });
    const resolved = resolveWallLayoutGeometry(layout, { wallThicknessMeters: 0.2 });
    const centerXs = resolved.centerlinePolyline.map((point) => point.x);
    const centerZs = resolved.centerlinePolyline.map((point) => point.z);
    const interiorXs = resolved.interiorFacePolygon.map((point) => point.x);
    const interiorZs = resolved.interiorFacePolygon.map((point) => point.z);

    expect(Math.max(...centerXs) - Math.min(...centerXs)).toBeCloseTo(5.8, 6);
    expect(Math.max(...centerZs) - Math.min(...centerZs)).toBeCloseTo(4.8, 6);
    expect(Math.max(...interiorXs) - Math.min(...interiorXs)).toBeCloseTo(5.6, 6);
    expect(Math.max(...interiorZs) - Math.min(...interiorZs)).toBeCloseTo(4.6, 6);
  });

  it('resolves inside-clear and centerline basis back to exterior faces', () => {
    const outsideLayout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 5,
      wallThicknessMeters: 0.2,
    });
    const insideLayout = {
      ...outsideLayout,
      dimensionBasis: 'inside_clear' as const,
      nodes: outsideLayout.nodes.map((node) => ({
        ...node,
        x: Math.sign(node.x) * 2.8,
        z: Math.sign(node.z) * 2.3,
      })),
    };
    const centerlineLayout = {
      ...outsideLayout,
      dimensionBasis: 'wall_centerline' as const,
      nodes: outsideLayout.nodes.map((node) => ({
        ...node,
        x: Math.sign(node.x) * 2.9,
        z: Math.sign(node.z) * 2.4,
      })),
    };

    for (const layout of [insideLayout, centerlineLayout]) {
      const resolved = resolveWallLayoutGeometry(layout, { wallThicknessMeters: 0.2 });
      const xs = resolved.exteriorFacePolygon.map((point) => point.x);
      const zs = resolved.exteriorFacePolygon.map((point) => point.z);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(6, 6);
      expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(5, 6);
    }
  });

  it('identifies four convex outside corners from ordered perimeter traversal', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = createOutsideFaceRectangleLayout({
      lengthMeters: 6,
      widthMeters: 5,
      wallHeightMeters: preset.wall.heightMeters,
      wallThicknessMeters: preset.wall.wallThicknessMeters,
    });
    const geometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: layout,
        cmuSettings: { ...preset.wall, openings: [], bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const courseZeroAssemblies = geometry.wallCmuLayout.cornerAssemblies?.filter((assembly) => assembly.courseIndex === 0) ?? [];

    expect(courseZeroAssemblies).toHaveLength(4);
    expect(courseZeroAssemblies.every((assembly) => assembly.cornerType === 'convex_outside')).toBe(true);
    expect(new Set(courseZeroAssemblies.map((assembly) => assembly.exteriorCornerPoint.x)).size).toBe(2);
    expect(new Set(courseZeroAssemblies.map((assembly) => assembly.exteriorCornerPoint.z)).size).toBe(2);
  });

  it('keeps outside-face CMU corners flush with the exterior dimensions', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout({ ...preset.wall, openings: [], bondPattern: 'running_bond' });
    const wallDepth = preset.wall.blockDepthMeters;

    const minX = Math.min(...layout.blocks.map((block) => block.face === 'east' || block.face === 'west' ? block.x - wallDepth / 2 : block.x - block.lengthMeters / 2));
    const maxX = Math.max(...layout.blocks.map((block) => block.face === 'east' || block.face === 'west' ? block.x + wallDepth / 2 : block.x + block.lengthMeters / 2));
    const minZ = Math.min(...layout.blocks.map((block) => block.face === 'north' || block.face === 'south' ? block.z - wallDepth / 2 : block.z - block.lengthMeters / 2));
    const maxZ = Math.max(...layout.blocks.map((block) => block.face === 'north' || block.face === 'south' ? block.z + wallDepth / 2 : block.z + block.lengthMeters / 2));

    expect(minX).toBeCloseTo(-preset.wall.lengthMeters / 2, 6);
    expect(maxX).toBeCloseTo(preset.wall.lengthMeters / 2, 6);
    expect(minZ).toBeCloseTo(-preset.wall.widthMeters / 2, 6);
    expect(maxZ).toBeCloseTo(preset.wall.widthMeters / 2, 6);
  });

  it('does not double-generate overlapping corner blocks across joined wall faces', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout({ ...preset.wall, openings: [], bondPattern: 'running_bond' });
    const wallDepth = preset.wall.blockDepthMeters;
    const courseZeroBlocks = layout.blocks.filter((block) => block.course === 0);

    for (let i = 0; i < courseZeroBlocks.length; i += 1) {
      for (let j = i + 1; j < courseZeroBlocks.length; j += 1) {
        const a = blockBounds(courseZeroBlocks[i], wallDepth);
        const b = blockBounds(courseZeroBlocks[j], wallDepth);
        if (courseZeroBlocks[i].face === courseZeroBlocks[j].face) continue;
        expect(overlapArea(a, b)).toBeLessThan(0.0001);
      }
    }
  });

  it('stack bond does not alternate courses', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout({ ...preset.wall, openings: [], bondPattern: 'stack_bond' });
    const courseOne = layout.blocks.find((block) => block.face === 'north' && block.course === 1);

    expect(courseOne?.blockType).not.toBe('half');
    expect(layout.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/stack bond/i)]));
  });

  it('reports placement-based module fit status from generated layouts', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const bondFit = generateCmuLayout({ ...preset.wall, openings: [] });
    const cutFit = generateCmuLayout({ ...preset.wall, widthMeters: 5.13, openings: [] });

    expect(bondFit.moduleFitReport.summary).not.toContain('compatible');
    expect(bondFit.moduleFitReport.cutUnitCount).toBe(bondFit.counts.cut);
    expect(cutFit.moduleFitReport.status).toBe('cut_required');
    expect(cutFit.counts.cut).toBeGreaterThan(0);
    expect(cutFit.moduleFitReport.cutUnitCount).toBeGreaterThan(0);
  });

  it('computes conceptual pilasters at corners and openings', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);

    expect(layout.pilasters.length).toBeGreaterThanOrEqual(4);
  });

  it('rough opening allowance resolves through the CMU module grid', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const baseLayout = generateCmuLayout(preset.wall);
    const widerRoughLayout = generateCmuLayout({
      ...preset.wall,
      openings: preset.wall.openings.map((opening) =>
        opening.type === 'door' ? { ...opening, roughOpeningAllowanceMeters: 0.1 } : opening,
      ),
    });

    expect(widerRoughLayout.roughOpenings[0].roughOpeningWidthMeters).toBeGreaterThanOrEqual(
      baseLayout.roughOpenings[0].roughOpeningWidthMeters,
    );
    const moduleLength = preset.wall.blockModule?.moduleLengthMeters ?? 0.4;
    const startRemainder = widerRoughLayout.roughOpenings[0].roughStartAlongMeters % moduleLength;
    expect(Math.min(startRemainder, moduleLength - startRemainder)).toBeCloseTo(0, 6);
    expect(widerRoughLayout.lintels[0].lengthMeters).toBeGreaterThanOrEqual(baseLayout.lintels[0].lengthMeters);
  });

  it('derives trimmed jamb blocks where running bond units partially overlap a rough opening', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');

    expect(door).toBeDefined();
    const trimmedJambs = layout.blocks.filter(
      (block) =>
        block.blockType === 'cut' &&
        block.source === 'opening_jamb_closure' &&
        typeof block.startAlongMeters === 'number' &&
        typeof block.endAlongMeters === 'number' &&
        (Math.abs(block.endAlongMeters! - door!.roughStartAlongMeters) < 0.02 ||
          Math.abs(block.startAlongMeters! - door!.roughEndAlongMeters) < 0.02),
    );

    expect(trimmedJambs.length).toBeGreaterThan(0);
    expect(new Set(trimmedJambs.map((block) => block.courseIndex)).size).toBeGreaterThan(1);
    trimmedJambs.forEach((block) => {
      const end = block.endAlongMeters ?? 0;
      const start = block.startAlongMeters ?? 0;
      const touchesLeftRough =
        Math.abs(end - door!.roughStartAlongMeters) < 0.02 ||
        Math.abs(end - door!.actualStartAlongMeters) < 0.02;
      const touchesRightRough =
        Math.abs(start - door!.roughEndAlongMeters) < 0.02 ||
        Math.abs(start - door!.actualEndAlongMeters) < 0.02;
      expect(touchesLeftRough || touchesRightRough).toBe(true);
    });
  });

  it('running bond trims jamb blocks on alternating courses without leaving closure gaps', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');
    const trimmedJambs = layout.blocks
      .filter(
        (block) =>
          block.blockType === 'cut' &&
          block.source === 'opening_jamb_closure' &&
          typeof block.startAlongMeters === 'number' &&
          typeof block.endAlongMeters === 'number' &&
          (Math.abs(block.endAlongMeters! - door!.roughStartAlongMeters) < 0.02 ||
            Math.abs(block.startAlongMeters! - door!.roughEndAlongMeters) < 0.02),
      )
      .slice(0, 4);

    expect(new Set(trimmedJambs.map((block) => block.actualLengthMeters?.toFixed(3) ?? block.lengthMeters.toFixed(3))).size).toBeGreaterThan(0);
  });

  it('sums closure grout only for closures classified as grout fill', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout({
      ...preset.wall,
      openings: preset.wall.openings.map((opening) =>
        opening.type === 'door' ? { ...opening, roughOpeningAllowanceMeters: 0.02 } : opening,
      ),
    });
    const explicitClosureVolume = layout.openingCourseClosures.reduce(
      (sum, closure) => sum + (closure.closureType === 'grout_fill' ? closure.groutVolume ?? 0 : 0),
      0,
    );

    expect(layout.openingGrout.closureGroutVolumeCubicMeters).toBeCloseTo(explicitClosureVolume, 8);
    expect(layout.openingGrout.closureGroutVolumeCubicMeters).toBeLessThan(
      layout.openingGrout.roughOpeningAreaSquareMeters * preset.wall.wallThicknessMeters,
    );
  });
});

function blockBounds(
  block: ReturnType<typeof generateCmuLayout>['blocks'][number],
  wallDepth: number,
) {
  if (block.face === 'north' || block.face === 'south') {
    return {
      minX: block.x - block.lengthMeters / 2,
      maxX: block.x + block.lengthMeters / 2,
      minZ: block.z - wallDepth / 2,
      maxZ: block.z + wallDepth / 2,
    };
  }
  return {
    minX: block.x - wallDepth / 2,
    maxX: block.x + wallDepth / 2,
    minZ: block.z - block.lengthMeters / 2,
    maxZ: block.z + block.lengthMeters / 2,
  };
}

function overlapArea(
  a: ReturnType<typeof blockBounds>,
  b: ReturnType<typeof blockBounds>,
) {
  const x = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const z = Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
  return x * z;
}

function firstCourseDoubleHalfSegments(blocks: ReturnType<typeof generateDesignGeometry>['blockInstances']) {
  const bySegment = new Map<string, typeof blocks>();
  blocks
    .filter((block) => block.course === 0)
    .forEach((block) => {
      bySegment.set(block.segmentId, [...(bySegment.get(block.segmentId) ?? []), block]);
    });
  return [...bySegment.entries()].filter(([, segmentBlocks]) => {
    const ordered = [...segmentBlocks].sort((a, b) => (a.stationMeters ?? 0) - (b.stationMeters ?? 0));
    return ordered[0]?.blockType === 'half' && ordered[ordered.length - 1]?.blockType === 'half';
  }).map(([segmentId]) => segmentId);
}
