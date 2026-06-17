import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import OpsCard from '../OpsCard';
import { OPS_BODY, OPS_MUTED, OPS_TITLE } from '../opsTheme';
import type { ScheduleEvent } from '../../../types/scheduleEvent';
import { formatScheduleDate } from '../../../utils/scheduleEventUtils';
import { plannerScheduleHubHref } from '../../../utils/plannerRoutes';

interface Props {
  deadlines: ScheduleEvent[];
}

export default function ScheduleDeadlinesCard({ deadlines }: Props) {
  const navigate = useNavigate();
  const preview = deadlines.slice(0, 4);

  return (
    <OpsCard nested>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={OPS_TITLE}>Upcoming deadlines</p>
          <p className={`mt-1 text-2xl font-semibold ${OPS_BODY}`}>{deadlines.length}</p>
        </div>
        <AlertCircle className="h-5 w-5 text-amber-500" />
      </div>
      {preview.length > 0 ? (
        <ul className={`mt-3 space-y-2 text-sm ${OPS_MUTED}`}>
          {preview.map((e) => (
            <li key={e.id} className="truncate">
              {formatScheduleDate(e.startDate)} · {e.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-3 text-sm ${OPS_MUTED}`}>No deadlines in the next two weeks.</p>
      )}
      <button
        type="button"
        className="mt-4 text-sm font-medium text-cyan-600 hover:underline dark:text-cyan-400"
        onClick={() => navigate(plannerScheduleHubHref({ view: 'list' }))}
      >
        View schedule
      </button>
    </OpsCard>
  );
}
