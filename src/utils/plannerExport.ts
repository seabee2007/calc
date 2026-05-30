import type { PlannerBoardBundle } from '../types/fieldPlanner';

/**
 * Export planner board data as JSON (Phase 4 reporting).
 */
export function exportPlannerBoardJson(
  bundle: PlannerBoardBundle,
  projectName: string,
): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    projectName,
    board: bundle.board,
    buckets: bundle.buckets,
    tasks: bundle.tasks,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `field-planner-${projectName.replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export tasks as CSV for spreadsheets.
 */
export function exportPlannerTasksCsv(bundle: PlannerBoardBundle, projectName: string): void {
  const headers = ['Title', 'Bucket', 'Status', 'Priority', 'Due Date', 'Assignee'];
  const bucketMap = new Map(bundle.buckets.map((b) => [b.id, b.title]));
  const rows = bundle.tasks.map((t) => [
    t.title,
    bucketMap.get(t.bucketId) ?? '',
    t.status,
    t.priority,
    t.dueDate ?? '',
    t.assigneeName ?? '',
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `field-tasks-${projectName.replace(/\s+/g, '-').toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
