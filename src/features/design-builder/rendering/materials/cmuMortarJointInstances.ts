import type { CmuBlockInstance } from '../../geometry/designGeometry';

export const MORTAR_FACE_RECESS_METERS = 0.002;
export const MIN_MORTAR_JOINT_METERS = 0.001;
export const JOINT_EPSILON_METERS = 0.002;

export type MortarJointKind = 'head' | 'bed';

export type MortarEligibleBlockSource =
  | 'wall'
  | 'wall_run'
  | 'corner_assembly'
  | 'opening_closure'
  | 'terminal_closure'
  | 'auto_layout'
  | 'closed_perimeter_solver'
  | 'manual_override'
  | 'opening_assembly_solver'
  | 'opening_jamb_closure'
  | 'lintel_closure'
  | 'infill_panel_solver'
  | 'panel_top_closure'
  | 'gable_end_solver'
  | 'rc_frame_infill'
  | 'below_grade_rc_infill';

export type MortarInfillBand = 'above_grade' | 'below_grade' | 'gable' | 'main';

export type MortarJointInstance = {
  kind: MortarJointKind;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  valid: boolean;
  zeroGapFallback?: boolean;
};

export type MortarJointDiagnostics = {
  eligibleBlockCount: number;
  rowGroupCount: number;
  headJointCandidateCount: number;
  headJointCount: number;
  zeroGapFallbackCount: number;
  bedJointCount: number;
  skippedOpeningGaps: number;
  skippedNonContiguousGaps: number;
  invalidJointCount: number;
  faceRecessMeters: number;
};

export type GenerateMortarJointInstancesParams = {
  blocks: readonly CmuBlockInstance[];
  mortarJointMeters: number;
  defaultBlockDepthMeters: number;
  defaultBlockHeightMeters: number;
};

const EXCLUDED_BLOCK_SOURCES = new Set<string>(['lintel_bond_beam']);

function wallTangent(rotationY: number): { x: number; z: number } {
  return { x: Math.cos(rotationY), z: -Math.sin(rotationY) };
}

function resolveBlockSpan(block: CmuBlockInstance): { start: number; end: number } {
  const start = block.startAlongMeters ?? block.stationMeters ?? 0;
  const end =
    block.endAlongMeters ??
    start + (block.nominalLengthMeters ?? block.actualLengthMeters ?? block.lengthMeters);
  return { start, end };
}

function resolveBlockHeight(block: CmuBlockInstance, fallbackMeters: number): number {
  return block.physicalHeightMeters ?? block.heightMeters ?? fallbackMeters;
}

function resolveBlockDepth(block: CmuBlockInstance, fallbackMeters: number): number {
  return block.depthMeters ?? fallbackMeters;
}

function positionAtStation(
  block: CmuBlockInstance,
  stationMeters: number,
  y: number,
): { x: number; y: number; z: number } {
  const span = resolveBlockSpan(block);
  const blockCenterStation = (span.start + span.end) / 2;
  const delta = stationMeters - blockCenterStation;
  const tangent = wallTangent(block.rotationY);
  return {
    x: block.x + tangent.x * delta,
    y,
    z: block.z + tangent.z * delta,
  };
}

export function deriveMortarInfillBand(block: CmuBlockInstance): MortarInfillBand {
  if (block.infillBand) {
    return block.infillBand;
  }
  if (block.source === 'gable_end_solver') {
    return 'gable';
  }
  if (block.source === 'below_grade_rc_infill') {
    return 'below_grade';
  }
  if (block.source === 'rc_frame_infill' || block.source === 'infill_panel_solver' || block.source === 'panel_top_closure') {
    return 'above_grade';
  }
  return 'main';
}

export function courseGroupKey(block: CmuBlockInstance): string {
  const hostSegmentId = block.segmentId ?? block.face;
  const wallFace = block.wallFace ?? block.face;
  const infillBand = deriveMortarInfillBand(block);
  const courseIndex = block.courseIndex ?? block.course ?? 0;
  return [hostSegmentId, wallFace, infillBand, courseIndex].join(':');
}

export function shouldParticipateInMortar(block: CmuBlockInstance): boolean {
  if (block.blockType === 'lintel_bond_beam') return false;
  if (block.source && EXCLUDED_BLOCK_SOURCES.has(block.source)) return false;
  return true;
}

function maxHeadJointMeters(mortarJointMeters: number): number {
  return Math.max(mortarJointMeters * 1.5, 0.025);
}

function buildContiguousRuns(
  blocks: readonly CmuBlockInstance[],
  maxHeadGapMeters: number,
): { runs: CmuBlockInstance[][]; skippedNonContiguousGaps: number } {
  const sorted = [...blocks].sort((left, right) => resolveBlockSpan(left).start - resolveBlockSpan(right).start);
  const runs: CmuBlockInstance[][] = [];
  let skippedNonContiguousGaps = 0;
  let currentRun: CmuBlockInstance[] = [];

  sorted.forEach((block) => {
    if (currentRun.length === 0) {
      currentRun.push(block);
      return;
    }
    const previous = currentRun[currentRun.length - 1];
    const gap = resolveBlockSpan(block).start - resolveBlockSpan(previous).end;
    if (gap > maxHeadGapMeters) {
      skippedNonContiguousGaps += 1;
      runs.push(currentRun);
      currentRun = [block];
      return;
    }
    currentRun.push(block);
  });

  if (currentRun.length > 0) {
    runs.push(currentRun);
  }

  return { runs, skippedNonContiguousGaps };
}

function createHeadJointInstance(params: {
  previous: CmuBlockInstance;
  next: CmuBlockInstance;
  rotationY: number;
  centerStation: number;
  jointWidth: number;
  mortarDepth: number;
  defaultBlockHeightMeters: number;
  zeroGapFallback?: boolean;
}): MortarJointInstance {
  const headHeight = Math.min(
    resolveBlockHeight(params.previous, params.defaultBlockHeightMeters),
    resolveBlockHeight(params.next, params.defaultBlockHeightMeters),
  );
  const centerY = (params.previous.y + params.next.y) / 2;
  return {
    kind: 'head',
    ...positionAtStation(params.previous, params.centerStation, centerY),
    rotationY: params.rotationY,
    scaleX: Math.max(MIN_MORTAR_JOINT_METERS, params.jointWidth),
    scaleY: headHeight,
    scaleZ: params.mortarDepth,
    valid: true,
    zeroGapFallback: params.zeroGapFallback,
  };
}

export function generateMortarJointInstances(
  params: GenerateMortarJointInstancesParams,
): { instances: MortarJointInstance[]; diagnostics: MortarJointDiagnostics } {
  const {
    blocks,
    mortarJointMeters,
    defaultBlockDepthMeters,
    defaultBlockHeightMeters,
  } = params;
  const maxHeadGapMeters = maxHeadJointMeters(mortarJointMeters);
  const instances: MortarJointInstance[] = [];
  let skippedOpeningGaps = 0;
  let skippedNonContiguousGaps = 0;
  let invalidJointCount = 0;
  let headJointCount = 0;
  let zeroGapFallbackCount = 0;
  let bedJointCount = 0;
  let headJointCandidateCount = 0;
  let eligibleBlockCount = 0;

  const grouped = new Map<string, CmuBlockInstance[]>();
  blocks.forEach((block) => {
    if (!shouldParticipateInMortar(block)) return;
    eligibleBlockCount += 1;
    const key = courseGroupKey(block);
    const existing = grouped.get(key) ?? [];
    existing.push(block);
    grouped.set(key, existing);
  });

  grouped.forEach((courseBlocks) => {
    const { runs, skippedNonContiguousGaps: skippedRuns } = buildContiguousRuns(
      courseBlocks,
      maxHeadGapMeters,
    );
    skippedNonContiguousGaps += skippedRuns;

    runs.forEach((run) => {
      if (run.length === 0) return;
      const referenceBlock = run[0];
      const rotationY = referenceBlock.rotationY;
      const blockDepth = resolveBlockDepth(referenceBlock, defaultBlockDepthMeters);
      const mortarDepth = Math.max(
        MIN_MORTAR_JOINT_METERS,
        blockDepth - MORTAR_FACE_RECESS_METERS * 2,
      );

      for (let index = 0; index < run.length - 1; index += 1) {
        const previous = run[index];
        const next = run[index + 1];
        const gapStart = resolveBlockSpan(previous).end;
        const gapEnd = resolveBlockSpan(next).start;
        const actualGapMeters = gapEnd - gapStart;
        headJointCandidateCount += 1;

        if (actualGapMeters < -JOINT_EPSILON_METERS) {
          invalidJointCount += 1;
          instances.push({
            kind: 'head',
            ...positionAtStation(previous, (gapStart + gapEnd) / 2, (previous.y + next.y) / 2),
            rotationY,
            scaleX: Math.max(MIN_MORTAR_JOINT_METERS, Math.abs(actualGapMeters)),
            scaleY: Math.max(
              MIN_MORTAR_JOINT_METERS,
              Math.min(
                resolveBlockHeight(previous, defaultBlockHeightMeters),
                resolveBlockHeight(next, defaultBlockHeightMeters),
              ),
            ),
            scaleZ: mortarDepth,
            valid: false,
          });
          continue;
        }

        if (Math.abs(actualGapMeters) <= JOINT_EPSILON_METERS) {
          instances.push(
            createHeadJointInstance({
              previous,
              next,
              rotationY,
              centerStation: gapStart,
              jointWidth: mortarJointMeters,
              mortarDepth,
              defaultBlockHeightMeters,
              zeroGapFallback: true,
            }),
          );
          headJointCount += 1;
          zeroGapFallbackCount += 1;
          continue;
        }

        if (actualGapMeters > maxHeadGapMeters) {
          skippedOpeningGaps += 1;
          continue;
        }

        instances.push(
          createHeadJointInstance({
            previous,
            next,
            rotationY,
            centerStation: (gapStart + gapEnd) / 2,
            jointWidth: actualGapMeters,
            mortarDepth,
            defaultBlockHeightMeters,
          }),
        );
        headJointCount += 1;
      }

      const runStart = resolveBlockSpan(run[0]).start;
      const runEnd = resolveBlockSpan(run[run.length - 1]).end;
      const runLength = runEnd - runStart;
      if (runLength <= MIN_MORTAR_JOINT_METERS) return;

      const bedReference = run[0];
      const bedHeight = resolveBlockHeight(bedReference, defaultBlockHeightMeters);
      const bedBottomY = bedReference.y - bedHeight / 2;
      const bedCenterY = bedBottomY - mortarJointMeters / 2;

      instances.push({
        kind: 'bed',
        ...positionAtStation(bedReference, (runStart + runEnd) / 2, bedCenterY),
        rotationY,
        scaleX: runLength,
        scaleY: mortarJointMeters,
        scaleZ: mortarDepth,
        valid: true,
      });
      bedJointCount += 1;
    });
  });

  return {
    instances,
    diagnostics: {
      eligibleBlockCount,
      rowGroupCount: grouped.size,
      headJointCandidateCount,
      headJointCount,
      zeroGapFallbackCount,
      bedJointCount,
      skippedOpeningGaps,
      skippedNonContiguousGaps,
      invalidJointCount,
      faceRecessMeters: MORTAR_FACE_RECESS_METERS,
    },
  };
}
