import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  GANTT_LOGIC_NETWORK_SHEET_NAME,
  GANTT_SCHEDULE_SHEET_NAME,
  buildGanttWorkbook,
} from '../export/ganttExcelExport';
import type { BuildGanttScheduleResult } from '../schedule/buildGanttSchedule';

const sampleSchedule: BuildGanttScheduleResult = {
  activities: [
    {
      activityCode: '03-01-01',
      title: 'Form slab',
      divisionCode: '03',
      divisionName: 'Concrete',
      workPackageCode: '03-01',
      workPackageName: 'Slab on Grade',
      durationDays: 2,
      plannedStart: '2026-06-01',
      plannedFinish: '2026-06-02',
      relationshipType: 'FS',
      lagDays: 0,
      crewSize: 2,
      laborHours: 16,
      manDays: 2,
      crewDays: 1,
      totalCost: 1200,
      notes: 'Sample note',
    },
  ],
  logicLinks: [],
  plannedDurationDays: 2,
  warnings: [],
};

describe('ganttExcelExport', () => {
  it('includes Gantt Schedule and Logic Network sheets with expected headers', () => {
    const workbook = buildGanttWorkbook({
      schedule: sampleSchedule,
      projectName: 'Sample Project',
      estimateType: 'detailed',
      exportedAt: new Date('2026-06-06T12:00:00.000Z'),
    });

    expect(workbook.SheetNames).toContain(GANTT_SCHEDULE_SHEET_NAME);
    expect(workbook.SheetNames).toContain(GANTT_LOGIC_NETWORK_SHEET_NAME);

    const scheduleSheet = workbook.Sheets[GANTT_SCHEDULE_SHEET_NAME];
    const scheduleRows = XLSX.utils.sheet_to_json<string[]>(scheduleSheet, {
      header: 1,
      raw: false,
    }) as string[][];

    expect(scheduleRows[0]).toEqual([
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
    ]);
    expect(scheduleRows[1]?.[0]).toBe('03-01-01');

    const logicSheet = workbook.Sheets[GANTT_LOGIC_NETWORK_SHEET_NAME];
    const logicRows = XLSX.utils.sheet_to_json<string[]>(logicSheet, {
      header: 1,
      raw: false,
    }) as string[][];

    expect(logicRows[0]).toEqual([
      'predecessor_activity_code',
      'predecessor_title',
      'relationship_type',
      'lag_days',
      'successor_activity_code',
      'successor_title',
    ]);
  });
});
