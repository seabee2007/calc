import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';

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

import { buildGanttWorkbook, LEVEL_THREE_GANTT_SHEET_NAME } from '../export/ganttExcelExport';
import { downloadLevelThreeGanttPdfFromElement } from '../export/levelThreeGanttPdfExport';
import { savePDFWithPlatformSupport } from '../../../utils/pdf';
import html2canvas from 'html2canvas';
import type { ScheduleActivity } from '../scheduling/adapters/estimateLineItemsToScheduleActivities';
import type { CpmResult } from '../scheduling/cpmTypes';

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
  projectDurationDays: 4,
  criticalPathActivityCodes: ['A'],
  warnings: [],
};

describe('Level III Gantt export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Excel export has Level III Gantt Chart sheet with day columns', () => {
    const workbook = buildGanttWorkbook({
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
    });

    expect(workbook.SheetNames).toContain(LEVEL_THREE_GANTT_SHEET_NAME);
    const sheet = workbook.Sheets[LEVEL_THREE_GANTT_SHEET_NAME];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 });
    const header = rows[0] as (string | number)[];
    expect(header.slice(0, 6)).toEqual([
      'Activity Code',
      'Description',
      'Float',
      'Duration',
      'Start',
      'Finish',
    ]);
    expect(header.length).toBeGreaterThan(6);
    expect(String(header[6])).toBe('6');
    expect(String(header[7])).toBe('7');
  });

  it('Excel export marks critical path cells with fill style', () => {
    const workbook = buildGanttWorkbook({
      schedule: null,
      projectName: 'Test Project',
      estimateType: 'detailed',
      cpmResult,
      activities: [makeActivity('A'), makeActivity('B')],
      projectStartDate: '2026-06-06',
    });
    const sheet = workbook.Sheets[LEVEL_THREE_GANTT_SHEET_NAME];
    const criticalCell = sheet.G2;
    expect(criticalCell?.v).toBe('■');
    expect(criticalCell?.s?.fill?.fgColor?.rgb).toBe('FFEF4444');
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
    expect(savePDFWithPlatformSupport).toHaveBeenCalled();
  });
});
