import * as XLSX from 'xlsx';
import {
  downloadWorkbook,
  sanitizeEstimateExportFileStem,
} from '../importExport/estimateExportBuilder';
import type { BuildGanttScheduleResult, GanttActivity } from '../schedule/buildGanttSchedule';
import type { ScheduleActivity } from '../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink, CpmResult, ResourceHistogramDay } from '../scheduling/cpmTypes';
import {
  buildTimelineDays,
  getLevelThreeGanttRows,
  resolveGanttCellKind,
} from '../scheduling/levelThreeGanttUtils';

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
}

export const LEVEL_THREE_GANTT_SHEET_NAME = 'Level III Gantt Chart';

const GANTT_CELL_FILL: Record<string, string> = {
  critical: 'FFEF4444',
  noncritical: 'FF06B6D4',
  float: 'FFD1D5DB',
};

function buildLevelThreeVisualGanttSheet(
  params: BuildGanttWorkbookParams,
): XLSX.WorkSheet | null {
  if (!params.cpmResult || !params.activities?.length) return null;

  const projectStartDate =
    params.projectStartDate ?? new Date().toISOString().slice(0, 10);
  const projectDuration = Math.max(params.cpmResult.projectDurationDays, 1);
  const timelineDays = buildTimelineDays(projectStartDate, projectDuration);
  const rows = getLevelThreeGanttRows(
    params.activities,
    params.cpmResult,
    projectStartDate,
    params.leveledOffsets ?? {},
  );

  const header = [
    'Activity Code',
    'Description',
    'Float',
    'Duration',
    'Start',
    'Finish',
    ...timelineDays.map((d) => String(d.dayOfMonth)),
  ];

  const body = rows.map((row) => {
    const dayCells = timelineDays.map((day) => {
      const kind = resolveGanttCellKind(day.dayOffset, row);
      if (kind === 'critical') return '■';
      if (kind === 'noncritical') return '■';
      if (kind === 'float') return '·';
      return '';
    });
    return [
      row.activity.activityCode,
      row.activity.activityDescription,
      row.cpm.totalFloat,
      row.activity.durationDays,
      row.plannedStart,
      row.plannedFinish,
      ...dayCells,
    ];
  });

  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);

  rows.forEach((row, rowIndex) => {
    timelineDays.forEach((day, colIndex) => {
      const kind = resolveGanttCellKind(day.dayOffset, row);
      if (kind === 'empty') return;
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: 6 + colIndex });
      const cell = sheet[cellRef];
      if (!cell) return;
      cell.s = {
        fill: { fgColor: { rgb: GANTT_CELL_FILL[kind] } },
        alignment: { horizontal: 'center' },
      };
    });
  });

  return sheet;
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

  if (params.cpmResult && params.activities) {
    const visualGanttSheet = buildLevelThreeVisualGanttSheet(params);
    if (visualGanttSheet) {
      XLSX.utils.book_append_sheet(workbook, visualGanttSheet, LEVEL_THREE_GANTT_SHEET_NAME);
    }

    const cpmByCode = new Map(params.cpmResult.activities.map((a) => [a.activityCode, a]));
    const actByCode = new Map(params.activities.map((a) => [a.activityCode, a]));
    const sorted = [...params.cpmResult.activities].sort(
      (left, right) => left.earlyStart - right.earlyStart,
    );

    if (params.logicLinks && params.logicLinks.length > 0) {
      const logicRows = [
        [...LOGIC_NETWORK_HEADERS],
        ...params.logicLinks.map((link) => [
          link.predecessorActivityCode,
          actByCode.get(link.predecessorActivityCode)?.activityDescription ?? '',
          link.relationshipType,
          link.lagDays,
          link.successorActivityCode,
          actByCode.get(link.successorActivityCode)?.activityDescription ?? '',
        ]),
      ];
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(logicRows),
        GANTT_LOGIC_NETWORK_SHEET_NAME,
      );
    }

    const cpmRows = [
      ['code', 'description', 'duration', 'es', 'ef', 'ls', 'lf', 'tf', 'ff', 'critical'],
      ...sorted.map((cpm) => {
        const act = actByCode.get(cpm.activityCode);
        return [
          cpm.activityCode,
          act?.activityDescription ?? '',
          act?.durationDays ?? '',
          cpm.earlyStart,
          cpm.earlyFinish,
          cpm.lateStart,
          cpm.lateFinish,
          cpm.totalFloat,
          cpm.freeFloat,
          cpm.isCritical ? 'Yes' : 'No',
        ];
      }),
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(cpmRows), 'CPM Table');

    if (params.resourceHistogram && params.resourceHistogram.length > 0) {
      const histogramRows = [
        ['day_offset', 'date', 'required_crew', 'available_crew', 'over_allocated'],
        ...params.resourceHistogram.map((d) => [
          d.dayOffset,
          d.date,
          d.requiredCrew,
          d.availableCrew,
          d.isOverallocated ? 'Yes' : 'No',
        ]),
      ];
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(histogramRows),
        'Resource Histogram',
      );
    }

    if (params.leveledOffsets && Object.keys(params.leveledOffsets).length > 0) {
      const levelingRows = [
        ['activity_code', 'days_moved', 'original_start', 'leveled_start'],
        ...Object.entries(params.leveledOffsets).map(([code, offset]) => {
          const cpm = cpmByCode.get(code);
          return [
            code,
            offset,
            cpm ? cpm.earlyStart : '',
            cpm ? cpm.earlyStart + offset : '',
          ];
        }),
      ];
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(levelingRows),
        'Resource Leveling Changes',
      );
    }
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

export function downloadGanttExcel(params: BuildGanttWorkbookParams & { fileName?: string }): void {
  const workbook = buildGanttWorkbook(params);
  const fileName = params.fileName ?? buildGanttExportFileName(params.projectName);
  downloadWorkbook(workbook, fileName);
}
