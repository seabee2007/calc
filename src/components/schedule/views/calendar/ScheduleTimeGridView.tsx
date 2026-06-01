import React, { useMemo, useRef } from 'react';
import type { ScheduleEvent } from '../../../../types/scheduleEvent';
import ScheduleCalendarEventBlock from '../../ScheduleCalendarEventBlock';
import ScheduleCalendarEventChip from '../../ScheduleCalendarEventChip';
import ScheduleCalendarMultiDayBar, { multiDayLaneCount } from '../../ScheduleCalendarMultiDayBar';
import {
  DEFAULT_GRID_DAY_END_HOUR,
  DEFAULT_GRID_DAY_START_HOUR,
  DEFAULT_GRID_SLOT_HEIGHT_PX,
  DEFAULT_GRID_SLOT_MINUTES,
  dayLabel,
  layoutTimedEventsForDay,
  slotIndexToTimes,
  splitTimedAndAllDay,
  splitEventsForTimeGrid,
  toIsoDate,
} from '../../../../utils/scheduleEventUtils';
import {
  evaluateHorizontalSwipe,
  isScheduleInteractiveTarget,
  isTapGesture,
  type TouchPoint,
} from '../../../../utils/scheduleTouchInteraction';
import { SCHEDULE_CARD, SCHEDULE_MUTED } from '../../scheduleTheme';

export interface ScheduleCreateAtSlotPayload {
  date: string;
  startTime: string;
  endTime: string;
}

interface Props {
  events: ScheduleEvent[];
  days: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateAtSlot?: (payload: ScheduleCreateAtSlotPayload) => void;
  enableHeaderSwipe?: boolean;
  onPeriodShift?: (direction: -1 | 1) => void;
  lastSwipeAtRef?: React.MutableRefObject<number>;
}

function formatHourLabel(h: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12} ${ampm}`;
}

export default function ScheduleTimeGridView({
  events,
  days,
  selectedId,
  onSelect,
  onCreateAtSlot,
  enableHeaderSwipe = false,
  onPeriodShift,
  lastSwipeAtRef,
}: Props) {
  const startHour = DEFAULT_GRID_DAY_START_HOUR;
  const endHour = DEFAULT_GRID_DAY_END_HOUR;
  const slotMinutes = DEFAULT_GRID_SLOT_MINUTES;
  const slotHeightPx = DEFAULT_GRID_SLOT_HEIGHT_PX;
  const slotCount = ((endHour - startHour) * 60) / slotMinutes;
  const gridHeight = slotCount * slotHeightPx;
  const slotsPerHour = 60 / slotMinutes;
  const hourRowHeight = slotHeightPx * slotsPerHour;

  const headerSwipeStartRef = useRef<TouchPoint | null>(null);
  const slotTouchStartRef = useRef<{ x: number; y: number; slotIndex: number } | null>(null);
  const localSwipeAtRef = useRef(0);
  const swipeCooldownRef = lastSwipeAtRef ?? localSwipeAtRef;

  const { multiDayBars, daySingleEvents } = useMemo(
    () => splitEventsForTimeGrid(events, days),
    [events, days],
  );

  const multiLaneCount = multiDayLaneCount(multiDayBars);
  const gridCols = `56px repeat(${days.length}, minmax(100px, 1fr))`;

  const dayData = useMemo(() => {
    return days.map((iso) => {
      const dayEvents = daySingleEvents.get(iso) ?? [];
      const { allDay, timed } = splitTimedAndAllDay(dayEvents);
      const layouts = layoutTimedEventsForDay(timed, {
        dayStartHour: startHour,
        dayEndHour: endHour,
        slotMinutes,
        slotHeightPx,
      });
      return { iso, allDay, layouts };
    });
  }, [days, daySingleEvents, startHour, endHour, slotMinutes, slotHeightPx]);

  const hasAllDay = dayData.some((d) => d.allDay.length > 0);
  const showMultiLane = multiDayBars.length > 0;

  const slotTimesForIndex = (slotIndex: number) =>
    slotIndexToTimes(slotIndex, {
      dayStartHour: startHour,
      dayEndHour: endHour,
      slotMinutes,
    });

  const handleSlotActivate = (iso: string, slotIndex: number) => {
    if (!onCreateAtSlot) return;
    const { startTime, endTime } = slotTimesForIndex(slotIndex);
    onCreateAtSlot({ date: iso, startTime, endTime });
  };

  const handleHeaderTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!enableHeaderSwipe || !onPeriodShift || event.touches.length !== 1) {
      headerSwipeStartRef.current = null;
      return;
    }
    if (isScheduleInteractiveTarget(event.target)) {
      headerSwipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    headerSwipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  };

  const handleHeaderTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = headerSwipeStartRef.current;
    headerSwipeStartRef.current = null;
    if (!enableHeaderSwipe || !onPeriodShift || !start || event.changedTouches.length === 0) {
      return;
    }
    if (isScheduleInteractiveTarget(event.target)) return;

    const touch = event.changedTouches[0];
    const direction = evaluateHorizontalSwipe(
      start,
      { x: touch.clientX, y: touch.clientY },
      swipeCooldownRef.current,
    );
    if (direction == null) return;

    swipeCooldownRef.current = Date.now();
    onPeriodShift(direction);
  };

  const slotInteractiveClass = onCreateAtSlot
    ? 'z-0 cursor-pointer transition-colors hover:bg-blue-50/50 active:bg-blue-100/60 dark:hover:bg-blue-950/25 dark:active:bg-blue-950/40'
    : 'z-0 pointer-events-none';

  return (
    <div className={`${SCHEDULE_CARD} flex min-h-0 flex-1 flex-col overflow-hidden`}>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <div
          data-schedule-swipe-zone="true"
          className="sticky top-0 z-20 grid border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(100px, 1fr))` }}
          onTouchStart={enableHeaderSwipe ? handleHeaderTouchStart : undefined}
          onTouchEnd={enableHeaderSwipe ? handleHeaderTouchEnd : undefined}
        >
          <div className="border-r border-slate-200 dark:border-slate-700" />
          {days.map((iso) => {
            const isToday = iso === toIsoDate(new Date());
            return (
              <div
                key={iso}
                className={`border-r border-slate-200 px-2 py-2 text-center last:border-r-0 dark:border-slate-700 ${
                  isToday ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : ''
                }`}
              >
                <p
                  className={`text-xs font-semibold ${isToday ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-slate-200'}`}
                >
                  {dayLabel(iso)}
                </p>
              </div>
            );
          })}
        </div>

        {showMultiLane && (
          <div
            className="grid gap-1 border-b border-slate-200 bg-slate-50 px-0.5 py-1 dark:border-slate-700 dark:bg-slate-900/80"
            style={{
              gridTemplateColumns: gridCols,
              gridTemplateRows: `repeat(${multiLaneCount}, minmax(28px, auto))`,
            }}
          >
            <div
              className={`row-span-full flex items-start border-r border-slate-200 px-1 pt-1 text-[10px] font-medium ${SCHEDULE_MUTED} dark:border-slate-700`}
              style={{ gridRow: `1 / span ${multiLaneCount}` }}
            >
              Multi-day
            </div>
            {multiDayBars.map((bar) => (
              <ScheduleCalendarMultiDayBar
                key={`${bar.event.id}-${bar.startColumnIndex}-${bar.lane}`}
                event={bar.event}
                selected={selectedId === bar.event.id}
                onClick={() => onSelect(bar.event.id)}
                gridColumn={`${bar.startColumnIndex + 2} / span ${bar.spanColumns}`}
                gridRow={bar.lane + 1}
              />
            ))}
          </div>
        )}

        {hasAllDay && (
          <div
            className="grid border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div
              className={`flex items-center border-r border-slate-200 px-1 text-[10px] font-medium ${SCHEDULE_MUTED} dark:border-slate-700`}
            >
              All day
            </div>
            {dayData.map(({ iso, allDay }) => (
              <div
                key={`allday-${iso}`}
                className="min-h-[48px] space-y-1 border-r border-slate-200 bg-white p-1 last:border-r-0 dark:border-slate-700 dark:bg-slate-900"
              >
                {allDay.map((e) => (
                  <ScheduleCalendarEventChip
                    key={e.id}
                    event={e}
                    selected={selectedId === e.id}
                    onClick={() => onSelect(e.id)}
                    compact
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        <div
          className="grid flex-1"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(100px, 1fr))` }}
        >
          <div
            className="relative border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            style={{ height: gridHeight }}
          >
            {Array.from({ length: endHour - startHour }).map((_, i) => (
              <div
                key={i}
                className={`absolute left-0 right-0 border-b border-slate-200 px-1 text-right text-[10px] ${SCHEDULE_MUTED} dark:border-slate-700`}
                style={{ top: i * hourRowHeight, height: hourRowHeight }}
              >
                {formatHourLabel(startHour + i)}
              </div>
            ))}
          </div>

          {dayData.map(({ iso, layouts }) => (
            <div
              key={`grid-${iso}`}
              className="relative border-r border-slate-200 bg-white last:border-r-0 dark:border-slate-700 dark:bg-slate-900"
              style={{ height: gridHeight }}
            >
              {onCreateAtSlot &&
                Array.from({ length: slotCount }).map((_, slotIndex) => (
                  <button
                    key={`slot-${slotIndex}`}
                    type="button"
                    aria-label={`Add event on ${dayLabel(iso)}`}
                    className={`absolute left-0 right-0 border-b border-slate-200/70 dark:border-slate-700/60 ${slotInteractiveClass}`}
                    style={{ top: slotIndex * slotHeightPx, height: slotHeightPx }}
                    onClick={() => handleSlotActivate(iso, slotIndex)}
                    onTouchStart={(event) => {
                      if (event.touches.length !== 1) {
                        slotTouchStartRef.current = null;
                        return;
                      }
                      const touch = event.touches[0];
                      slotTouchStartRef.current = {
                        x: touch.clientX,
                        y: touch.clientY,
                        slotIndex,
                      };
                    }}
                    onTouchEnd={(event) => {
                      const start = slotTouchStartRef.current;
                      slotTouchStartRef.current = null;
                      if (!start || start.slotIndex !== slotIndex || event.changedTouches.length === 0) {
                        return;
                      }
                      const touch = event.changedTouches[0];
                      if (!isTapGesture(start, { x: touch.clientX, y: touch.clientY })) return;
                      event.preventDefault();
                      handleSlotActivate(iso, slotIndex);
                    }}
                  />
                ))}
              {!onCreateAtSlot &&
                Array.from({ length: slotCount }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-b border-slate-200/70 dark:border-slate-700/60"
                    style={{ top: i * slotHeightPx, height: slotHeightPx }}
                  />
                ))}
              {layouts.map(({ event, topPx, heightPx }) => (
                <ScheduleCalendarEventBlock
                  key={event.id}
                  event={event}
                  selected={selectedId === event.id}
                  onClick={() => onSelect(event.id)}
                  style={{ top: topPx, height: heightPx }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
