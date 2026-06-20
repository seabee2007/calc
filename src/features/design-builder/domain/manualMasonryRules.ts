import type {
  CmuWallSystemParameters,
  ManualMasonryPlacementPreview,
  MasonryCourseRun,
  MasonryToolMode,
  MasonryUnitType,
} from '../types';
import { resolveCmuModuleConfig } from './cmuModuleRules';

export const MANUAL_MASONRY_SEGMENT_ID = 'manual-plan-course';

export function createMasonryRunId(): string {
  return `masonry-run-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
}

export function masonryToolToUnitType(tool: MasonryToolMode): MasonryUnitType | null {
  if (tool === 'full_block') return 'full_block';
  if (tool === 'half_block') return 'half_block';
  if (tool === 'end_block') return 'end_block';
  if (tool === 'jamb_block') return 'jamb_block';
  if (tool === 'bond_beam_block') return 'bond_beam_block';
  if (tool === 'grout_rebar_cell') return 'grout_rebar_cell';
  return null;
}

export function unitModuleSpan(unitType: MasonryUnitType): number {
  return unitType === 'half_block' ? 0.5 : 1;
}

export function snapManualMasonryPoint(
  point: { x: number; z: number },
  wall: CmuWallSystemParameters,
): { x: number; z: number; moduleIndex: number } {
  const module = resolveCmuModuleConfig(wall);
  const moduleLength = module.moduleLengthMeters || wall.blockLengthMeters || 0.4;
  const moduleDepth = module.nominalDepthMeters || wall.wallThicknessMeters || 0.19;
  const moduleIndex = Math.round(point.x / moduleLength);
  const rowIndex = Math.round(point.z / moduleDepth);
  return {
    x: moduleIndex * moduleLength,
    z: rowIndex * moduleDepth,
    moduleIndex,
  };
}

export function createManualMasonryPreview(params: {
  start: { x: number; z: number };
  current: { x: number; z: number };
  wall: CmuWallSystemParameters;
  tool: MasonryToolMode;
}): ManualMasonryPlacementPreview | null {
  const unitType = masonryToolToUnitType(params.tool);
  if (!unitType) return null;
  const module = resolveCmuModuleConfig(params.wall);
  const moduleLength = module.moduleLengthMeters || params.wall.blockLengthMeters || 0.4;
  const start = snapManualMasonryPoint(params.start, params.wall);
  const current = snapManualMasonryPoint(params.current, params.wall);
  const deltaX = current.x - start.x;
  const deltaZ = current.z - start.z;
  const axis: 'x' | 'z' = Math.abs(deltaZ) > Math.abs(deltaX) ? 'z' : 'x';
  const deltaModules = axis === 'x'
    ? Math.round(deltaX / moduleLength)
    : Math.round(deltaZ / moduleLength);
  const direction = deltaModules < 0 ? -1 : 1;
  const span = unitModuleSpan(unitType);
  const count = Math.max(1, Math.floor(Math.abs(deltaModules) / span) + 1);
  const startModuleIndex = direction < 0 ? start.moduleIndex - Math.ceil((count - 1) * span) : start.moduleIndex;
  const orientation = axis === 'x'
    ? direction < 0 ? 'west' : 'east'
    : direction < 0 ? 'north' : 'south';
  return {
    originX: axis === 'x' ? startModuleIndex * moduleLength : start.x,
    originZ: axis === 'z' ? start.z + (direction < 0 ? -Math.ceil((count - 1) * span) * moduleLength : 0) : start.z,
    courseIndex: 0,
    startModuleIndex,
    unitType,
    count,
    orientation,
    valid: true,
  };
}

export function commitManualMasonryRun(
  preview: ManualMasonryPlacementPreview,
  wall?: CmuWallSystemParameters,
): MasonryCourseRun {
  const module = wall ? resolveCmuModuleConfig(wall) : null;
  const moduleLengthMeters = (module?.moduleLengthMeters ?? wall?.blockLengthMeters ?? 0.4) * unitModuleSpan(preview.unitType);
  const moduleHeightMeters = module?.moduleHeightMeters ?? wall?.blockHeightMeters ?? 0.2;
  const wallThicknessMeters = module?.nominalDepthMeters ?? wall?.wallThicknessMeters ?? 0.19;
  const tangent = preview.orientation === 'west'
    ? { x: -1, z: 0 }
    : preview.orientation === 'north'
      ? { x: 0, z: -1 }
      : preview.orientation === 'south'
        ? { x: 0, z: 1 }
        : { x: 1, z: 0 };
  return {
    id: createMasonryRunId(),
    wallSegmentId: MANUAL_MASONRY_SEGMENT_ID,
    origin: { x: preview.originX, y: preview.courseIndex * moduleHeightMeters, z: preview.originZ },
    tangent,
    courseIndex: preview.courseIndex,
    startModuleIndex: preview.startModuleIndex,
    unitType: preview.unitType,
    count: preview.count,
    moduleLengthMeters,
    moduleHeightMeters,
    wallThicknessMeters,
    direction: preview.orientation === 'west' || preview.orientation === 'north' ? 'reverse' : 'forward',
    source: 'manual_3d_brush',
    originX: preview.originX,
    originZ: preview.originZ,
    orientation: preview.orientation,
  };
}

export function removeLatestManualMasonryRun(runs: readonly MasonryCourseRun[]): MasonryCourseRun[] {
  return runs.slice(0, -1);
}

export function summarizeManualMasonryRuns(runs: readonly MasonryCourseRun[]) {
  return runs.reduce(
    (summary, run) => {
      summary.total += run.count;
      summary[run.unitType] += run.count;
      return summary;
    },
    {
      total: 0,
      full_block: 0,
      half_block: 0,
      end_block: 0,
      jamb_block: 0,
      bond_beam_block: 0,
      grout_rebar_cell: 0,
    } satisfies Record<MasonryUnitType | 'total', number>,
  );
}
