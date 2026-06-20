import type {
  CmuWallSystemParameters,
  DesignWallLayoutParameters,
  GableRoofSystemParameters,
  SteelTrussSystemParameters,
  ThickenedEdgeSlabParameters,
  WallOpeningParameters,
} from '../types';
import {
  analyzeCmuModuleFit,
  resolveCmuModuleConfig,
  summarizeWallModuleFits,
  validateCmuOpenings,
  type CmuModuleFitResult,
} from '../domain/cmuModuleRules';
import {
  calculateCmuOpeningGroutSummary,
  resolveCmuOpenings,
  type CmuOpeningGroutSummary,
  type ResolvedCmuOpening,
} from '../domain/cmuOpeningRules';

export type DesignGeometrySourcePath = 'layout_graph' | 'legacy_preset';

export interface DesignGeometryInput {
  sourcePath: DesignGeometrySourcePath;
  wallLayout: DesignWallLayoutParameters | null;
  wall: CmuWallSystemParameters;
  slab: ThickenedEdgeSlabParameters;
  roof: GableRoofSystemParameters;
  truss: SteelTrussSystemParameters;
}

export interface DesignGeometryWallSegment {
  segmentId: string;
  lengthMeters: number;
  heightMeters: number;
  thicknessMeters: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

export type SegmentFrame = {
  segmentId: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
  lengthMeters: number;
  tangent: { x: number; z: number };
  inwardNormal: { x: number; z: number };
  outwardNormal: { x: number; z: number };
  rotationY: number;
  wallHeightMeters: number;
  wallThicknessMeters: number;
};

export type OrderedPerimeterSegment = {
  segmentId: string;
  startNodeId: string;
  endNodeId: string;
  index: number;
  tangent: { x: number; z: number };
};

export type LayoutCornerAssembly = {
  cornerId: string;
  courseIndex: number;
  incomingSegmentId: string;
  outgoingSegmentId: string;
  ownerSegmentId: string;
  buttingSegmentId: string;
  ownerEndTrimMeters: number;
  buttingStartTrimMeters: number;
  exteriorCornerPoint: { x: number; z: number };
  strategy: 'interlocked_running_bond';
};

export interface DesignGeometryBlockInstance {
  id: string;
  segmentId: string;
  course: number;
  blockType: CmuBlockType;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  lengthMeters: number;
}

export interface DesignGeometryPoint {
  x: number;
  z: number;
}

export interface DesignGeometryBoundaryViolation {
  blockId: string;
  segmentId: string;
  course: number;
  blockType: CmuBlockType;
}

export interface CmuCornerCourseLayout {
  cornerId: string;
  nodeId: string;
  courseIndex: number;
  ownerSegmentId: string;
  buttingSegmentId: string;
  cornerType: 'outside' | 'inside' | 'end' | 'tee';
  strategy: 'interlocked_running_bond' | 'butt' | 'pilaster';
  ownerStartTrim: number;
  buttingStartTrim: number;
  generatedUnitType: 'corner_block' | 'full_block' | 'half_block' | 'end_block' | 'cut_block';
  warning?: string;
}

export interface DesignGeometryResult {
  sourcePath: DesignGeometrySourcePath;
  wallSegments: DesignGeometryWallSegment[];
  blockInstances: DesignGeometryBlockInstance[];
  cornerCourseLayouts: CmuCornerCourseLayout[];
  exteriorFootprint: DesignGeometryPoint[];
  boundaryViolations: DesignGeometryBoundaryViolation[];
  blockCount: number;
  bondPattern: NonNullable<CmuWallSystemParameters['bondPattern']>;
  wallCmuLayout: CmuLayoutResult;
}

export interface CmuBlockInstance {
  id: string;
  face: CmuBlockInstanceWallFace;
  segmentId?: string;
  course: number;
  blockType: CmuBlockType;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  lengthMeters: number;
  startAlongMeters: number;
  endAlongMeters: number;
}

export type CmuBlockType =
  | 'full'
  | 'half'
  | 'end'
  | 'corner'
  | 'jamb'
  | 'lintel_bond_beam'
  | 'cut';

export interface CmuLintelInstance {
  id: string;
  face: CmuBlockInstanceWallFace;
  openingId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  lengthMeters: number;
  heightMeters: number;
  segmentId?: string;
}

export interface CmuPilasterInstance {
  id: string;
  face: CmuBlockInstanceWallFace;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  heightMeters: number;
  nodeId?: string;
}

export interface CmuJambGroutCellInstance {
  id: string;
  face: CmuBlockInstanceWallFace;
  openingId: string;
  courseIndex: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  heightMeters: number;
  widthMeters: number;
  segmentId?: string;
}

export type CmuOpeningClosureType =
  | 'none'
  | 'half_block'
  | 'end_block'
  | 'jamb_block'
  | 'cut_block'
  | 'grout_fill'
  | 'shim_gap';

export interface CmuOpeningCourseClosure {
  openingId: string;
  wallFace: CmuBlockInstanceWallFace;
  courseIndex: number;
  courseBottom: number;
  courseTop: number;
  side: 'left' | 'right';
  roughOpeningEdge: number;
  nearestBlockEdge: number;
  residualGap: number;
  closureType: CmuOpeningClosureType;
  suggestedUnitType?: string;
  groutVolume?: number;
  warning?: string;
}

export interface CmuLayoutResult {
  blocks: CmuBlockInstance[];
  lintels: CmuLintelInstance[];
  pilasters: CmuPilasterInstance[];
  roughOpenings: ResolvedCmuOpening[];
  jambGroutCells: CmuJambGroutCellInstance[];
  openingCourseClosures: CmuOpeningCourseClosure[];
  openingGrout: CmuOpeningGroutSummary;
  counts: Record<CmuBlockType, number>;
  totalBlocks: number;
  courseCount: number;
  moduleFits: ReturnType<typeof summarizeWallModuleFits>;
  warnings: string[];
  bondBeamLengthMeters: number;
  groutedCellCount: number;
  segmentFrames?: SegmentFrame[];
  cornerAssemblies?: LayoutCornerAssembly[];
}

export function normalizeBondPattern(
  bondPattern: CmuWallSystemParameters['bondPattern'],
): NonNullable<CmuWallSystemParameters['bondPattern']> {
  return bondPattern === 'stack_bond' ? 'stack_bond' : 'running_bond';
}

export function buildDesignGeometryInputFromLayout(params: {
  wallLayout: DesignWallLayoutParameters | null;
  cmuSettings: CmuWallSystemParameters;
  openings?: WallOpeningParameters[];
  slabSettings: ThickenedEdgeSlabParameters;
  roofSettings: GableRoofSystemParameters;
  trussSettings: SteelTrussSystemParameters;
}): DesignGeometryInput {
  const wallLayout = params.wallLayout && params.wallLayout.segments.length > 0 ? params.wallLayout : null;
  return {
    sourcePath: wallLayout ? 'layout_graph' : 'legacy_preset',
    wallLayout,
    wall: {
      ...params.cmuSettings,
      bondPattern: normalizeBondPattern(params.cmuSettings.bondPattern),
      openings: params.openings ?? params.cmuSettings.openings,
    },
    slab: params.slabSettings,
    roof: params.roofSettings,
    truss: params.trussSettings,
  };
}

export function generateDesignGeometry(input: DesignGeometryInput): DesignGeometryResult {
  const wall = {
    ...input.wall,
    bondPattern: normalizeBondPattern(input.wall.bondPattern),
  };
  if (import.meta.env.DEV && !input.wall.bondPattern) {
    console.warn('[DesignBuilder] Missing bond pattern; defaulting to running_bond.');
  }
  if (input.sourcePath !== 'layout_graph' || !input.wallLayout) {
    const wallCmuLayout = generateCmuLayout(wall);
    return {
      sourcePath: 'legacy_preset',
      wallSegments: [],
      blockInstances: wallCmuLayout.blocks.map((block) => ({
        id: block.id,
        segmentId: block.face,
        course: block.course,
        blockType: block.blockType,
        x: block.x,
        y: block.y,
        z: block.z,
        rotationY: block.rotationY,
        lengthMeters: block.lengthMeters,
      })),
      cornerCourseLayouts: [],
      exteriorFootprint: [],
      boundaryViolations: [],
      blockCount: wallCmuLayout.totalBlocks,
      bondPattern: wall.bondPattern ?? 'running_bond',
      wallCmuLayout,
    };
  }

  const wallCmuLayout = generateCmuLayoutFromWallLayout(input.wallLayout, wall);
  const exteriorFootprint = wallCmuLayout.segmentFrames?.length ? deriveExteriorFootprint(input.wallLayout) : [];
  const wallSegments = (wallCmuLayout.segmentFrames ?? []).map((frame) => ({
    segmentId: frame.segmentId,
    lengthMeters: frame.lengthMeters,
    heightMeters: frame.wallHeightMeters,
    thicknessMeters: frame.wallThicknessMeters,
    x: (frame.start.x + frame.end.x) / 2 + frame.inwardNormal.x * (frame.wallThicknessMeters / 2),
    y: frame.wallHeightMeters / 2,
    z: (frame.start.z + frame.end.z) / 2 + frame.inwardNormal.z * (frame.wallThicknessMeters / 2),
    rotationY: frame.rotationY,
  }));
  const blockInstances = wallCmuLayout.blocks.map((block) => ({
    id: block.id,
    segmentId: block.segmentId ?? block.face,
    course: block.course,
    blockType: block.blockType,
    x: block.x,
    y: block.y,
    z: block.z,
    rotationY: block.rotationY,
    lengthMeters: block.lengthMeters,
  }));
  const boundaryViolations = findExteriorFootprintBoundaryViolations(
    blockInstances,
    exteriorFootprint,
    wall.wallThicknessMeters || input.wallLayout.defaultWallThicknessMeters,
  );
  if (import.meta.env.DEV && boundaryViolations.length > 0) {
    console.warn('[DesignBuilder] CMU unit outside exterior footprint', {
      boundaryViolations,
      exteriorFootprint,
    });
  }
  return {
    sourcePath: 'layout_graph',
    wallSegments,
    blockInstances,
    cornerCourseLayouts: wallCmuLayout.cornerAssemblies?.map((assembly) => ({
      cornerId: assembly.cornerId,
      nodeId: assembly.cornerId.replace(/^corner-/, ''),
      courseIndex: assembly.courseIndex,
      ownerSegmentId: assembly.ownerSegmentId,
      buttingSegmentId: assembly.buttingSegmentId,
      cornerType: 'outside',
      strategy: 'interlocked_running_bond',
      ownerStartTrim: assembly.ownerEndTrimMeters,
      buttingStartTrim: assembly.buttingStartTrimMeters,
      generatedUnitType: 'corner_block',
    })) ?? [],
    exteriorFootprint,
    boundaryViolations,
    blockCount: wallCmuLayout.blocks.length,
    bondPattern: wall.bondPattern ?? 'running_bond',
    wallCmuLayout,
  };
}

export function generateCmuBlockInstances(params: CmuWallSystemParameters): CmuBlockInstance[] {
  if (!params.showIndividualBlocks) return [];
  return generateCmuLayout(params).blocks;
}

export function generateCmuLayoutFromWallLayout(
  layout: DesignWallLayoutParameters,
  params: CmuWallSystemParameters,
): CmuLayoutResult {
  const moduleConfig = resolveCmuModuleConfig(params);
  const moduleLength = moduleConfig.moduleLengthMeters;
  const moduleHeight = moduleConfig.moduleHeightMeters;
  const actualFullLength = moduleConfig.actualLengthMeters ?? Math.max(0.01, moduleLength - moduleConfig.mortarJointMeters);
  const actualHeight = moduleConfig.actualHeightMeters ?? Math.max(0.01, moduleHeight - moduleConfig.mortarJointMeters);
  if (moduleLength <= 0 || moduleHeight <= 0) return emptyCmuLayout(params);

  const warnings = [
    'Layout graph CMU geometry is segment-based; detailed L-corner unit visualization is approximate in this milestone.',
  ];
  const segmentFrames = buildSegmentFrames(layout, params, warnings);
  const frameById = new Map(segmentFrames.map((frame) => [frame.segmentId, frame]));
  const courseCount = Math.max(1, ...segmentFrames.map((frame) => courseCountFromHeight(frame.wallHeightMeters, moduleHeight)));
  const cornerAssemblies = buildLayoutCornerAssemblies(layout, segmentFrames, courseCount, params, warnings);
  const assemblyBySegmentCourse = new Map<string, { startTrim: number; endTrim: number; ownerStart: boolean; ownerEnd: boolean }>();
  cornerAssemblies.forEach((assembly) => {
    const incomingKey = `${assembly.incomingSegmentId}:${assembly.courseIndex}`;
    const outgoingKey = `${assembly.outgoingSegmentId}:${assembly.courseIndex}`;
    const incoming = assemblyBySegmentCourse.get(incomingKey) ?? { startTrim: 0, endTrim: 0, ownerStart: false, ownerEnd: false };
    const outgoing = assemblyBySegmentCourse.get(outgoingKey) ?? { startTrim: 0, endTrim: 0, ownerStart: false, ownerEnd: false };
    if (assembly.ownerSegmentId === assembly.incomingSegmentId) {
      incoming.ownerEnd = true;
      outgoing.startTrim = Math.max(outgoing.startTrim, assembly.buttingStartTrimMeters);
    } else {
      outgoing.ownerStart = true;
      incoming.endTrim = Math.max(incoming.endTrim, assembly.ownerEndTrimMeters);
    }
    assemblyBySegmentCourse.set(incomingKey, incoming);
    assemblyBySegmentCourse.set(outgoingKey, outgoing);
  });

  const roughOpenings = params.openings
    .map((opening) => resolveLayoutOpeningGeometry({ opening, segmentFrame: opening.wallSegmentId ? frameById.get(opening.wallSegmentId) : undefined, wallSettings: params }))
    .filter((opening): opening is ResolvedCmuOpening => opening != null);
  const blocks: CmuBlockInstance[] = [];
  const counts = createEmptyCounts();
  const runningBond = normalizeBondPattern(params.bondPattern) === 'running_bond';

  segmentFrames.forEach((frame) => {
    const segmentOpenings = roughOpenings.filter((opening) => getLayoutOpeningSegmentId(opening) === frame.segmentId);
    const frameCourseCount = courseCountFromHeight(frame.wallHeightMeters, moduleHeight);
    for (let course = 0; course < frameCourseCount; course += 1) {
      const trims = assemblyBySegmentCourse.get(`${frame.segmentId}:${course}`) ?? { startTrim: 0, endTrim: 0, ownerStart: false, ownerEnd: false };
      const effectiveLength = Math.max(moduleLength / 2, frame.lengthMeters - trims.startTrim - trims.endTrim);
      const courseUnits = buildCourseUnits({
        wallLength: effectiveLength,
        moduleLength,
        actualFullLength,
        runningBond,
        course,
      });
      courseUnits.forEach((unit, column) => {
        const startAlongMeters = unit.startAlongMeters + trims.startTrim;
        const endAlongMeters = unit.endAlongMeters + trims.startTrim;
        if (
          segmentOpenings.some(
            (opening) =>
              startAlongMeters < opening.roughEndAlongMeters &&
              endAlongMeters > opening.roughStartAlongMeters &&
              course * moduleHeight < opening.roughTopMeters &&
              course * moduleHeight + actualHeight > opening.roughBottomMeters,
          )
        ) {
          return;
        }
        const alongCenter = (startAlongMeters + endAlongMeters) / 2;
        const point = pointOnSegmentFrame(frame, alongCenter, frame.wallThicknessMeters / 2);
        const blockType =
          (column === 0 && trims.ownerStart) || (column === courseUnits.length - 1 && trims.ownerEnd)
            ? 'corner'
            : unit.unitType === 'half'
              ? 'half'
              : unit.unitType === 'cut'
                ? 'cut'
                : (column === 0 && trims.startTrim > 0) || (column === courseUnits.length - 1 && trims.endTrim > 0)
                  ? 'end'
                  : 'full';
        blocks.push({
          id: `${frame.segmentId}-${course}-${column}`,
          face: 'north',
          segmentId: frame.segmentId,
          course,
          blockType,
          x: point.x,
          y: course * moduleHeight + actualHeight / 2,
          z: point.z,
          rotationY: frame.rotationY,
          lengthMeters: Math.max(0.02, endAlongMeters - startAlongMeters),
          startAlongMeters,
          endAlongMeters,
        });
        counts[blockType] += 1;
      });
    }
  });

  const lintels = roughOpenings
    .filter((opening) => opening.lintelType !== 'none')
    .map((opening) => {
      const frame = frameById.get(getLayoutOpeningSegmentId(opening) ?? '');
      const point = frame ? pointOnSegmentFrame(frame, (opening.roughStartAlongMeters + opening.roughEndAlongMeters) / 2, frame.wallThicknessMeters / 2) : { x: 0, z: 0 };
      return {
        id: `lintel-${opening.id}`,
        face: 'north' as const,
        segmentId: getLayoutOpeningSegmentId(opening),
        openingId: opening.id,
        x: point.x,
        y: opening.roughTopMeters + opening.lintelHeightMeters / 2,
        z: point.z,
        rotationY: frame?.rotationY ?? 0,
        lengthMeters: opening.lintelLengthMeters,
        heightMeters: opening.lintelHeightMeters,
      };
    });
  lintels.forEach(() => {
    counts.lintel_bond_beam += 1;
  });

  const jambGroutCells = roughOpenings.flatMap((opening) => {
    if (!opening.jambGroutEnabled) return [];
    const frame = frameById.get(getLayoutOpeningSegmentId(opening) ?? '');
    if (!frame) return [];
    const cells: CmuJambGroutCellInstance[] = [];
    const cellHeight = Math.min(frame.wallHeightMeters, opening.roughOpeningHeightMeters + opening.lintelHeightMeters);
    const y = cellHeight / 2;
    [opening.roughStartAlongMeters, opening.roughEndAlongMeters].forEach((along, sideIndex) => {
      const point = pointOnSegmentFrame(frame, along, frame.wallThicknessMeters / 2);
      cells.push({
        id: `jamb-${opening.id}-${sideIndex}`,
        face: 'north',
        segmentId: frame.segmentId,
        openingId: opening.id,
        courseIndex: 0,
        x: point.x,
        y,
        z: point.z,
        rotationY: frame.rotationY,
        heightMeters: cellHeight,
        widthMeters: moduleLength,
      });
    });
    return cells;
  });

  const pilasters = layout.nodes.map((node) => ({
    id: `pilaster-${node.id}`,
    face: 'north' as const,
    nodeId: node.id,
    x: node.x,
    y: params.heightMeters / 2,
    z: node.z,
    rotationY: 0,
    heightMeters: params.heightMeters,
  }));
  const wallLengthTotal = segmentFrames.reduce((sum, frame) => sum + frame.lengthMeters, 0);
  const baseOpeningGrout = calculateLayoutOpeningGroutSummary(params, roughOpenings, moduleHeight, wallLengthTotal);
  const openingGrout = {
    ...baseOpeningGrout,
    jambGroutCellCount: jambGroutCells.length,
  };
  return {
    blocks,
    lintels,
    pilasters,
    roughOpenings,
    jambGroutCells,
    openingCourseClosures: [],
    openingGrout,
    counts,
    totalBlocks: Object.values(counts).reduce((sum, value) => sum + value, 0),
    courseCount,
    moduleFits: summarizeWallModuleFits(params),
    warnings: [...new Set([...warnings, ...openingGrout.warnings])],
    bondBeamLengthMeters: params.bondBeamEnabled ? wallLengthTotal : 0,
    groutedCellCount: Math.ceil(wallLengthTotal / Math.max(0.1, params.groutedCellSpacingMeters ?? 1.2)),
    segmentFrames,
    cornerAssemblies,
  };
}

type LayoutResolvedOpening = ResolvedCmuOpening & {
  wallSegmentId?: string;
  worldX?: number;
  worldZ?: number;
  rotationY?: number;
  wallThicknessMeters?: number;
};

function buildSegmentFrames(
  layout: DesignWallLayoutParameters,
  wall: CmuWallSystemParameters,
  warnings: string[],
): SegmentFrame[] {
  const perimeter = buildOrderedPerimeter(layout, warnings);
  const exteriorFootprint = perimeter.length > 0
    ? perimeter.map((item) => {
        const node = layout.nodes.find((candidate) => candidate.id === item.startNodeId);
        return node ? { x: node.x, z: node.z } : null;
      }).filter((point): point is DesignGeometryPoint => point != null)
    : deriveExteriorFootprint(layout);
  const inwardSign = signedPolygonArea(exteriorFootprint) >= 0 ? 1 : -1;
  const orderedIds = new Set(perimeter.map((item) => item.segmentId));
  const orderedSegments = [
    ...perimeter.map((item) => layout.segments.find((segment) => segment.id === item.segmentId)).filter((segment): segment is DesignWallLayoutParameters['segments'][number] => segment != null),
    ...layout.segments.filter((segment) => !orderedIds.has(segment.id)),
  ];

  return orderedSegments.map((segment) => {
    const start = layout.nodes.find((node) => node.id === segment.startNodeId);
    const end = layout.nodes.find((node) => node.id === segment.endNodeId);
    if (!start || !end) return null;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthMeters = Math.hypot(dx, dz);
    if (lengthMeters <= 0) return null;
    const tangent = { x: dx / lengthMeters, z: dz / lengthMeters };
    const inwardNormal = exteriorFootprint.length >= 3
      ? { x: -tangent.z * inwardSign, z: tangent.x * inwardSign }
      : { x: 0, z: 0 };
    return {
      segmentId: segment.id,
      start: { x: start.x, z: start.z },
      end: { x: end.x, z: end.z },
      lengthMeters,
      tangent,
      inwardNormal,
      outwardNormal: { x: -inwardNormal.x, z: -inwardNormal.z },
      rotationY: -Math.atan2(dz, dx),
      wallHeightMeters: segment.wallHeightMeters || layout.defaultWallHeightMeters || wall.heightMeters,
      wallThicknessMeters: segment.wallThicknessMeters || layout.defaultWallThicknessMeters || wall.wallThicknessMeters,
    } satisfies SegmentFrame;
  }).filter((frame): frame is SegmentFrame => frame != null);
}

function buildOrderedPerimeter(
  layout: DesignWallLayoutParameters,
  warnings: string[],
): OrderedPerimeterSegment[] {
  if (!layout.isFootprintClosed || layout.segments.length < 3) {
    warnings.push('Wall layout is not a closed perimeter; corner assemblies use open-wall fallback.');
    return [];
  }
  const first = layout.segments[0];
  const ordered: OrderedPerimeterSegment[] = [];
  const visited = new Set<string>();
  const firstStartNode = layout.nodes.find((node) => node.id === first.startNodeId);
  const firstEndNode = layout.nodes.find((node) => node.id === first.endNodeId);
  if (!firstStartNode || !firstEndNode) return [];
  const firstLength = Math.hypot(firstEndNode.x - firstStartNode.x, firstEndNode.z - firstStartNode.z);
  if (firstLength <= 0) return [];
  ordered.push({
    segmentId: first.id,
    startNodeId: first.startNodeId,
    endNodeId: first.endNodeId,
    index: 0,
    tangent: { x: (firstEndNode.x - firstStartNode.x) / firstLength, z: (firstEndNode.z - firstStartNode.z) / firstLength },
  });
  visited.add(first.id);
  let currentNodeId = first.endNodeId;
  for (let index = 1; index < layout.segments.length; index += 1) {
    const touching = layout.segments.filter(
      (segment) => !visited.has(segment.id) && (segment.startNodeId === currentNodeId || segment.endNodeId === currentNodeId),
    );
    if (touching.length !== 1) {
      warnings.push('Wall layout perimeter is non-manifold or branched; using safe flush corner fallback.');
      return [];
    }
    const segment = touching[0];
    const startNode = layout.nodes.find((node) => node.id === currentNodeId);
    const nextNodeId = segment.startNodeId === currentNodeId ? segment.endNodeId : segment.startNodeId;
    const endNode = layout.nodes.find((node) => node.id === nextNodeId);
    if (!startNode || !endNode) return [];
    const length = Math.hypot(endNode.x - startNode.x, endNode.z - startNode.z);
    if (length <= 0) return [];
    ordered.push({
      segmentId: segment.id,
      startNodeId: currentNodeId,
      endNodeId: nextNodeId,
      index,
      tangent: { x: (endNode.x - startNode.x) / length, z: (endNode.z - startNode.z) / length },
    });
    visited.add(segment.id);
    currentNodeId = nextNodeId;
    if (currentNodeId === first.startNodeId) break;
  }
  if (visited.size !== layout.segments.length || currentNodeId !== first.startNodeId) {
    warnings.push('Wall layout is disconnected or has multiple loops; using safe flush corner fallback.');
    return [];
  }
  return ordered;
}

function buildLayoutCornerAssemblies(
  layout: DesignWallLayoutParameters,
  frames: readonly SegmentFrame[],
  courseCount: number,
  wall: CmuWallSystemParameters,
  warnings: string[],
): LayoutCornerAssembly[] {
  const ordered = buildOrderedPerimeter(layout, warnings);
  if (ordered.length < 3 || normalizeBondPattern(wall.bondPattern) !== 'running_bond') return [];
  const frameById = new Map(frames.map((frame) => [frame.segmentId, frame]));
  const assemblies: LayoutCornerAssembly[] = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const incoming = ordered[(index + ordered.length - 1) % ordered.length];
    const outgoing = ordered[index];
    const incomingFrame = frameById.get(incoming.segmentId);
    const outgoingFrame = frameById.get(outgoing.segmentId);
    const cornerNode = layout.nodes.find((node) => node.id === outgoing.startNodeId);
    if (!incomingFrame || !outgoingFrame || !cornerNode) continue;
    const cornerSetbackMeters = Math.max(incomingFrame.wallThicknessMeters, outgoingFrame.wallThicknessMeters);
    for (let courseIndex = 0; courseIndex < courseCount; courseIndex += 1) {
      const incomingOwns = courseIndex % 2 === 0;
      assemblies.push({
        cornerId: `corner-${outgoing.startNodeId}`,
        courseIndex,
        incomingSegmentId: incoming.segmentId,
        outgoingSegmentId: outgoing.segmentId,
        ownerSegmentId: incomingOwns ? incoming.segmentId : outgoing.segmentId,
        buttingSegmentId: incomingOwns ? outgoing.segmentId : incoming.segmentId,
        ownerEndTrimMeters: incomingOwns ? 0 : cornerSetbackMeters,
        buttingStartTrimMeters: incomingOwns ? cornerSetbackMeters : 0,
        exteriorCornerPoint: { x: cornerNode.x, z: cornerNode.z },
        strategy: 'interlocked_running_bond',
      });
    }
  }
  return assemblies;
}

function resolveLayoutOpeningGeometry(params: {
  opening: WallOpeningParameters;
  segmentFrame?: SegmentFrame;
  wallSettings: CmuWallSystemParameters;
}): LayoutResolvedOpening | null {
  const frame = params.segmentFrame;
  if (!frame) return null;
  const moduleConfig = resolveCmuModuleConfig(params.wallSettings);
  const allowance = Math.max(0, params.opening.roughOpeningAllowanceMeters ?? 0.05);
  const actualWidthMeters = Math.max(0, params.opening.widthMeters);
  const actualHeightMeters = Math.max(0, params.opening.heightMeters);
  const roughOpeningWidthMeters = Math.max(actualWidthMeters, params.opening.roughOpeningWidthMeters ?? actualWidthMeters + allowance * 2);
  const roughOpeningHeightMeters = Math.max(actualHeightMeters, params.opening.roughOpeningHeightMeters ?? actualHeightMeters + allowance * 2);
  const rawActualStart = Math.max(0, Math.min(frame.lengthMeters - actualWidthMeters, params.opening.positionAlongSegment ?? params.opening.offsetMeters ?? 0));
  const roughStartAlongMeters = Math.max(0, Math.min(frame.lengthMeters - roughOpeningWidthMeters, rawActualStart - (roughOpeningWidthMeters - actualWidthMeters) / 2));
  const roughBottomMeters = params.opening.type === 'door'
    ? 0
    : Math.max(0, (params.opening.sillHeightMeters ?? 0) - (roughOpeningHeightMeters - actualHeightMeters) / 2);
  const lintelType = params.opening.lintelType ?? params.wallSettings.lintelType ?? 'bond_beam';
  const lintelBearingMeters = Math.max(0, params.opening.lintelBearingMeters ?? params.wallSettings.lintelBearingMeters ?? 0.2);
  const lintelCourseCount = Math.max(1, params.opening.lintelCourseCount ?? params.wallSettings.lintelCourseCount ?? 1);
  const lintelLengthMeters = lintelType === 'none' ? 0 : Math.min(frame.lengthMeters, roughOpeningWidthMeters + lintelBearingMeters * 2);
  const center = pointOnSegmentFrame(frame, roughStartAlongMeters + roughOpeningWidthMeters / 2, frame.wallThicknessMeters / 2);
  return {
    id: params.opening.id,
    type: params.opening.type,
    wallFace: params.opening.wallFace ?? 'north',
    wallSegmentId: frame.segmentId,
    actualWidthMeters,
    actualHeightMeters,
    actualAreaSquareMeters: actualWidthMeters * actualHeightMeters,
    roughOpeningWidthMeters,
    roughOpeningHeightMeters,
    roughOpeningAreaSquareMeters: roughOpeningWidthMeters * roughOpeningHeightMeters,
    roughStartAlongMeters,
    roughEndAlongMeters: roundMeters(roughStartAlongMeters + roughOpeningWidthMeters),
    roughBottomMeters: roundMeters(roughBottomMeters),
    roughTopMeters: roundMeters(roughBottomMeters + roughOpeningHeightMeters),
    actualStartAlongMeters: rawActualStart,
    actualEndAlongMeters: roundMeters(rawActualStart + actualWidthMeters),
    actualBottomMeters: params.opening.type === 'door' ? 0 : params.opening.sillHeightMeters ?? 0,
    actualTopMeters: (params.opening.type === 'door' ? 0 : params.opening.sillHeightMeters ?? 0) + actualHeightMeters,
    lintelType,
    lintelBearingMeters,
    lintelCourseCount,
    lintelLengthMeters,
    lintelHeightMeters: moduleConfig.moduleHeightMeters * lintelCourseCount,
    jambGroutEnabled: params.opening.jambGroutEnabled ?? true,
    jambRebarEnabled: params.opening.jambRebarEnabled ?? false,
    groutCellsEachSide: Math.max(0, params.opening.groutCellsEachSide ?? params.wallSettings.jambCellsEachSide ?? 1),
    jambGroutCellCount: (params.opening.jambGroutEnabled ?? true)
      ? Math.max(0, params.opening.groutCellsEachSide ?? params.wallSettings.jambCellsEachSide ?? 1) * 2
      : 0,
    groutCellsAboveOpening: Math.max(0, params.opening.groutCellsAboveOpening ?? 0),
    groutCellsBelowWindow: params.opening.type === 'window' ? Math.max(0, params.opening.groutCellsBelowWindow ?? 0) : 0,
    openingFrameMaterial: params.opening.openingFrameMaterial ?? 'none',
    worldX: center.x,
    worldZ: center.z,
    rotationY: frame.rotationY,
    wallThicknessMeters: frame.wallThicknessMeters,
  };
}

function getLayoutOpeningSegmentId(opening: ResolvedCmuOpening): string | undefined {
  return (opening as LayoutResolvedOpening).wallSegmentId;
}

function pointOnSegmentFrame(frame: SegmentFrame, alongMeters: number, inwardOffsetMeters: number): DesignGeometryPoint {
  return {
    x: frame.start.x + frame.tangent.x * alongMeters + frame.inwardNormal.x * inwardOffsetMeters,
    z: frame.start.z + frame.tangent.z * alongMeters + frame.inwardNormal.z * inwardOffsetMeters,
  };
}

function calculateLayoutOpeningGroutSummary(
  params: CmuWallSystemParameters,
  openings: readonly ResolvedCmuOpening[],
  moduleHeight: number,
  wallLengthTotal: number,
): CmuOpeningGroutSummary {
  const coreFillFactor = Math.max(0, Math.min(1, params.coreFillFactor ?? 0.5));
  const groutWastePercent = Math.max(0, params.groutWastePercent ?? 0.1);
  const wasteMultiplier = 1 + groutWastePercent;
  const wallThickness = Math.max(0, params.wallThicknessMeters);
  const moduleConfig = resolveCmuModuleConfig(params);
  const cellCoreArea = moduleConfig.moduleLengthMeters * wallThickness * coreFillFactor;
  const jambGroutVolumeCubicMeters = openings.reduce((sum, opening) => {
    if (!opening.jambGroutEnabled) return sum;
    const groutedHeight = Math.min(params.heightMeters, opening.roughOpeningHeightMeters + opening.lintelHeightMeters);
    return sum + opening.jambGroutCellCount * cellCoreArea * groutedHeight * wasteMultiplier;
  }, 0);
  const lintelGroutVolumeCubicMeters = openings.reduce((sum, opening) => {
    if (opening.lintelType === 'none' || !params.lintelBondBeamEnabled) return sum;
    return sum + opening.lintelLengthMeters * wallThickness * opening.lintelHeightMeters * coreFillFactor * wasteMultiplier;
  }, 0);
  const bondBeamGroutVolumeCubicMeters = params.bondBeamEnabled
    ? wallLengthTotal * wallThickness * moduleHeight * coreFillFactor * wasteMultiplier
    : 0;
  return {
    resolvedOpenings: [...openings],
    actualOpeningAreaSquareMeters: openings.reduce((sum, opening) => sum + opening.actualAreaSquareMeters, 0),
    roughOpeningAreaSquareMeters: openings.reduce((sum, opening) => sum + opening.roughOpeningAreaSquareMeters, 0),
    jambGroutCellCount: openings.reduce((sum, opening) => sum + opening.jambGroutCellCount, 0),
    lintelCount: openings.filter((opening) => opening.lintelType !== 'none').length,
    lintelLengthMeters: openings.reduce((sum, opening) => sum + opening.lintelLengthMeters, 0),
    jambGroutVolumeCubicMeters,
    closureGroutVolumeCubicMeters: 0,
    lintelGroutVolumeCubicMeters,
    bondBeamGroutVolumeCubicMeters,
    totalGroutVolumeCubicMeters: jambGroutVolumeCubicMeters + lintelGroutVolumeCubicMeters + bondBeamGroutVolumeCubicMeters,
    courseClosureCutBlockCount: 0,
    coreFillFactor,
    groutWastePercent,
    warnings: ['Opening grout/reinforcement quantities are generated from wall-layout segment geometry.'],
  };
}

function roundMeters(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function generateCmuLayout(params: CmuWallSystemParameters): CmuLayoutResult {
  const moduleConfig = resolveCmuModuleConfig(params);
  const moduleLength = moduleConfig.moduleLengthMeters;
  const moduleHeight = moduleConfig.moduleHeightMeters;
  const actualFullLength = moduleConfig.actualLengthMeters ?? Math.max(0.01, moduleLength - moduleConfig.mortarJointMeters);
  const actualHeight = moduleConfig.actualHeightMeters ?? Math.max(0.01, moduleHeight - moduleConfig.mortarJointMeters);
  if (moduleLength <= 0 || moduleHeight <= 0) return emptyCmuLayout(params);

  const blocks: CmuBlockInstance[] = [];
  const roughOpenings = resolveCmuOpenings(params);
  const baseOpeningGrout = calculateCmuOpeningGroutSummary(params);
  const lintels = generateLintelInstances(params, moduleConfig, roughOpenings);
  const pilasters = generatePilasterInstances(params);
  const jambGroutCells = generateJambGroutCellInstances(params, roughOpenings, courseCountFromHeight(params.heightMeters, moduleHeight));
  const openingCourseClosures = generateOpeningCourseClosures({
    params,
    openings: roughOpenings,
    moduleLength,
    moduleHeight,
    actualFullLength,
    courseCount: courseCountFromHeight(params.heightMeters, moduleHeight),
  });
  const openingGrout = buildLayoutOpeningGroutSummary({
    params,
    base: baseOpeningGrout,
    jambGroutCells,
    openingCourseClosures,
    moduleHeight,
  });
  const counts = createEmptyCounts();
  const moduleFits = summarizeWallModuleFits(params);
  const warnings = [
    ...validateCmuOpenings(params),
    ...openingGrout.warnings,
    ...openingCourseClosures.flatMap((closure) => (closure.warning ? [closure.warning] : [])),
    ...moduleFitWarnings(moduleFits),
    ...(params.bondPattern === 'stack_bond' ? ['Stack bond may require reinforcement/design review.'] : []),
  ];
  const jambKeys = new Set<string>();
  const wallThickness = Math.max(0, params.wallThicknessMeters);
  const wallFaces = [
    { face: 'north', length: params.lengthMeters, z: -params.widthMeters / 2 + wallThickness / 2, rotationY: 0, fit: moduleFits.north },
    { face: 'south', length: params.lengthMeters, z: params.widthMeters / 2 - wallThickness / 2, rotationY: 0, fit: moduleFits.south },
    { face: 'east', length: params.widthMeters, x: params.lengthMeters / 2 - wallThickness / 2, rotationY: Math.PI / 2, fit: moduleFits.east },
    { face: 'west', length: params.widthMeters, x: -params.lengthMeters / 2 + wallThickness / 2, rotationY: Math.PI / 2, fit: moduleFits.west },
  ] as const;
  const courseCount = courseCountFromHeight(params.heightMeters, moduleHeight);

  for (const wall of wallFaces) {
    for (let course = 0; course < courseCount; course += 1) {
      const runningBond = (params.bondPattern ?? 'running_bond') === 'running_bond';
      const horizontalWall = wall.face === 'north' || wall.face === 'south';
      const horizontalOwnsCorners = !runningBond || course % 2 === 0;
      const ownsCorner = horizontalWall ? horizontalOwnsCorners : !horizontalOwnsCorners;
      const cornerTrim = (params.cornerCondition ?? 'interlocked') === 'interlocked' && !ownsCorner ? wallThickness : 0;
      const effectiveWallLength = Math.max(moduleLength / 2, wall.length - cornerTrim * 2);
      const courseUnits = buildCourseUnits({
        wallLength: effectiveWallLength,
        moduleLength,
        actualFullLength,
        runningBond,
        course,
      });
      courseUnits.forEach((unit, column) => {
        const startAlongMeters = unit.startAlongMeters + cornerTrim;
        const endAlongMeters = unit.endAlongMeters + cornerTrim;
        const verticalBand = {
          startAlongMeters,
          endAlongMeters,
          bottomMeters: course * moduleHeight,
          topMeters: course * moduleHeight + actualHeight,
        };
        if (overlapsOpening(roughOpenings, wall.face, verticalBand)) {
          addJambBlocks({
            params,
            moduleLength,
            actualHeight,
            wall,
            course,
            band: verticalBand,
            blocks,
            counts,
            jambKeys,
          });
          return;
        }

        const blockType = resolveBlockType(params, course, { ...unit, startAlongMeters, endAlongMeters }, wall.length, wall.fit, ownsCorner);
        const centeredAlong = startAlongMeters - wall.length / 2 + unit.lengthMeters / 2;
        const y = course * moduleHeight + actualHeight / 2;
        const x = 'x' in wall ? wall.x : centeredAlong;
        const z = 'z' in wall ? wall.z : centeredAlong;
        blocks.push({
          id: `${wall.face}-${course}-${column}`,
          face: wall.face,
          course,
          blockType,
          x,
          y,
          z,
          rotationY: wall.rotationY,
          lengthMeters: unit.lengthMeters,
          startAlongMeters,
          endAlongMeters,
        });
        counts[blockType] += 1;
      });
    }
  }

  lintels.forEach(() => {
    counts.lintel_bond_beam += 1;
  });

  return {
    blocks,
    lintels,
    pilasters,
    roughOpenings,
    jambGroutCells,
    openingCourseClosures,
    openingGrout,
    counts,
    totalBlocks: Object.values(counts).reduce((sum, value) => sum + value, 0),
    courseCount,
    moduleFits,
    warnings,
    bondBeamLengthMeters: params.bondBeamEnabled ? 2 * (params.lengthMeters + params.widthMeters) : 0,
    groutedCellCount: Math.ceil((2 * (params.lengthMeters + params.widthMeters)) / Math.max(0.1, params.groutedCellSpacingMeters ?? 1.2)),
  };
}

function overlapsOpening(
  openings: readonly ResolvedCmuOpening[],
  face: CmuBlockInstanceWallFace,
  block: {
    startAlongMeters: number;
    endAlongMeters: number;
    bottomMeters: number;
    topMeters: number;
  },
): boolean {
  return openings.some((opening) => {
    if (opening.wallFace !== face) return false;
    const overlapsHorizontal = block.startAlongMeters < opening.roughEndAlongMeters && block.endAlongMeters > opening.roughStartAlongMeters;
    const overlapsVertical = block.bottomMeters < opening.roughTopMeters && block.topMeters > opening.roughBottomMeters;
    return overlapsHorizontal && overlapsVertical;
  });
}

export type CmuBlockInstanceWallFace = 'north' | 'east' | 'south' | 'west';

export interface DesignGeometrySummary {
  blockInstances: CmuBlockInstance[];
  slab: ThickenedEdgeSlabParameters;
  wall: CmuWallSystemParameters;
  roof: GableRoofSystemParameters;
  truss: SteelTrussSystemParameters;
}

function emptyCmuLayout(params?: CmuWallSystemParameters): CmuLayoutResult {
  const roughOpenings = params ? resolveCmuOpenings(params) : [];
  const openingGrout = params ? calculateCmuOpeningGroutSummary(params) : emptyOpeningGroutSummary();
  return {
    blocks: [],
    lintels: [],
    pilasters: [],
    roughOpenings,
    jambGroutCells: [],
    openingCourseClosures: [],
    openingGrout,
    counts: createEmptyCounts(),
    totalBlocks: 0,
    courseCount: 0,
    moduleFits: params ? summarizeWallModuleFits(params) : {
      north: analyzeCmuModuleFit(0, 0.4),
      south: analyzeCmuModuleFit(0, 0.4),
      east: analyzeCmuModuleFit(0, 0.4),
      west: analyzeCmuModuleFit(0, 0.4),
    },
    warnings: [],
    bondBeamLengthMeters: 0,
    groutedCellCount: 0,
  };
}

function emptyOpeningGroutSummary(): CmuOpeningGroutSummary {
  return {
    resolvedOpenings: [],
    actualOpeningAreaSquareMeters: 0,
    roughOpeningAreaSquareMeters: 0,
    jambGroutCellCount: 0,
    lintelCount: 0,
    lintelLengthMeters: 0,
    jambGroutVolumeCubicMeters: 0,
    closureGroutVolumeCubicMeters: 0,
    lintelGroutVolumeCubicMeters: 0,
    bondBeamGroutVolumeCubicMeters: 0,
    totalGroutVolumeCubicMeters: 0,
    courseClosureCutBlockCount: 0,
    coreFillFactor: 0.5,
    groutWastePercent: 0,
    warnings: [],
  };
}

function createEmptyCounts(): Record<CmuBlockType, number> {
  return {
    full: 0,
    half: 0,
    end: 0,
    corner: 0,
    jamb: 0,
    lintel_bond_beam: 0,
    cut: 0,
  };
}

function resolveBlockType(
  params: CmuWallSystemParameters,
  course: number,
  unit: CmuCourseUnit,
  wallLength: number,
  fit: CmuModuleFitResult,
  ownsCorner = true,
): CmuBlockType {
  const nearStart = unit.startAlongMeters <= Math.max(0.005, params.mortarJointMeters);
  const nearEnd = unit.endAlongMeters >= wallLength - Math.max(0.005, params.mortarJointMeters);
  if (unit.unitType === 'cut') return 'cut';
  if (unit.unitType === 'half') return 'half';
  if ((params.cornerCondition ?? 'interlocked') === 'interlocked' && ownsCorner && (nearStart || nearEnd)) return 'corner';
  if ((params.cornerCondition ?? 'interlocked') === 'interlocked' && !ownsCorner && (nearStart || nearEnd)) return 'end';
  if ((params.endCondition ?? 'return_corner') === 'plain_end' && (nearStart || nearEnd)) return 'end';
  if ((params.bondPattern ?? 'running_bond') === 'running_bond' && course % 2 === 1 && nearStart) return 'half';
  if (fit.fit === 'cut' && nearEnd) return 'cut';
  return 'full';
}

interface CmuCourseUnit {
  unitType: 'full' | 'half' | 'cut';
  startAlongMeters: number;
  endAlongMeters: number;
  lengthMeters: number;
}

function buildCourseUnits(params: {
  wallLength: number;
  moduleLength: number;
  actualFullLength: number;
  runningBond: boolean;
  course: number;
}): CmuCourseUnit[] {
  const units: CmuCourseUnit[] = [];
  const halfModule = params.moduleLength / 2;
  const tolerance = 0.005;
  let cursor = 0;

  if (params.runningBond && params.course % 2 === 1 && params.wallLength > halfModule + tolerance) {
    units.push(makeCourseUnit('half', cursor, halfModule, params.actualFullLength / 2, params.wallLength));
    cursor += halfModule;
  }

  while (cursor < params.wallLength - tolerance) {
    const remaining = params.wallLength - cursor;
    if (remaining >= params.moduleLength - tolerance) {
      units.push(makeCourseUnit('full', cursor, params.moduleLength, params.actualFullLength, params.wallLength));
      cursor += params.moduleLength;
    } else if (Math.abs(remaining - halfModule) <= tolerance || remaining >= halfModule - tolerance) {
      units.push(makeCourseUnit('half', cursor, halfModule, params.actualFullLength / 2, params.wallLength));
      cursor += halfModule;
    } else {
      units.push(makeCourseUnit('cut', cursor, remaining, Math.max(0.04, remaining - 0.01), params.wallLength));
      cursor = params.wallLength;
    }
  }

  return units;
}

export function generateLayoutWallGeometry(
  layout: DesignWallLayoutParameters,
  wall: CmuWallSystemParameters,
): Pick<DesignGeometryResult, 'wallSegments' | 'blockInstances' | 'cornerCourseLayouts' | 'exteriorFootprint' | 'boundaryViolations'> {
  const moduleConfig = resolveCmuModuleConfig(wall);
  const moduleLength = moduleConfig.moduleLengthMeters;
  const moduleHeight = moduleConfig.moduleHeightMeters;
  const actualFullLength = moduleConfig.actualLengthMeters ?? Math.max(0.01, moduleLength - moduleConfig.mortarJointMeters);
  const actualHeight = moduleConfig.actualHeightMeters ?? Math.max(0.01, moduleHeight - moduleConfig.mortarJointMeters);
  const runningBond = normalizeBondPattern(wall.bondPattern) === 'running_bond';
  const wallSegments: DesignGeometryWallSegment[] = [];
  const blockInstances: DesignGeometryBlockInstance[] = [];
  const exteriorFootprint = deriveExteriorFootprint(layout);
  const inwardSign = signedPolygonArea(exteriorFootprint) >= 0 ? 1 : -1;
  const maxCourseCount = Math.max(
    1,
    ...layout.segments.map((segment) => courseCountFromHeight(segment.wallHeightMeters || layout.defaultWallHeightMeters || wall.heightMeters, moduleHeight)),
  );
  const cornerCourseLayouts = buildCornerCourseLayouts(layout, wall, maxCourseCount);
  if (moduleLength <= 0 || moduleHeight <= 0) {
    return { wallSegments, blockInstances, cornerCourseLayouts, exteriorFootprint, boundaryViolations: [] };
  }

  layout.segments.forEach((segment) => {
    const start = layout.nodes.find((node) => node.id === segment.startNodeId);
    const end = layout.nodes.find((node) => node.id === segment.endNodeId);
    if (!start || !end) return;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthMeters = Math.hypot(dx, dz);
    if (lengthMeters <= 0) return;
    const dirX = dx / lengthMeters;
    const dirZ = dz / lengthMeters;
    const heightMeters = segment.wallHeightMeters || layout.defaultWallHeightMeters || wall.heightMeters;
    const thicknessMeters = segment.wallThicknessMeters || layout.defaultWallThicknessMeters || wall.wallThicknessMeters;
    const inwardNormal = exteriorFootprint.length >= 3
      ? { x: -dirZ * inwardSign, z: dirX * inwardSign }
      : { x: 0, z: 0 };
    const centerX = start.x + dx / 2 + inwardNormal.x * (thicknessMeters / 2);
    const centerZ = start.z + dz / 2 + inwardNormal.z * (thicknessMeters / 2);
    const rotationY = -Math.atan2(dz, dx);

    wallSegments.push({
      segmentId: segment.id,
      lengthMeters,
      heightMeters,
      thicknessMeters,
      x: centerX,
      y: heightMeters / 2,
      z: centerZ,
      rotationY,
    });

    const courseCount = courseCountFromHeight(heightMeters, moduleHeight);
    for (let course = 0; course < courseCount; course += 1) {
      const trims = resolveSegmentCourseTrims(
        segment.id,
        segment.startNodeId,
        segment.endNodeId,
        course,
        cornerCourseLayouts,
        thicknessMeters,
        moduleLength,
      );
      const effectiveLength = Math.max(moduleLength / 2, lengthMeters - trims.startTrim - trims.endTrim);
      const courseUnits = buildCourseUnits({
        wallLength: effectiveLength,
        moduleLength,
        actualFullLength,
        runningBond,
        course,
      });
      courseUnits.forEach((unit, column) => {
        const startAlongMeters = unit.startAlongMeters + trims.startTrim;
        const endAlongMeters = unit.endAlongMeters + trims.startTrim;
        const alongCenter = (startAlongMeters + endAlongMeters) / 2;
        const ownsCornerAtStart = trims.ownerAtStart && column === 0;
        const ownsCornerAtEnd = trims.ownerAtEnd && column === courseUnits.length - 1;
        const blockType = ownsCornerAtStart || ownsCornerAtEnd
          ? 'corner'
          : trims.trimmedAtStart && column === 0 || trims.trimmedAtEnd && column === courseUnits.length - 1
            ? 'end'
            : unit.unitType === 'half'
              ? 'half'
              : unit.unitType === 'cut'
                ? 'cut'
                : 'full';
        blockInstances.push({
          id: `${segment.id}-${course}-${column}`,
          segmentId: segment.id,
          course,
          blockType,
          x: start.x + dirX * alongCenter + inwardNormal.x * (thicknessMeters / 2),
          y: course * moduleHeight + actualHeight / 2,
          z: start.z + dirZ * alongCenter + inwardNormal.z * (thicknessMeters / 2),
          rotationY,
          lengthMeters: Math.max(0.02, endAlongMeters - startAlongMeters),
        });
      });
    }
  });

  const generatedBoundaryViolations = findExteriorFootprintBoundaryViolations(
    blockInstances,
    exteriorFootprint,
    wall.wallThicknessMeters || layout.defaultWallThicknessMeters,
  );
  if (import.meta.env.DEV && generatedBoundaryViolations.length > 0) {
    console.warn('[DesignBuilder] CMU unit outside exterior footprint', generatedBoundaryViolations);
  }
  return { wallSegments, blockInstances, cornerCourseLayouts, exteriorFootprint, boundaryViolations: generatedBoundaryViolations };
}

function deriveExteriorFootprint(layout: DesignWallLayoutParameters): DesignGeometryPoint[] {
  if (!layout.isFootprintClosed || layout.segments.length < 3) return [];
  const firstSegment = layout.segments[0];
  const points: DesignGeometryPoint[] = [];
  let currentNodeId = firstSegment.startNodeId;
  const visitedSegments = new Set<string>();
  for (let index = 0; index < layout.segments.length; index += 1) {
    const node = layout.nodes.find((item) => item.id === currentNodeId);
    if (!node) return [];
    points.push({ x: node.x, z: node.z });
    const nextSegment = layout.segments.find(
      (segment) => !visitedSegments.has(segment.id) && (segment.startNodeId === currentNodeId || segment.endNodeId === currentNodeId),
    );
    if (!nextSegment) break;
    visitedSegments.add(nextSegment.id);
    currentNodeId = nextSegment.startNodeId === currentNodeId ? nextSegment.endNodeId : nextSegment.startNodeId;
    if (currentNodeId === firstSegment.startNodeId) break;
  }
  return points.length >= 3 ? points : [];
}

function signedPolygonArea(points: readonly DesignGeometryPoint[]): number {
  if (points.length < 3) return 0;
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.z - next.x * point.z;
  }, 0) / 2;
}

export function findExteriorFootprintBoundaryViolations(
  blocks: readonly DesignGeometryBlockInstance[],
  exteriorFootprint: readonly DesignGeometryPoint[],
  wallThicknessMeters: number,
  toleranceMeters = 0.006,
): DesignGeometryBoundaryViolation[] {
  if (exteriorFootprint.length < 3) return [];
  return blocks
    .filter((block) =>
      blockFootprintCorners(block, wallThicknessMeters).some((corner) => !pointInPolygonOrOnBoundary(corner, exteriorFootprint, toleranceMeters)),
    )
    .map((block) => ({
      blockId: block.id,
      segmentId: block.segmentId,
      course: block.course,
      blockType: block.blockType,
    }));
}

function blockFootprintCorners(
  block: DesignGeometryBlockInstance,
  wallThicknessMeters: number,
): DesignGeometryPoint[] {
  const halfLength = block.lengthMeters / 2;
  const halfDepth = wallThicknessMeters / 2;
  const cos = Math.cos(block.rotationY);
  const sin = Math.sin(block.rotationY);
  const localPoints = [
    { x: -halfLength, z: -halfDepth },
    { x: halfLength, z: -halfDepth },
    { x: halfLength, z: halfDepth },
    { x: -halfLength, z: halfDepth },
  ];
  return localPoints.map((point) => ({
    x: block.x + point.x * cos - point.z * sin,
    z: block.z + point.x * sin + point.z * cos,
  }));
}

function pointInPolygonOrOnBoundary(
  point: DesignGeometryPoint,
  polygon: readonly DesignGeometryPoint[],
  toleranceMeters: number,
): boolean {
  if (polygon.some((start, index) => distancePointToSegment(point, start, polygon[(index + 1) % polygon.length]) <= toleranceMeters)) {
    return true;
  }
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const intersects =
      current.z > point.z !== previous.z > point.z &&
      point.x < ((previous.x - current.x) * (point.z - current.z)) / (previous.z - current.z) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distancePointToSegment(
  point: DesignGeometryPoint,
  start: DesignGeometryPoint,
  end: DesignGeometryPoint,
): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 0) return Math.hypot(point.x - start.x, point.z - start.z);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq));
  return Math.hypot(point.x - (start.x + dx * t), point.z - (start.z + dz * t));
}

function buildCornerCourseLayouts(
  layout: DesignWallLayoutParameters,
  wall: CmuWallSystemParameters,
  courseCount: number,
): CmuCornerCourseLayout[] {
  const byNode = new Map<string, string[]>();
  layout.segments.forEach((segment) => {
    byNode.set(segment.startNodeId, [...(byNode.get(segment.startNodeId) ?? []), segment.id]);
    byNode.set(segment.endNodeId, [...(byNode.get(segment.endNodeId) ?? []), segment.id]);
  });
  const layouts: CmuCornerCourseLayout[] = [];
  byNode.forEach((segmentIds, nodeId) => {
    const sortedSegmentIds = [...segmentIds].sort();
    const cornerType = sortedSegmentIds.length <= 1 ? 'end' : sortedSegmentIds.length === 2 ? 'outside' : 'tee';
    for (let courseIndex = 0; courseIndex < courseCount; courseIndex += 1) {
      if (cornerType === 'outside' && normalizeBondPattern(wall.bondPattern) === 'running_bond') {
        const ownerSegmentId = sortedSegmentIds[courseIndex % 2];
        const buttingSegmentId = sortedSegmentIds[(courseIndex + 1) % 2];
        layouts.push({
          cornerId: `corner-${nodeId}`,
          nodeId,
          courseIndex,
          ownerSegmentId,
          buttingSegmentId,
          cornerType,
          strategy: 'interlocked_running_bond',
          ownerStartTrim: 0,
          buttingStartTrim: wall.wallThicknessMeters,
          generatedUnitType: 'corner_block',
        });
        continue;
      }
      if (cornerType === 'end') {
        layouts.push({
          cornerId: `corner-${nodeId}`,
          nodeId,
          courseIndex,
          ownerSegmentId: sortedSegmentIds[0],
          buttingSegmentId: sortedSegmentIds[0],
          cornerType,
          strategy: 'butt',
          ownerStartTrim: 0,
          buttingStartTrim: 0,
          generatedUnitType: 'end_block',
        });
      } else if (cornerType === 'tee') {
        layouts.push({
          cornerId: `corner-${nodeId}`,
          nodeId,
          courseIndex,
          ownerSegmentId: sortedSegmentIds[0],
          buttingSegmentId: sortedSegmentIds[1],
          cornerType,
          strategy: 'pilaster',
          ownerStartTrim: 0,
          buttingStartTrim: wall.wallThicknessMeters,
          generatedUnitType: 'full_block',
          warning: 'T-intersection corner weave is conceptual in this milestone.',
        });
      }
    }
  });
  return layouts;
}

function resolveSegmentCourseTrims(
  segmentId: string,
  startNodeId: string,
  endNodeId: string,
  course: number,
  cornerLayouts: readonly CmuCornerCourseLayout[],
  wallThicknessMeters: number,
  moduleLengthMeters: number,
) {
  const trimLength = Math.min(moduleLengthMeters / 2, Math.max(0, wallThicknessMeters));
  const courseCorners = cornerLayouts.filter((corner) => corner.courseIndex === course);
  const start = courseCorners.find(
    (corner) => corner.nodeId === startNodeId && (corner.ownerSegmentId === segmentId || corner.buttingSegmentId === segmentId),
  );
  const end = courseCorners.find(
    (corner) => corner.nodeId === endNodeId && (corner.ownerSegmentId === segmentId || corner.buttingSegmentId === segmentId),
  );
  return {
    startTrim: start?.buttingSegmentId === segmentId ? trimLength : 0,
    endTrim: end?.buttingSegmentId === segmentId ? trimLength : 0,
    ownerAtStart: start?.ownerSegmentId === segmentId,
    ownerAtEnd: end?.ownerSegmentId === segmentId,
    trimmedAtStart: start?.buttingSegmentId === segmentId,
    trimmedAtEnd: end?.buttingSegmentId === segmentId,
  };
}

function courseCountFromHeight(heightMeters: number, moduleHeight: number): number {
  return Math.max(1, Math.ceil(Math.max(0, heightMeters) / Math.max(0.001, moduleHeight)));
}

function generateOpeningCourseClosures(params: {
  params: CmuWallSystemParameters;
  openings: readonly ResolvedCmuOpening[];
  moduleLength: number;
  moduleHeight: number;
  actualFullLength: number;
  courseCount: number;
}): CmuOpeningCourseClosure[] {
  const closures: CmuOpeningCourseClosure[] = [];
  const wallLengthByFace: Record<CmuBlockInstanceWallFace, number> = {
    north: params.params.lengthMeters,
    south: params.params.lengthMeters,
    east: params.params.widthMeters,
    west: params.params.widthMeters,
  };
  const wallThickness = Math.max(0, params.params.wallThicknessMeters);
  const fillFactor = Math.max(0, Math.min(1, params.params.coreFillFactor ?? 0.5));
  const wasteMultiplier = 1 + Math.max(0, params.params.groutWastePercent ?? 0.1);

  params.openings.forEach((opening) => {
    const wallFace = opening.wallFace ?? 'north';
    const wallLength = wallLengthByFace[wallFace];
    for (let course = 0; course < params.courseCount; course += 1) {
      const courseBottom = course * params.moduleHeight;
      const courseTop = courseBottom + params.moduleHeight;
      if (courseBottom >= opening.roughTopMeters || courseTop <= opening.roughBottomMeters) continue;

      const units = buildCourseUnits({
        wallLength,
        moduleLength: params.moduleLength,
        actualFullLength: params.actualFullLength,
        runningBond: (params.params.bondPattern ?? 'running_bond') === 'running_bond',
        course,
      });
      const keptUnits = units.filter(
        (unit) =>
          !(unit.startAlongMeters < opening.roughEndAlongMeters && unit.endAlongMeters > opening.roughStartAlongMeters),
      );
      const leftUnit = keptUnits
        .filter((unit) => unit.endAlongMeters <= opening.roughStartAlongMeters)
        .sort((a, b) => b.endAlongMeters - a.endAlongMeters)[0];
      const rightUnit = keptUnits
        .filter((unit) => unit.startAlongMeters >= opening.roughEndAlongMeters)
        .sort((a, b) => a.startAlongMeters - b.startAlongMeters)[0];

      closures.push(
        makeOpeningClosure({
          opening,
          course,
          courseBottom,
          courseTop,
          side: 'left',
          roughOpeningEdge: opening.roughStartAlongMeters,
          nearestBlockEdge: leftUnit?.endAlongMeters ?? 0,
          moduleLength: params.moduleLength,
          wallThickness,
          courseHeight: params.moduleHeight,
          fillFactor,
          wasteMultiplier,
          groutEnabled: opening.jambGroutEnabled,
        }),
        makeOpeningClosure({
          opening,
          course,
          courseBottom,
          courseTop,
          side: 'right',
          roughOpeningEdge: opening.roughEndAlongMeters,
          nearestBlockEdge: rightUnit?.startAlongMeters ?? wallLength,
          moduleLength: params.moduleLength,
          wallThickness,
          courseHeight: params.moduleHeight,
          fillFactor,
          wasteMultiplier,
          groutEnabled: opening.jambGroutEnabled,
        }),
      );
    }
  });

  return closures;
}

function makeOpeningClosure(params: {
  opening: ResolvedCmuOpening;
  course: number;
  courseBottom: number;
  courseTop: number;
  side: 'left' | 'right';
  roughOpeningEdge: number;
  nearestBlockEdge: number;
  moduleLength: number;
  wallThickness: number;
  courseHeight: number;
  fillFactor: number;
  wasteMultiplier: number;
  groutEnabled: boolean;
}): CmuOpeningCourseClosure {
  const residualGap = Math.max(0, Math.abs(params.roughOpeningEdge - params.nearestBlockEdge));
  const closureType = classifyClosureGap(residualGap, params.moduleLength, params.groutEnabled);
  const groutVolume =
    closureType === 'grout_fill'
      ? residualGap * params.wallThickness * params.courseHeight * params.fillFactor * params.wasteMultiplier
      : 0;
  const warning =
    closureType === 'cut_block'
      ? `Opening ${params.opening.id} creates non-modular jamb cuts on course ${params.course + 1}.`
      : closureType === 'grout_fill'
        ? `Opening ${params.opening.id} uses grout-fill closure on course ${params.course + 1}.`
        : undefined;

  return {
    openingId: params.opening.id,
    wallFace: params.opening.wallFace ?? 'north',
    courseIndex: params.course,
    courseBottom: params.courseBottom,
    courseTop: params.courseTop,
    side: params.side,
    roughOpeningEdge: params.roughOpeningEdge,
    nearestBlockEdge: params.nearestBlockEdge,
    residualGap,
    closureType,
    suggestedUnitType: suggestedUnitTypeForClosure(closureType),
    groutVolume,
    warning,
  };
}

function classifyClosureGap(
  residualGap: number,
  moduleLength: number,
  groutEnabled: boolean,
): CmuOpeningClosureType {
  const tolerance = Math.max(0.006, moduleLength * 0.025);
  const halfModule = moduleLength / 2;
  if (residualGap <= tolerance) return 'none';
  if (residualGap <= moduleLength * 0.08) return 'shim_gap';
  if (Math.abs(residualGap - halfModule) <= tolerance) return 'half_block';
  if (Math.abs(residualGap - moduleLength) <= tolerance) return 'jamb_block';
  if (groutEnabled && residualGap <= moduleLength * 0.35) return 'grout_fill';
  return 'cut_block';
}

function suggestedUnitTypeForClosure(closureType: CmuOpeningClosureType): string | undefined {
  switch (closureType) {
    case 'half_block':
      return 'half block';
    case 'end_block':
      return 'end block';
    case 'jamb_block':
      return 'jamb block';
    case 'cut_block':
      return 'cut block';
    case 'grout_fill':
      return 'grout/closure fill';
    case 'shim_gap':
      return 'shim/mortar pack';
    case 'none':
    default:
      return undefined;
  }
}

function buildLayoutOpeningGroutSummary(params: {
  params: CmuWallSystemParameters;
  base: CmuOpeningGroutSummary;
  jambGroutCells: readonly CmuJambGroutCellInstance[];
  openingCourseClosures: readonly CmuOpeningCourseClosure[];
  moduleHeight: number;
}): CmuOpeningGroutSummary {
  const moduleConfig = resolveCmuModuleConfig(params.params);
  const wallThickness = Math.max(0, params.params.wallThicknessMeters);
  const fillFactor = Math.max(0, Math.min(1, params.params.coreFillFactor ?? 0.5));
  const wasteMultiplier = 1 + Math.max(0, params.params.groutWastePercent ?? 0.1);
  const cellCoreArea = moduleConfig.moduleLengthMeters * wallThickness * fillFactor;
  const jambGroutVolumeCubicMeters = params.jambGroutCells.reduce(
    (sum, cell) => sum + cellCoreArea * cell.heightMeters * wasteMultiplier,
    0,
  );
  const closureGroutVolumeCubicMeters = params.openingCourseClosures.reduce(
    (sum, closure) => sum + (closure.closureType === 'grout_fill' ? closure.groutVolume ?? 0 : 0),
    0,
  );
  const courseClosureCutBlockCount = params.openingCourseClosures.filter(
    (closure) => closure.closureType === 'cut_block',
  ).length;

  return {
    ...params.base,
    jambGroutCellCount: params.jambGroutCells.length,
    jambGroutVolumeCubicMeters,
    closureGroutVolumeCubicMeters,
    courseClosureCutBlockCount,
    totalGroutVolumeCubicMeters:
      jambGroutVolumeCubicMeters +
      closureGroutVolumeCubicMeters +
      params.base.lintelGroutVolumeCubicMeters +
      params.base.bondBeamGroutVolumeCubicMeters,
    warnings: [
      ...new Set([
        ...params.base.warnings,
        'Jamb grout volume is based on selected grouted cells and course closure conditions, not the full rough opening area.',
        ...params.openingCourseClosures.flatMap((closure) => (closure.warning ? [closure.warning] : [])),
      ]),
    ],
  };
}

function makeCourseUnit(
  unitType: CmuCourseUnit['unitType'],
  moduleStart: number,
  moduleSpan: number,
  actualLength: number,
  wallLength: number,
): CmuCourseUnit {
  const inset = Math.max(0, moduleSpan - actualLength) / 2;
  const startAlongMeters = moduleStart + inset;
  const endAlongMeters = Math.min(wallLength, moduleStart + moduleSpan - inset);
  return {
    unitType,
    startAlongMeters,
    endAlongMeters,
    lengthMeters: Math.max(0.02, endAlongMeters - startAlongMeters),
  };
}

function addJambBlocks({
  params,
  moduleLength,
  actualHeight,
  wall,
  course,
  band,
  blocks,
  counts,
  jambKeys,
}: {
  params: CmuWallSystemParameters;
  moduleLength: number;
  actualHeight: number;
  wall: { face: CmuBlockInstanceWallFace; length: number; x?: number; z?: number; rotationY: number };
  course: number;
  band: { startAlongMeters: number; endAlongMeters: number; bottomMeters: number; topMeters: number };
  blocks: CmuBlockInstance[];
  counts: Record<CmuBlockType, number>;
  jambKeys: Set<string>;
}) {
  const opening = resolveCmuOpenings(params).find((item) => {
    if (item.wallFace !== wall.face) return false;
    return (
      band.startAlongMeters < item.roughEndAlongMeters &&
      band.endAlongMeters > item.roughStartAlongMeters &&
      band.bottomMeters < item.roughTopMeters &&
      band.topMeters > item.roughBottomMeters
    );
  });
  if (!opening) return;

  const moduleHeight = resolveCmuModuleConfig(params).moduleHeightMeters;
  const y = course * moduleHeight + actualHeight / 2;
  const jambPositions = [opening.roughStartAlongMeters, opening.roughEndAlongMeters];
  jambPositions.forEach((along, index) => {
    const key = `${wall.face}-${opening.id}-${course}-${index}`;
    if (jambKeys.has(key)) return;
    jambKeys.add(key);
    if (along < 0 || along > wall.length) return;
    const centeredAlong = along - wall.length / 2;
    const x = 'x' in wall ? wall.x ?? centeredAlong : centeredAlong;
    const z = 'z' in wall ? wall.z ?? centeredAlong : centeredAlong;
    blocks.push({
      id: `${wall.face}-jamb-${opening.id}-${course}-${index}`,
      face: wall.face,
      course,
      blockType: 'jamb',
      x,
      y,
      z,
      rotationY: wall.rotationY,
      lengthMeters: moduleLength / 2,
      startAlongMeters: Math.max(0, along - moduleLength / 4),
      endAlongMeters: Math.min(wall.length, along + moduleLength / 4),
    });
    counts.jamb += 1;
  });
}

function generateLintelInstances(
  params: CmuWallSystemParameters,
  moduleConfig: ReturnType<typeof resolveCmuModuleConfig>,
  openings: readonly ResolvedCmuOpening[],
): CmuLintelInstance[] {
  if ((params.lintelType ?? 'bond_beam') === 'none') return [];
  return openings
    .filter((opening) => opening.lintelType !== 'none')
    .map((opening) => {
    const wallFace = opening.wallFace ?? 'north';
    const wallLength = wallFace === 'north' || wallFace === 'south'
      ? params.lengthMeters
      : params.widthMeters;
    const length = Math.min(wallLength, opening.lintelLengthMeters);
    const along = (opening.roughStartAlongMeters + opening.roughEndAlongMeters) / 2;
    const centeredAlong = along - wallLength / 2;
    const y = opening.roughTopMeters + opening.lintelHeightMeters / 2;
    const rotationY = wallFace === 'east' || wallFace === 'west' ? Math.PI / 2 : 0;
    const x = wallFace === 'east'
      ? params.lengthMeters / 2
      : wallFace === 'west'
        ? -params.lengthMeters / 2
        : centeredAlong;
    const z = wallFace === 'north'
      ? -params.widthMeters / 2
      : wallFace === 'south'
        ? params.widthMeters / 2
        : centeredAlong;
    return {
      id: `lintel-${opening.id}`,
      face: wallFace,
      openingId: opening.id,
      x,
      y,
      z,
      rotationY,
      lengthMeters: length,
      heightMeters: opening.lintelHeightMeters || moduleConfig.moduleHeightMeters,
    };
  });
}

function generateJambGroutCellInstances(
  params: CmuWallSystemParameters,
  openings: readonly ResolvedCmuOpening[],
  courseCount: number,
): CmuJambGroutCellInstance[] {
  const moduleConfig = resolveCmuModuleConfig(params);
  const cellWidth = moduleConfig.moduleLengthMeters;
  const cellHeight = moduleConfig.moduleHeightMeters;
  const cells: CmuJambGroutCellInstance[] = [];

  openings.forEach((opening) => {
    if (!opening.jambGroutEnabled || opening.groutCellsEachSide <= 0) return;
    const wallFace = opening.wallFace ?? 'north';
    const wallLength = wallFace === 'north' || wallFace === 'south'
      ? params.lengthMeters
      : params.widthMeters;
    const rotationY = wallFace === 'east' || wallFace === 'west' ? Math.PI / 2 : 0;
    const sides = [
      { side: 'left', edge: opening.roughStartAlongMeters, direction: -1 },
      { side: 'right', edge: opening.roughEndAlongMeters, direction: 1 },
    ] as const;

    for (let course = 0; course < courseCount; course += 1) {
      const courseBottom = course * cellHeight;
      const courseTop = courseBottom + cellHeight;
      if (courseBottom >= opening.roughTopMeters || courseTop <= opening.roughBottomMeters) continue;
      const y = courseBottom + cellHeight / 2;
      sides.forEach((side) => {
        for (let index = 0; index < opening.groutCellsEachSide; index += 1) {
          const centerAlong = side.edge + side.direction * (index + 0.5) * cellWidth;
          if (centerAlong < 0 || centerAlong > wallLength) continue;
          const centeredAlong = centerAlong - wallLength / 2;
          const x = wallFace === 'east'
            ? params.lengthMeters / 2
            : wallFace === 'west'
              ? -params.lengthMeters / 2
              : centeredAlong;
          const z = wallFace === 'north'
            ? -params.widthMeters / 2
            : wallFace === 'south'
              ? params.widthMeters / 2
              : centeredAlong;

          cells.push({
            id: `jamb-grout-${opening.id}-${side.side}-${index}-course-${course}`,
            face: wallFace,
            openingId: opening.id,
            courseIndex: course,
            x,
            y,
            z,
            rotationY,
            heightMeters: cellHeight,
            widthMeters: cellWidth,
          });
        }
      });
    }
  });

  return cells;
}

function generatePilasterInstances(params: CmuWallSystemParameters): CmuPilasterInstance[] {
  if (!params.pilasterEnabled) return [];
  const positions: CmuPilasterInstance[] = [];
  const corners = [
    { id: 'north-west', x: -params.lengthMeters / 2, z: -params.widthMeters / 2, face: 'north' as const, rotationY: 0 },
    { id: 'north-east', x: params.lengthMeters / 2, z: -params.widthMeters / 2, face: 'north' as const, rotationY: 0 },
    { id: 'south-west', x: -params.lengthMeters / 2, z: params.widthMeters / 2, face: 'south' as const, rotationY: 0 },
    { id: 'south-east', x: params.lengthMeters / 2, z: params.widthMeters / 2, face: 'south' as const, rotationY: 0 },
  ];
  corners.forEach((corner) => {
    positions.push({
      id: `pilaster-${corner.id}`,
      face: corner.face,
      x: corner.x,
      y: params.heightMeters / 2,
      z: corner.z,
      rotationY: corner.rotationY,
      heightMeters: params.heightMeters,
    });
  });
  params.openings.forEach((opening) => {
    const wallFace = opening.wallFace ?? 'north';
    const offsetMeters = opening.offsetMeters ?? opening.positionAlongSegment ?? 0;
    const wallLength = wallFace === 'north' || wallFace === 'south' ? params.lengthMeters : params.widthMeters;
    [offsetMeters, offsetMeters + opening.widthMeters].forEach((along, index) => {
      const centeredAlong = along - wallLength / 2;
      const x = wallFace === 'east'
        ? params.lengthMeters / 2
        : wallFace === 'west'
          ? -params.lengthMeters / 2
          : centeredAlong;
      const z = wallFace === 'north'
        ? -params.widthMeters / 2
        : wallFace === 'south'
          ? params.widthMeters / 2
          : centeredAlong;
      positions.push({
        id: `pilaster-${opening.id}-${index}`,
        face: wallFace,
        x,
        y: params.heightMeters / 2,
        z,
        rotationY: wallFace === 'east' || wallFace === 'west' ? Math.PI / 2 : 0,
        heightMeters: params.heightMeters,
      });
    });
  });
  return positions;
}

function moduleFitWarnings(fits: ReturnType<typeof summarizeWallModuleFits>): string[] {
  return Object.entries(fits)
    .filter(([, fit]) => fit.fit === 'cut')
    .map(([face, fit]) => `${face} wall creates cut blocks. Suggested clean lengths: ${fit.suggestedLengthsMeters.join('m or ')}m.`);
}
