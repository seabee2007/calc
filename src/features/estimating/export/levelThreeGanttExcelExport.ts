import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { sanitizeEstimateExportFileStem } from '../importExport/estimateExportBuilder';
import type { ScheduleActivity } from '../scheduling/adapters/estimateLineItemsToScheduleActivities';
import { isDisplayCritical } from '../scheduling/cpm/cpmDisplayCritical';
import type { CpmLogicLink, CpmResult, ResourceHistogramDay } from '../scheduling/cpmTypes';
import { computeTodayDayOffset, getLocalDateYmd } from '../scheduling/levelThreeGanttGrid';
import {
  buildTimelineDays,
  buildTimelineMonthSegments,
  getLevelThreeGanttRows,
  resolveGanttCellKind,
  type LevelThreeGanttRow,
} from '../scheduling/levelThreeGanttUtils';
import type { BuildGanttWorkbookParams } from './ganttExcelExport';

const LOGIC_NETWORK_SHEET_NAME = 'Logic Network';
const EXPORT_INFO_SHEET_NAME = 'Export Info';

export const LEVEL_THREE_GANTT_SHEET_NAME = 'Level III Gantt';
export const RESOURCE_HISTOGRAM_SHEET_NAME = 'Resource Histogram';
export const CPM_TABLE_SHEET_NAME = 'CPM Table';

export const LEVEL_THREE_EXCEL_LEFT_COL_COUNT = 3;
export const LEVEL_THREE_EXCEL_TIMELINE_START_COL = 4;
export const LEVEL_THREE_EXCEL_TITLE_ROW = 1;
export const LEVEL_THREE_EXCEL_MONTH_ROW = 2;
export const LEVEL_THREE_EXCEL_DAY_ROW = 3;
export const LEVEL_THREE_EXCEL_DATA_START_ROW = 4;

export const LEVEL_THREE_EXCEL_COLORS = {
  sheetBg: 'FF0F172A',
  headerBg: 'FF1E293B',
  rowAltBg: 'FF111827',
  text: 'FFFFFFFF',
  textMuted: 'FFCBD5E1',
  critical: 'FFEF4444',
  noncritical: 'FF06B6D4',
  floatFill: 'FF334155',
  floatBorder: 'FF94A3B8',
  today: 'FF06B6D4',
  border: 'FF475569',
  criticalText: 'FFF87171',
} as const;

const LEFT_COLUMN_WIDTHS = {
  code: 14,
  description: 42,
  float: 10,
} as const;

const DAY_COLUMN_WIDTH = 3.75;
const ACTIVITY_ROW_HEIGHT = 22;

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function thinBorder(argb: string): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb } };
  return { top: side, left: side, bottom: side, right: side };
}

function dashedBorder(argb: string): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'dashed', color: { argb } },
    left: { style: 'dashed', color: { argb } },
    bottom: { style: 'dashed', color: { argb } },
    right: { style: 'dashed', color: { argb } },
  };
}

function applyBaseCell(
  cell: ExcelJS.Cell,
  options: {
    fill?: string;
    fontColor?: string;
    bold?: boolean;
    align?: Partial<ExcelJS.Alignment>;
    border?: Partial<ExcelJS.Borders>;
  } = {},
): void {
  cell.fill = solidFill(options.fill ?? LEVEL_THREE_EXCEL_COLORS.sheetBg);
  cell.font = {
    color: { argb: options.fontColor ?? LEVEL_THREE_EXCEL_COLORS.textMuted },
    bold: options.bold ?? false,
    size: 10,
  };
  cell.alignment = {
    vertical: 'middle',
    horizontal: 'left',
    ...options.align,
  };
  cell.border = options.border ?? thinBorder(LEVEL_THREE_EXCEL_COLORS.border);
}

export function timelineColumnForDayOffset(dayOffset: number): number {
  return LEVEL_THREE_EXCEL_TIMELINE_START_COL + dayOffset;
}

export function barColumnRangeForRow(
  row: LevelThreeGanttRow,
  timelineStartCol = LEVEL_THREE_EXCEL_TIMELINE_START_COL,
): {
  barStartCol: number;
  barEndCol: number;
  floatStartCol: number | null;
  floatEndCol: number | null;
} {
  const earlyStart = row.cpm.earlyStart + row.leveledOffset;
  const earlyFinish = earlyStart + row.activity.durationDays;
  const totalFloat = Math.max(0, row.cpm.totalFloat - row.leveledOffset);

  const barStartCol = timelineStartCol + earlyStart;
  const barEndCol = timelineStartCol + earlyFinish - 1;
  const floatStartCol = totalFloat > 0 ? timelineStartCol + earlyFinish : null;
  const floatEndCol =
    totalFloat > 0 ? timelineStartCol + earlyFinish + totalFloat - 1 : null;

  return { barStartCol, barEndCol, floatStartCol, floatEndCol };
}

function styleTimelineCell(
  cell: ExcelJS.Cell,
  kind: ReturnType<typeof resolveGanttCellKind>,
  isTodayColumn: boolean,
): void {
  if (kind === 'critical') {
    applyBaseCell(cell, {
      fill: LEVEL_THREE_EXCEL_COLORS.critical,
      fontColor: LEVEL_THREE_EXCEL_COLORS.text,
      align: { horizontal: 'center' },
    });
  } else if (kind === 'noncritical') {
    applyBaseCell(cell, {
      fill: LEVEL_THREE_EXCEL_COLORS.noncritical,
      fontColor: LEVEL_THREE_EXCEL_COLORS.text,
      align: { horizontal: 'center' },
    });
  } else if (kind === 'float') {
    applyBaseCell(cell, {
      fill: LEVEL_THREE_EXCEL_COLORS.floatFill,
      fontColor: LEVEL_THREE_EXCEL_COLORS.textMuted,
      align: { horizontal: 'center' },
      border: dashedBorder(LEVEL_THREE_EXCEL_COLORS.floatBorder),
    });
  } else {
    applyBaseCell(cell, { align: { horizontal: 'center' } });
  }

  if (isTodayColumn) {
    cell.border = {
      ...cell.border,
      left: { style: 'medium', color: { argb: LEVEL_THREE_EXCEL_COLORS.today } },
    };
  }
}

function addLevelThreeGanttSheet(
  workbook: ExcelJS.Workbook,
  params: BuildGanttWorkbookParams,
): void {
  const projectStartDate = params.projectStartDate ?? getLocalDateYmd();
  const projectDuration = Math.max(params.cpmResult!.projectDurationDays, 1);
  const timelineDays = buildTimelineDays(projectStartDate, projectDuration);
  const monthSegments = buildTimelineMonthSegments(timelineDays);
  const rows = getLevelThreeGanttRows(
    params.activities!,
    params.cpmResult!,
    projectStartDate,
    params.leveledOffsets ?? {},
  );
  const todayOffset = computeTodayDayOffset(
    projectStartDate,
    getLocalDateYmd(),
    projectDuration,
  );

  const sheet = workbook.addWorksheet(LEVEL_THREE_GANTT_SHEET_NAME, {
    views: [
      {
        state: 'frozen',
        xSplit: LEVEL_THREE_EXCEL_LEFT_COL_COUNT,
        ySplit: LEVEL_THREE_EXCEL_DAY_ROW,
        showGridLines: false,
      },
    ],
  });

  sheet.properties.defaultRowHeight = ACTIVITY_ROW_HEIGHT;
  sheet.getColumn(1).width = LEFT_COLUMN_WIDTHS.code;
  sheet.getColumn(2).width = LEFT_COLUMN_WIDTHS.description;
  sheet.getColumn(3).width = LEFT_COLUMN_WIDTHS.float;
  for (let col = LEVEL_THREE_EXCEL_TIMELINE_START_COL; col < LEVEL_THREE_EXCEL_TIMELINE_START_COL + projectDuration; col += 1) {
    sheet.getColumn(col).width = DAY_COLUMN_WIDTH;
  }

  const titleCell = sheet.getCell(LEVEL_THREE_EXCEL_TITLE_ROW, 1);
  titleCell.value = `Level III Gantt — ${params.projectName}`;
  sheet.mergeCells(LEVEL_THREE_EXCEL_TITLE_ROW, 1, LEVEL_THREE_EXCEL_TITLE_ROW, 3);
  applyBaseCell(titleCell, {
    fill: LEVEL_THREE_EXCEL_COLORS.headerBg,
    fontColor: LEVEL_THREE_EXCEL_COLORS.text,
    bold: true,
  });

  const legendCell = sheet.getCell(
    LEVEL_THREE_EXCEL_TITLE_ROW,
    LEVEL_THREE_EXCEL_TIMELINE_START_COL,
  );
  legendCell.value =
    'Legend: Critical=red | Noncritical=cyan | Total float=dashed gray | Today=blue line';
  sheet.mergeCells(
    LEVEL_THREE_EXCEL_TITLE_ROW,
    LEVEL_THREE_EXCEL_TIMELINE_START_COL,
    LEVEL_THREE_EXCEL_TITLE_ROW,
    LEVEL_THREE_EXCEL_TIMELINE_START_COL + Math.min(projectDuration, 12) - 1,
  );
  applyBaseCell(legendCell, {
    fill: LEVEL_THREE_EXCEL_COLORS.headerBg,
    fontColor: LEVEL_THREE_EXCEL_COLORS.textMuted,
    align: { horizontal: 'left' },
  });

  for (let col = 1; col <= LEVEL_THREE_EXCEL_LEFT_COL_COUNT; col += 1) {
    applyBaseCell(sheet.getCell(LEVEL_THREE_EXCEL_MONTH_ROW, col), {
      fill: LEVEL_THREE_EXCEL_COLORS.headerBg,
    });
  }

  for (const segment of monthSegments) {
    const startCol = timelineColumnForDayOffset(segment.startDayOffset);
    const endCol = startCol + segment.dayCount - 1;
    const monthCell = sheet.getCell(LEVEL_THREE_EXCEL_MONTH_ROW, startCol);
    monthCell.value = segment.monthLabel;
    if (segment.dayCount > 1) {
      sheet.mergeCells(LEVEL_THREE_EXCEL_MONTH_ROW, startCol, LEVEL_THREE_EXCEL_MONTH_ROW, endCol);
    }
    applyBaseCell(monthCell, {
      fill: LEVEL_THREE_EXCEL_COLORS.headerBg,
      fontColor: LEVEL_THREE_EXCEL_COLORS.text,
      bold: true,
      align: { horizontal: 'center' },
    });
  }

  const headers = ['CODE', 'DESCRIPTION', 'FLOAT'] as const;
  headers.forEach((label, index) => {
    const cell = sheet.getCell(LEVEL_THREE_EXCEL_DAY_ROW, index + 1);
    cell.value = label;
    applyBaseCell(cell, {
      fill: LEVEL_THREE_EXCEL_COLORS.headerBg,
      fontColor: LEVEL_THREE_EXCEL_COLORS.text,
      bold: true,
      align: { horizontal: index === 2 ? 'center' : 'left' },
      border: {
        top: { style: 'thin', color: { argb: LEVEL_THREE_EXCEL_COLORS.border } },
        left: { style: 'thin', color: { argb: LEVEL_THREE_EXCEL_COLORS.border } },
        bottom: { style: 'thin', color: { argb: LEVEL_THREE_EXCEL_COLORS.border } },
        right:
          index === 2
            ? { style: 'medium', color: { argb: LEVEL_THREE_EXCEL_COLORS.today } }
            : { style: 'thin', color: { argb: LEVEL_THREE_EXCEL_COLORS.border } },
      },
    });
  });

  timelineDays.forEach((day) => {
    const col = timelineColumnForDayOffset(day.dayOffset);
    const cell = sheet.getCell(LEVEL_THREE_EXCEL_DAY_ROW, col);
    cell.value = day.dayOfMonth;
    applyBaseCell(cell, {
      fill: LEVEL_THREE_EXCEL_COLORS.headerBg,
      fontColor: day.isToday ? LEVEL_THREE_EXCEL_COLORS.today : LEVEL_THREE_EXCEL_COLORS.textMuted,
      bold: day.isToday,
      align: { horizontal: 'center' },
    });
    if (todayOffset !== null && day.dayOffset === todayOffset) {
      cell.border = {
        ...cell.border,
        left: { style: 'medium', color: { argb: LEVEL_THREE_EXCEL_COLORS.today } },
      };
    }
  });

  const cpmResult = params.cpmResult!;

  rows.forEach((row, rowIndex) => {
    const excelRow = LEVEL_THREE_EXCEL_DATA_START_ROW + rowIndex;
    const rowFill =
      rowIndex % 2 === 1 ? LEVEL_THREE_EXCEL_COLORS.rowAltBg : LEVEL_THREE_EXCEL_COLORS.sheetBg;
    const displayCritical = isDisplayCritical(cpmResult, row.activity.activityCode);

    sheet.getRow(excelRow).height = ACTIVITY_ROW_HEIGHT;

    const codeCell = sheet.getCell(excelRow, 1);
    codeCell.value = row.activity.activityCode;
    applyBaseCell(codeCell, {
      fill: rowFill,
      fontColor: displayCritical
        ? LEVEL_THREE_EXCEL_COLORS.criticalText
        : LEVEL_THREE_EXCEL_COLORS.text,
      bold: displayCritical,
    });

    const descCell = sheet.getCell(excelRow, 2);
    descCell.value = row.activity.activityDescription;
    applyBaseCell(descCell, { fill: rowFill, fontColor: LEVEL_THREE_EXCEL_COLORS.text });

    const floatCell = sheet.getCell(excelRow, 3);
    floatCell.value = `${row.cpm.totalFloat}d`;
    applyBaseCell(floatCell, {
      fill: rowFill,
      fontColor: LEVEL_THREE_EXCEL_COLORS.textMuted,
      align: { horizontal: 'center' },
      border: {
        top: { style: 'thin', color: { argb: LEVEL_THREE_EXCEL_COLORS.border } },
        left: { style: 'thin', color: { argb: LEVEL_THREE_EXCEL_COLORS.border } },
        bottom: { style: 'thin', color: { argb: LEVEL_THREE_EXCEL_COLORS.border } },
        right: { style: 'medium', color: { argb: LEVEL_THREE_EXCEL_COLORS.today } },
      },
    });

    timelineDays.forEach((day) => {
      const col = timelineColumnForDayOffset(day.dayOffset);
      const kind = resolveGanttCellKind(day.dayOffset, row, cpmResult);
      const isTodayColumn = todayOffset !== null && day.dayOffset === todayOffset;
      const cell = sheet.getCell(excelRow, col);
      cell.value = '';
      styleTimelineCell(cell, kind, isTodayColumn);
      if (kind === 'empty') {
        cell.fill = solidFill(rowFill);
      }
    });
  });
}

function addResourceHistogramSheet(
  workbook: ExcelJS.Workbook,
  histogram: ResourceHistogramDay[],
): void {
  const sheet = workbook.addWorksheet(RESOURCE_HISTOGRAM_SHEET_NAME, {
    views: [{ showGridLines: false }],
  });
  sheet.addRow([
    'Day',
    'Date',
    'Required Crew',
    'Critical Resources',
    'Noncritical Resources',
    'Available Crew',
    'Overallocated Amount',
    'Overallocated',
  ]);
  sheet.getRow(1).font = { bold: true, color: { argb: LEVEL_THREE_EXCEL_COLORS.text } };
  sheet.getRow(1).fill = solidFill(LEVEL_THREE_EXCEL_COLORS.headerBg);

  histogram.forEach((day, index) => {
    const row = sheet.addRow([
      day.dayOffset,
      day.date,
      day.requiredCrew,
      day.criticalRequiredCrew,
      day.noncriticalRequiredCrew,
      day.availableCrew,
      day.overallocatedAmount,
      day.isOverallocated ? 'Yes' : 'No',
    ]);
    const fill = index % 2 === 0 ? LEVEL_THREE_EXCEL_COLORS.sheetBg : LEVEL_THREE_EXCEL_COLORS.rowAltBg;
    row.eachCell((cell) => {
      applyBaseCell(cell, {
        fill: day.isOverallocated ? 'FF7F1D1D' : fill,
        fontColor: LEVEL_THREE_EXCEL_COLORS.text,
      });
    });
  });
}

function addCpmTableSheet(
  workbook: ExcelJS.Workbook,
  params: BuildGanttWorkbookParams,
): void {
  const cpmByCode = new Map(params.cpmResult!.activities.map((a) => [a.activityCode, a]));
  const actByCode = new Map(params.activities!.map((a) => [a.activityCode, a]));
  const sorted = [...params.cpmResult!.activities].sort(
    (left, right) => left.earlyStart - right.earlyStart,
  );

  const sheet = workbook.addWorksheet(CPM_TABLE_SHEET_NAME, {
    views: [{ showGridLines: false }],
  });
  sheet.addRow([
    'code',
    'description',
    'duration',
    'es',
    'ef',
    'ls',
    'lf',
    'tf',
    'ff',
    'critical',
  ]);
  sheet.getRow(1).font = { bold: true };

  sorted.forEach((cpm) => {
    const act = actByCode.get(cpm.activityCode);
    const row = sheet.addRow([
      cpm.activityCode,
      act?.activityDescription ?? '',
      act?.durationDays ?? '',
      cpm.earlyStart,
      cpm.earlyFinish,
      cpm.lateStart,
      cpm.lateFinish,
      cpm.totalFloat,
      cpm.freeFloat,
      isDisplayCritical(params.cpmResult!, cpm.activityCode) ? 'Yes' : 'No',
    ]);
    if (isDisplayCritical(params.cpmResult!, cpm.activityCode)) {
      row.eachCell((cell) => {
        cell.fill = solidFill('FFFECACA');
      });
    }
    void cpmByCode;
  });
}

function addLogicNetworkSheet(
  workbook: ExcelJS.Workbook,
  params: BuildGanttWorkbookParams,
): void {
  if (!params.logicLinks?.length) return;
  const actByCode = new Map(params.activities!.map((a) => [a.activityCode, a]));
  const sheet = workbook.addWorksheet(LOGIC_NETWORK_SHEET_NAME, {
    views: [{ showGridLines: false }],
  });
  sheet.addRow([
    'predecessor_activity_code',
    'predecessor_title',
    'relationship_type',
    'lag_days',
    'successor_activity_code',
    'successor_title',
  ]);
  sheet.getRow(1).font = { bold: true };

  params.logicLinks.forEach((link) => {
    sheet.addRow([
      link.predecessorActivityCode,
      actByCode.get(link.predecessorActivityCode)?.activityDescription ?? '',
      link.relationshipType,
      link.lagDays,
      link.successorActivityCode,
      actByCode.get(link.successorActivityCode)?.activityDescription ?? '',
    ]);
  });
}

function addExportInfoSheet(workbook: ExcelJS.Workbook, params: BuildGanttWorkbookParams): void {
  const exportedAt = params.exportedAt ?? new Date();
  const sheet = workbook.addWorksheet(EXPORT_INFO_SHEET_NAME, {
    views: [{ showGridLines: false }],
  });
  sheet.addRows([
    ['field', 'value'],
    ['project_name', params.projectName],
    ['estimate_type', params.estimateType],
    ['exported_at', exportedAt.toISOString()],
    ['activity_count', params.cpmResult!.activities.length],
    ['project_duration_days', params.cpmResult!.projectDurationDays],
    ['export_format', 'Level III Gantt styled workbook'],
  ]);
}

export function buildLevelThreeGanttExcelFileName(projectName: string, date = new Date()): string {
  const stem = sanitizeEstimateExportFileStem(projectName);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${stem}-level-iii-gantt-${year}-${month}-${day}.xlsx`;
}

export async function buildLevelThreeGanttExcelWorkbook(
  params: BuildGanttWorkbookParams,
): Promise<ExcelJS.Workbook> {
  if (!params.cpmResult || !params.activities?.length) {
    throw new Error('CPM result and activities are required for Level III Gantt Excel export.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Arden Project OS';
  workbook.created = params.exportedAt ?? new Date();

  addLevelThreeGanttSheet(workbook, params);

  if (params.resourceHistogram && params.resourceHistogram.length > 0) {
    addResourceHistogramSheet(workbook, params.resourceHistogram);
  }

  addCpmTableSheet(workbook, params);
  addLogicNetworkSheet(workbook, params);
  addExportInfoSheet(workbook, params);

  return workbook;
}

export async function downloadLevelThreeGanttExcel(
  params: BuildGanttWorkbookParams & { fileName?: string },
): Promise<void> {
  const workbook = await buildLevelThreeGanttExcelWorkbook(params);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const fileName = params.fileName ?? buildLevelThreeGanttExcelFileName(params.projectName);
  saveAs(blob, fileName);
}
