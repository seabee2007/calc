import type { IsolatedFooting, RcFrameFoundationSettings } from '../types';
import type { StructuralColumn } from '../types';
import { footingCenterElevationMeters } from './foundationElevations';

function footingIdForColumn(columnId: string): string {
  return `footing-${columnId}`;
}

export function createIsolatedFootingsForColumns(params: {
  columns: StructuralColumn[];
  foundation: RcFrameFoundationSettings;
  topOfFootingY: number;
}): IsolatedFooting[] {
  const settings = params.foundation.isolatedFootings;
  if (!settings.enabled || !settings.autoCreateAtStructuralColumns) {
    return [];
  }

  const seenColumnIds = new Set<string>();
  const footings: IsolatedFooting[] = [];

  for (const column of params.columns) {
    if (seenColumnIds.has(column.id)) continue;
    seenColumnIds.add(column.id);

    const thicknessMeters = Math.max(0, settings.thicknessMeters);
    const topElevationMeters = params.topOfFootingY;
    const bottomElevationMeters = topElevationMeters - thicknessMeters;

    footings.push({
      id: footingIdForColumn(column.id),
      name: `Footing ${column.hostNodeId ?? column.id}`,
      columnId: column.id,
      position: { x: column.position.x, z: column.position.z },
      widthMeters: Math.max(0.1, settings.widthMeters),
      lengthMeters: Math.max(0.1, settings.lengthMeters),
      thicknessMeters,
      topElevationMeters,
      bottomElevationMeters,
      centerElevationMeters: footingCenterElevationMeters(topElevationMeters, thicknessMeters),
      source: 'auto_at_column',
    });
  }

  return footings;
}
