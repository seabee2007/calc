import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  computeTodayDayOffset,
  DAY_WIDTH,
  todayLineLeftPx,
} from '../levelThreeGanttGrid';
import { buildTimelineDays } from '../levelThreeGanttUtils';
import { mergeScheduleAssumptions } from '../scheduleAssumptions';

const pageSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/EstimateWorkspacePage.tsx',
  ),
  'utf8',
);

const excelExportSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../export/levelThreeGanttExcelExport.ts',
  ),
  'utf8',
);

describe('schedule start date sync wiring', () => {
  it('Schedule Preview control changes update scheduleSettings via updateScheduleSettings', () => {
    expect(pageSource).toContain('handleSchedulePlanControlsChange');
    expect(pageSource).toContain('scheduleSettingsHook.updateScheduleSettings');
    expect(pageSource).toContain('settingsPatch.projectStartDate = patch.projectStartDate');
    expect(pageSource).toContain('settingsPatch.includeWeekends = patch.includeWeekends');
  });

  it('syncs schedulePlanControls from loaded scheduleSettings.projectStartDate', () => {
    expect(pageSource).toContain(
      'scheduleSettingsHook.scheduleSettings.projectStartDate',
    );
    expect(pageSource).toContain('projectStartDate: loaded');
  });

  it('handleSaveEstimate merges scheduleSettings into assumptions before save', () => {
    expect(pageSource).toContain('const saveAssumptions = mergeScheduleAssumptions');
    expect(pageSource).toContain(
      '{ scheduleSettings: scheduleSettingsHook.scheduleSettings }',
    );
    expect(pageSource).toContain('existingAssumptions: saveAssumptions');
  });

  it('Gantt Preview export uses scheduleSettings.projectStartDate, not schedulePlanControls', () => {
    expect(pageSource).toContain(
      'scheduleSettingsHook.scheduleSettings.projectStartDate || getTodayScheduleDateYmd()',
    );
    const ganttExportBlock = pageSource.slice(
      pageSource.indexOf('const runGanttExport = useCallback'),
      pageSource.indexOf('const handleExportGanttPdf'),
    );
    expect(ganttExportBlock).not.toContain('schedulePlanControls.projectStartDate');
  });

  it('Level III CPM export uses scheduleSettings.projectStartDate', () => {
    expect(pageSource).toContain('const runCpmGanttExport = useCallback');
    expect(pageSource).toContain(
      'scheduleSettingsHook.scheduleSettings.projectStartDate || getTodayScheduleDateYmd()',
    );
  });

  it('Excel export uses local today date, not UTC toISOString', () => {
    expect(excelExportSource).toContain('getLocalDateYmd');
    expect(excelExportSource).not.toContain('toISOString().slice(0, 10)');
  });
});

describe('Level III Gantt timeline uses scheduleSettings.projectStartDate', () => {
  it('first timeline day matches projectStartDate 2026-06-04', () => {
    const days = buildTimelineDays('2026-06-04', 5, '2026-06-04');
    expect(days[0].dayOfMonth).toBe(4);
    expect(days[0].dayOffset).toBe(0);
  });

  it('first timeline day changes when projectStartDate changes to 2026-06-07', () => {
    const days = buildTimelineDays('2026-06-07', 5, '2026-06-07');
    expect(days[0].dayOfMonth).toBe(7);
    expect(days[0].dayOffset).toBe(0);
  });

  it('today line recalculates when projectStartDate changes', () => {
    const offsetFromJune4 = computeTodayDayOffset('2026-06-04', '2026-06-07', 30);
    const offsetFromJune7 = computeTodayDayOffset('2026-06-07', '2026-06-07', 30);

    expect(offsetFromJune4).toBe(3);
    expect(offsetFromJune7).toBe(0);
    expect(todayLineLeftPx(offsetFromJune4!)).toBe(3 * DAY_WIDTH);
    expect(todayLineLeftPx(offsetFromJune7!)).toBe(0);
  });
});

describe('mergeScheduleAssumptions persists projectStartDate', () => {
  it('writes scheduleSettings.projectStartDate into assumptions', () => {
    const merged = mergeScheduleAssumptions(
      {
        scheduleSettings: {
          projectStartDate: '2026-06-04',
          hoursPerDay: 8,
          availableCrewSize: 4,
          includeWeekends: false,
        },
      },
      { estimateSettings: { hoursPerDay: 8 } },
    );

    const settings = merged.scheduleSettings as { projectStartDate: string };
    expect(settings.projectStartDate).toBe('2026-06-04');
  });
});
