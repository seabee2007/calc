/**
 * Logic Network Excel export.
 *
 * Produces a two-sheet workbook:
 *   • "Logic Links"   — every predecessor→successor relationship with CPM fields when available
 *   • "Activities"    — activity list with optional ES/EF/LS/LF/TF columns
 */

import * as XLSX from 'xlsx';
import { downloadWorkbook, sanitizeEstimateExportFileStem } from '../importExport/estimateExportBuilder';
import type { ScheduleActivity } from '../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink, CpmResult } from '../scheduling/cpmTypes';

export interface ExportLogicLinksParams {
  projectName: string;
  activities: ScheduleActivity[];
  logicLinks: CpmLogicLink[];
  /** If provided, ES/EF/LS/LF/TF columns are added to both sheets. */
  livePreviewCpm?: CpmResult | null;
}

function buildLinksSheet(params: ExportLogicLinksParams): XLSX.WorkSheet {
  const { activities, logicLinks, livePreviewCpm } = params;
  const actByCode = new Map(activities.map((a) => [a.activityCode, a]));
  const cpmByCode = new Map(livePreviewCpm?.activities.map((a) => [a.activityCode, a]) ?? []);

  const hasCpm = livePreviewCpm != null;

  const headers = [
    'predecessor_code',
    'predecessor_title',
    'relationship_type',
    'lag_days',
    'successor_code',
    'successor_title',
    ...(hasCpm
      ? [
          'pred_es',
          'pred_ef',
          'pred_ls',
          'pred_lf',
          'pred_tf',
          'pred_critical',
          'succ_es',
          'succ_ef',
          'succ_ls',
          'succ_lf',
          'succ_tf',
          'succ_critical',
        ]
      : []),
  ];

  const rows: (string | number | boolean)[][] = [headers];

  for (const link of logicLinks) {
    const predAct = actByCode.get(link.predecessorActivityCode);
    const succAct = actByCode.get(link.successorActivityCode);
    const predCpm = cpmByCode.get(link.predecessorActivityCode);
    const succCpm = cpmByCode.get(link.successorActivityCode);

    const row: (string | number | boolean)[] = [
      link.predecessorActivityCode,
      predAct?.activityDescription ?? '',
      link.relationshipType,
      link.lagDays,
      link.successorActivityCode,
      succAct?.activityDescription ?? '',
    ];

    if (hasCpm) {
      row.push(
        predCpm?.earlyStart ?? '',
        predCpm?.earlyFinish ?? '',
        predCpm?.lateStart ?? '',
        predCpm?.lateFinish ?? '',
        predCpm?.totalFloat ?? '',
        predCpm?.isCritical ? 'YES' : 'NO',
        succCpm?.earlyStart ?? '',
        succCpm?.earlyFinish ?? '',
        succCpm?.lateStart ?? '',
        succCpm?.lateFinish ?? '',
        succCpm?.totalFloat ?? '',
        succCpm?.isCritical ? 'YES' : 'NO',
      );
    }

    rows.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  const colWidths = [
    { wch: 22 }, // pred code
    { wch: 40 }, // pred title
    { wch: 16 }, // rel type
    { wch: 10 }, // lag
    { wch: 22 }, // succ code
    { wch: 40 }, // succ title
  ];
  if (hasCpm) {
    for (let i = 0; i < 12; i++) colWidths.push({ wch: 10 });
  }
  ws['!cols'] = colWidths;

  return ws;
}

function buildActivitiesSheet(params: ExportLogicLinksParams): XLSX.WorkSheet {
  const { activities, logicLinks, livePreviewCpm } = params;
  const cpmByCode = new Map(livePreviewCpm?.activities.map((a) => [a.activityCode, a]) ?? []);
  const hasCpm = livePreviewCpm != null;

  // Precompute predecessor/successor counts
  const predCount = new Map<string, number>();
  const succCount = new Map<string, number>();
  for (const link of logicLinks) {
    predCount.set(link.successorActivityCode, (predCount.get(link.successorActivityCode) ?? 0) + 1);
    succCount.set(link.predecessorActivityCode, (succCount.get(link.predecessorActivityCode) ?? 0) + 1);
  }

  const headers = [
    'activity_code',
    'activity_title',
    'division_code',
    'duration_days',
    'crew_size',
    'predecessor_count',
    'successor_count',
    ...(hasCpm ? ['es', 'ef', 'ls', 'lf', 'tf', 'ff', 'critical'] : []),
  ];

  const rows: (string | number | boolean)[][] = [headers];

  for (const act of activities) {
    const cpm = cpmByCode.get(act.activityCode);
    const row: (string | number | boolean)[] = [
      act.activityCode,
      act.activityDescription,
      act.divisionCode,
      act.durationDays,
      act.crewSize,
      predCount.get(act.activityCode) ?? 0,
      succCount.get(act.activityCode) ?? 0,
    ];

    if (hasCpm) {
      row.push(
        cpm?.earlyStart ?? '',
        cpm?.earlyFinish ?? '',
        cpm?.lateStart ?? '',
        cpm?.lateFinish ?? '',
        cpm?.totalFloat ?? '',
        cpm?.freeFloat ?? '',
        cpm?.isCritical ? 'YES' : 'NO',
      );
    }

    rows.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 22 },
    { wch: 44 },
    { wch: 14 },
    { wch: 13 },
    { wch: 11 },
    { wch: 16 },
    { wch: 15 },
    ...(hasCpm ? Array(7).fill({ wch: 10 }) : []),
  ];

  return ws;
}

export function buildLogicNetworkExcelFileName(projectName: string, date = new Date()): string {
  const stem = sanitizeEstimateExportFileStem(projectName);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${stem}-logic-network-${y}-${m}-${d}.xlsx`;
}

export function exportLogicLinksToExcel(params: ExportLogicLinksParams, projectName: string): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildLinksSheet(params), 'Logic Links');
  XLSX.utils.book_append_sheet(wb, buildActivitiesSheet(params), 'Activities');
  downloadWorkbook(wb, buildLogicNetworkExcelFileName(projectName));
}
