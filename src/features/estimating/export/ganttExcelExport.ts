import * as XLSX from 'xlsx';
import {
  downloadWorkbook,
  sanitizeEstimateExportFileStem,
} from '../importExport/estimateExportBuilder';
import type { BuildGanttScheduleResult, GanttActivity } from '../schedule/buildGanttSchedule';
import type { ScheduleActivity } from '../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink, CpmResult, ResourceHistogramDay } from '../scheduling/cpmTypes';
export const LEVEL_THREE_GANTT_SHEET_NAME = 'Level III Gantt';

export const GANTT_SCHEDULE_SHEET_NAME = 'Gantt Schedule';
export const GANTT_LOGIC_NETWORK_SHEET_NAME = 'Logic Network';
export const GANTT_DIVISION_SUMMARY_SHEET_NAME = 'Division Summary';
export const GANTT_EXPORT_INFO_SHEET_NAME = 'Export Info';

const GANTT_SCHEDULE_HEADERS = [
  'activity_code',
  'division_code',
  'division_name',
  'work_package_code',
  'work_package_name',
  'activity_title',
  'duration_days',
  'planned_start',
  'planned_finish',
  'predecessor_activity_code',
  'relationship_type',
  'lag_days',
  'crew_size',
  'labor_hours',
  'man_days',
  'crew_days',
  'total_cost',
  'notes',
] as const;

const LOGIC_NETWORK_HEADERS = [
  'predecessor_activity_code',
  'predecessor_title',
  'relationship_type',
  'lag_days',
  'successor_activity_code',
  'successor_title',
] as const;

const DIVISION_SUMMARY_HEADERS = [
  'division_code',
  'division_name',
  'activity_count',
  'total_duration_days',
  'labor_hours',
  'total_cost',
] as const;

function activityToScheduleRow(activity: GanttActivity): (string | number)[] {
  return [
    activity.activityCode,
    activity.divisionCode,
    activity.divisionName,
    activity.workPackageCode ?? '',
    activity.workPackageName ?? '',
    activity.title,
    activity.durationDays,
    activity.plannedStart,
    activity.plannedFinish,
    activity.predecessorActivityCode ?? '',
    activity.relationshipType,
    activity.lagDays,
    activity.crewSize ?? '',
    activity.laborHours ?? '',
    activity.manDays ?? '',
    activity.crewDays ?? '',
    activity.totalCost ?? '',
    activity.notes ?? '',
  ];
}

function buildDivisionSummaryRows(activities: GanttActivity[]): (string | number)[][] {
  const byDivision = new Map<
    string,
    {
      divisionName: string;
      activityCount: number;
      totalDurationDays: number;
      laborHours: number;
      totalCost: number;
    }
  >();

  for (const activity of activities) {
    const existing = byDivision.get(activity.divisionCode) ?? {
      divisionName: activity.divisionName,
      activityCount: 0,
      totalDurationDays: 0,
      laborHours: 0,
      totalCost: 0,
    };

    existing.activityCount += 1;
    existing.totalDurationDays += activity.durationDays;
    existing.laborHours += activity.laborHours ?? 0;
    existing.totalCost += activity.totalCost ?? 0;
    byDivision.set(activity.divisionCode, existing);
  }

  return [...byDivision.entries()]
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([divisionCode, summary]) => [
      divisionCode,
      summary.divisionName,
      summary.activityCount,
      summary.totalDurationDays,
      summary.laborHours,
      summary.totalCost,
    ]);
}

/** Whether the export reflects the resource-leveled schedule or the raw CPM baseline. */
export type GanttExportMode = 'leveled' | 'baseline';

export interface BuildGanttWorkbookParams {
  schedule: BuildGanttScheduleResult | null;
  projectName: string;
  estimateType: string;
  exportedAt?: Date;
  /** Optional CPM data for Level III Gantt export. */
  cpmResult?: CpmResult | null;
  activities?: ScheduleActivity[];
  logicLinks?: CpmLogicLink[];
  projectStartDate?: string;
  leveledOffsets?: Record<string, number>;
  resourceHistogram?: ResourceHistogramDay[];
  /** Controls the schedule-type label in the export header. Defaults to 'leveled'. */
  scheduleMode?: GanttExportMode;
}

export function isLevelThreeGanttExcelExport(
  params: BuildGanttWorkbookParams,
): boolean {
  return Boolean(params.cpmResult && params.activities && params.activities.length > 0);
}

export function buildGanttWorkbook(params: BuildGanttWorkbookParams): XLSX.WorkBook {
  const exportedAt = params.exportedAt ?? new Date();
  const exportedAtIso = exportedAt.toISOString();
  const workbook = XLSX.utils.book_new();

  if (params.schedule) {
    const scheduleRows = [
      [...GANTT_SCHEDULE_HEADERS],
      ...params.schedule.activities.map(activityToScheduleRow),
    ];
    const logicRows = [
      [...LOGIC_NETWORK_HEADERS],
      ...params.schedule.logicLinks.map((link) => [
        link.predecessorActivityCode,
        link.predecessorTitle,
        link.relationshipType,
        link.lagDays,
        link.successorActivityCode,
        link.successorTitle,
      ]),
    ];
    const divisionRows = [
      [...DIVISION_SUMMARY_HEADERS],
      ...buildDivisionSummaryRows(params.schedule.activities),
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(scheduleRows),
      GANTT_SCHEDULE_SHEET_NAME,
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(logicRows),
      GANTT_LOGIC_NETWORK_SHEET_NAME,
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(divisionRows),
      GANTT_DIVISION_SUMMARY_SHEET_NAME,
    );
  }

  const infoRows = [
    ['field', 'value'],
    ['project_name', params.projectName],
    ['estimate_type', params.estimateType],
    ['exported_at', exportedAtIso],
    ...(params.schedule
      ? [
          ['activity_count', params.schedule.activities.length],
          ['planned_duration_days', params.schedule.plannedDurationDays],
        ]
      : params.cpmResult
        ? [
            ['activity_count', params.cpmResult.activities.length],
            ['project_duration_days', params.cpmResult.projectDurationDays],
          ]
        : []),
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(infoRows),
    GANTT_EXPORT_INFO_SHEET_NAME,
  );

  return workbook;
}

export function buildGanttExportFileName(projectName: string, date = new Date()): string {
  const stem = sanitizeEstimateExportFileStem(projectName);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${stem}-gantt-${year}-${month}-${day}.xlsx`;
}

export async function downloadGanttExcel(
  params: BuildGanttWorkbookParams & { fileName?: string },
): Promise<void> {
  if (isLevelThreeGanttExcelExport(params)) {
    const levelThreeExport = await import('./levelThreeGanttExcelExport');
    await levelThreeExport.downloadLevelThreeGanttExcel({
      ...params,
      fileName:
        params.fileName ?? levelThreeExport.buildLevelThreeGanttExcelFileName(params.projectName),
    });
    return;
  }

  const workbook = buildGanttWorkbook(params);
  const fileName = params.fileName ?? buildGanttExportFileName(params.projectName);
  downloadWorkbook(workbook, fileName);
}
