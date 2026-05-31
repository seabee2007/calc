import { describe, expect, it } from 'vitest';
import type { ScheduleEvent } from '../types/scheduleEvent';
import {
  buildRecurrenceInstanceId,
  expandRecurringEventsForRange,
  formatRecurrenceSummary,
  generateRecurrenceOccurrenceDates,
  parseRecurrenceInstanceId,
} from './scheduleRecurrenceUtils';
import { defaultRecurrenceRule } from './scheduleRecurrenceUtils';

function mockEvent(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: 'series-1',
    projectId: 'p1',
    taskId: null,
    createdBy: 'u1',
    title: 'Safety meeting',
    notes: null,
    eventType: 'general_task',
    status: 'scheduled',
    priority: 'medium',
    startDate: '2026-06-02',
    endDate: null,
    startTime: '08:00',
    endTime: '09:00',
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
    recurrenceRule: defaultRecurrenceRule(),
    recurrenceSeriesId: null,
    recurrenceInstanceDate: null,
    recurrenceExceptionType: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('generateRecurrenceOccurrenceDates', () => {
  it('generates weekly Tuesdays in June', () => {
    const rule = {
      ...defaultRecurrenceRule(),
      frequency: 'weekly' as const,
      interval: 1,
      weekdays: [1],
      endType: 'on_date' as const,
      endDate: '2026-06-30',
    };
    const dates = generateRecurrenceOccurrenceDates(
      rule,
      '2026-06-02',
      '2026-06-01',
      '2026-06-30',
    );
    expect(dates.length).toBeGreaterThan(3);
    expect(dates.every((d) => new Date(d + 'T12:00:00').getDay() === 2)).toBe(true);
  });

  it('respects after_count', () => {
    const rule = {
      frequency: 'daily' as const,
      interval: 1,
      endType: 'after_count' as const,
      occurrenceCount: 5,
    };
    const dates = generateRecurrenceOccurrenceDates(
      rule,
      '2026-06-01',
      '2026-01-01',
      '2026-12-31',
    );
    expect(dates).toHaveLength(5);
  });
});

describe('expandRecurringEventsForRange', () => {
  it('expands weekly series into visible instances', () => {
    const master = mockEvent({
      recurrenceRule: {
        frequency: 'daily',
        interval: 1,
        endType: 'after_count',
        occurrenceCount: 5,
      },
      startDate: '2026-06-01',
    });
    const expanded = expandRecurringEventsForRange(
      [master],
      '2026-06-01',
      '2026-06-05',
    );
    expect(expanded).toHaveLength(5);
    expect(expanded[0].id).toBe(buildRecurrenceInstanceId('series-1', '2026-06-01'));
    expect(expanded[0].isRecurringInstance).toBe(true);
  });
});

describe('parseRecurrenceInstanceId', () => {
  it('parses virtual ids', () => {
    expect(parseRecurrenceInstanceId('abc::2026-06-10')).toEqual({
      seriesId: 'abc',
      occurrenceDate: '2026-06-10',
    });
  });
});

describe('formatRecurrenceSummary', () => {
  it('describes weekly pattern', () => {
    const text = formatRecurrenceSummary(defaultRecurrenceRule());
    expect(text.toLowerCase()).toContain('week');
  });
});
