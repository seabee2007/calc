import { describe, expect, it } from 'vitest';
import { createBlankCmuBuildingPreset, createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import {
  buildDesignGeometryInputFromLayout,
  findExteriorFootprintBoundaryViolations,
  generateCmuBlockInstances,
  generateCmuLayout,
  generateDesignGeometry,
  resolveWallLayoutGeometry,
} from '../geometry/designGeometry';
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

    const doorBlocks = instances.filter(
      (instance) =>
        instance.blockType !== 'jamb' &&
        instance.id.startsWith('south-') &&
        instance.x >= -preset.wall.lengthMeters / 2 + 2.4 &&
        instance.x <= -preset.wall.lengthMeters / 2 + 3.3 &&
        instance.y <= 2.1,
    );
    const windowBlocks = instances.filter(
      (instance) =>
        instance.blockType !== 'jamb' &&
        instance.id.startsWith('east-') &&
        instance.z >= -preset.wall.widthMeters / 2 + 2.1 &&
        instance.z <= -preset.wall.widthMeters / 2 + 3.3 &&
        instance.y >= 1 &&
        instance.y <= 1.9,
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
    expect(layout.lintels[0].lengthMeters).toBeCloseTo(
      (preset.wall.openings[0].roughOpeningWidthMeters ?? preset.wall.openings[0].widthMeters + 0.1) +
        2 * (preset.wall.lintelBearingMeters ?? 0.2),
      6,
    );
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
    const windowLintel = geometry.wallCmuLayout.lintels.find((lintel) => lintel.openingId === 'window-east-01');
    const windowGrout = geometry.wallCmuLayout.jambGroutCells.filter((cell) => cell.openingId === 'window-east-01');

    expect(windowOpening?.wallSegmentId).toBe(preset.wall.openings.find((opening) => opening.id === 'window-east-01')?.wallSegmentId);
    expect(windowOpening?.worldX).toBeCloseTo(windowLintel?.x ?? 0, 6);
    expect(windowOpening?.worldZ).toBeCloseTo(windowLintel?.z ?? 0, 6);
    expect(windowLintel?.segmentId).toBe(windowOpening?.wallSegmentId);
    expect(windowGrout.every((cell) => cell.segmentId === windowOpening?.wallSegmentId)).toBe(true);
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
    const running = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: { ...preset.wall, openings: [], bondPattern: 'running_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const stacked = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: preset.wallLayout,
        cmuSettings: { ...preset.wall, openings: [], bondPattern: 'stack_bond' },
        openings: [],
        slabSettings: preset.slab,
        roofSettings: preset.roof,
        trussSettings: preset.truss,
      }),
    );
    const firstSegmentId = preset.wallLayout.segments[0].id;
    const runningCourseOne = running.blockInstances.filter((block) => block.segmentId === firstSegmentId && block.course === 1);
    const stackedCourseOne = stacked.blockInstances.filter((block) => block.segmentId === firstSegmentId && block.course === 1);

    expect(runningCourseOne.some((block) => block.lengthMeters < (preset.wall.blockModule?.moduleLengthMeters ?? 0.4) * 0.75)).toBe(true);
    expect(stackedCourseOne.some((block) => block.blockType === 'half')).toBe(false);
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
    expect(courseZero[0].buttingStartTrim).toBeCloseTo(preset.wall.wallThicknessMeters, 6);
  });

  it('layout corner weave generates corner and end units without duplicate corner blocks', () => {
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
    const courseZeroCornerBlocks = geometry.blockInstances.filter((block) => block.course === 0 && block.blockType === 'corner');
    const courseZeroEndBlocks = geometry.blockInstances.filter((block) => block.course === 0 && block.blockType === 'end');

    expect(courseZeroCornerBlocks.length).toBe(4);
    expect(courseZeroEndBlocks.length).toBe(4);
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

  it('reports half-module and cut-block wall conditions in generated layout', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const halfFit = generateCmuLayout(preset.wall);
    const cutFit = generateCmuLayout({ ...preset.wall, widthMeters: 5.13 });

    expect(halfFit.moduleFits.east.fit).toBe('half');
    expect(cutFit.moduleFits.east.fit).toBe('cut');
    expect(cutFit.counts.cut).toBeGreaterThan(0);
    expect(cutFit.warnings.some((warning) => warning.includes('Suggested clean lengths'))).toBe(true);
  });

  it('computes conceptual pilasters at corners and openings', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);

    expect(layout.pilasters.length).toBeGreaterThanOrEqual(4);
  });

  it('changing rough opening allowance changes layout, jamb grout, lintel length, and grout volume', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const baseLayout = generateCmuLayout(preset.wall);
    const widerRoughLayout = generateCmuLayout({
      ...preset.wall,
      openings: preset.wall.openings.map((opening) =>
        opening.type === 'door' ? { ...opening, roughOpeningAllowanceMeters: 0.1 } : opening,
      ),
    });

    expect(widerRoughLayout.roughOpenings[0].roughOpeningWidthMeters).toBeGreaterThan(
      baseLayout.roughOpenings[0].roughOpeningWidthMeters,
    );
    expect(widerRoughLayout.blocks.length).not.toBe(baseLayout.blocks.length);
    expect(widerRoughLayout.openingGrout.jambGroutCellCount).not.toBe(baseLayout.openingGrout.jambGroutCellCount);
    expect(widerRoughLayout.lintels[0].lengthMeters).toBeGreaterThan(baseLayout.lintels[0].lengthMeters);
    expect(widerRoughLayout.openingGrout.totalGroutVolumeCubicMeters).toBeGreaterThan(
      baseLayout.openingGrout.totalGroutVolumeCubicMeters,
    );
  });

  it('derives opening closures for each course and side intersecting a rough opening', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');

    expect(door).toBeDefined();
    const doorClosures = layout.openingCourseClosures.filter((closure) => closure.openingId === door?.id);

    expect(doorClosures.length).toBeGreaterThan(0);
    expect(new Set(doorClosures.map((closure) => closure.side))).toEqual(new Set(['left', 'right']));
    expect(new Set(doorClosures.map((closure) => closure.courseIndex)).size).toBeGreaterThan(1);
  });

  it('running bond produces different jamb residuals on alternating courses', () => {
    const preset = createFiveBySixCmuBuildingPreset();
    const layout = generateCmuLayout(preset.wall);
    const door = layout.roughOpenings.find((opening) => opening.type === 'door');
    const leftClosures = layout.openingCourseClosures
      .filter((closure) => closure.openingId === door?.id && closure.side === 'left')
      .slice(0, 4);

    expect(new Set(leftClosures.map((closure) => closure.residualGap.toFixed(3))).size).toBeGreaterThan(1);
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

    expect(layout.openingCourseClosures.some((closure) => closure.closureType === 'grout_fill')).toBe(true);
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
