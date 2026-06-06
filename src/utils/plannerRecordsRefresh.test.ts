import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchPlannerRecordsChanged,
  PLANNER_RECORDS_CHANGED_EVENT,
  subscribePlannerRecordsChanged,
} from './plannerRecordsRefresh';

describe('plannerRecordsRefresh', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dispatches planner-records-changed with detail', () => {
    const listeners = new Map<string, Set<EventListener>>();
    vi.stubGlobal('window', {
      addEventListener: (type: string, listener: EventListener) => {
        const set = listeners.get(type) ?? new Set();
        set.add(listener);
        listeners.set(type, set);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        listeners.get(type)?.delete(listener);
      },
      dispatchEvent: (event: Event) => {
        for (const listener of listeners.get(event.type) ?? []) {
          listener(event);
        }
        return true;
      },
    });

    const handler = vi.fn();
    const unsubscribe = subscribePlannerRecordsChanged(handler);

    dispatchPlannerRecordsChanged({ kind: 'rfi', projectId: 'proj-1', id: 'rfi-1' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      kind: 'rfi',
      projectId: 'proj-1',
      id: 'rfi-1',
    });

    unsubscribe();
  });

  it('exports stable event name', () => {
    expect(PLANNER_RECORDS_CHANGED_EVENT).toBe('planner-records-changed');
  });
});
