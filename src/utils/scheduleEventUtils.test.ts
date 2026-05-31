import { describe, expect, it } from 'vitest';
import type { ScheduleEvent } from '../types/scheduleEvent';
import { SCHEDULE_EVENT_TYPE_LABELS, SCHEDULE_EVENT_TYPES } from '../types/scheduleEvent';
import {
  compareEventsAsc,
  dayOperationalSummary,
  eventIntersectsRange,
  eventOverlapsDateRange,
  eventsForCalendarCell,
  filterEventsForVisibleRange,
  filterScheduleEvents,
  getCalendarLoadRange,
  getCalendarRangeLabel,
  getDateRangePreset,
  shiftCalendarAnchor,
  getEventDateSpan,
  getMonthGridDateBounds,
  getWeekDays,
  getWorkWeekDays,
  groupEventsByDate,
  groupEventsByDayForAgenda,
  isAllDayScheduleEvent,
  isMultiDayEvent,
  isTimedGridEvent,
  layoutMonthWeekMultiDayBars,
  layoutMultiDayBarsForDays,
  layoutTimedEventsForDay,
  resolveMilestoneForProject,
  splitEventsForTimeGrid,
  statusAccentClass,
  todayIsoDate,
} from './scheduleEventUtils';

function mockEvent(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: '1',
    projectId: 'p1',
    projectName: 'Alpha Tower',
    taskId: null,
    createdBy: 'u1',
    title: 'Site visit',
    notes: null,
    eventType: 'site_visit',
    status: 'scheduled',
    priority: 'medium',
    startDate: '2026-06-10',
    endDate: null,
    startTime: null,
    endTime: null,
    trade: 'Electrical',
    crew: 'Crew A',
    location: null,
    assignedTo: [],
    relatedDocuments: [],
    relatedPhotos: [],
    activityLog: [],
    comments: [],
    weatherRisk: null,
    milestoneKey: null,
    syncMetadata: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const LEAVE = mockEvent({
  id: 'leave',
  title: 'LEAVE',
  startDate: '2026-05-31',
  endDate: '2026-06-18',
  startTime: '08:00',
  endTime: '09:00',
  eventType: 'site_visit',
  status: 'completed',
});

describe('eventIntersectsRange (LEAVE May 31 – Jun 18)', () => {
  it('matches Outlook/Teams visibility matrix', () => {
    expect(eventIntersectsRange(LEAVE, '2026-05-24', '2026-05-30')).toBe(false);
    expect(eventIntersectsRange(LEAVE, '2026-05-31', '2026-06-06')).toBe(true);
    expect(eventIntersectsRange(LEAVE, '2026-06-07', '2026-06-13')).toBe(true);
    expect(eventIntersectsRange(LEAVE, '2026-06-14', '2026-06-20')).toBe(true);
    expect(eventIntersectsRange(LEAVE, '2026-06-01', '2026-06-05')).toBe(true);
    expect(eventIntersectsRange(LEAVE, '2026-06-08', '2026-06-12')).toBe(true);
    expect(eventIntersectsRange(LEAVE, '2026-06-15', '2026-06-18')).toBe(true);
    expect(eventIntersectsRange(LEAVE, '2026-06-01', '2026-06-01')).toBe(true);
    expect(eventIntersectsRange(LEAVE, '2026-06-10', '2026-06-10')).toBe(true);
    expect(eventIntersectsRange(LEAVE, '2026-06-18', '2026-06-18')).toBe(true);
    expect(eventIntersectsRange(LEAVE, '2026-06-19', '2026-06-19')).toBe(false);
    expect(eventIntersectsRange(LEAVE, '2026-05-01', '2026-05-31')).toBe(true);
    expect(eventIntersectsRange(LEAVE, '2026-06-01', '2026-06-30')).toBe(true);
  });

  it('aliases eventOverlapsDateRange', () => {
    expect(eventOverlapsDateRange(LEAVE, '2026-06-07', '2026-06-13')).toBe(true);
  });
});

describe('filterEventsForVisibleRange', () => {
  it('includes LEAVE for intersecting weeks only', () => {
    const all = [LEAVE, mockEvent({ id: 'other', startDate: '2026-05-01' })];
    expect(filterEventsForVisibleRange(all, '2026-05-24', '2026-05-30').map((e) => e.id)).toEqual([]);
    expect(filterEventsForVisibleRange(all, '2026-05-31', '2026-06-06').map((e) => e.id)).toEqual([
      'leave',
    ]);
  });
});

describe('getCalendarLoadRange', () => {
  it('uses full month bounds for month view', () => {
    const may = getCalendarLoadRange('month', '2026-05-15', '', '');
    expect(may).toEqual(getMonthGridDateBounds(2026, 4));
    expect(eventIntersectsRange(LEAVE, may.dateFrom, may.dateTo)).toBe(true);
  });

  it('uses single day for day view', () => {
    expect(getCalendarLoadRange('day', '2026-06-10', '', '')).toEqual({
      dateFrom: '2026-06-10',
      dateTo: '2026-06-10',
    });
  });
});

describe('filterScheduleEvents', () => {
  it('filters by date range using overlap not start date only', () => {
    const filtered = filterScheduleEvents([LEAVE], {
      dateFrom: '2026-06-07',
      dateTo: '2026-06-13',
    });
    expect(filtered).toHaveLength(1);
  });

  it('filters by trade and status', () => {
    const events = [
      mockEvent({ id: '1', trade: 'Electrical', status: 'scheduled' }),
      mockEvent({ id: '2', trade: 'Plumbing', status: 'delayed' }),
    ];
    const filtered = filterScheduleEvents(events, {
      trade: 'Electrical',
      status: 'scheduled',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('filters by priority and assigned user', () => {
    const events = [
      mockEvent({ id: '1', priority: 'critical', assignedTo: ['Alex'] }),
      mockEvent({ id: '2', priority: 'low', assignedTo: ['Bob'] }),
    ];
    expect(
      filterScheduleEvents(events, { priority: 'critical' }).map((e) => e.id),
    ).toEqual(['1']);
    expect(
      filterScheduleEvents(events, { assignedUser: 'alex' }).map((e) => e.id),
    ).toEqual(['1']);
  });
});

describe('groupEventsByDate', () => {
  it('groups and sorts by date', () => {
    const events = [
      mockEvent({ id: 'b', startDate: '2026-06-12' }),
      mockEvent({ id: 'a', startDate: '2026-06-10' }),
    ];
    const buckets = groupEventsByDate(events);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].key).toBe('2026-06-10');
    expect(buckets[1].events[0].id).toBe('b');
  });
});

describe('groupEventsByDayForAgenda', () => {
  it('labels today and tomorrow', () => {
    const today = '2026-06-10';
    const events = [
      mockEvent({ id: '1', startDate: today }),
      mockEvent({ id: '2', startDate: '2026-06-11' }),
      mockEvent({ id: '3', startDate: '2026-06-15' }),
    ];
    const groups = groupEventsByDayForAgenda(events, today);
    expect(groups[0].label).toBe('Today');
    expect(groups[1].label).toBe('Tomorrow');
    expect(groups[2].label).not.toBe('Today');
  });

  it('lists multi-day LEAVE once on start date', () => {
    const groups = groupEventsByDayForAgenda(
      [LEAVE, mockEvent({ id: 'sd', startDate: '2026-06-05' })],
      '2026-06-01',
    );
    const leaveGroups = groups.filter((g) => g.events.some((e) => e.id === 'leave'));
    expect(leaveGroups).toHaveLength(1);
    expect(leaveGroups[0].key).toBe('2026-05-31');
    const allIds = groups.flatMap((g) => g.events.map((e) => e.id));
    expect(allIds.filter((id) => id === 'leave')).toHaveLength(1);
  });
});

describe('dayOperationalSummary', () => {
  it('counts crews, deliveries, inspections, and deadlines', () => {
    const day = '2026-06-10';
    const events = [
      mockEvent({ eventType: 'crew_work_day', crew: 'A', startDate: day }),
      mockEvent({ eventType: 'crew_work_day', crew: 'A', startDate: day }),
      mockEvent({ eventType: 'material_delivery', startDate: day }),
      mockEvent({ eventType: 'inspection', startDate: day }),
      mockEvent({ eventType: 'rfi_due', startDate: day }),
    ];
    const summary = dayOperationalSummary(events, day);
    expect(summary.total).toBe(5);
    expect(summary.crews).toBe(1);
    expect(summary.deliveries).toBe(1);
    expect(summary.inspections).toBe(1);
    expect(summary.deadlines).toBe(1);
  });

  it('includes LEAVE on mid-span days', () => {
    expect(dayOperationalSummary([LEAVE], '2026-06-10').total).toBe(1);
    expect(dayOperationalSummary([LEAVE], '2026-06-19').total).toBe(0);
  });
});

describe('compareEventsAsc', () => {
  it('orders by date then time', () => {
    const a = mockEvent({ startDate: '2026-06-10', startTime: '08:00' });
    const b = mockEvent({ startDate: '2026-06-10', startTime: '14:00' });
    expect(compareEventsAsc(a, b)).toBeLessThan(0);
  });
});

describe('resolveMilestoneForProject', () => {
  it('finds milestone by milestone_key', () => {
    const events = [
      mockEvent({
        milestoneKey: 'bid_due',
        eventType: 'bid_due_date',
        title: 'Bid submission',
      }),
    ];
    const slots = resolveMilestoneForProject(events, 'p1');
    const bid = slots.find((s) => s.key === 'bid_due');
    expect(bid?.event?.title).toBe('Bid submission');
    expect(bid?.status).toBe('scheduled');
  });

  it('marks missing milestones as not_scheduled', () => {
    const slots = resolveMilestoneForProject([], 'p1');
    expect(slots.every((s) => s.status === 'not_scheduled')).toBe(true);
  });

  it('maps legacy warranty to warranty_end', () => {
    const events = [mockEvent({ milestoneKey: 'warranty', eventType: 'warranty_follow_up' })];
    const slot = resolveMilestoneForProject(events, 'p1').find((s) => s.key === 'warranty_end');
    expect(slot?.event).toBeTruthy();
  });
});

describe('statusAccentClass', () => {
  it('returns delayed accent', () => {
    expect(statusAccentClass('delayed')).toContain('amber');
  });
});

describe('getDateRangePreset', () => {
  it('returns bounded ranges for presets', () => {
    const week = getDateRangePreset('this_week');
    expect(week.dateFrom <= week.dateTo).toBe(true);
    const month = getDateRangePreset('this_month');
    expect(month.dateFrom <= month.dateTo).toBe(true);
  });
});

describe('SCHEDULE_EVENT_TYPE_LABELS', () => {
  it('has a label for every event type', () => {
    for (const t of SCHEDULE_EVENT_TYPES) {
      expect(SCHEDULE_EVENT_TYPE_LABELS[t]).toBeTruthy();
    }
  });
});

describe('getWorkWeekDays', () => {
  it('returns five weekdays starting Monday', () => {
    const days = getWorkWeekDays('2026-06-08');
    expect(days).toHaveLength(5);
    expect(days[0]).toBe('2026-06-08');
    expect(days[4]).toBe('2026-06-12');
  });
});

describe('layoutTimedEventsForDay', () => {
  it('positions timed events with top and height', () => {
    const layouts = layoutTimedEventsForDay([
      mockEvent({ startTime: '09:00', endTime: '10:30' }),
    ]);
    expect(layouts).toHaveLength(1);
    expect(layouts[0].topPx).toBeGreaterThan(0);
    expect(layouts[0].heightPx).toBeGreaterThan(0);
  });

  it('excludes all-day events', () => {
    const layouts = layoutTimedEventsForDay([mockEvent({ startTime: null })]);
    expect(layouts).toHaveLength(0);
    expect(isAllDayScheduleEvent(mockEvent({ startTime: null }))).toBe(true);
  });

  it('treats proposal due without time as all-day not timed grid', () => {
    const proposal = mockEvent({
      eventType: 'proposal_due',
      startTime: null,
      endTime: null,
    });
    expect(isAllDayScheduleEvent(proposal)).toBe(true);
    expect(isTimedGridEvent(proposal)).toBe(false);
    expect(layoutTimedEventsForDay([proposal])).toHaveLength(0);
  });
});

describe('shiftCalendarAnchor', () => {
  it('advances one month from May 31 without skipping June', () => {
    const next = shiftCalendarAnchor('month', '2026-05-31', 1);
    expect(next).toBe('2026-06-30');
    const prev = shiftCalendarAnchor('month', '2026-05-31', -1);
    expect(prev).toBe('2026-04-30');
  });

  it('today anchor stays in current month for month view', () => {
    const today = todayIsoDate();
    const label = getCalendarRangeLabel('month', today);
    const anchor = new Date(today + 'T12:00:00');
    expect(label).toContain(
      anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    );
  });
});

describe('getCalendarRangeLabel', () => {
  it('labels work week and agenda', () => {
    expect(getCalendarRangeLabel('agenda', '2026-06-10')).toBe('Agenda');
    expect(getCalendarRangeLabel('work_week', '2026-06-10')).toContain('Work week');
  });
});

describe('isMultiDayEvent', () => {
  it('returns true when endDate is after startDate', () => {
    expect(isMultiDayEvent(mockEvent({ startDate: '2026-06-01', endDate: '2026-06-04' }))).toBe(
      true,
    );
    expect(isMultiDayEvent(mockEvent({ startDate: '2026-06-01', endDate: null }))).toBe(false);
    expect(isMultiDayEvent(mockEvent({ startDate: '2026-06-01', endDate: '2026-06-01' }))).toBe(
      false,
    );
  });
});

describe('getEventDateSpan', () => {
  it('clips span to visible range', () => {
    const span = getEventDateSpan(
      mockEvent({ startDate: '2026-06-01', endDate: '2026-06-10' }),
      '2026-06-03',
      '2026-06-07',
    );
    expect(span).toEqual({ visibleStart: '2026-06-03', visibleEnd: '2026-06-07' });
  });

  it('clips LEAVE to work week Jun 15–18', () => {
    const days = getWorkWeekDays('2026-06-15');
    const span = getEventDateSpan(LEAVE, days[0], days[4]);
    expect(span).toEqual({ visibleStart: '2026-06-15', visibleEnd: '2026-06-18' });
  });
});

describe('layoutMultiDayBarsForDays', () => {
  it('spans columns Mon through Thu', () => {
    const days = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];
    const bars = layoutMultiDayBarsForDays(
      [mockEvent({ id: 'md1', startDate: '2026-06-01', endDate: '2026-06-04', title: 'Roof' })],
      days,
    );
    expect(bars).toHaveLength(1);
    expect(bars[0].startColumnIndex).toBe(0);
    expect(bars[0].spanColumns).toBe(4);
  });

  it('shows LEAVE on week May 31–Jun 6', () => {
    const days = getWeekDays('2026-05-25');
    expect(days[0]).toBe('2026-05-25');
    expect(days[6]).toBe('2026-05-31');
    const bars = layoutMultiDayBarsForDays([LEAVE], days);
    expect(bars).toHaveLength(1);
    expect(bars[0].startColumnIndex).toBe(6);
    expect(bars[0].spanColumns).toBe(1);
  });

  it('shows LEAVE across full week Jun 7–13', () => {
    const days = getWeekDays('2026-06-07');
    const bars = layoutMultiDayBarsForDays([LEAVE], days);
    expect(bars).toHaveLength(1);
    expect(bars[0].startColumnIndex).toBe(0);
    expect(bars[0].spanColumns).toBe(7);
  });
});

describe('layoutMonthWeekMultiDayBars', () => {
  it('shows LEAVE on May 31 in last week of May 2026', () => {
    const weeks = [
      [null, null, null, null, null, null, '2026-05-31'] as (string | null)[],
    ];
    const bars = layoutMonthWeekMultiDayBars(weeks[0], [LEAVE]);
    expect(bars).toHaveLength(1);
    expect(bars[0].startColumnIndex).toBe(6);
    expect(bars[0].spanColumns).toBe(1);
  });
});

describe('splitEventsForTimeGrid', () => {
  it('excludes multi-day from per-day single slots', () => {
    const days = ['2026-06-01', '2026-06-02'];
    const { multiDayBars, daySingleEvents } = splitEventsForTimeGrid(
      [
        mockEvent({ id: 'md', startDate: '2026-06-01', endDate: '2026-06-02' }),
        mockEvent({ id: 'sd', startDate: '2026-06-02', endDate: null }),
      ],
      days,
    );
    expect(multiDayBars).toHaveLength(1);
    expect(daySingleEvents.get('2026-06-01')).toHaveLength(0);
    expect(daySingleEvents.get('2026-06-02')?.map((e) => e.id)).toEqual(['sd']);
  });

  it('puts LEAVE in multi-day lane for day view Jun 10', () => {
    const { multiDayBars, daySingleEvents } = splitEventsForTimeGrid([LEAVE], ['2026-06-10']);
    expect(multiDayBars).toHaveLength(1);
    expect(multiDayBars[0].event.id).toBe('leave');
    expect(daySingleEvents.get('2026-06-10')).toHaveLength(0);
  });
});

describe('eventsForCalendarCell', () => {
  it('omits multi-day from month chips', () => {
    const cell = eventsForCalendarCell(
      [mockEvent({ id: 'md', startDate: '2026-06-01', endDate: '2026-06-03' })],
      '2026-06-02',
    );
    expect(cell).toHaveLength(0);
  });
});
