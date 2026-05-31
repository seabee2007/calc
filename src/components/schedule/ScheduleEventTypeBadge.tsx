import React from 'react';
import type { ScheduleEventType } from '../../types/scheduleEvent';
import { SCHEDULE_EVENT_TYPE_LABELS } from '../../types/scheduleEvent';
import { SCHEDULE_EVENT_TYPE_STYLES } from './scheduleTheme';

interface Props {
  type: ScheduleEventType;
  compact?: boolean;
}

export default function ScheduleEventTypeBadge({ type, compact }: Props) {
  const style = SCHEDULE_EVENT_TYPE_STYLES[type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-medium ${style.badge} ${
        compact ? 'text-[10px]' : 'text-xs'
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden />
      {SCHEDULE_EVENT_TYPE_LABELS[type]}
    </span>
  );
}
