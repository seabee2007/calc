import React, { useMemo } from 'react';
import type { ScheduleEvent } from '../../../../types/scheduleEvent';
import ScheduleCalendarEventChip from '../../ScheduleCalendarEventChip';
import ScheduleCalendarMultiDayBar, { multiDayLaneCount } from '../../ScheduleCalendarMultiDayBar';
import { SCHEDULE_CARD } from '../../scheduleTheme';
import {
  eventsForCalendarCell,
  getMonthGrid,
  layoutMonthWeekMultiDayBars,
  todayIsoDate,
} from '../../../../utils/scheduleEventUtils';

interface Props {
  events: ScheduleEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  year: number;
  month: number;
}

const MAX_SINGLE_DAY = 2;
const LANE_H = 28;

export default function ScheduleCalendarMonthView({
  events,
  selectedId,
  onSelect,
  year,
  month,
}: Props) {
  const weeks = useMemo(() => getMonthGrid(year, month), [year, month]);
  const todayIso = todayIsoDate();

  const weekLayouts = useMemo(
    () =>
      weeks.map((week) => {
        const bars = layoutMonthWeekMultiDayBars(week, events);
        return { week, bars, laneCount: multiDayLaneCount(bars) };
      }),
    [weeks, events],
  );

  return (
    <div className={`${SCHEDULE_CARD} flex min-h-0 flex-1 flex-col overflow-hidden`}>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100 text-center text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {weekLayouts.map(({ week, bars, laneCount }, wi) => {
          const rowTemplate =
            laneCount > 0
              ? `repeat(${laneCount}, ${LANE_H}px) minmax(100px, auto)`
              : 'minmax(100px, auto)';

          return (
            <div
              key={wi}
              className="grid grid-cols-7 border-b border-slate-200 last:border-0 dark:border-slate-700"
              style={{ gridTemplateRows: rowTemplate }}
            >
              {laneCount > 0 &&
                bars.map((bar) => (
                  <ScheduleCalendarMultiDayBar
                    key={`${bar.event.id}-w${wi}-${bar.startColumnIndex}-${bar.lane}`}
                    event={bar.event}
                    selected={selectedId === bar.event.id}
                    onClick={() => onSelect(bar.event.id)}
                    gridColumn={`${bar.startColumnIndex + 1} / span ${bar.spanColumns}`}
                    gridRow={bar.lane + 1}
                    showTypeBadge
                  />
                ))}
              {week.map((iso, di) => {
                if (!iso) {
                  return (
                    <div
                      key={`empty-${wi}-${di}`}
                      className="min-h-[100px] bg-slate-50 dark:bg-slate-900/30"
                      style={{ gridColumn: di + 1, gridRow: laneCount > 0 ? laneCount + 1 : 1 }}
                    />
                  );
                }
                const dayEvents = eventsForCalendarCell(events, iso);
                const dayNum = parseInt(iso.slice(8), 10);
                const isToday = iso === todayIso;
                const overflow = dayEvents.length - MAX_SINGLE_DAY;
                return (
                  <div
                    key={iso}
                    className={`min-h-[100px] border-r border-slate-200 bg-white p-1 last:border-r-0 dark:border-slate-700 dark:bg-slate-950 ${
                      isToday
                        ? 'z-[1] !bg-blue-50 ring-2 ring-inset ring-blue-500 text-blue-700 dark:!bg-blue-950/40 dark:ring-blue-400 dark:text-blue-300'
                        : ''
                    }`}
                    style={{ gridColumn: di + 1, gridRow: laneCount > 0 ? laneCount + 1 : 1 }}
                  >
                    <span
                      className={
                        isToday
                          ? 'inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-blue-500 bg-blue-50 text-xs font-semibold text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'text-xs font-medium text-slate-700 dark:text-slate-300'
                      }
                      aria-current={isToday ? 'date' : undefined}
                    >
                      {dayNum}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, MAX_SINGLE_DAY).map((e) => (
                        <ScheduleCalendarEventChip
                          key={e.id}
                          event={e}
                          selected={selectedId === e.id}
                          onClick={() => onSelect(e.id)}
                          compact
                        />
                      ))}
                      {overflow > 0 && (
                        <button
                          type="button"
                          className="w-full text-left text-[10px] font-medium text-[#2563EB] hover:underline"
                          onClick={() =>
                            dayEvents[MAX_SINGLE_DAY] && onSelect(dayEvents[MAX_SINGLE_DAY].id)
                          }
                        >
                          +{overflow} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
