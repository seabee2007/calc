import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { savePDFWithPlatformSupport } from '../../../utils/pdf';
import { sanitizeEstimateExportFileStem } from '../importExport/estimateExportBuilder';
import { isDisplayCritical } from '../scheduling/cpm/cpmDisplayCritical';
import type { CpmResult } from '../scheduling/cpmTypes';
import type { GanttExportMode } from './ganttExcelExport';
import { computeTodayDayOffset, getLocalDateYmd } from '../scheduling/levelThreeGanttGrid';
import {
  buildTimelineDays,
  buildTimelineMonthSegments,
  getLevelThreeGanttRows,
  type LevelThreeGanttRow,
  type TimelineMonthSegment,
} from '../scheduling/levelThreeGanttUtils';
import type { ScheduleActivity } from '../scheduling/adapters/estimateLineItemsToScheduleActivities';

export const LEVEL_THREE_GANTT_PDF_TITLE = 'Level III Gantt Schedule';

// ─── Public interfaces ────────────────────────────────────────────

/** Legacy DOM-capture params. Kept for backward compat. */
export interface DownloadLevelThreeGanttPdfParams {
  chartElement: HTMLElement;
  projectName: string;
  fileName?: string;
}

/** Programmatic export params — produces a print-quality light-theme PDF. */
export interface LevelThreeGanttPdfParams {
  projectName: string;
  fileName?: string;
  cpmResult: CpmResult;
  activities: ScheduleActivity[];
  projectStartDate: string;
  leveledOffsets?: Record<string, number>;
  exportedAt?: Date;
  /** Controls the schedule-type label in the header. Defaults to 'leveled'. */
  scheduleMode?: GanttExportMode;
}

// ─── Backward-compat helpers (used in existing tests) ────────────

export function createLevelThreeGanttPdf(): jsPDF {
  return new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });
}

export function isLandscapePdf(doc: jsPDF): boolean {
  return doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight();
}

export function buildLevelThreeGanttPdfFileName(projectName: string, date = new Date()): string {
  const stem = sanitizeEstimateExportFileStem(projectName);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${stem}-level-iii-gantt-${year}-${month}-${day}.pdf`;
}

/**
 * Legacy DOM-capture PDF. Kept for test compatibility.
 * For production exports use downloadLevelThreeGanttPdf() instead.
 */
export async function downloadLevelThreeGanttPdfFromElement(
  params: DownloadLevelThreeGanttPdfParams,
): Promise<void> {
  const canvas = await html2canvas(params.chartElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    scrollX: 0,
    scrollY: typeof window !== 'undefined' ? -window.scrollY : 0,
    windowWidth: params.chartElement.scrollWidth,
    width: params.chartElement.scrollWidth,
    height: params.chartElement.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/png');
  const doc = createLevelThreeGanttPdf();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const headerHeight = 22;
  const footerHeight = 9;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2 - headerHeight - footerHeight;

  const drawLegacyHeader = (pageNum: number): void => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(6, 182, 212);
    doc.text('ARDEN PROJECT OS', pageWidth - margin, margin + 5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(LEVEL_THREE_GANTT_PDF_TITLE, margin, margin + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Project: ${params.projectName}`, margin, margin + 13.5);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const exportDate = new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    doc.text(`Exported: ${exportDate}  |  Page ${pageNum}`, margin, margin + 19);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, margin + headerHeight - 0.5, pageWidth - margin, margin + headerHeight - 0.5);
  };

  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imageTop = margin + headerHeight;
  let heightLeft = imgHeight;
  let position = imageTop;
  let pageNum = 1;

  drawLegacyHeader(pageNum);
  doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
  heightLeft -= usableHeight;

  while (heightLeft > 0) {
    position = imageTop - (imgHeight - heightLeft);
    pageNum += 1;
    doc.addPage();
    drawLegacyHeader(pageNum);
    doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= usableHeight;
  }

  const fileName = params.fileName ?? buildLevelThreeGanttPdfFileName(params.projectName);
  await savePDFWithPlatformSupport(doc, fileName, LEVEL_THREE_GANTT_PDF_TITLE);
}

// ─── Programmatic PDF layout constants (A3 landscape) ────────────

const ML = 12;       // left / right margin (mm)
const MT = 10;       // top / bottom margin (mm)
const HEADER_H = 27; // title block height
const LEGEND_H = 9;  // legend row height
const MONTH_ROW_H = 7;
const DAY_ROW_H = 6;
const ROW_H = 6;     // activity row height
const FOOTER_H = 7;
const FOOTER_GAP = 2;

const CODE_W = 21;
const DESC_W = 54;
const FLOAT_W = 12;
const PANEL_W = CODE_W + DESC_W + FLOAT_W; // 87 mm

const MIN_DAY_W = 3.2;
const MAX_DAY_W = 12.0;

// Light / print-optimised colours
const PC = {
  brand:        [6, 182, 212]   as [number, number, number],
  headerBg:     [241, 245, 249] as [number, number, number],
  rowAlt:       [248, 250, 252] as [number, number, number],
  text:         [15, 23, 42]    as [number, number, number],
  muted:        [100, 116, 139] as [number, number, number],
  border:       [203, 213, 225] as [number, number, number],
  criticalText: [185, 28, 28]   as [number, number, number],
  criticalBar:  [239, 68, 68]   as [number, number, number],
  noncritBar:   [6, 182, 212]   as [number, number, number],
  floatColor:   [203, 213, 225] as [number, number, number],
  today:        [6, 182, 212]   as [number, number, number],
  white:        [255, 255, 255] as [number, number, number],
};

function setC(doc: jsPDF, color: [number, number, number], target: 'fill' | 'draw' | 'text'): void {
  if (target === 'fill') doc.setFillColor(color[0], color[1], color[2]);
  else if (target === 'draw') doc.setDrawColor(color[0], color[1], color[2]);
  else doc.setTextColor(color[0], color[1], color[2]);
}

function formatYmdShort(ymd: string): string {
  const parts = ymd.split('-').map(Number);
  const y = parts[0] ?? 2025;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

function addDaysToYmd(ymd: string, days: number): string {
  const parts = ymd.split('-').map(Number);
  const date = new Date((parts[0] ?? 2025), (parts[1] ?? 1) - 1, (parts[2] ?? 1) + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

// ─── Section drawing functions ────────────────────────────────────

function scheduleModeLabel(mode: GanttExportMode | undefined): string {
  return mode === 'baseline' ? 'CPM Baseline' : 'Resource Leveled';
}

function drawPdfHeader(
  doc: jsPDF,
  left: number,
  width: number,
  projectName: string,
  startDateStr: string,
  finishDateStr: string,
  exportedAt: Date,
  scheduleMode: GanttExportMode | undefined,
): void {
  const top = MT;
  const modeLabel = scheduleModeLabel(scheduleMode);

  setC(doc, PC.white, 'fill');
  doc.rect(left, top, width, HEADER_H, 'F');

  // Brand label — small, cyan, right-aligned
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setC(doc, PC.brand, 'text');
  doc.text('ARDEN PROJECT OS', left + width, top + 5.5, { align: 'right' });

  // Main title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  setC(doc, PC.text, 'text');
  doc.text('Level III Gantt Schedule', left, top + 8);

  // Schedule mode badge — right of title
  const titleW = doc.getTextWidth('Level III Gantt Schedule');
  const badgeColor: [number, number, number] = scheduleMode === 'baseline'
    ? [245, 158, 11]   // amber-400
    : [6, 182, 212];   // cyan-500 (leveled = brand colour)
  setC(doc, badgeColor, 'text');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(modeLabel, left + titleW + 4, top + 7.5);

  // Project name
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setC(doc, PC.text, 'text');
  doc.text(`Project: ${projectName}`, left, top + 15.5);

  // Date range + export date
  doc.setFontSize(8);
  setC(doc, PC.muted, 'text');
  const exportStr = exportedAt.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  doc.text(
    `Date Range: ${startDateStr} – ${finishDateStr}    |    Exported: ${exportStr}    |    Schedule: ${modeLabel}`,
    left, top + 22,
  );

  // Divider
  setC(doc, PC.border, 'draw');
  doc.setLineWidth(0.3);
  doc.line(left, top + HEADER_H, left + width, top + HEADER_H);
}

function drawPdfLegend(doc: jsPDF, left: number, top: number, width: number): void {
  setC(doc, PC.headerBg, 'fill');
  doc.rect(left, top, width, LEGEND_H, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setC(doc, PC.muted, 'text');
  doc.text('LEGEND:', left + 1.5, top + LEGEND_H - 2.2);

  const items: Array<{ color: [number, number, number]; label: string; dashed?: boolean }> = [
    { color: PC.criticalBar, label: 'Critical Path' },
    { color: PC.noncritBar, label: 'Noncritical' },
    { color: PC.floatColor, label: 'Total Float', dashed: true },
    { color: PC.today, label: 'Today' },
  ];

  let x = left + 22;
  for (const item of items) {
    if (item.dashed) {
      setC(doc, item.color, 'draw');
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([1.5, 1], 0);
      doc.rect(x, top + 2.2, 7.5, 3.8, 'D');
      doc.setLineDashPattern([], 0);
      doc.setLineWidth(0.1);
    } else {
      setC(doc, item.color, 'fill');
      doc.rect(x, top + 2.2, 7.5, 3.8, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setC(doc, PC.text, 'text');
    const labelX = x + 9;
    doc.text(item.label, labelX, top + LEGEND_H - 2.2);
    x = labelX + doc.getTextWidth(item.label) + 6;
  }

  setC(doc, PC.border, 'draw');
  doc.setLineWidth(0.2);
  doc.line(left, top + LEGEND_H, left + width, top + LEGEND_H);
}

function drawMonthRow(
  doc: jsPDF,
  opts: {
    left: number;
    timelineLeft: number;
    top: number;
    dayW: number;
    monthSegments: TimelineMonthSegment[];
    startOffset: number;
    endOffset: number;
  },
): void {
  const { left, timelineLeft, top, dayW, monthSegments, startOffset, endOffset } = opts;

  setC(doc, PC.headerBg, 'fill');
  doc.rect(left, top, PANEL_W, MONTH_ROW_H, 'F');

  for (const seg of monthSegments) {
    const segStart = Math.max(seg.startDayOffset, startOffset);
    const segEnd = Math.min(seg.startDayOffset + seg.dayCount - 1, endOffset);
    if (segStart > segEnd) continue;

    const cellX = timelineLeft + (segStart - startOffset) * dayW;
    const cellW = (segEnd - segStart + 1) * dayW;

    setC(doc, PC.headerBg, 'fill');
    doc.rect(cellX, top, cellW, MONTH_ROW_H, 'F');

    setC(doc, PC.border, 'draw');
    doc.setLineWidth(0.2);
    doc.rect(cellX, top, cellW, MONTH_ROW_H, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setC(doc, PC.text, 'text');
    const label = truncateText(doc, seg.monthLabel, cellW - 2);
    doc.text(label, cellX + cellW / 2, top + MONTH_ROW_H - 1.5, { align: 'center' });
  }
}

function drawDayRow(
  doc: jsPDF,
  opts: {
    left: number;
    timelineLeft: number;
    top: number;
    dayW: number;
    timelineDays: Array<{ dayOffset: number; dayOfMonth: number; isToday: boolean; isWeekend: boolean }>;
    startOffset: number;
    endOffset: number;
    todayOffset: number | null;
  },
): void {
  const { left, timelineLeft, top, dayW, timelineDays, startOffset, endOffset, todayOffset } = opts;

  // Left-panel column labels
  setC(doc, PC.headerBg, 'fill');
  doc.rect(left, top, PANEL_W, DAY_ROW_H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setC(doc, PC.text, 'text');
  doc.text('CODE', left + 1.5, top + DAY_ROW_H - 1.5);
  doc.text('DESCRIPTION', left + CODE_W + 1.5, top + DAY_ROW_H - 1.5);
  doc.text('FLOAT', left + CODE_W + DESC_W + FLOAT_W / 2, top + DAY_ROW_H - 1.5, { align: 'center' });

  setC(doc, PC.border, 'draw');
  doc.setLineWidth(0.3);
  doc.line(left + PANEL_W, top, left + PANEL_W, top + DAY_ROW_H);

  for (const day of timelineDays) {
    if (day.dayOffset < startOffset || day.dayOffset > endOffset) continue;

    const cellX = timelineLeft + (day.dayOffset - startOffset) * dayW;
    const isToday = todayOffset !== null && day.dayOffset === todayOffset;

    setC(doc, isToday ? PC.today : PC.headerBg, 'fill');
    doc.rect(cellX, top, dayW, DAY_ROW_H, 'F');

    setC(doc, PC.border, 'draw');
    doc.setLineWidth(0.1);
    doc.rect(cellX, top, dayW, DAY_ROW_H, 'D');

    if (dayW >= 4.5) {
      doc.setFont('helvetica', isToday ? 'bold' : 'normal');
      doc.setFontSize(5.5);
      setC(doc, isToday ? PC.white : PC.muted, 'text');
      doc.text(String(day.dayOfMonth), cellX + dayW / 2, top + DAY_ROW_H - 1.2, { align: 'center' });
    }

    if (isToday) {
      setC(doc, PC.today, 'draw');
      doc.setLineWidth(0.5);
      doc.line(cellX, top, cellX, top + DAY_ROW_H);
      doc.setLineWidth(0.1);
    }
  }
}

function drawActivityRow(
  doc: jsPDF,
  opts: {
    row: LevelThreeGanttRow;
    rowY: number;
    left: number;
    timelineLeft: number;
    dayW: number;
    startOffset: number;
    endOffset: number;
    rowAlt: boolean;
    todayOffset: number | null;
    cpmResult: CpmResult;
  },
): void {
  const { row, rowY, left, timelineLeft, dayW, startOffset, endOffset, rowAlt, todayOffset, cpmResult } = opts;

  // Compute bar geometry first so displayCritical can use adjustedFloat
  const earlyStart = row.cpm.earlyStart + row.leveledOffset;
  const duration = row.activity.durationDays;
  const adjustedFloat = Math.max(0, row.cpm.totalFloat - row.leveledOffset);

  // Match the same critical-display logic as resolveGanttCellKind:
  // an activity leveled past all its float is displayed as critical even if not on the CPM critical path.
  const displayCritical =
    isDisplayCritical(cpmResult, row.activity.activityCode) ||
    (row.leveledOffset > 0 && adjustedFloat === 0);

  const rowFill = rowAlt ? PC.rowAlt : PC.white;

  // Left panel
  setC(doc, rowFill, 'fill');
  doc.rect(left, rowY, PANEL_W, ROW_H, 'F');

  doc.setFont('helvetica', displayCritical ? 'bold' : 'normal');
  doc.setFontSize(6.5);
  setC(doc, displayCritical ? PC.criticalText : PC.text, 'text');
  doc.text(row.activity.activityCode, left + 1.5, rowY + ROW_H - 1.5);

  doc.setFont('helvetica', 'normal');
  setC(doc, PC.text, 'text');
  const desc = truncateText(doc, row.activity.activityDescription, DESC_W - 2);
  doc.text(desc, left + CODE_W + 1.5, rowY + ROW_H - 1.5);

  // Show adjusted float (matches on-screen display)
  doc.setFontSize(6);
  setC(doc, PC.muted, 'text');
  doc.text(
    `${adjustedFloat}d`,
    left + CODE_W + DESC_W + FLOAT_W / 2,
    rowY + ROW_H - 1.5,
    { align: 'center' },
  );

  setC(doc, PC.border, 'draw');
  doc.setLineWidth(0.3);
  doc.line(left + PANEL_W, rowY, left + PANEL_W, rowY + ROW_H);

  // Timeline background
  const windowW = (endOffset - startOffset + 1) * dayW;
  setC(doc, rowFill, 'fill');
  doc.rect(timelineLeft, rowY, windowW, ROW_H, 'F');

  // Today line
  if (todayOffset !== null && todayOffset >= startOffset && todayOffset <= endOffset) {
    const todayX = timelineLeft + (todayOffset - startOffset) * dayW;
    setC(doc, PC.today, 'draw');
    doc.setLineWidth(0.5);
    doc.line(todayX, rowY, todayX, rowY + ROW_H);
    doc.setLineWidth(0.1);
  }

  const totalFloat = adjustedFloat; // alias for float-bar section below

  const visBarStart = Math.max(earlyStart, startOffset);
  const visBarEnd = Math.min(earlyStart + duration - 1, endOffset);
  if (visBarStart <= visBarEnd) {
    const barX = timelineLeft + (visBarStart - startOffset) * dayW;
    const barW = (visBarEnd - visBarStart + 1) * dayW;
    setC(doc, displayCritical ? PC.criticalBar : PC.noncritBar, 'fill');
    doc.rect(barX, rowY + 1.2, barW, ROW_H - 2.4, 'F');
  }

  // Float bar (dashed outline)
  if (totalFloat > 0) {
    const floatStart = earlyStart + duration;
    const visFloatStart = Math.max(floatStart, startOffset);
    const visFloatEnd = Math.min(floatStart + totalFloat - 1, endOffset);
    if (visFloatStart <= visFloatEnd) {
      const floatX = timelineLeft + (visFloatStart - startOffset) * dayW;
      const floatW = (visFloatEnd - visFloatStart + 1) * dayW;
      setC(doc, PC.border, 'draw');
      doc.setLineWidth(0.35);
      doc.setLineDashPattern([1.5, 1], 0);
      doc.rect(floatX, rowY + 1.8, floatW, ROW_H - 3.6, 'D');
      doc.setLineDashPattern([], 0);
      doc.setLineWidth(0.1);
    }
  }

  // Row bottom border
  setC(doc, PC.border, 'draw');
  doc.setLineWidth(0.1);
  doc.line(left, rowY + ROW_H, left + PANEL_W + windowW, rowY + ROW_H);
}

function drawPageFooter(
  doc: jsPDF,
  left: number,
  footerTop: number,
  width: number,
  pageNum: number,
  totalPages: number,
  exportedAt: Date,
): void {
  setC(doc, PC.border, 'draw');
  doc.setLineWidth(0.3);
  doc.line(left, footerTop, left + width, footerTop);

  const y = footerTop + 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setC(doc, PC.muted, 'text');
  doc.text('Arden Project OS', left, y);
  doc.text(`Page ${pageNum} of ${totalPages}`, left + width / 2, y, { align: 'center' });
  const dateStr = exportedAt.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  doc.text(`Generated: ${dateStr}`, left + width, y, { align: 'right' });
}

// ─── Main programmatic export ─────────────────────────────────────

/**
 * Programmatic, print-quality, light-theme Level III Gantt PDF.
 * Uses A3 landscape, paginating both vertically and horizontally as needed.
 * No html2canvas capture — all layout is drawn via jsPDF primitives.
 */
export async function downloadLevelThreeGanttPdf(params: LevelThreeGanttPdfParams): Promise<void> {
  const exportedAt = params.exportedAt ?? new Date();
  const leveledOffsets = params.leveledOffsets ?? {};

  // Extend the timeline beyond the CPM baseline when leveling pushes activities forward.
  const actByCode = new Map(params.activities.map((a) => [a.activityCode, a]));
  const projectDuration = Math.max(
    params.cpmResult.projectDurationDays,
    ...params.cpmResult.activities.map((ca) => {
      const act = actByCode.get(ca.activityCode);
      const lo = leveledOffsets[ca.activityCode] ?? 0;
      return ca.earlyStart + lo + (act?.durationDays ?? 0);
    }),
    1,
  );

  const finishYmd = addDaysToYmd(params.projectStartDate, projectDuration - 1);

  const timelineDays = buildTimelineDays(params.projectStartDate, projectDuration);
  const monthSegments = buildTimelineMonthSegments(timelineDays);
  const ganttRows = getLevelThreeGanttRows(
    params.activities,
    params.cpmResult,
    params.projectStartDate,
    leveledOffsets,
  );
  const todayOffset = computeTodayDayOffset(params.projectStartDate, getLocalDateYmd(), projectDuration);

  // A3 landscape: 420 × 297 mm
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - 2 * ML;
  const timelineW = contentW - PANEL_W;

  const dayW = Math.max(MIN_DAY_W, Math.min(MAX_DAY_W, timelineW / projectDuration));
  const daysPerPage = Math.floor(timelineW / dayW);

  // Horizontal page windows
  const dateWindows: Array<{ startOffset: number; endOffset: number }> = [];
  for (let start = 0; start < projectDuration; start += daysPerPage) {
    dateWindows.push({
      startOffset: start,
      endOffset: Math.min(start + daysPerPage - 1, projectDuration - 1),
    });
  }

  // Vertical page windows
  const ganttTop = MT + HEADER_H + LEGEND_H;
  const footerTop = pageH - MT - FOOTER_H;
  const activitiesAreaH = footerTop - ganttTop - FOOTER_GAP - MONTH_ROW_H - DAY_ROW_H;
  const activitiesPerPage = Math.max(1, Math.floor(activitiesAreaH / ROW_H));

  const activityWindows: Array<{ startIdx: number; endIdx: number }> = [];
  for (let start = 0; start < Math.max(ganttRows.length, 1); start += activitiesPerPage) {
    activityWindows.push({
      startIdx: start,
      endIdx: Math.min(start + activitiesPerPage - 1, ganttRows.length - 1),
    });
  }

  const totalPages = dateWindows.length * activityWindows.length;
  const startDateStr = formatYmdShort(params.projectStartDate);
  const finishDateStr = formatYmdShort(finishYmd);
  let pageNum = 0;

  for (const actWin of activityWindows) {
    for (const dateWin of dateWindows) {
      pageNum += 1;
      if (pageNum > 1) doc.addPage();

      const left = ML;
      const timelineLeft = left + PANEL_W;

      // Use a slightly wider column when the last window has fewer days
      const windowDays = dateWin.endOffset - dateWin.startOffset + 1;
      const windowDayW =
        windowDays < daysPerPage
          ? Math.min(MAX_DAY_W, timelineW / windowDays)
          : dayW;

      drawPdfHeader(doc, left, contentW, params.projectName, startDateStr, finishDateStr, exportedAt, params.scheduleMode);
      drawPdfLegend(doc, left, MT + HEADER_H, contentW);

      const monthTop = ganttTop;
      drawMonthRow(doc, {
        left, timelineLeft, top: monthTop, dayW: windowDayW,
        monthSegments, startOffset: dateWin.startOffset, endOffset: dateWin.endOffset,
      });

      const dayTop = monthTop + MONTH_ROW_H;
      drawDayRow(doc, {
        left, timelineLeft, top: dayTop, dayW: windowDayW,
        timelineDays, startOffset: dateWin.startOffset, endOffset: dateWin.endOffset,
        todayOffset,
      });

      const activitiesTop = dayTop + DAY_ROW_H;
      const rowsSlice = ganttRows.slice(actWin.startIdx, actWin.endIdx + 1);

      rowsSlice.forEach((row, idx) => {
        drawActivityRow(doc, {
          row, rowY: activitiesTop + idx * ROW_H,
          left, timelineLeft, dayW: windowDayW,
          startOffset: dateWin.startOffset, endOffset: dateWin.endOffset,
          rowAlt: idx % 2 === 1,
          todayOffset, cpmResult: params.cpmResult,
        });
      });

      // Gantt grid outer border
      if (rowsSlice.length > 0) {
        const gridH = rowsSlice.length * ROW_H;
        const gridW = PANEL_W + windowDays * windowDayW;
        setC(doc, PC.border, 'draw');
        doc.setLineWidth(0.3);
        doc.rect(left, monthTop, gridW, MONTH_ROW_H + DAY_ROW_H + gridH, 'D');
      }

      drawPageFooter(doc, left, footerTop, contentW, pageNum, totalPages, exportedAt);
    }
  }

  const fileName = params.fileName ?? buildLevelThreeGanttPdfFileName(params.projectName, exportedAt);
  await savePDFWithPlatformSupport(doc, fileName, LEVEL_THREE_GANTT_PDF_TITLE);
}
