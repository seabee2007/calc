import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import OpsCard from '../OpsCard';
import { OPS_BODY, OPS_MUTED, OPS_TITLE } from '../opsTheme';
import type { ScheduleEvent } from '../../../types/scheduleEvent';
import { formatScheduleTime } from '../../../utils/scheduleEventUtils';
import { plannerScheduleHubHref } from '../../../utils/plannerRoutes';

interface Props {
  events: ScheduleEvent[];
}

export default function ScheduleTodayCard({ events }: Props) {
  const navigate = useNavigate();
  const preview = events.slice(0, 4);

  return (
    <OpsCard>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={OPS_TITLE}>Today on schedule</p>
          <p className={`mt-1 text-2xl font-semibold ${OPS_BODY}`}>{events.length}</p>
        </div>
        <Calendar className="h-5 w-5 text-cyan-500" />
      </div>
      {preview.length > 0 ? (
        <ul className={`mt-3 space-y-2 text-sm ${OPS_MUTED}`}>
          {preview.map((e) => (
            <li key={e.id} className="truncate">
              {e.startTime ? formatScheduleTime(e.startTime) + ' · ' : ''}
              {e.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-3 text-sm ${OPS_MUTED}`}>No events scheduled for today.</p>
      )}
      <button
        type="button"
        className="mt-4 text-sm font-medium text-cyan-600 hover:underline dark:text-cyan-400"
        onClick={() => navigate(plannerScheduleHubHref({ view: 'calendar', cal: 'day' }))}
      >
        Open calendar
      </button>
    </OpsCard>
  );
}
