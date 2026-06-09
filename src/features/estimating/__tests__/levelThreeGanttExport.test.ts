import { describe, expect, it, vi, beforeEach } from 'vitest';
import type ExcelJS from 'exceljs';

vi.mock('../../../utils/pdf', () => ({
  savePDFWithPlatformSupport: vi.fn(async () => true),
}));

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({
    width: 1200,
    height: 800,
    toDataURL: () =>
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  })),
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

import {
  CPM_TABLE_SHEET_NAME,
  LEVEL_THREE_EXCEL_COLORS,
  LEVEL_THREE_EXCEL_DAY_ROW,
  LEVEL_THREE_EXCEL_MONTH_ROW,
  LEVEL_THREE_GANTT_SHEET_NAME,
  RESOURCE_HISTOGRAM_SHEET_NAME,
  barColumnRangeForRow,
  buildLevelThreeGanttExcelFileName,
  buildLevelThreeGanttExcelWorkbook,
} from '../export/levelThreeGanttExcelExport';
import {
  createLevelThreeGanttPdf,
  downloadLevelThreeGanttPdfFromElement,
  isLandscapePdf,
  LEVEL_THREE_GANTT_PDF_TITLE,
} from '../export/levelThreeGanttPdfExport';
import { GANTT_EXPORT_INFO_SHEET_NAME, GANTT_LOGIC_NETWORK_SHEET_NAME } from '../export/ganttExcelExport';
import { savePDFWithPlatformSupport } from '../../../utils/pdf';
import html2canvas from 'html2canvas';
import type { ScheduleActivity } from '../scheduling/adapters/estimateLineItemsToScheduleActivities';
import {
  buildValidCpmDisplayFields,
  type CpmResult,
  type ResourceHistogramDay,
} from '../scheduling/cpmTypes';
import { getLevelThreeGanttRows } from '../scheduling/levelThreeGanttUtils';

function makeActivity(code: string): ScheduleActivity {
  return {
    activityCode: code,
    activityDescription: `Task ${code}`,
    divisionCode: '01',
    divisionName: 'General',
    durationDays: 2,
    laborHours: 0,
    manDays: 0,
    crewDays: 0,
    crewSize: 2,
    totalCost: 0,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

const cpmResult: CpmResult = {
  activities: [
    {
      activityCode: 'A',
      earlyStart: 0,
      earlyFinish: 2,
      lateStart: 0,
      lateFinish: 2,
      totalFloat: 0,
      freeFloat: 0,
      isCritical: true,
    },
    {
      activityCode: 'B',
      earlyStart: 2,
      earlyFinish: 4,
      lateStart: 3,
      lateFinish: 5,
      totalFloat: 1,
      freeFloat: 1,
      isCritical: false,
    },
  ],
  projectDurationDays: 5,
  criticalPathActivityCodes: ['A'],
  warnings: [],
  ...buildValidCpmDisplayFields(['A'], {
    hasRunCpm: true,
    hasValidPrecedenceDiagram: true,
  }),
};

const resourceHistogram: ResourceHistogramDay[] = [
  {
    dayOffset: 0,
    date: '2026-06-06',
    requiredCrew: 3,
    criticalRequiredCrew: 2,
    noncriticalRequiredCrew: 1,
    availableCrew: 2,
    overallocatedAmount: 1,
    isOverallocated: true,
    activeActivities: [
      {
        activityCode: 'A',
        activityTitle: 'Activity A',
        crewSize: 8,
        isCritical: true,
        scheduledStartDay: 0,
        scheduledFinishDay: 0,
      },
    ],
  },
];

function fillArgb(cell: ExcelJS.Cell): string | undefined {
  const fill = cell.fill as ExcelJS.FillPattern | undefined;
  return fill?.fgColor?.argb;
}

function borderStyle(cell: ExcelJS.Cell, side: keyof ExcelJS.Borders): string | undefined {
  const border = cell.border?.[side];
  return border && 'style' in border ? border.style : undefined;
}

describe('Level III Gantt export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function buildSampleWorkbook() {
    return buildLevelThreeGanttExcelWorkbook({
      schedule: null,
      projectName: 'Test Project',
      estimateType: 'detailed',
      cpmResult,
      activities: [makeActivity('A'), makeActivity('B')],
      projectStartDate: '2026-06-06',
      logicLinks: [
        {
          predecessorActivityCode: 'A',
          successorActivityCode: 'B',
          relationshipType: 'FS',
          lagDays: 0,
        },
      ],
      resourceHistogram,
    });
  }

  it('Excel export creates Level III Gantt sheet first', async () => {
    const workbook = await buildSampleWorkbook();
    expect(workbook.worksheets[0]?.name).toBe(LEVEL_THREE_GANTT_SHEET_NAME);
    expect(buildLevelThreeGanttExcelFileName('Test Project', new Date('2026-06-06T12:00:00.000Z'))).toBe(
      'test-project-level-iii-gantt-2026-06-06.xlsx',
    );
  });

  it('Excel export hides gridlines and freezes panes', async () => {
    const workbook = await buildSampleWorkbook();
    const sheet = workbook.getWorksheet(LEVEL_THREE_GANTT_SHEET_NAME)!;
    expect(sheet.views?.[0]?.showGridLines).toBe(false);
    expect(sheet.views?.[0]?.state).toBe('frozen');
    expect(sheet.views?.[0]?.xSplit).toBe(3);
    expect(sheet.views?.[0]?.ySplit).toBe(3);
  });

  it('Excel export has month row and day row with CODE/DESCRIPTION/FLOAT only', async () => {
    const workbook = await buildSampleWorkbook();
    const sheet = workbook.getWorksheet(LEVEL_THREE_GANTT_SHEET_NAME)!;

    expect(sheet.getCell(LEVEL_THREE_EXCEL_MONTH_ROW, 4).value).toBe('JUN');
    expect(sheet.getCell(LEVEL_THREE_EXCEL_DAY_ROW, 1).value).toBe('CODE');
    expect(sheet.getCell(LEVEL_THREE_EXCEL_DAY_ROW, 2).value).toBe('DESCRIPTION');
    expect(sheet.getCell(LEVEL_THREE_EXCEL_DAY_ROW, 3).value).toBe('FLOAT');
    expect(sheet.getCell(LEVEL_THREE_EXCEL_DAY_ROW, 4).value).toBe(6);
    expect(sheet.getCell(LEVEL_THREE_EXCEL_DAY_ROW, 5).value).toBe(7);

    const dayHeaderValues = Array.from({ length: 6 }, (_, index) =>
      sheet.getCell(LEVEL_THREE_EXCEL_DAY_ROW, index + 1).value,
    );
    expect(dayHeaderValues).not.toContain('DUR');
    expect(dayHeaderValues).not.toContain('START');
    expect(dayHeaderValues).not.toContain('FINISH');
    expect(dayHeaderValues).not.toContain('Duration');
  });

  it('Excel export styles critical, noncritical, and float cells', async () => {
    const workbook = await buildSampleWorkbook();
    const sheet = workbook.getWorksheet(LEVEL_THREE_GANTT_SHEET_NAME)!;

    const criticalCell = sheet.getCell(4, 4);
    const noncriticalCell = sheet.getCell(5, 6);
    const floatCell = sheet.getCell(5, 8);

    expect(fillArgb(criticalCell)).toBe(LEVEL_THREE_EXCEL_COLORS.critical);
    expect(fillArgb(noncriticalCell)).toBe(LEVEL_THREE_EXCEL_COLORS.noncritical);
    expect(fillArgb(floatCell)).toBe(LEVEL_THREE_EXCEL_COLORS.floatFill);
    expect(borderStyle(floatCell, 'left')).toBe('dashed');
  });

  it('Excel export includes Resource Histogram, CPM Table, Logic Network, and Export Info sheets', async () => {
    const workbook = await buildSampleWorkbook();
    const names = workbook.worksheets.map((sheet) => sheet.name);
    expect(names).toEqual([
      LEVEL_THREE_GANTT_SHEET_NAME,
      RESOURCE_HISTOGRAM_SHEET_NAME,
      CPM_TABLE_SHEET_NAME,
      GANTT_LOGIC_NETWORK_SHEET_NAME,
      GANTT_EXPORT_INFO_SHEET_NAME,
    ]);
  });

  it('bar column math uses CPM day offsets', () => {
    const rows = getLevelThreeGanttRows(
      [makeActivity('A'), makeActivity('B')],
      cpmResult,
      '2026-06-06',
    );
    const critical = barColumnRangeForRow(rows[0]);
    const noncritical = barColumnRangeForRow(rows[1]);

    expect(critical.barStartCol).toBe(4);
    expect(critical.barEndCol).toBe(5);
    expect(critical.floatStartCol).toBeNull();
    expect(noncritical.barStartCol).toBe(6);
    expect(noncritical.barEndCol).toBe(7);
    expect(noncritical.floatStartCol).toBe(8);
    expect(noncritical.floatEndCol).toBe(8);
  });

  it('Gantt PDF export creates landscape PDF and does not use portrait mode', () => {
    const doc = createLevelThreeGanttPdf();
    expect(isLandscapePdf(doc)).toBe(true);
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
  });

  it('PDF export captures chart DOM element via html2canvas', async () => {
    const element = {
      scrollWidth: 800,
      scrollHeight: 400,
    } as HTMLElement;

    await downloadLevelThreeGanttPdfFromElement({
      chartElement: element,
      projectName: 'Test Project',
    });

    expect(html2canvas).toHaveBeenCalledWith(element, expect.objectContaining({ scale: 2 }));
    expect(savePDFWithPlatformSupport).toHaveBeenCalledWith(
      expect.objectContaining({
        internal: expect.objectContaining({
          pageSize: expect.objectContaining({
            getWidth: expect.any(Function),
            getHeight: expect.any(Function),
          }),
        }),
      }),
      expect.any(String),
      LEVEL_THREE_GANTT_PDF_TITLE,
    );

    const savedDoc = vi.mocked(savePDFWithPlatformSupport).mock.calls[0]?.[0];
    expect(savedDoc).toBeDefined();
    expect(isLandscapePdf(savedDoc!)).toBe(true);
  });
});
