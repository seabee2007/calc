import { describe, expect, it } from 'vitest';
import {
  isPlacementPourScheduleEvent,
  pourDateIsoToScheduleDate,
  PLACEMENT_POUR_SCHEDULE_SYNC_KEY,
} from './placementScheduleSyncService';
import type { ScheduleEvent } from '../types/scheduleEvent';

function mockEvent(syncMetadata: ScheduleEvent['syncMetadata']): ScheduleEvent {
  return {
    id: '1',
    projectId: 'p1',
    taskId: null,
    createdBy: 'u1',
    title: 'Test',
    notes: null,
    eventType: 'material_delivery',
    status: 'scheduled',
    priority: 'medium',
    startDate: '2026-06-15',
    endDate: null,
    startTime: null,
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
    syncMetadata,
    recurrenceRule: null,
    recurrenceSeriesId: null,
    recurrenceInstanceDate: null,
    recurrenceExceptionType: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('placementScheduleSyncService', () => {
  it('converts pour ISO to calendar date', () => {
    expect(pourDateIsoToScheduleDate('2026-06-15T12:00:00.000Z')).toBe('2026-06-15');
  });

  it('detects placement planner sync events', () => {
    expect(
      isPlacementPourScheduleEvent(
        mockEvent({ syncKey: PLACEMENT_POUR_SCHEDULE_SYNC_KEY }),
      ),
    ).toBe(true);
    expect(isPlacementPourScheduleEvent(mockEvent(null))).toBe(false);
  });
});
