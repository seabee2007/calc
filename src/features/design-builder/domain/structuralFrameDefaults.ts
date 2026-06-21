import type { StructuralFrameSystemParameters } from '../types';

export const DEFAULT_RC_COLUMN_WIDTH_METERS = 0.35;
export const DEFAULT_RC_COLUMN_DEPTH_METERS = 0.35;
export const DEFAULT_GRADE_BEAM_WIDTH_METERS = 0.3;
export const DEFAULT_GRADE_BEAM_DEPTH_METERS = 0.45;
export const DEFAULT_RING_BEAM_WIDTH_METERS = 0.25;
export const DEFAULT_RING_BEAM_DEPTH_METERS = 0.3;
export const DEFAULT_ROOF_TO_MASONRY_CLEARANCE_METERS = 0.1016;
/** Minimum required concrete depth between gable CMU and roof underside (4 in). */
export const DEFAULT_MIN_RAKE_CAP_DEPTH_METERS = DEFAULT_ROOF_TO_MASONRY_CLEARANCE_METERS;
export const ROOF_CONTACT_EPSILON_METERS = 0.001;
/** @deprecated Cap top now meets purlin bottom; retained for legacy tests only. */
export const ROOF_CAP_CONTACT_CLEARANCE_METERS = 0;

export function createDefaultStructuralFrameSystem(): StructuralFrameSystemParameters {
  return {
    kind: 'structural_frame_system',
    buildingSystemMode: 'cmu_bearing_wall',
    defaultColumnWidthMeters: DEFAULT_RC_COLUMN_WIDTH_METERS,
    defaultColumnDepthMeters: DEFAULT_RC_COLUMN_DEPTH_METERS,
    defaultGradeBeamWidthMeters: DEFAULT_GRADE_BEAM_WIDTH_METERS,
    defaultGradeBeamDepthMeters: DEFAULT_GRADE_BEAM_DEPTH_METERS,
    defaultRingBeamWidthMeters: DEFAULT_RING_BEAM_WIDTH_METERS,
    defaultRingBeamDepthMeters: DEFAULT_RING_BEAM_DEPTH_METERS,
    columns: [],
    beams: [],
  };
}

export function createEmptyCmuInfillSystem() {
  return {
    kind: 'cmu_infill_system' as const,
    panels: [],
  };
}

export function createEmptyGableEndSystem() {
  return {
    kind: 'gable_end_system' as const,
    gableEnds: [],
  };
}
