import type { DesignSnapTarget } from './designSnapRules';
import type { DesignBuilderSnapMode } from '../types';
import { formatPlanGridSpacingMeters } from './planGridState';

const STATUS_SEPARATOR = ' · ';

function formatDegrees(value: number): string {
  return `${Math.round(value)}°`;
}

export function formatDrawWallStatusChip(params: {
  snapMode: DesignBuilderSnapMode;
  gridSpacingMeters: number;
  orthogonalLock: boolean;
  shiftConstraintLabel?: string | null;
  snapTarget?: DesignSnapTarget | null;
}): string {
  if (params.shiftConstraintLabel) {
    if (
      params.shiftConstraintLabel.startsWith('Closure:') ||
      params.shiftConstraintLabel.startsWith('Typed length') ||
      params.shiftConstraintLabel.startsWith('Current segment:')
    ) {
      return params.shiftConstraintLabel;
    }
    return params.shiftConstraintLabel.includes('parallel') ? 'Locked: parallel' : 'Locked: 90°';
  }
  if (params.snapTarget?.captured && params.snapTarget.type !== 'raw') {
    if (params.snapTarget.label === 'Exact rectangle corner') {
      return 'Closure: exact rectangle corner';
    }
    if (params.snapTarget.type === 'grid') {
      return `Snap: Grid ${formatPlanGridSpacingMeters(params.gridSpacingMeters)}`;
    }
    if (params.snapTarget.type === 'cmu_module') {
      return 'Snap: CMU';
    }
    if (params.snapTarget.label) {
      return `Snap: ${params.snapTarget.label}`;
    }
  }
  if (params.snapMode === 'off') {
    return 'Free angle';
  }
  return 'Free angle';
}

export function formatDrawWallSnapTargetFeedback(params: {
  snapTarget: DesignSnapTarget | null;
  snapMode: DesignBuilderSnapMode;
  gridSpacingMeters: number;
  shiftConstraintLabel?: string | null;
  lengthMeters?: number;
  angleDegrees?: number;
}): string | null {
  const parts: string[] = [];
  if (params.shiftConstraintLabel) {
    parts.push(params.shiftConstraintLabel);
  } else if (params.snapMode === 'off' && (!params.snapTarget || params.snapTarget.type === 'raw')) {
    parts.push('Free angle');
  } else if (params.snapTarget && params.snapTarget.type !== 'raw') {
    if (params.snapTarget.label === 'Exact rectangle corner') parts.push('Closure: exact rectangle corner');
    else if (params.snapTarget.label === '90 deg' || params.snapTarget.label?.includes('90')) parts.push('Guide: 90°');
    else if (params.snapTarget.label === 'Parallel') parts.push('Guide: Parallel');
    else if (params.snapTarget.type === 'cmu_module') parts.push('Snap: CMU module');
    else if (params.snapTarget.type === 'grid') {
      parts.push(`Snap: Grid ${formatPlanGridSpacingMeters(params.gridSpacingMeters)}`);
    } else if (params.snapTarget.type === 'node' || params.snapTarget.type === 'endpoint') {
      parts.push('Snap: Corner');
    }
  }
  if (params.lengthMeters != null && params.lengthMeters > 0) {
    parts.push(`Length: ${params.lengthMeters.toFixed(2)} m`);
  }
  if (params.angleDegrees != null) {
    parts.push(`Angle: ${formatDegrees(params.angleDegrees)}`);
  }
  return parts.length > 0 ? parts.join(STATUS_SEPARATOR) : null;
}
