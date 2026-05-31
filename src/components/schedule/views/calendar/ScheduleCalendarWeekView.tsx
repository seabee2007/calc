import React, { useMemo } from 'react';
import type { ScheduleEvent } from '../../../../types/scheduleEvent';
import ScheduleTimeGridView from './ScheduleTimeGridView';
import {
  getWeekDays,
  getWeekStart,
  getWorkWeekDays,
  toIsoDate,
} from '../../../../utils/scheduleEventUtils';

interface Props {
  events: ScheduleEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  anchorIso: string;
  mode?: 'week' | 'work_week';
}

export default function ScheduleCalendarWeekView({
  events,
  selectedId,
  onSelect,
  anchorIso,
  mode = 'week',
}: Props) {
  const days = useMemo(() => {
    const weekStart = toIsoDate(getWeekStart(new Date(anchorIso + 'T12:00:00')));
    return mode === 'work_week' ? getWorkWeekDays(weekStart) : getWeekDays(weekStart);
  }, [anchorIso, mode]);

  return (
    <ScheduleTimeGridView
      events={events}
      days={days}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
}
