import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/pdf', () => ({
  savePDFWithPlatformSupport: vi.fn(async () => true),
}));

import { buildGanttPdfDocument } from '../export/ganttPdfExport';
import type { BuildGanttScheduleResult } from '../schedule/buildGanttSchedule';

const sampleSchedule: BuildGanttScheduleResult = {
  activities: [
    {
      activityCode: '03-01-01',
      title: 'Form slab',
      divisionCode: '03',
      divisionName: 'Concrete',
      durationDays: 2,
      plannedStart: '2026-06-01',
      plannedFinish: '2026-06-02',
      relationshipType: 'FS',
      lagDays: 0,
    },
    {
      activityCode: '03-01-02',
      title: 'Place concrete',
      divisionCode: '03',
      divisionName: 'Concrete',
      durationDays: 1,
      plannedStart: '2026-06-03',
      plannedFinish: '2026-06-03',
      predecessorActivityCode: '03-01-01',
      relationshipType: 'FS',
      lagDays: 0,
    },
  ],
  logicLinks: [
    {
      predecessorActivityCode: '03-01-01',
      predecessorTitle: 'Form slab',
      successorActivityCode: '03-01-02',
      successorTitle: 'Place concrete',
      relationshipType: 'FS',
      lagDays: 0,
    },
  ],
  plannedDurationDays: 3,
  warnings: [],
};

describe('ganttPdfExport', () => {
  it('buildGanttPdfDocument runs without throw and produces at least one page', () => {
    const doc = buildGanttPdfDocument({
      schedule: sampleSchedule,
      projectName: 'Sample Project',
      estimateType: 'detailed',
      exportedAt: new Date('2026-06-06T12:00:00.000Z'),
    });

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
