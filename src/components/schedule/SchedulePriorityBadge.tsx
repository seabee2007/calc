import React from 'react';
import type { SchedulePriority } from '../../types/scheduleEvent';
import { SCHEDULE_PRIORITY_LABELS } from '../../types/scheduleEvent';
import { SCHEDULE_PRIORITY_STYLES } from './scheduleTheme';

interface Props {
  priority: SchedulePriority;
  compact?: boolean;
}

export default function SchedulePriorityBadge({ priority, compact }: Props) {
  const style = SCHEDULE_PRIORITY_STYLES[priority];
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 font-medium ${style.badge} ${
        compact ? 'text-[10px]' : 'text-xs'
      }`}
    >
      {SCHEDULE_PRIORITY_LABELS[priority]}
    </span>
  );
}
