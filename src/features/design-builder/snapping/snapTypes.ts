import type { DesignBuilderSnapMode, DesignBuilderToolMode } from '../types';

export type PlanPoint = { x: number; z: number };
export type ScreenPoint = { x: number; y: number };

export type SnapType =
  | 'none'
  | 'grid'
  | 'endpoint'
  | 'midpoint'
  | 'intersection'
  | 'nearest'
  | 'perpendicular'
  | 'parallel'
  | 'extension'
  | 'ortho'
  | 'polar'
  | 'cmu-module';

export type SnapCandidate = {
  worldPoint: PlanPoint;
  screenPoint: ScreenPoint;
  snapType: SnapType;
  sourceId?: string;
  distancePx: number;
  label?: string;
  confidence: number;
  priority: number;
};

export type SnapResult = {
  worldPoint: PlanPoint;
  screenPoint: ScreenPoint;
  snapped: boolean;
  snapType: SnapType;
  sourceId?: string;
  distancePx: number;
  label?: string;
  confidence: number;
  candidates: SnapCandidate[];
};

export type SnapTolerancePreset = 'low' | 'normal' | 'high';

export type ObjectSnapSettings = {
  enabled: boolean;
  endpoint: boolean;
  midpoint: boolean;
  intersection: boolean;
  nearest: boolean;
  perpendicular: boolean;
  extension: boolean;
};

export type SnapSettings = {
  snapMode: DesignBuilderSnapMode;
  gridSpacingMeters: number;
  moduleLengthMeters?: number;
  tolerancePx: number;
  tolerancePreset: SnapTolerancePreset;
  objectSnap: ObjectSnapSettings;
  orthogonal: boolean;
  polar: boolean;
  polarAnglesDegrees: readonly number[];
};

export type SnapKeyboardState = {
  altHeld?: boolean;
  shiftHeld?: boolean;
  tabCycleIndex?: number;
  horizontalLock?: boolean;
  verticalLock?: boolean;
};

export type SnapSegment = {
  id: string;
  start: PlanPoint;
  end: PlanPoint;
};

export type SnapPoint = {
  id?: string;
  point: PlanPoint;
  snapType: Extract<SnapType, 'endpoint' | 'midpoint' | 'intersection' | 'nearest'>;
  label?: string;
};

export type SnapGeometry = {
  points?: readonly SnapPoint[];
  segments?: readonly SnapSegment[];
};

export type SnapCommandState = {
  basePoint?: PlanPoint | null;
  activeSegment?: SnapSegment | null;
};

export type ResolveSnapParams = {
  rawScreenPoint: ScreenPoint;
  rawWorldPoint: PlanPoint;
  planToScreenPoint: (point: PlanPoint) => ScreenPoint;
  currentToolMode: DesignBuilderToolMode;
  commandState?: SnapCommandState;
  geometry?: SnapGeometry;
  settings: SnapSettings;
  keyboard?: SnapKeyboardState;
};

export const DEFAULT_SNAP_TOLERANCE_PX = 12;

export const DEFAULT_POLAR_ANGLES_DEGREES = [
  0, 15, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330,
] as const;

export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  snapMode: 'grid',
  gridSpacingMeters: 0.5,
  tolerancePx: DEFAULT_SNAP_TOLERANCE_PX,
  tolerancePreset: 'normal',
  objectSnap: {
    enabled: true,
    endpoint: true,
    midpoint: true,
    intersection: true,
    nearest: false,
    perpendicular: true,
    extension: false,
  },
  orthogonal: false,
  polar: true,
  polarAnglesDegrees: DEFAULT_POLAR_ANGLES_DEGREES,
};
