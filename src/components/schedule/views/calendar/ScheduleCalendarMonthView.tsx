import React, { useMemo } from 'react';
import type { ScheduleEvent } from '../../../../types/scheduleEvent';
import ScheduleCalendarEventChip from '../../ScheduleCalendarEventChip';
import ScheduleCalendarMultiDayBar, { multiDayLaneCount } from '../../ScheduleCalendarMultiDayBar';
import { SCHEDULE_CARD } from '../../scheduleTheme';
import { isScheduleInteractiveTarget } from '../../../../utils/scheduleTouchInteraction';
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
  onCreateAtDate?: (date: string) => void;
}

const MAX_SINGLE_DAY = 2;
const DAY_NUMBER_HEIGHT = 28;
const DATE_EVENT_GAP = 8;
const LANE_H = 26;
const LANE_GAP = 2;
const MULTI_DAY_TOP = DAY_NUMBER_HEIGHT + DATE_EVENT_GAP;

function multiDayLanesHeight(laneCount: number): number {
  if (laneCount <= 0) return 0;
  return laneCount * LANE_H + (laneCount - 1) * LANE_GAP;
}

export default function ScheduleCalendarMonthView({
  events,
  selectedId,
  onSelect,
  year,
  month,
  onCreateAtDate,
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

  const handleDayCellClick = (iso: string, event: React.MouseEvent<HTMLDivElement>) => {
    if (!onCreateAtDate) return;
    if (isScheduleInteractiveTarget(event.target)) return;
    onCreateAtDate(iso);
  };

  const dayCellInteractiveClass = onCreateAtDate
    ? 'cursor-pointer transition-colors hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-900/80 dark:active:bg-slate-800/80'
    : '';

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
          const lanesHeight = multiDayLanesHeight(laneCount);

          return (
            <div
              key={wi}
              className="relative grid grid-cols-7 border-b border-slate-200 last:border-0 dark:border-slate-700"
            >
              {laneCount > 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-[5]"
                  style={{ top: MULTI_DAY_TOP, height: lanesHeight }}
                >
                  {bars.map((bar) => (
                    <div
                      key={`${bar.event.id}-w${wi}-${bar.startColumnIndex}-${bar.lane}`}
                      className="pointer-events-auto absolute px-0.5"
                      style={{
                        left: `${(bar.startColumnIndex / 7) * 100}%`,
                        width: `${(bar.spanColumns / 7) * 100}%`,
                        top: bar.lane * (LANE_H + LANE_GAP),
                        height: LANE_H,
                      }}
                    >
                      <ScheduleCalendarMultiDayBar
                        event={bar.event}
                        selected={selectedId === bar.event.id}
                        onClick={() => onSelect(bar.event.id)}
                        showTypeBadge
                        fillCell
                      />
                    </div>
                  ))}
                </div>
              )}
              {week.map((iso, di) => {
                if (!iso) {
                  return (
                    <div
                      key={`empty-${wi}-${di}`}
                      className="min-h-[120px] bg-slate-50 dark:bg-slate-900/30"
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
                    onClick={(event) => handleDayCellClick(iso, event)}
                    className={`relative flex min-h-[120px] flex-col overflow-hidden border-r border-slate-200 bg-white last:border-r-0 dark:border-slate-700 dark:bg-slate-950 ${dayCellInteractiveClass} ${
                      isToday
                        ? 'z-[1] !bg-blue-50 ring-2 ring-inset ring-blue-500 text-blue-700 dark:!bg-blue-950/40 dark:ring-blue-400 dark:text-blue-300'
                        : ''
                    }`}
                  >
                    <div
                      className="relative z-10 shrink-0 px-2 pt-2 text-xs"
                      style={{ minHeight: DAY_NUMBER_HEIGHT }}
                    >
                      <span
                        className={
                          isToday
                            ? 'inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-blue-500 bg-blue-50 text-xs font-semibold text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300'
                            : 'font-medium text-slate-700 dark:text-slate-300'
                        }
                        aria-current={isToday ? 'date' : undefined}
                      >
                        {dayNum}
                      </span>
                    </div>

                    <div
                      className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-1.5 pb-1.5"
                      style={{ paddingTop: lanesHeight > 0 ? lanesHeight : undefined }}
                    >
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
                          data-schedule-event="true"
                          data-no-swipe="true"
                          className="w-full min-w-0 truncate text-left text-[10px] font-medium text-[#2563EB] hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (dayEvents[MAX_SINGLE_DAY]) {
                              onSelect(dayEvents[MAX_SINGLE_DAY].id);
                            }
                          }}
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
