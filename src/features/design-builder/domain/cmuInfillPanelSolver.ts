import type {
  CmuInfillPanel,
  CmuWallSystemParameters,
  DesignWallLayoutParameters,
  StructuralBeam,
  StructuralColumn,
} from '../types';
import { resolveCmuModuleDefinition } from './cmuModuleRules';
import { resolveDesignMasonrySettings } from './masonrySettings';
import {
  columnInsideFaceStationOnSegment,
  findColumnAtNode,
} from './structuralFrameLayout';
import type { CmuBlockInstance, SegmentFrame } from '../geometry/designGeometry';

export type InfillPanelSolveResult = {
  panel: CmuInfillPanel;
  blocks: CmuBlockInstance[];
  fullBlockCount: number;
  halfBlockCount: number;
  cutBlockCount: number;
};

function panelId(segmentId: string, index: number): string {
  return `infill-${segmentId}-${index}`;
}

function blockFromPanelUnit(params: {
  panel: CmuInfillPanel;
  frame: SegmentFrame;
  courseIndex: number;
  moduleIndex: number;
  stationMeters: number;
  unitLengthMeters: number;
  moduleHeightMeters: number;
  blockType: CmuBlockInstance['blockType'];
}): CmuBlockInstance {
  const centerStation = params.stationMeters + params.unitLengthMeters / 2;
  const y =
    params.panel.bottomElevationMeters +
    params.courseIndex * params.moduleHeightMeters +
    params.moduleHeightMeters / 2;
  return {
    id: `${params.panel.id}-c${params.courseIndex}-m${params.moduleIndex}`,
    face: 'north',
    segmentId: params.panel.hostSegmentId,
    course: params.courseIndex + 1,
    courseIndex: params.courseIndex,
    moduleIndex: params.moduleIndex,
    blockType: params.blockType,
    unitType: params.blockType === 'half' ? 'half_block' : params.blockType === 'cut' ? 'cut_block' : 'full_block',
    stationMeters: params.stationMeters,
    nominalLengthMeters: params.unitLengthMeters,
    actualLengthMeters: params.unitLengthMeters,
    heightMeters: params.moduleHeightMeters,
    depthMeters: params.frame.wallThicknessMeters,
    source: 'infill_panel_solver',
    x:
      params.frame.start.x +
      params.frame.tangent.x * centerStation +
      params.frame.inwardNormal.x * (params.frame.wallThicknessMeters / 2),
    y,
    z:
      params.frame.start.z +
      params.frame.tangent.z * centerStation +
      params.frame.inwardNormal.z * (params.frame.wallThicknessMeters / 2),
    rotationY: params.frame.rotationY,
    lengthMeters: params.unitLengthMeters,
  };
}

export function deriveInfillPanelsForSegment(params: {
  segmentId: string;
  segment: { startNodeId: string; endNodeId: string; wallHeightMeters: number };
  frame: SegmentFrame;
  columns: StructuralColumn[];
  beams: StructuralBeam[];
  wall: CmuWallSystemParameters;
  gradeBeamTopMeters: number;
  ringBeamBaseMeters: number;
}): CmuInfillPanel[] {
  const startCol = findColumnAtNode(params.columns, params.segment.startNodeId);
  const endCol = findColumnAtNode(params.columns, params.segment.endNodeId);
  const leftStation = startCol
    ? columnInsideFaceStationOnSegment(startCol, params.frame, 'start')
    : 0;
  const rightStation = endCol
    ? columnInsideFaceStationOnSegment(endCol, params.frame, 'end')
    : params.frame.lengthMeters;
  if (rightStation - leftStation <= 0.05) return [];
  const masonrySettings = resolveDesignMasonrySettings(params.wall);
  return [
    {
      id: panelId(params.segmentId, 0),
      hostSegmentId: params.segmentId,
      leftSupportType: startCol ? 'column' : 'wall_end',
      leftSupportId: startCol?.id,
      rightSupportType: endCol ? 'column' : 'wall_end',
      rightSupportId: endCol?.id,
      bottomSupportType: 'grade_beam',
      bottomSupportId: params.beams.find(
        (b) => b.kind === 'grade_beam' && b.hostSegmentId === params.segmentId,
      )?.id,
      topSupportType: 'ring_beam',
      topSupportId: params.beams.find(
        (b) => b.kind === 'ring_beam' && b.hostSegmentId === params.segmentId,
      )?.id,
      startStationMeters: leftStation,
      endStationMeters: rightStation,
      bottomElevationMeters: params.gradeBeamTopMeters,
      topElevationMeters: params.ringBeamBaseMeters,
      masonrySettings: {
        blockModule: masonrySettings.blockModule,
        bondPattern: masonrySettings.bondPattern,
        snapToModule: masonrySettings.snapToModule,
        wasteFactor: masonrySettings.wasteFactor,
      },
    },
  ];
}

export function deriveInfillPanelsForLayout(params: {
  layout: DesignWallLayoutParameters;
  segmentFrames: SegmentFrame[];
  columns: StructuralColumn[];
  beams: StructuralBeam[];
  wall: CmuWallSystemParameters;
}): CmuInfillPanel[] {
  const gradeBeam = params.beams.find((b) => b.kind === 'grade_beam');
  const ringBeam = params.beams.find((b) => b.kind === 'ring_beam');
  const gradeTop = gradeBeam?.topElevationMeters ?? 0.45;
  const ringBase = ringBeam?.baseElevationMeters ?? params.layout.defaultWallHeightMeters - 0.3;
  const panels: CmuInfillPanel[] = [];
  for (const seg of params.layout.segments) {
    const frame = params.segmentFrames.find((f) => f.segmentId === seg.id);
    if (!frame) continue;
    panels.push(
      ...deriveInfillPanelsForSegment({
        segmentId: seg.id,
        segment: seg,
        frame,
        columns: params.columns,
        beams: params.beams,
        wall: params.wall,
        gradeBeamTopMeters: gradeTop,
        ringBeamBaseMeters: ringBase,
      }),
    );
  }
  return panels;
}

export function solveInfillPanelBlocks(params: {
  panel: CmuInfillPanel;
  frame: SegmentFrame;
  wall: CmuWallSystemParameters;
}): InfillPanelSolveResult {
  const module = resolveCmuModuleDefinition(params.wall);
  const panelHeight = params.panel.topElevationMeters - params.panel.bottomElevationMeters;
  const courseCount = Math.max(0, Math.floor(panelHeight / module.nominalModuleHeightMeters));
  const bondPattern = params.panel.masonrySettings.bondPattern ?? 'running_bond';
  const blocks: CmuBlockInstance[] = [];
  let fullBlockCount = 0;
  let halfBlockCount = 0;
  let cutBlockCount = 0;

  for (let courseIndex = 0; courseIndex < courseCount; courseIndex += 1) {
    const coursePhase = bondPattern === 'running_bond' ? courseIndex % 2 : 0;
    const jointOffset = coursePhase === 1 ? module.nominalModuleLengthMeters / 2 : 0;
    let station = params.panel.startStationMeters + jointOffset;
    const maxStation = params.panel.endStationMeters;
    let moduleIndex = 0;
    while (station < maxStation - 0.001) {
      const remaining = maxStation - station;
      let unitLength = module.nominalModuleLengthMeters;
      let blockType: CmuBlockInstance['blockType'] = 'stretcher';
      if (remaining < module.nominalModuleLengthMeters - 0.005) {
        if (remaining >= module.nominalModuleLengthMeters / 2 - 0.005) {
          unitLength = module.nominalModuleLengthMeters / 2;
          blockType = 'half';
          halfBlockCount += 1;
        } else if (remaining >= 0.08) {
          unitLength = remaining;
          blockType = 'cut';
          cutBlockCount += 1;
        } else {
          break;
        }
      } else {
        fullBlockCount += 1;
      }
      blocks.push(
        blockFromPanelUnit({
          panel: params.panel,
          frame: params.frame,
          courseIndex,
          moduleIndex,
          stationMeters: station,
          unitLengthMeters: unitLength,
          moduleHeightMeters: module.nominalModuleHeightMeters,
          blockType,
        }),
      );
      station += unitLength;
      moduleIndex += 1;
    }
  }

  return {
    panel: params.panel,
    blocks,
    fullBlockCount,
    halfBlockCount,
    cutBlockCount,
  };
}

export function panelClearWidthMeters(panel: CmuInfillPanel): number {
  return Math.max(0, panel.endStationMeters - panel.startStationMeters);
}
