import React from 'react';
import type { ScheduleEvent } from '../../types/scheduleEvent';
import { SCHEDULE_EVENT_TYPE_LABELS } from '../../types/scheduleEvent';
import { SCHEDULE_EVENT_TYPE_STYLES } from './scheduleTheme';
import ScheduleStatusBadge from './ScheduleStatusBadge';
import { statusAccentClass } from '../../utils/scheduleEventUtils';
import { logScheduleTouchDebug } from '../../utils/scheduleTouchInteraction';

interface Props {
  event: ScheduleEvent;
  selected?: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
}

export default function ScheduleCalendarEventBlock({
  event,
  selected,
  onClick,
  style,
}: Props) {
  const typeStyle = SCHEDULE_EVENT_TYPE_STYLES[event.eventType];
  const isOrangeDelivery = event.eventType === 'material_delivery' || event.eventType === 'equipment_delivery';
  const titleColor = isOrangeDelivery
    ? 'text-orange-900 dark:text-orange-100'
    : 'text-[#1F2937] dark:text-slate-100';
  const subtitleColor = isOrangeDelivery
    ? 'text-orange-700 dark:text-orange-200'
    : 'text-[#4B5563] dark:text-slate-300';
  const metaColor = isOrangeDelivery
    ? 'text-orange-700/80 dark:text-orange-200/80'
    : 'text-[#6B7280] dark:text-slate-400';

  return (
    <button
      type="button"
      data-schedule-event="true"
      data-no-swipe="true"
      onClick={(e) => {
        e.stopPropagation();
        logScheduleTouchDebug('event block clicked', { id: event.id });
        onClick();
      }}
      style={style}
      className={`pointer-events-auto absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-md border p-1.5 text-left shadow-sm ${typeStyle.surface} ${statusAccentClass(
        event.status,
      )} ${selected ? 'ring-2 ring-[#2563EB]' : 'hover:shadow-md'}`}
    >
      <div className={`mb-0.5 h-1 w-full rounded-full ${typeStyle.dot}`} />
      <p className={`truncate text-[11px] font-semibold ${titleColor}`}>
        {event.title}
      </p>
      <p className={`truncate text-[10px] ${subtitleColor}`}>
        {event.projectName}
      </p>
      {event.trade && (
        <p className={`truncate text-[10px] ${metaColor}`}>{event.trade}</p>
      )}
      <div className="mt-0.5">
        <ScheduleStatusBadge status={event.status} compact />
      </div>
    </button>
  );
}
