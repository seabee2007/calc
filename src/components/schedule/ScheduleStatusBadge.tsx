import React from 'react';
import type { ScheduleEventStatus } from '../../types/scheduleEvent';
import { SCHEDULE_STATUS_LABELS } from '../../types/scheduleEvent';
import { SCHEDULE_STATUS_STYLES } from './scheduleTheme';

interface Props {
  status: ScheduleEventStatus;
  compact?: boolean;
}

export default function ScheduleStatusBadge({ status, compact }: Props) {
  const style = SCHEDULE_STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 font-medium ${style.badge} ${
        compact ? 'text-[10px]' : 'text-xs'
      }`}
    >
      {SCHEDULE_STATUS_LABELS[status]}
    </span>
  );
}
