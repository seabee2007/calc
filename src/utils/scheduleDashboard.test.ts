import { describe, expect, it } from 'vitest';
import type { ScheduleEvent } from '../types/scheduleEvent';
import { buildScheduleDashboardSnapshot } from './scheduleDashboard';

function mockEvent(overrides: Partial<ScheduleEvent>): ScheduleEvent {
  return {
    id: 'e1',
    projectId: 'p1',
    taskId: null,
    createdBy: 'u1',
    title: 'Work meeting',
    notes: null,
    eventType: 'general_task',
    status: 'scheduled',
    priority: 'medium',
    startDate: '2026-06-02',
    endDate: null,
    startTime: '14:00',
    endTime: null,
    trade: null,
    crew: null,
    location: null,
    assignedTo: [],
    relatedDocuments: [],
    relatedPhotos: [],
    activityLog: [],
    comments: [],
    weatherRisk: null,
    milestoneKey: null,
    syncMetadata: null,
    recurrenceRule: {
      frequency: 'daily',
      interval: 1,
      endType: 'never',
    },
    recurrenceSeriesId: null,
    recurrenceInstanceDate: null,
    recurrenceExceptionType: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('buildScheduleDashboardSnapshot', () => {
  it('dedupes recurring master and modified exception for the same day', () => {
    const today = '2026-06-02';
    const master = mockEvent({
      id: 'master-1',
      startDate: today,
      recurrenceRule: {
        frequency: 'daily',
        interval: 1,
        endType: 'never',
      },
    });
    const exception = mockEvent({
      id: 'ex-1',
      recurrenceRule: null,
      recurrenceSeriesId: 'master-1',
      recurrenceInstanceDate: today,
      recurrenceExceptionType: 'modified',
      startDate: today,
      title: 'Work meeting',
    });

    const snapshot = buildScheduleDashboardSnapshot([master, exception], today);
    expect(snapshot.todayEvents).toHaveLength(1);
    expect(snapshot.todayEvents[0].title).toBe('Work meeting');
  });
});
