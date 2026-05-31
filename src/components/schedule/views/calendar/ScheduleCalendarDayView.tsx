import React, { useMemo } from 'react';
import type { ScheduleEvent } from '../../../../types/scheduleEvent';
import type { Project } from '../../../../types';
import ScheduleTimeGridView from './ScheduleTimeGridView';
import { dayOperationalSummary } from '../../../../utils/scheduleEventUtils';
import { SCHEDULE_CARD, SCHEDULE_BODY, SCHEDULE_MUTED } from '../../scheduleTheme';

interface Props {
  events: ScheduleEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  anchorIso: string;
  projectForWeather?: Project | null;
}

export default function ScheduleCalendarDayView({
  events,
  selectedId,
  onSelect,
  anchorIso,
  projectForWeather,
}: Props) {
  const dayIso = anchorIso;
  const summary = useMemo(
    () => dayOperationalSummary(events, dayIso),
    [events, dayIso],
  );
  const forecast = projectForWeather?.calculations?.[0]?.weather?.forecast?.[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="grid shrink-0 gap-2 sm:grid-cols-2">
        <div className={`${SCHEDULE_CARD} p-3`}>
          <p className={`text-xs font-semibold uppercase ${SCHEDULE_MUTED}`}>Operations</p>
          <p className={`mt-1 text-sm ${SCHEDULE_BODY}`}>
            {summary.total} events · {summary.crews} crews · {summary.deliveries} deliveries ·{' '}
            {summary.inspections} inspections · {summary.deadlines} deadlines
          </p>
        </div>
        <div className={`${SCHEDULE_CARD} p-3`}>
          <p className={`text-xs font-semibold uppercase ${SCHEDULE_MUTED}`}>Weather</p>
          {forecast ? (
            <p className={`mt-1 text-sm ${SCHEDULE_BODY}`}>
              {forecast.tempMax ?? forecast.tempMin ?? '—'}° · {forecast.precipitation ?? 0}% rain
            </p>
          ) : (
            <p className={`mt-1 text-sm ${SCHEDULE_MUTED}`}>
              Select a project filter for saved forecast.
            </p>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <ScheduleTimeGridView
          events={events}
          days={[dayIso]}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}
