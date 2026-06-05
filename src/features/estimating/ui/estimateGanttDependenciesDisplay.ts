import type { EstimateScheduleDependencyPreview } from '../application/estimateScheduleDependencies';
import {
  calculateGanttBarPosition,
  DEFAULT_GANTT_COLUMN_WIDTH_PX,
  GANTT_ROW_HEIGHT_PX,
  hasValidGanttTaskDates,
  type GanttRow,
  type GanttTimelineRange,
} from './estimateGanttDisplay';

export interface GanttTaskBarAnchors {
  candidateId: string;
  title: string;
  centerY: number;
  barLeftPx: number;
  barRightPx: number;
}

export interface GanttDependencyConnector {
  id: string;
  dependencyId: string;
  path: string;
  tooltip: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

function isFiniteCoordinate(value: number): boolean {
  return Number.isFinite(value);
}

export function buildGanttRowCenterYMap(rows: GanttRow[]): Map<string, number> {
  const centerYByCandidateId = new Map<string, number>();
  let offsetY = 0;

  for (const row of rows) {
    const rowHeight = GANTT_ROW_HEIGHT_PX[row.kind];
    const centerY = offsetY + rowHeight / 2;

    if (row.kind === 'task' && row.task) {
      centerYByCandidateId.set(row.task.candidateId, centerY);
    }

    offsetY += rowHeight;
  }

  return centerYByCandidateId;
}

export function getRenderedGanttBarWidth(
  barWidthPx: number,
  columnWidth: number = DEFAULT_GANTT_COLUMN_WIDTH_PX,
): number {
  const safeWidth = Number.isFinite(barWidthPx) ? barWidthPx : 0;
  const safeColumnWidth = Number.isFinite(columnWidth) && columnWidth > 0
    ? columnWidth
    : DEFAULT_GANTT_COLUMN_WIDTH_PX;
  return Math.max(safeWidth - 2, safeColumnWidth - 2);
}

export function getTaskBarAnchorPoints(
  row: GanttRow,
  rowCenterY: number,
  range: GanttTimelineRange,
  columnWidth: number = DEFAULT_GANTT_COLUMN_WIDTH_PX,
): GanttTaskBarAnchors | null {
  if (row.kind !== 'task' || !row.task || range.isEmpty) return null;
  if (!hasValidGanttTaskDates(row.task)) return null;

  const barPosition = calculateGanttBarPosition(row.task, range.startDate, columnWidth);
  if (!barPosition) return null;

  const renderedWidth = getRenderedGanttBarWidth(barPosition.widthPx, columnWidth);
  const barLeftPx = barPosition.leftPx;
  const barRightPx = barPosition.leftPx + renderedWidth;

  if (![rowCenterY, barLeftPx, barRightPx].every(isFiniteCoordinate)) {
    return null;
  }

  return {
    candidateId: row.task.candidateId,
    title: row.label,
    centerY: rowCenterY,
    barLeftPx,
    barRightPx,
  };
}

export function shouldDrawDependency(
  dependency: EstimateScheduleDependencyPreview,
  predecessor: GanttTaskBarAnchors | null | undefined,
  successor: GanttTaskBarAnchors | null | undefined,
): boolean {
  if (dependency.dependencyType !== 'finish_to_start') return false;
  if (!predecessor || !successor) return false;

  return [predecessor.barRightPx, predecessor.centerY, successor.barLeftPx, successor.centerY].every(
    isFiniteCoordinate,
  );
}

export function formatDependencyTooltip(
  predecessorTitle: string,
  successorTitle: string,
): string {
  const predecessor = predecessorTitle.trim() || 'Task';
  const successor = successorTitle.trim() || 'Task';
  return `${predecessor} → ${successor} (finish-to-start)`;
}

export function buildElbowConnectorPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): string {
  if (![startX, startY, endX, endY].every(isFiniteCoordinate)) return '';

  const horizontalGap = endX - startX;
  const bendX = startX + Math.max(8, horizontalGap / 2);

  if (!isFiniteCoordinate(bendX)) return '';

  return `M ${startX} ${startY} H ${bendX} V ${endY} H ${endX}`;
}

export function buildGanttDependencyConnectors(
  dependencies: EstimateScheduleDependencyPreview[],
  rows: GanttRow[],
  range: GanttTimelineRange,
  columnWidth: number = DEFAULT_GANTT_COLUMN_WIDTH_PX,
): GanttDependencyConnector[] {
  if (!dependencies.length || range.isEmpty || rows.length === 0) return [];

  const centerYByCandidateId = buildGanttRowCenterYMap(rows);
  const anchorsByCandidateId = new Map<string, GanttTaskBarAnchors>();

  for (const row of rows) {
    if (row.kind !== 'task' || !row.task) continue;

    const centerY = centerYByCandidateId.get(row.task.candidateId);
    if (centerY == null) continue;

    const anchors = getTaskBarAnchorPoints(row, centerY, range, columnWidth);
    if (anchors) {
      anchorsByCandidateId.set(anchors.candidateId, anchors);
    }
  }

  const connectors: GanttDependencyConnector[] = [];

  for (const dependency of dependencies) {
    const predecessor = anchorsByCandidateId.get(dependency.predecessorCandidateId);
    const successor = anchorsByCandidateId.get(dependency.successorCandidateId);

    if (!shouldDrawDependency(dependency, predecessor, successor)) continue;

    const startX = predecessor!.barRightPx;
    const startY = predecessor!.centerY;
    const endX = successor!.barLeftPx;
    const endY = successor!.centerY;
    const path = buildElbowConnectorPath(startX, startY, endX, endY);

    if (!path) continue;

    connectors.push({
      id: `connector:${dependency.id}`,
      dependencyId: dependency.id,
      path,
      tooltip: formatDependencyTooltip(predecessor!.title, successor!.title),
      startX,
      startY,
      endX,
      endY,
    });
  }

  return connectors;
}
